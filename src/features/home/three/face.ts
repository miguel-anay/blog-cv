import { CanvasTexture, MeshBasicMaterial, NearestFilter, SRGBColorSpace } from "three";

// Eyes and eyebrows for the avatar.
//
// The GLB ships a dedicated `face` node: a 121-vertex (11x11) plane curved onto
// the front of the head, carrying its own UV set. It has NO geometry for the
// features themselves and no material (the GLB ships zero materials) — the
// features are meant to arrive as a TEXTURE on that plane. Until now the node
// was caught by SKIN_NODES in avatar.ts and painted with the skin matcap, which
// is why the avatar read as blank-faced: the plane was there, correctly placed,
// tinted the exact colour of the head behind it.
//
// The reference portfolio (davidhckh/portfolio-2025) drives this plane from a
// 4x4 sprite sheet of hand-drawn expressions. That sheet is a third-party asset
// under the same restrictive licence as the GLB, and it is DAVID'S FACE — so it
// is deliberately not used here. The atlas is drawn in-process instead: no
// binary asset to ship or license, and the features become tunable constants.

// One row of blink frames. Four is what the eye needs to read a blink as motion
// rather than a flicker; more frames is wasted canvas.
const FRAMES = 4;
const FRAME_SIZE = 256;

// Openness per frame, 1 = wide open. The last frame is not fully 0: a hairline
// of lash reads as a closed eye, whereas true zero makes the face vanish for a
// frame and looks like a dropped draw.
const OPENNESS = [1, 0.6, 0.25, 0.06];

const INK = "#14171c"; // matches the `black` matcap tone; features read as one material with the shoes/hair

// Feature placement, in tile-normalised coordinates (0..1 across the plane's
// own UV, NOT world units). Retune these — not the model — to move the eyes.
const EYE_X = 0.33; // distance from the tile's vertical centre line, mirrored
const EYE_Y = 0.54;
const EYE_RX = 0.072;
const EYE_RY = 0.1;

const BROW_Y = 0.36;
const BROW_HALF_WIDTH = 0.1;
const BROW_THICKNESS = 0.042;
// Outer end sits LOWER than the inner end. The sign is paired with flipY in
// buildAtlas: invert one without the other and the brows angle inward-down,
// which reads as a scowl rather than a neutral face.
// Near-flat on purpose: at 0.028 the face read as a scowl in one direction
// and as worry in the other. Neutral lives close to horizontal.
const BROW_TILT = 0.009;

// Blink cadence. Real blinks are fast and asymmetric — the close is roughly
// half the duration of the open, which is what stops it reading as a mechanical
// pulse. Interval is randomised so two page loads never blink in lockstep.
const BLINK_MIN_GAP = 3;
const BLINK_MAX_GAP = 6;
const CLOSE_TIME = 0.12;
const OPEN_TIME = 0.2;

let texture: CanvasTexture | null = null;
let material: MeshBasicMaterial | null = null;
let sinceBlink = 0;
let blinkAt = BLINK_MIN_GAP;
let currentFrame = -1;

const nextGap = (): number => BLINK_MIN_GAP + Math.random() * (BLINK_MAX_GAP - BLINK_MIN_GAP);

function drawEye(ctx: CanvasRenderingContext2D, cx: number, cy: number, openness: number): void {
  const rx = EYE_RX * FRAME_SIZE;
  const ry = Math.max(EYE_RY * FRAME_SIZE * openness, 1.5); // floor keeps a closed eye a visible line
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, sign: number): void {
  const half = BROW_HALF_WIDTH * FRAME_SIZE;
  const tilt = BROW_TILT * FRAME_SIZE;
  ctx.beginPath();
  ctx.lineWidth = BROW_THICKNESS * FRAME_SIZE;
  ctx.lineCap = "round";
  // `sign` mirrors the tilt so both brows slope away from the nose rather than
  // both leaning the same way, which reads as a smirk.
  ctx.moveTo(cx - half * sign, cy - tilt);
  ctx.lineTo(cx + half * sign, cy + tilt);
  ctx.stroke();
}

function buildAtlas(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE * FRAMES;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;

  for (let i = 0; i < FRAMES; i++) {
    const originX = i * FRAME_SIZE;
    const openness = OPENNESS[i]!;
    for (const side of [-1, 1]) {
      const cx = originX + (0.5 + side * (EYE_X - 0.5) * -1) * FRAME_SIZE;
      drawEye(ctx, cx, EYE_Y * FRAME_SIZE, openness);
      // Brows ride slightly with the lid so a blink moves the whole brow-eye
      // group a hair, instead of leaving the brows floating over shut eyes.
      drawBrow(ctx, cx, (BROW_Y + (1 - openness) * 0.012) * FRAME_SIZE, side);
    }
  }

  const tex = new CanvasTexture(canvas);
  // MEASURED, not assumed. glTF UV convention (top-left origin) implies
  // flipY = false, but this plane's UVs run the other way: with flipY = false
  // the eyebrows render BELOW the eyes and read as a mouth. Keep the three.js
  // default. If the face ever ships upside down, this is the line.
  tex.flipY = true;
  tex.colorSpace = SRGBColorSpace;
  tex.generateMipmaps = false;
  // Nearest keeps the ink edges crisp; the plane is small on screen and linear
  // filtering across the tile seam would bleed the neighbouring frame in.
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.repeat.set(1 / FRAMES, 1);
  return tex;
}

function setFrame(index: number): void {
  if (!texture || index === currentFrame) return;
  currentFrame = index;
  texture.offset.x = index / FRAMES;
}

export const face = {
  /** Builds the plane's material. Caller owns disposal via avatar's `meshes`. */
  createMaterial(): MeshBasicMaterial {
    texture = buildAtlas();
    material = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      // The plane is coincident with the head shell it sits on, so depth
      // testing would z-fight along the whole silhouette. Backface culling
      // (FrontSide, the default) still hides it once the head turns away, so
      // disabling the test does NOT let the face show through the back of the
      // skull as the avatar swivels out of the chair.
      depthTest: false,
      depthWrite: false,
    });
    setFrame(0);
    return material;
  },

  tick(dt: number): void {
    if (!texture) return;
    sinceBlink += dt;
    const into = sinceBlink - blinkAt;
    if (into < 0) {
      setFrame(0);
      return;
    }
    if (into >= CLOSE_TIME + OPEN_TIME) {
      sinceBlink = 0;
      blinkAt = nextGap();
      setFrame(0);
      return;
    }
    // Closing runs forward through the frames, opening runs back out.
    const t =
      into < CLOSE_TIME ? into / CLOSE_TIME : 1 - (into - CLOSE_TIME) / OPEN_TIME;
    setFrame(Math.min(FRAMES - 1, Math.round(t * (FRAMES - 1))));
  },

  destroy(): void {
    texture?.dispose(); // material itself is disposed with the rest via avatar's `meshes`
    texture = null;
    material = null;
    sinceBlink = 0;
    blinkAt = BLINK_MIN_GAP;
    currentFrame = -1;
  },
};
