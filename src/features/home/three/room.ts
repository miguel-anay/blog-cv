import {
  Mesh,
  MeshBasicMaterial,
  CanvasTexture,
  TextureLoader,
  RepeatWrapping,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  type Texture,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import { musicNotes } from "./musicNotes";
import {
  phase2Progress,
  standRiseForProgress,
  turnProgress,
  AVATAR_POSITION,
  AVATAR_SCALE,
  SCENE_YAW,
} from "./avatar";

// Eval-spike asset only. Third-party, restrictive license, redistribution NOT
// granted — this file must never be committed. See .gitignore: public/models/_eval/.
const MODEL_URL = "/models/_eval/room.glb";
const COLOR_MAP_URL = "/models/_eval/room.webp";
// The two monitor faces are NOT part of the room bake — they have their own
// atlas, which is why they came out reading as wall texture while every other
// surface looked right. Same split the reference uses (room-texture vs
// desktops-texture), and the same LinearSRGBColorSpace on it: skipping the
// sRGB decode is what makes the screens read as emissive next to the matte room.
const DESKTOPS_MAP_URL = "/models/_eval/desktops.webp";
const SHADOW_MESH_NAME = "shadow-catcher";
// Left screen is the one that scrolls; the right one holds the chat frame.
const SCROLL_SCREEN_NAME = "desktop-plane-0";
const SCREEN_NAMES = new Set([SCROLL_SCREEN_NAME, "desktop-plane-1"]);
const CHAIR_NAME = "chair";
const RADIO_NAME = "music";

// How far up the desk travels during phase 2, in world units. The camera sits
// ~11 units from the desk at a 38° vertical FOV, so the visible half-height
// there is ~11·tan(19°) ≈ 3.8 — 10 clears the top of frame with margin to
// spare, including the chair back. Raise it if the camera is ever pulled back.
const ROOM_RISE = 10;

// How far the chair swings as the figure gets out of it, and how far it tumbles
// once the desk climbs away. Reference magnitudes (portfolio-2025's
// `chairScrollRotation`), which are absolute: the GLB authors the chair at zero
// rotation, so these are written straight onto it rather than added.
//
// The swivel sign tracks the figure's own turn: `rotationYForProgress` runs
// SCENE_YAW -> SCENE_YAW - PI, i.e. y DECREASING (a right turn — three.js
// rotates counter-clockwise about +Y from above). Get this backwards and the
// seat spins away from him instead of with him. Change avatar.ts's
// ROTATION_STANDING and this has to change with it.
const CHAIR_SWIVEL_Y = -1.1;
const CHAIR_TUMBLE_X = -0.9;
const CHAIR_TUMBLE_Z = -1.3;

// Screen scroll: a nudge every few seconds, eased toward over ~1s, so the left
// monitor reads as being read rather than as a still. Range and cadence match
// the reference's random `scroll()`; it drives the texture offset instead of a
// shader uniform because a plain map offset does the same UV shift for free.
const SCROLL_MIN_INTERVAL = 3;
const SCROLL_MAX_INTERVAL = 5;
const SCROLL_EASE = 2.5;

let root: Object3D | null = null;
let colorMap: Texture | null = null;
let desktopsMap: Texture | null = null;
let shadowTexture: CanvasTexture | null = null;
let chair: Object3D | null = null;
let scrollScreen: Texture | null = null;
let scrollTarget = 0;
let scrollTimer = SCROLL_MIN_INTERVAL;
const meshes: Mesh[] = [];

// Small radial-alpha lookup so the shadow-catcher reads as a soft contact
// shadow under the chair rather than a hard-edged dark rectangle. No real
// shadow maps — this scene has zero lights (see stage.ts).
function createShadowTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0.45)");
  gradient.addColorStop(0.7, "rgba(0,0,0,0.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function applyMaterials(scene: Object3D): void {
  shadowTexture = createShadowTexture();
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;

    // Dispose whatever default material GLTFLoader assigned (the GLB ships zero materials).
    const old = obj.material;
    if (Array.isArray(old)) old.forEach((m) => m.dispose());
    else old?.dispose();

    if (obj.name === SHADOW_MESH_NAME) {
      obj.material = new MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false,
      });
    } else if (SCREEN_NAMES.has(obj.name)) {
      // The scrolling screen gets its OWN copy of the atlas: offset lives on
      // the texture, so sharing one would drag the other screen's UVs along
      // with it. Material.dispose() does not touch maps, hence the explicit
      // handle for destroy() to clean up.
      if (obj.name === SCROLL_SCREEN_NAME) {
        scrollScreen = desktopsMap!.clone();
        scrollScreen.needsUpdate = true;
      }
      obj.material = new MeshBasicMaterial({
        map: obj.name === SCROLL_SCREEN_NAME ? scrollScreen : desktopsMap,
      });
    } else {
      obj.material = new MeshBasicMaterial({ map: colorMap });
    }

    meshes.push(obj);
  });
}

