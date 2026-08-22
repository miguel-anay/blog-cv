import {
  Euler,
  Matrix4,
  Mesh,
  MeshMatcapMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Material,
  type SkinnedMesh,
  type Texture,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Third-party asset, same policy as the avatar: lives in the gitignored
// public/models/_eval/ and must never be committed. Provenance is the filename
// the model shipped under — "Glasses by jeremy", id 9i5mmOwt7cu. The licence has
// NOT been verified; confirm it before this ships anywhere public.
const MODEL_URL = "/models/_eval/glasses.glb";

const HEAD_MESH = "head";
const HEAD_BONE = "headBone";

// The frame is placed by solving two point pairs, not by hand-tuned offsets:
// each lens centre is put on the eye it belongs to, and scale and translation
// fall out of that. Only WIDTH_BOOST and STAND_OFF are taste.

// Eye centres on the face plane, in the avatar's BIND space (the coordinates the
// geometry bounding boxes use, NOT world units).
//
// MEASURED, and the measurement is the whole point. Reading them off the face
// plane's UV range linearly gives y≈5.56 and puts the frame a full lens too low:
// the plane is steeply curved, so across most of its span v travels through Z
// rather than Y, which makes a v-to-height reading meaningless. These come from
// barycentric-solving face.ts's OWN eye UV (EYE_X 0.33, EYE_Y 0.54, flipped for
// flipY) against the plane's triangles — the exact 3D point each drawn pupil
// lands on. Re-derive them if face.ts's eye constants ever move.
const EYE_LEFT = new Vector3(0.579, 5.576, 0.327);
const EYE_RIGHT = new Vector3(0.228, 5.57, 0.397);

// Lens centres in the frame's own geometry: centroid of the front 12% slab —
// the rim plane, temples excluded — split at x = 0. Slightly asymmetric because
// the model is.
const LENS_LEFT = new Vector3(-8.47, 5.55, 0.97);
const LENS_RIGHT = new Vector3(8.06, 5.68, 1.0);

// Lens spread relative to pupil spread. 1.0 is optically honest — each lens
// centre exactly on its pupil — but on a head this stylised it reads as small
// reading glasses, because the drawn eyes sit far closer together (0.358 apart)
// than the head is wide (1.396). Boosting widens the frame around the eyes; the
// centres drift outward by half the boost, invisible up to ~1.3 and starting to
// look like the eyes are peering inward past ~1.5.
const WIDTH_BOOST = 1.25;

// How far the lens plane floats in front of the eye, and along WHICH axis.
//
// Offsetting along world -z alone lands the frame a measured ~1.75px low at
// 1280x820, consistently across every pose sampled: the face plane is tilted
// back, so "in front of the face" is not "along -z". This is the averaged
// triangle normal at the two eye points, which points up as well as forward and
// takes the bias out. Keep the distance small — the frame is rigid to headBone,
// so any stand-off is a lever arm that swings when the head pitches.
const EYE_NORMAL = new Vector3(-0.118, 0.398, -0.91);
const STAND_OFF = 0.05;

// The frame's temples run toward +z; the avatar faces -z. Without this the
// glasses sit backwards with the arms sticking out of the face.
const YAW = Math.PI;

let attached: Object3D | null = null;

/**
 * Parents the glasses to the avatar's head bone so they ride the animation.
 *
 * Returns the meshes it created so the caller can dispose them alongside the
 * rest of the avatar. Resolves to an empty array if anything is missing —
 * a missing accessory must never cost the page its avatar.
 */
export async function attachGlasses(
  root: Object3D,
  matcap: Texture,
  decorate: (material: Material) => void,
): Promise<Mesh[]> {
  const head = root.getObjectByName(HEAD_MESH) as SkinnedMesh | undefined;
  const skeleton = head?.skeleton;
  if (!skeleton) return [];

  const boneIndex = skeleton.bones.findIndex((b) => b.name === HEAD_BONE);
  if (boneIndex < 0) return [];

  let source: Object3D;
  try {
    source = (await new GLTFLoader().loadAsync(MODEL_URL)).scene;
  } catch {
    return [];
  }

  const meshes: Mesh[] = [];
  source.traverse((obj) => {
    if (!(obj instanceof Mesh)) return;
    // The GLB ships a PBR material, and this scene has ZERO lights — it would
    // render as a flat black silhouette. Matcap instead, matching the rest of
    // the avatar, and decorated with the same dissolve so the frames wipe with
    // the body rather than hanging in the air through the hologram transition.
    const material = new MeshMatcapMaterial({ matcap });
    decorate(material);
    obj.material = material;
    meshes.push(obj);
  });
  if (meshes.length === 0) return [];

  // Uniform scale that puts the lens spread onto the pupil spread (times taste).
  const scale =
    (WIDTH_BOOST * Math.abs(EYE_LEFT.x - EYE_RIGHT.x)) /
    Math.abs(LENS_RIGHT.x - LENS_LEFT.x);

  // A YAW of pi maps a geometry point g to (-g.x, g.y, -g.z), so the rotated,
  // scaled lens midpoint is the offset from the frame's origin to where the
  // lenses end up. Subtracting it from the eye midpoint gives the translation.
  const eyeMid = EYE_LEFT.clone().add(EYE_RIGHT).multiplyScalar(0.5);
  const lensMid = LENS_LEFT.clone().add(LENS_RIGHT).multiplyScalar(0.5);
  const lensOffset = new Vector3(-lensMid.x, lensMid.y, -lensMid.z).multiplyScalar(scale);
  const position = eyeMid.sub(lensOffset).addScaledVector(EYE_NORMAL, STAND_OFF);

  // A child of a bone renders at bone.matrixWorld * local. In the rest pose the
  // bone's inverse bind matrix is exactly the inverse of bone.matrixWorld, so
  // pre-multiplying by it makes `local` describe a pose in bind space —
  // verified against a marker, which landed on its target with zero error.
  // The avatar's bindMatrix is identity, which is what lets this stay a plain
  // two-matrix product.
  const target = new Matrix4().compose(
    position,
    new Quaternion().setFromEuler(new Euler(0, YAW, 0)),
    new Vector3(scale, scale, scale),
  );
  const local = new Matrix4().multiplyMatrices(skeleton.boneInverses[boneIndex]!, target);

  const holder = new Object3D();
  holder.add(source);
  local.decompose(holder.position, holder.quaternion, holder.scale);
  skeleton.bones[boneIndex]!.add(holder);
  attached = holder;

  return meshes;
}

export function destroyGlasses(): void {
  // Geometry and materials are disposed by the avatar alongside its own meshes;
  // this only unhooks the holder from the skeleton.
  attached?.removeFromParent();
  attached = null;
}
