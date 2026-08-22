import {
  Mesh,
  MeshMatcapMaterial,
  CanvasTexture,
  Texture,
  TextureLoader,
  LinearFilter,
  SRGBColorSpace,
  AnimationMixer,
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type Material,
  type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import { face } from "./face";
import { findIslands, groupByIsland, type Island } from "./headSplit";
import { attachGlasses, destroyGlasses } from "./glasses";

// Eval-spike asset only. Third-party (davidhckh), restrictive license, redistribution
// NOT granted — this file must never be committed. See .gitignore: public/models/_eval/.
const MODEL_URL = "/models/_eval/avatar.glb";

type Tone = { base: string; highlight: string; shadow: string };

const TONES: Record<"black" | "gray" | "white" | "skin", Tone> = {
  black: { base: "#161616", highlight: "#3c3c3c", shadow: "#000000" },
  gray: { base: "#8a8a8a", highlight: "#cfcfcf", shadow: "#3f3f3f" },
  white: { base: "#efe9df", highlight: "#ffffff", shadow: "#b7b0a4" },
  skin: { base: "#d9a06c", highlight: "#f2c99a", shadow: "#8c5a37" },
};

// Real matcaps shipped alongside the avatar GLB, keyed the same as TONES.
// Not glTF-embedded — loaded standalone via TextureLoader, so they keep the
// default flipY=true (a matcap is sampled by view-space normal, not mesh UVs;
// flipping it would put the highlight on the wrong side of the sphere lookup).
const MATCAP_URLS: Record<keyof typeof TONES, string> = {
  black: "/models/_eval/matcap-black.webp",
  gray: "/models/_eval/matcap-gray.webp",
  white: "/models/_eval/matcap-white.webp",
  skin: "/models/_eval/matcap-skin.webp",
};

// GLB mesh node names (verified from inspection) that should read as warm skin tone.
//
// `face` is deliberately NOT here. It looks like a skin node by name, but it is
// the 11x11 plane curved over the front of the head that carries the eyes and
// eyebrows (see face.ts). Painting it with the skin matcap is what made the
// avatar read as blank-faced — the features were rendering in the exact colour
// of the head directly behind them.
const SKIN_NODES = new Set(["skin", "head"]);
const FACE_NODE = "face";

// Multiplied into the skin matcap to warm it toward a tanned tone.
//
// MeshMatcapMaterial.color MULTIPLIES the sampled matcap, so it can only ever
// darken — which is exactly right here, and exactly why this trick does NOT
// work for going lighter. The shipped matcap averages #ddad8e over its sampled
// disc (measured, not guessed); this tint lands it near #a5734a while leaving
// the painted highlight and rim falloff intact. To retarget: divide the colour
// you want by #ddad8e, channel by channel.
const SKIN_TINT = 0xFCE3D0;

// Hair reuses the SKIN matcap, tinted much darker, rather than the black one.
// Same reason as SKIN_TINT: the multiply keeps the painted highlight and rim
// falloff, so the hair still catches light. matcap-black is nearly flat and
// would read as a hole in the head.
const HAIR_TINT = 0x554e41;

const HEAD_NODE = "head";

// The `head` node welds hair and facial skin into ONE mesh with ONE material
// slot, so a single tint moved both together. headSplit.ts recovers the
// separate index-buffer islands; these two thresholds sort them.
//
// Expressed as fractions of the head's OWN bounding box, not as world units, so
// the rule survives a rescaled model. Verified by rendering each island in a
// flat debug colour: hair is the crown piece plus the two shells wrapping the
// back of the skull; skin is the face plate and the two ears.
const HAIR_CROWN_FRACTION = 0.9; // an island reaching this high up is hair
const HAIR_BACK_FRACTION = 0.7; // ...or this far back (the model faces -z)

// Base narrative state, driven purely by scroll progress. "seated" holds on
// the looping `idle` clip (measured ~54° knee flexion — genuinely seated).
// "standing-transition" plays the one-shot `wake-up` clip. "standing" holds
// on the looping `contact-idle` clip (~2-8° knee flexion — genuinely
// standing). The seated `left-desktop` typing clip is NOT part of this
// progression anymore — it's a periodic one-shot gesture layered on top of
// "seated" (see scheduleGesture below), so it isn't a State.
export type State = "seated" | "standing-transition" | "standing";

// Progress (0..1) at which the seated→standing narrative resolves and the
// dissolve/camera-pullback/skills-reveal beat starts. Shared by avatar (wipe),
// hologram (crossfade) and camera (waypoint blend) so all three stay locked
// to the same point in the scroll range — single source of truth.
export function stateForProgress(progress: number): State {
  return progress < 0.2 ? "seated" : progress < 0.3 ? "standing-transition" : "standing";
}

// Scroll point where the figure starts turning to hologram.
//
// Deliberately its own constant rather than PHASE2_START, which is what it used
// to share. The two ARE the same beat conceptually — "the figure is up" — but
// PHASE2_START is aliased to ROTATION_END and drives the phase-1 lift, the desk
// leaving frame, the camera pullback, the floor and the label reveal. Reusing it
// meant the dissolve could not be retimed without dragging the whole
// choreography along. This buys a beat of plain scroll after the figure stands,
// before it starts breaking up.
//
// The gap between this and WIPE_END is the whole DURATION of the wipe, so these
// two are the pair to tune: this one sets when it begins, WIPE_END sets how long
// it takes. Push them together and the body flashes to hologram in a few pixels
// of scroll.
const WIPE_START = 0.3;

// Scroll point where the figure is fully hologram.
//
// This used to be WALK_END (0.6), on the rule that the figure must finish
// dissolving by the time it arrives at centre. That rule was really a workaround
// for a different bug: when the wipe ran to 1.0 it was only ~69% done at the
// bottom of the reachable scroll, and because the wipe climbs from the feet the
// missing part was exactly the head — hologram body, solid skin head, and
// permanently so, because there was no scroll left to finish it.
//
// 0.85 is not that bug: the wipe still COMPLETES with room to spare. It just
// keeps going for a beat after the figure has settled, and that beat is what
// buys the slow burn. The head is the last thing to go, so between WALK_END and
// here the figure stands centred with its head still resolving. Deliberate. If
// it ever reads as broken rather than as a transition, pull this back toward
// WALK_END rather than reinstating the old coupling.
//
// CEILING: keep it under 1.0 with room to spare, or the head never finishes and
// the original bug is back.
const WIPE_END = 1;

/**
 * Dissolve ramp: 0 while the figure is solid, 1 when it is fully hologram.
 *
 * Read by BOTH twins — the solid avatar's dissolveUniforms and hologram.ts's
 * uProgress — so they cross over on exactly the same frame. Below WIPE_START it
 * returns 0, which the hologram shader treats as "fully solid" and discards
 * every fragment, so the twin is genuinely off rather than faintly drawn.
 *
 * Both endpoints are this function's own — see WIPE_START/WIPE_END — so the
 * dissolve can be retimed without touching the walk, the camera or the reveals.
 */
export function wipeProgressFor(progress: number): number {
  return clamp01((progress - WIPE_START) / (WIPE_END - WIPE_START));
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// The avatar is seen from behind while seated (facing its desk, away from the
// camera) and turns to face the viewer as it stands. Rotation rides the same
// `progress` scalar that drives wipeProgressFor, over exactly the same window
// as the standing-transition narrative state (0.4-0.6, see stateForProgress)
// so the turn happens while wake-up is actually playing, not before it.
// avatar.glb and room.glb are authored in the same space and only line up at a
// ZERO RELATIVE rotation between them, so any yaw applied to the figure must be
// applied to the desk too — otherwise the avatar spins away from its own chair
// and keyboard. room.ts imports SCENE_YAW for exactly that.
//
// At the authored yaw the figure faces roughly -X, which the camera (on +Z)
// sees side-on. SCENE_YAW turns the whole assembly so the figure faces -Z and
// the camera looks over its shoulder — the reference's hero framing.
export const SCENE_YAW = -Math.PI / 2;

const ROTATION_SEATED = SCENE_YAW;
// Standing turns a further half-turn, out of the desk and toward the camera.
//
// MINUS, not plus: three.js rotates counter-clockwise about +Y seen from above,
// so a positive delta swings the figure to its LEFT. He turns RIGHT, over the
// shoulder the chair is on. The two endpoints are the same facing either way
// (-PI/2 - PI and -PI/2 + PI are both PI/2), so this changes only which way he
// travels to get there — the standing beat lands identically.
// room.ts's CHAIR_SWIVEL_Y follows this sign; flip one and flip both.
const ROTATION_STANDING = SCENE_YAW - Math.PI;
const ROTATION_START = 0;
const ROTATION_END = 0.2;

/**
 * The turn's own ramp: 0 before the figure starts pivoting, 1 once it is up.
 * Deliberately NOT shared with the lift — the pair starts rising from the very
 * first pixel of scroll (see `standRiseForProgress`), while the turn begins at
 * ROTATION_START. Same beat, different windows.
 */
export function turnProgress(progress: number): number {
  return clamp01((progress - ROTATION_START) / (ROTATION_END - ROTATION_START));
}

export function rotationYForProgress(progress: number): number {
  const t = turnProgress(progress);
  return ROTATION_SEATED + (ROTATION_STANDING - ROTATION_SEATED) * t;
}

// Typing gesture: while seated, fire `left-desktop` once every ~7-13s
// (randomised) as long as the hero is fully in view and the tab is visible.
// `gestureTriggerId` is the cross-module sync point — hologram.ts polls it
// via getGestureTriggerId() so both twins play the gesture in the same
// frame instead of scheduling their own independent random timers.
const GESTURE_MIN_MS = 7000;
const GESTURE_MAX_MS = 13000;
let gestureTimer: ReturnType<typeof setTimeout> | null = null;
let gestureTriggerId = 0;

export function getGestureTriggerId(): number {
  return gestureTriggerId;
}

function scheduleGesture(): void {
  const delay = GESTURE_MIN_MS + Math.random() * (GESTURE_MAX_MS - GESTURE_MIN_MS);
  gestureTimer = setTimeout(() => {
    const { weight, progress } = sceneWeights.get("hero");
    if (document.visibilityState === "visible" && weight === 1 && stateForProgress(progress) === "seated") {
      gestureTriggerId++;
    }
    scheduleGesture();
  }, delay);
}

// Height-wipe dissolve uniforms, shared by reference across every mesh's
// compiled shader (see injectDissolve) so a single write here updates all of
// them. uMinY/uMaxY are the avatar's bind-pose vertical extent, computed once
// at load; uProgress <= 0 means "fully visible" (see wipeProgressFor).
const dissolveUniforms = {
  uProgress: { value: 0 },
  uMinY: { value: 0 },
  uMaxY: { value: 0 },
};

export function getVerticalExtent(): { minY: number; maxY: number } {
  return { minY: dissolveUniforms.uMinY.value, maxY: dissolveUniforms.uMaxY.value };
}

function computeVerticalExtent(scene: Object3D): { minY: number; maxY: number } {
  let minY = Infinity;
  let maxY = -Infinity;
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    obj.geometry.computeBoundingBox();
    const box = obj.geometry.boundingBox;
    if (!box) return;
    minY = Math.min(minY, box.min.y);
    maxY = Math.max(maxY, box.max.y);
  });
  return { minY, maxY };
}

