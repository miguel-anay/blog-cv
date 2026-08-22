import {
  Mesh,
  SkinnedMesh,
  ShaderMaterial,
  Color,
  AdditiveBlending,
  DoubleSide,
  AnimationMixer,
  LoopOnce,
  type AnimationAction,
  type AnimationClip,
  type Object3D,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import {
  getRoot,
  getClips,
  getVerticalExtent,
  stateForProgress,
  wipeProgressFor,
  rotationYForProgress,
  getGestureTriggerId,
  AVATAR_POSITION,
  AVATAR_SCALE,
  avatarScaleForProgress,
  avatarPositionForProgress,
  type State,
} from "./avatar";

// Original GLSL — a hologram twin of the matcap avatar. Skinning chunks are
// injected manually (unlike avatar.ts's onBeforeCompile-on-a-built-in
// approach) because this look — additive scanlines, fresnel rim, a travelling
// wipe-boundary band — has no built-in material to extend from; it has to be
// a from-scratch ShaderMaterial.
const VERTEX_SHADER = /* glsl */ `
  #include <skinning_pars_vertex>

  uniform float uMinY;
  uniform float uMaxY;

  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying float vModelProgress;
  varying float vWorldY;

  void main() {
    #include <beginnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>

    #include <begin_vertex>
    #include <skinning_vertex>

    vModelProgress = (uMaxY > uMinY) ? (position.y - uMinY) / (uMaxY - uMinY) : 0.0;

    vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
    vWorldY = worldPosition.y;

    vNormalView = normalize(normalMatrix * objectNormal);

    // project_vertex declares "mvPosition" itself (and sets gl_Position) — read
    // it straight afterward instead of redeclaring it, which would be a GLSL
    // compile error (link failures here are console.error, not a thrown JS
    // exception, so this fails completely silently at runtime).
    #include <project_vertex>
    vViewDir = normalize(-mvPosition.xyz);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform float uOpacity;

  varying vec3 vNormalView;
  varying vec3 vViewDir;
  varying float vModelProgress;
  varying float vWorldY;

  void main() {
    vec3 normal = normalize(vNormalView);
    vec3 viewDir = normalize(vViewDir);
    if (!gl_FrontFacing) normal = -normal;

    // Animated horizontal scanlines, sharpened with pow so they read as thin bands.
    float scan = pow(0.5 + 0.5 * sin(vWorldY * 40.0 - uTime * 2.0), 8.0);

    // Fresnel rim — brighter where the surface grazes the view direction.
    float fresnel = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 2.0);

    // Thin bright band riding the wipe boundary as it travels up the body.
    float bandWidth = 0.03;
    float bandFeather = 0.015;
    float band = 1.0 - smoothstep(bandWidth - bandFeather, bandWidth + bandFeather, abs(vModelProgress - uProgress));

    float intensity = scan * 0.5 + fresnel * 0.8 + band * 1.5;
    if (!gl_FrontFacing) intensity *= 0.4;

    // Hologram only shows where the solid avatar has already been wiped away
    // (inverse of avatar.ts's dissolveVisible), so the crossover is clean.
    float solidVisible = uProgress <= 0.0 ? 1.0 : smoothstep(uProgress, uProgress + 0.002, vModelProgress);
    float hologramGate = 1.0 - solidVisible;

    float alpha = clamp(intensity, 0.0, 1.0) * hologramGate * uOpacity;
    if (alpha <= 0.001) discard;

    gl_FragColor = vec4(uColor * intensity, alpha);
  }
`;

let clonedRoot: Object3D | null = null;
let mesh: SkinnedMesh | null = null;
let material: ShaderMaterial | null = null;
let mixer: AnimationMixer | null = null;
let deskAction: AnimationAction | null = null; // typing gesture, one-shot
let wakeAction: AnimationAction | null = null;
let idleAction: AnimationAction | null = null; // seated base
let contactAction: AnimationAction | null = null; // standing base
let currentAction: AnimationAction | null = null;
let narrativeState: State = "seated";
let lastHandledGestureId = 0;
let onMixerFinished: ((e: { action: AnimationAction }) => void) | null = null;
let time = 0;
let readPalette: (() => void) | null = null;

const readCssColor = (name: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// The twin's tint. `--hologram` is an OPTIONAL override: define it in CSS to
// colour the hologram on its own, otherwise it follows the site accent, which
// is what kept the two in step before this existed. Read live (not cached) so
// a theme swap repaints it — see the themechange listener below.
const readHologramColor = (): string => readCssColor("--hologram") || readCssColor("--accent");

function setWeight(action: AnimationAction, weight: number): void {
  action.enabled = true;
  action.setEffectiveTimeScale(1);
  action.setEffectiveWeight(weight);
}

// Mirrors avatar.ts's crossfadeTo/actionForState exactly — this twin only
// stays frame-locked if it drives its own mixer through the identical
// narrative-state and gesture logic (it can't just read avatar.ts's private
// action refs, it clones its own).
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

export const hologram = {
  /**
   * Sync, no I/O: clones the already-loaded avatar's skeleton + clips.
   * Returns false if the avatar isn't loaded, has no clips, or the mesh
   * nodes don't merge cleanly (mismatched attributes across sub-meshes) —
   * caller treats it exactly like room.init's failure path.
   */
  init(ctx: StageContext): boolean {
    const avatarRoot = getRoot();
    const clips = getClips();
    if (!avatarRoot || !clips) return false;

    const cloned = cloneSkeleton(avatarRoot);
    const skinnedMeshes: SkinnedMesh[] = [];
    cloned.traverse((obj) => {
      const asMesh = obj as Mesh;
      if (!asMesh.isMesh) return;
      // Hide EVERY cloned mesh — only the merged mesh renders. This has to cover
      // non-skinned children too, not just the skinned ones: the glasses are a
      // plain Mesh parented to headBone, so they ride along in the clone and
      // would otherwise draw a second, solid pair inside the hologram.
      asMesh.visible = false;
      if ((asMesh as SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(asMesh as SkinnedMesh);
    });
    if (skinnedMeshes.length === 0) return false;

    const merged = mergeGeometries(
      skinnedMeshes.map((m) => m.geometry),
      false,
    );
    if (!merged) return false; // mismatched attribute sets across sub-meshes — bail, no hologram

    const extent = getVerticalExtent();

    material = new ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new Color() },
        uOpacity: { value: 1 },
        uMinY: { value: extent.minY },
        uMaxY: { value: extent.maxY },
      },
    });

    mesh = new SkinnedMesh(merged, material);
    mesh.bind(skinnedMeshes[0].skeleton, skinnedMeshes[0].bindMatrix);
    cloned.add(mesh);

    mixer = new AnimationMixer(cloned);
    deskAction = mixer.clipAction(clips.desk as AnimationClip);
    wakeAction = mixer.clipAction(clips.wake as AnimationClip);
    idleAction = mixer.clipAction(clips.idle as AnimationClip);
    contactAction = mixer.clipAction(clips.contact as AnimationClip);

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

    onMixerFinished = (e) => {
      if (e.action === deskAction && currentAction === deskAction) {
        crossfadeTo(idleAction!);
      }
    };
    mixer.addEventListener("finished", onMixerFinished);

    readPalette = () => {
      if (!material) return;
      material.uniforms.uColor.value.set(readHologramColor());
    };
    readPalette();
    document.addEventListener("themechange", readPalette);
    document.addEventListener("modechange", readPalette);

    clonedRoot = cloned;
    this.resize(ctx.camera.aspect);
    ctx.scene.add(clonedRoot);
    time = 0;
    return true;
  },

  resize(_aspect: number): void {
    if (!clonedRoot) return;
    const [x, y, z] = AVATAR_POSITION;
    clonedRoot.position.set(x, y, z);
    clonedRoot.scale.setScalar(AVATAR_SCALE);
  },

  tick(dt: number): void {
    if (!clonedRoot || !mixer || !currentAction || !material) return;
    const { weight, progress } = sceneWeights.get("hero");
    if (weight === 0) return; // off-screen: skip skinning cost too, mirrors avatar.ts

    const nextNarrative = stateForProgress(progress);
    if (nextNarrative !== narrativeState) {
      narrativeState = nextNarrative;
      crossfadeTo(actionForState(nextNarrative));
    }

    // Gesture trigger id is shared with avatar.ts — polling it here (rather
    // than scheduling an independent random timer) is what keeps this twin
    // firing the typing gesture on the exact same frame as the solid mesh.
    const gestureId = getGestureTriggerId();
    if (gestureId !== lastHandledGestureId) {
      lastHandledGestureId = gestureId;
      if (narrativeState === "seated" && currentAction === idleAction) {
        crossfadeTo(deskAction!);
      }
    }

    clonedRoot.rotation.y = rotationYForProgress(progress);
    clonedRoot.position.set(...avatarPositionForProgress(progress));
    clonedRoot.scale.setScalar(avatarScaleForProgress(progress)); // twin must grow with it

    time += dt;
    material.uniforms.uProgress.value = wipeProgressFor(progress);
    material.uniforms.uTime.value = time;

    mixer.update(dt);
  },

  destroy(): void {
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

    if (readPalette) {
      document.removeEventListener("themechange", readPalette);
      document.removeEventListener("modechange", readPalette);
      readPalette = null;
    }

    mesh?.geometry.dispose();
    mesh = null;
    material?.dispose();
    material = null;

    clonedRoot?.removeFromParent();
    clonedRoot = null;
    time = 0;
  },
};