export const room = {
  /** Resolves false on any load/parse failure — caller keeps the avatar-only scene. */
  async init(ctx: StageContext): Promise<boolean> {
    let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
    let texture: Texture;
    let screens: Texture;
    try {
      [gltf, texture, screens] = await Promise.all([
        new GLTFLoader().loadAsync(MODEL_URL),
        new TextureLoader().loadAsync(COLOR_MAP_URL),
        new TextureLoader().loadAsync(DESKTOPS_MAP_URL),
      ]);
    } catch {
      return false;
    }

    // Same V-down convention as the room bake below. Repeat wrapping is what
    // lets the scroll offset wrap instead of clamping to a smeared edge row.
    screens.flipY = false;
    screens.colorSpace = LinearSRGBColorSpace;
    screens.wrapS = RepeatWrapping;
    screens.wrapT = RepeatWrapping;
    desktopsMap = screens;

    // room.glb's UVs follow glTF's V-down convention; TextureLoader defaults to
    // flipY=true (bottom-up), so the bake would read upside-down without this.
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    colorMap = texture;

    applyMaterials(gltf.scene);
    root = gltf.scene;
    chair = root.getObjectByName(CHAIR_NAME) ?? null;
    this.resize(ctx.camera.aspect);
    ctx.scene.add(root);

    // Parented to the room, not the scene, so the notes ride the desk's rise
    // and yaw for free instead of needing their own copy of that maths.
    const radio = root.getObjectByName(RADIO_NAME);
    if (radio) {
      try {
        await musicNotes.init(root, radio.position);
      } catch {
        musicNotes.destroy();
      }
    }
    return true;
  },

  resize(_aspect: number): void {
    // room.glb and the avatar are authored at the SAME world origin with no
    // relative offset (desk/chair line up with the seated pose) — so the
    // desk must scale/reposition in lockstep with AVATAR_POSITION/SCALE
    // (avatar.ts's calibration knob), exactly like hologram.ts's clone does.
    if (!root) return;
    const [x, y, z] = AVATAR_POSITION;
    root.position.set(x, y, z);
    root.scale.setScalar(AVATAR_SCALE);
    // Same yaw as the seated avatar — the two only align at zero RELATIVE
    // rotation, so the desk turns with it.
    root.rotation.y = SCENE_YAW;
  },

  tick(_dt: number): void {
    // room.glb ships no animation clips, so the desk's motion is driven straight
    // off scroll, as the sum of the two beats:
    //   phase 1 — `standRiseForProgress`, the SAME term avatar.ts adds to the
    //     figure, so the pair lifts locked together and the avatar never tears
    //     away from the desk it's sitting at.
    //   phase 2 — ROOM_RISE on top, which is the desk's alone: it keeps going
    //     and leaves frame while the avatar holds its height and walks.
    //
    // A rise, not the reference's `group.visible = false`: a hard toggle pops
    // the desk out of existence in one frame, which reads as the scene being
    // torn down rather than the desk leaving. Y is the only channel touched —
    // x/z/scale/yaw stay on resize()'s static values (resize() runs first each
    // frame, so this write always lands on top of a clean base).
    if (!root) return;
    const { weight, progress } = sceneWeights.get("hero");
    if (weight === 0) return;

    musicNotes.tick(_dt, progress);

    // The chair belongs to the figure, not to the desk: it swings out on the
    // SAME ramp that turns him (`turnProgress`), so the seat moves because he
    // pushed it, and only then tumbles away as the desk leaves.
    if (chair) {
      const turn = turnProgress(progress);
      const leaving = phase2Progress(progress);
      chair.rotation.set(CHAIR_TUMBLE_X * leaving, CHAIR_SWIVEL_Y * turn, CHAIR_TUMBLE_Z * leaving);
    }

    if (scrollScreen) {
      scrollTimer -= _dt;
      if (scrollTimer <= 0) {
        scrollTimer = SCROLL_MIN_INTERVAL + Math.random() * (SCROLL_MAX_INTERVAL - SCROLL_MIN_INTERVAL);
        // An ABSOLUTE depth within the reference's +/-0.25 band, not an
        // increment: the screen settles at a new reading position each time and
        // scrolls both ways, and the offset can never drift out of range.
        scrollTarget = Math.random() * 0.5 - 0.25;
      }
      const offset = scrollScreen.offset;
      offset.y += (scrollTarget - offset.y) * Math.min(1, SCROLL_EASE * _dt);
    }

    root.position.y =
      AVATAR_POSITION[1] + standRiseForProgress(progress) + ROOM_RISE * phase2Progress(progress);
  },

  destroy(): void {
    musicNotes.destroy();
    for (const mesh of meshes) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
    meshes.length = 0;

    colorMap?.dispose();
    colorMap = null;
    desktopsMap?.dispose();
    desktopsMap = null;
    scrollScreen?.dispose();
    scrollScreen = null;
    scrollTarget = 0;
    scrollTimer = SCROLL_MIN_INTERVAL;
    chair = null;
    shadowTexture?.dispose();
    shadowTexture = null;

    root?.removeFromParent();
    root = null;
  },
};