// Wires the bottom-to-top wipe into MeshMatcapMaterial via onBeforeCompile
// instead of a from-scratch ShaderMaterial: matcap shading + skinning are
// already correct in the built-in template (three auto-injects the skinning
// chunks for any material used on a SkinnedMesh), so this only needs to graft
// in the wipe varying/uniform and a discard — far less to get wrong than
// reimplementing matcap sampling by hand.
function injectDissolve(material: Material): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uProgress = dissolveUniforms.uProgress;
    shader.uniforms.uMinY = dissolveUniforms.uMinY;
    shader.uniforms.uMaxY = dissolveUniforms.uMaxY;

    shader.vertexShader =
      `uniform float uMinY;\nuniform float uMaxY;\nvarying float vModelProgress;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "vModelProgress = (uMaxY > uMinY) ? (position.y - uMinY) / (uMaxY - uMinY) : 0.0;\n\t#include <begin_vertex>",
      );

    shader.fragmentShader =
      `uniform float uProgress;\nvarying float vModelProgress;\n${shader.fragmentShader}`.replace(
        "void main() {",
        `void main() {
	float dissolveVisible = uProgress <= 0.0 ? 1.0 : smoothstep(uProgress, uProgress + 0.002, vModelProgress);
	if (dissolveVisible <= 0.0) discard;
`,
      );
  };
  material.needsUpdate = true;
}

let root: Object3D | null = null;
let mixer: AnimationMixer | null = null;
let deskAction: AnimationAction | null = null; // typing gesture, one-shot (not the seated base anymore)
let wakeAction: AnimationAction | null = null;
let idleAction: AnimationAction | null = null; // seated base
let contactAction: AnimationAction | null = null; // standing base
let currentAction: AnimationAction | null = null;
let narrativeState: State = "seated";
let lastHandledGestureId = 0;
let onMixerFinished: ((e: { action: AnimationAction }) => void) | null = null;
let clipsRef: {
  desk: AnimationClip;
  wake: AnimationClip;
  idle: AnimationClip;
  contact: AnimationClip;
} | null = null;

const meshes: Mesh[] = [];
const matcapTextures = new Map<string, Texture>();

function toneKeyFor(nodeName: string): keyof typeof TONES | undefined {
  if (SKIN_NODES.has(nodeName)) return "skin";
  return nodeName in TONES ? (nodeName as keyof typeof TONES) : undefined;
}

function createMatcapTexture(tone: Tone): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Base fill — the square's corners fall outside the normal-sampled unit circle
  // and are never actually read, but a solid fill avoids transparent edges.
  context.fillStyle = tone.base;
  context.fillRect(0, 0, size, size);

  // Soft key-light highlight, offset upper-left — reads as shaded plastic, not flat color.
  const highlight = context.createRadialGradient(
    cx - r * 0.35,
    cy - r * 0.4,
    0,
    cx - r * 0.35,
    cy - r * 0.4,
    r * 1.1,
  );
  highlight.addColorStop(0, tone.highlight);
  highlight.addColorStop(0.5, tone.base);
  highlight.addColorStop(1, tone.base);
  context.fillStyle = highlight;
  context.fillRect(0, 0, size, size);

  // Darker rim toward the silhouette so the sphere lookup reads as 3D.
  const rim = context.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  rim.addColorStop(0, "rgba(0,0,0,0)");
  rim.addColorStop(1, tone.shadow);
  context.fillStyle = rim;
  context.fillRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// Loads the four real matcap webps, falling back to the procedural generator
// per-key on any individual failure (404, decode error, ...) so a bad texture
// never breaks the page — it just looks a little flatter than intended.
async function loadMatcapTextures(): Promise<void> {
  const loader = new TextureLoader();
  const keys = Object.keys(MATCAP_URLS) as (keyof typeof TONES)[];
  await Promise.all(
    keys.map(async (key) => {
      try {
        const texture = await loader.loadAsync(MATCAP_URLS[key]);
        texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = false;
        texture.minFilter = LinearFilter; // required when generateMipmaps is false
        matcapTextures.set(key, texture);
      } catch {
        matcapTextures.set(key, createMatcapTexture(TONES[key]));
      }
    }),
  );
}

function disposeMaterial(material: Material | Material[] | undefined): void {
  if (Array.isArray(material)) material.forEach((m) => m.dispose());
  else material?.dispose();
}

// Splits the welded head into skin and hair, each with its own tint.
function applyHeadMaterials(obj: Mesh): void {
  const skinTexture = matcapTextures.get("skin") ?? createMatcapTexture(TONES.skin);

  const makeMaterial = (tint: number): MeshMatcapMaterial => {
    const material = new MeshMatcapMaterial({ matcap: skinTexture });
    material.color.setHex(tint);
    injectDissolve(material);
    return material;
  };

  const islands = findIslands(obj.geometry);
  obj.geometry.computeBoundingBox();
  const box = obj.geometry.boundingBox;

  // One island (or no bounding box) means the split failed — a different model,
  // or a re-export that welded the shells. Fall back to a single tinted head
  // rather than throwing: a uniformly-coloured avatar beats no avatar.
  if (islands.length < 2 || !box) {
    disposeMaterial(obj.material);
    obj.material = makeMaterial(SKIN_TINT);
    meshes.push(obj);
    return;
  }

  const crownY = box.max.y - (box.max.y - box.min.y) * (1 - HAIR_CROWN_FRACTION);
  const backZ = box.min.z + (box.max.z - box.min.z) * HAIR_BACK_FRACTION;
  const isHair = (island: Island): boolean => island.max[1] >= crownY || island.max[2] >= backZ;

  // Bucket 0 = skin, 1 = hair — the order the material array is indexed by.
  groupByIsland(obj.geometry, islands, (island) => (isHair(island) ? 1 : 0), 2);

  disposeMaterial(obj.material);
  obj.material = [makeMaterial(SKIN_TINT), makeMaterial(HAIR_TINT)];
  meshes.push(obj);
}

function applyMaterials(scene: Object3D): void {
  scene.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    if (obj.name === FACE_NODE) {
      disposeMaterial(obj.material);
      const faceMaterial = face.createMaterial();
      injectDissolve(faceMaterial);
      obj.material = faceMaterial;
      // Draws after the head shell it is coincident with. Pairs with the
      // material's depthTest:false — order, not depth, decides here.
      obj.renderOrder = 1;
      meshes.push(obj);
      return;
    }

    if (obj.name === HEAD_NODE) {
      applyHeadMaterials(obj);
      return;
    }

    const key = toneKeyFor(obj.name);
    if (!key) return; // unnamed/unknown node — leave as-is (none expected per GLB inspection)

    // loadMatcapTextures() populates every key before this runs; fallback here
    // only guards against a future key added to TONES without a matching load.
    let texture = matcapTextures.get(key);
    if (!texture) {
      texture = createMatcapTexture(TONES[key]);
      matcapTextures.set(key, texture);
    }

    // Dispose whatever default material GLTFLoader assigned (the GLB ships zero materials).
    disposeMaterial(obj.material);

    const material = new MeshMatcapMaterial({ matcap: texture });
    if (key === "skin") material.color.setHex(SKIN_TINT);
    injectDissolve(material);
    obj.material = material;
    meshes.push(obj);
  });
}

function setWeight(action: AnimationAction, weight: number): void {
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(weight);
}

// Crossfades the currently-blended-in action to `next`. Deliberately doesn't
// touch `narrativeState` — that's only meaningful for the seated/transition/
// standing progression (see the two call sites below); the typing gesture
// crossfades through here too but isn't itself a narrative state.
function crossfadeTo(next: AnimationAction): void {
  if (!currentAction || next === currentAction) return;
  setWeight(next, 1);
  next.time = 0;
  currentAction.crossFadeTo(next, 0.6, true);
  currentAction = next;
}

function actionForState(state: State): AnimationAction {
  return state === "seated" ? idleAction! : state === "standing-transition" ? wakeAction! : contactAction!;
}

// Framing constants, calibrated against the real render — NOT auto-fitted.
//
// Auto-fit was tried and removed. `Box3.setFromObject` on a SkinnedMesh measures
// the BIND pose (geometry vertices before skinning), not the animated pose the
// camera actually sees. For this model the bind-pose box centre sits at y≈4.18
// while the animated figure sits near the local origin, so fitting to it pushed
// the avatar almost entirely out of frame. Bone world positions are a truthful
// measure, but they still under-report the silhouette (the head mesh extends far
// above `headBone`, which sits at the neck).
//
// So these are tuned values. Re-tune them if the model, the clip, or the hero
// height changes — treat them as a calibration knob, not as magic numbers.
//
// Desk-scene composition: avatar and room.glb are placed at the SAME world
// origin with no relative offset (their left-desktop clip / desk mesh are
// authored to line up), so position/scale are the only knobs left — camera
// framing is now entirely owned by camera.ts's waypoints (see camera3d.tick,
// which overwrites ctx.camera's position/lookAt every frame this scene is
// active, so nothing needs to be set here at load time).
export const AVATAR_POSITION: [number, number, number] = [3, 1, 0];
export const AVATAR_SCALE = 0.45;

// Where the figure walks to as it stands. Seated it sits off to the right
// (AVATAR_POSITION.x) so the hero copy has the left half; standing it steps to
// the camera's own focus point, which is what projects to the centre of the
// screen — so "walks to the middle" is literally true.
//
// z MUST stay at the seated depth. The reference walks its avatar out to z=6
// because its camera pulls back to the "about" waypoint at the same time; with
// our camera locked to `hero` (CAMERA_FOLLOWS_SCROLL=false, camera z=7) that
// same walk cuts the camera distance from 7 to 1 — the figure balloons ~7x and
// sweeps the frame, which is indistinguishable from the whole world moving.
// Keeping z fixed makes the stand a pure lateral slide: constant size, static
// desk, nothing but the avatar changing. Only raise this if the camera is put
// back on the scroll.
const STANDING_X = 0;
// Vertical destination, and it needs its own constant rather than just holding
// whatever height the lift ended at. The camera sits off-axis at [9,4,7], so a
// point's SCREEN y depends on its world x too — walking inward shifts the
// figure vertically on screen even at a constant world y. This is the value
// that lands it centred once it has arrived, and it is calibrated FOR THE
// CURRENT STANDING_X: change that and this needs a nudge too. ~135px per world
// unit; the origin sits near the hips, so a little below centre frames best.
// Zero, and deliberately so: floor.ts puts the grid at this same height, so the
// figure's origin and the ground plane are the same y and cannot drift apart.
const STANDING_Y = 0;
// Scale the figure grows to as it walks in, on its own ramp rather than by
// moving it closer to the camera. Depth would work too, but it drags the
// figure across the frame at the same time and fights whatever the camera
// waypoints are doing — an explicit scale is the one knob that only does the
// one thing. AVATAR_SCALE stays the seated size; this is the standing size.
// Sized against the real model, not by eye: the GLB measures 4.30 units tall,
// and the visible frame height where the figure ends up is ~6.75 units, so 1.3
// fills ~83% of the screen. Re-derive it if the camera waypoints move.
const STANDING_SCALE = 1;
// Matches the `about` waypoint's own focus z. The camera travels there as the
// scroll runs, so camera and figure meet at the same point instead of the
// camera framing empty space six units in front of the avatar. This is also
// where the growth comes from: distance drops ~15.7 -> ~9.8, i.e. ~1.6x bigger,
// with no scale change at all. Only safe BECAUSE the camera moves — pin the
// camera to `hero` again and this same value balloons the figure ~7x.
const STANDING_Z = 5;

// The scroll splits into two beats, and this is the seam:
//
//   phase 1 (0 .. PHASE2_START) — desk and avatar rise TOGETHER by STAND_RISE,
//     starting from the very first pixel of scroll, so the pair reads as
//     travelling with the page instead of hovering over it. Their relative
//     placement (figure seated at the desk) is preserved the whole way up.
//     Partway through this lift the figure also turns and stands — see
//     `turnProgress`, which has its own later window. Camera and canvas static.
//   phase 2 (PHASE2_START .. 1) — the pair splits: the desk keeps climbing out
//     of frame (room.ts) while the avatar holds its height and walks to centre.
//
// Must sit at or after ROTATION_END so the turn finishes before the walk
// starts; otherwise the figure pivots and translates at once and reads as a
// skid rather than a step.
export const PHASE2_START = ROTATION_END;

// How far the desk-and-avatar pair lifts across phase 1, in world units.
//
// This is the knob with the tightest ceiling in the file, because it is pulled
// two ways. Bigger reads more like the scene is scrolling with the page, which
// is the point of it. But the avatar HOLDS this height for all of phase 2 while
// it walks, and the visible half-height at its distance is only ~3.8 units — so
// overshoot and the figure ends up walking along the top edge instead of the
// middle. If you want a genuine 1:1 track with the scroll, that is a CSS
// (sticky pin) change, not this constant, and the avatar cannot also land
// centred. Tune by eye.
const STAND_RISE = 1.0;

/**
 * Phase 1's lift ramp, running from the FIRST pixel of scroll to the seam —
 * unlike the turn, which starts later. Applied identically to the avatar and to
 * the desk, so the two cannot drift apart.
 */
export function standRiseForProgress(progress: number): number {
  return STAND_RISE * clamp01(progress / PHASE2_START);
}

/** 0 for all of phase 1, ramping 0..1 across phase 2. */
// Where the walk finishes. Every other ramp in this file runs to 1.0 by
// construction, which for the walk meant the figure was still drifting toward
// centre at the very bottom of the page. This lets it ARRIVE and then hold.
// Must stay above PHASE2_START; the closer the two, the more abrupt the walk.
const WALK_END = 1;

// Fade window for the page copy scrolling under the pinned scene. Its own
// ramp, not the walk's: on phase2Progress the text sat at half opacity ON TOP
// of the figure for the whole walk, because both ran over the same window. This
// finishes before the walk really starts, so the frame is clear by the time the
// HUD notes arrive.
const COPY_FADE_START = 0.1;
const COPY_FADE_END = 0.22;

/** 0 = copy fully visible, 1 = fully faded. */
export function copyFadeForProgress(progress: number): number {
  return clamp01((progress - COPY_FADE_START) / (COPY_FADE_END - COPY_FADE_START));
}

export function phase2Progress(progress: number): number {
  return clamp01((progress - PHASE2_START) / (WALK_END - PHASE2_START));
}

/** Seated size through phase 1, growing to STANDING_SCALE as the figure walks in. */
export function avatarScaleForProgress(progress: number): number {
  const t = phase2Progress(progress);
  return AVATAR_SCALE + (STANDING_SCALE - AVATAR_SCALE) * t;
}

export function avatarPositionForProgress(progress: number): [number, number, number] {
  const t = phase2Progress(progress);
  const [x, y, z] = AVATAR_POSITION;
  // Phase 1 lifts with the page; phase 2 then settles that height back to
  // STANDING_Y as the figure walks, so "walks to the middle" holds on BOTH
  // axes. `lifted` is already saturated by the time t leaves 0, so this reads
  // as one continuous move rather than a lift fighting a descent.
  const lifted = y + standRiseForProgress(progress);
  return [
    x + (STANDING_X - x) * t,
    lifted + (STANDING_Y - lifted) * t,
    z + (STANDING_Z - z) * t,
  ];
}

export const avatar = {
  /** Resolves false on any load/parse failure or a missing required clip — caller falls back to heroBlob. */
  async init(ctx: StageContext): Promise<boolean> {
    let gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
    try {
      // Matcap loading never rejects (per-key fallback inside), so this only
      // throws if the GLB itself fails.
      [gltf] = await Promise.all([new GLTFLoader().loadAsync(MODEL_URL), loadMatcapTextures()]);
    } catch {
      return false;
    }

    const scene = gltf.scene;
    const findClip = (name: string): AnimationClip | undefined =>
      gltf.animations.find((c) => c.name === name);
    const deskClip = findClip("left-desktop");
    const wakeClip = findClip("wake-up");
    const idleClip = findClip("idle");
    const contactClip = findClip("contact-idle");
    if (!deskClip || !wakeClip || !idleClip || !contactClip) return false;

    applyMaterials(scene);

    // Accessory, not part of the rig: a plain Mesh parented to headBone. Loaded
    // after the matcaps so it can share the black one, and awaited so the
    // hologram (which clones this root at init) sees a stable scene graph.
    // Failure is silent by contract — no glasses beats no avatar.
    meshes.push(...(await attachGlasses(scene, matcapTextures.get("black")!, injectDissolve)));

    const extent = computeVerticalExtent(scene);
    dissolveUniforms.uMinY.value = extent.minY;
    dissolveUniforms.uMaxY.value = extent.maxY;
    dissolveUniforms.uProgress.value = 0;
    clipsRef = { desk: deskClip, wake: wakeClip, idle: idleClip, contact: contactClip };

    mixer = new AnimationMixer(scene);
    deskAction = mixer.clipAction(deskClip);
    wakeAction = mixer.clipAction(wakeClip);
    idleAction = mixer.clipAction(idleClip);
    contactAction = mixer.clipAction(contactClip);

    // wake-up and the typing gesture are one-shots: play through once and
    // hold the last pose (clampWhenFinished) instead of looping or snapping
    // back to frame 0. idle/contact-idle stay LoopRepeat (the default).
    [deskAction, wakeAction].forEach((a) => {
      a.setLoop(LoopOnce, 1);
      a.clampWhenFinished = true;
    });

    [deskAction, wakeAction, idleAction, contactAction].forEach((a) => a.play());
    setWeight(deskAction, 0);
    setWeight(wakeAction, 0);
    setWeight(idleAction, 1);
    setWeight(contactAction, 0);
    currentAction = idleAction;
    narrativeState = "seated";
    lastHandledGestureId = getGestureTriggerId();

    // Typing gesture returns to the seated idle base on its own once it
    // finishes playing through — but only if nothing else has taken over
    // `currentAction` in the meantime (e.g. the narrative already advanced
    // to standing-transition while the gesture was mid-playback).
    onMixerFinished = (e) => {
      if (e.action === deskAction && currentAction === deskAction) {
        crossfadeTo(idleAction!);
      }
    };
    mixer.addEventListener("finished", onMixerFinished);

    scheduleGesture();

    root = scene;
    this.resize(ctx.camera.aspect);
    ctx.scene.add(root);
    return true;
  },

  resize(_aspect: number): void {
    if (!root) return;
    // No aspect-driven repositioning — see the note on AVATAR_POSITION above.
    // PerspectiveCamera's fixed vertical FOV already adapts framing across
    // aspect ratios; this just re-applies the fixed world-space transform.
    const [x, y, z] = AVATAR_POSITION;
    root.position.set(x, y, z);
    root.scale.setScalar(AVATAR_SCALE);
  },

  tick(dt: number): void {
    if (!root || !mixer || !currentAction) return;
    const { weight, progress } = sceneWeights.get("hero");
    if (weight === 0) return; // off-screen: skip skinning cost too

    // Narrative driven by scroll progress through the pinned stage (not by
    // visibility weight): seated, then standing up, then standing idle — the
    // skills panel (DOM, independent of this scene) reveals around the same
    // progress the avatar settles into "standing".
    const nextNarrative = stateForProgress(progress);
    if (nextNarrative !== narrativeState) {
      narrativeState = nextNarrative;
      crossfadeTo(actionForState(nextNarrative));
    }

    // Typing gesture: only while genuinely idle-seated (not already mid-
    // gesture, not transitioning/standing) and only on a new scheduler tick.
    const gestureId = getGestureTriggerId();
    if (gestureId !== lastHandledGestureId) {
      lastHandledGestureId = gestureId;
      if (narrativeState === "seated" && currentAction === idleAction) {
        crossfadeTo(deskAction!);
      }
    }

    root.rotation.y = rotationYForProgress(progress);
    root.position.set(...avatarPositionForProgress(progress));
    // Overrides resize()'s static AVATAR_SCALE, which ran earlier this frame.
    root.scale.setScalar(avatarScaleForProgress(progress));

    dissolveUniforms.uProgress.value = wipeProgressFor(progress);

    face.tick(dt); // blink cadence is its own clock — unrelated to the scroll

    mixer.update(dt);
  },

  destroy(): void {
    if (gestureTimer !== null) {
      clearTimeout(gestureTimer);
      gestureTimer = null;
    }
    if (mixer && onMixerFinished) mixer.removeEventListener("finished", onMixerFinished);
    onMixerFinished = null;
    mixer?.stopAllAction();
    mixer = null;
    deskAction = null;
    wakeAction = null;
    idleAction = null;
    contactAction = null;
    currentAction = null;
    narrativeState = "seated";
    lastHandledGestureId = 0;
    gestureTriggerId = 0;
    clipsRef = null;
    dissolveUniforms.uProgress.value = 0;

    for (const mesh of meshes) {
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material.dispose();
    }
    meshes.length = 0;

    // After the loop above: the glasses' geometry and material are disposed as
    // part of `meshes`; this only unhooks the holder from the skeleton.
    destroyGlasses();

    face.destroy();

    for (const texture of matcapTextures.values()) texture.dispose();
    matcapTextures.clear();

    root?.removeFromParent();
    root = null;
  },
};

// Read-only accessors for the hologram module: it clones this same loaded
// scene (skeleton + clips) rather than reaching into avatar internals.
export function getRoot(): Object3D | null {
  return root;
}

export function getClips(): {
  desk: AnimationClip;
  wake: AnimationClip;
  idle: AnimationClip;
  contact: AnimationClip;
} | null {
  return clipsRef;
}
