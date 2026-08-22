import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  TextureLoader,
  type Object3D,
  type Texture,
  type Vector3,
} from "three";
import { AVATAR_SCALE, phase2Progress } from "./avatar";

// Music notes drifting out of the radio on the shelf, ported 1:1 from the
// reference portfolio's `room/notes` (davidhckh/portfolio-2025): three sprites
// on one looping ramp, each offset by a third of the cycle so they leave in a
// steady stream rather than as a burst.
//
// Eval-spike asset only, same terms as room.glb — see room.ts.
const SPRITE_URL = "/models/_eval/icon-spritesheet.webp";

const SPRITE_COUNT = 3;

// Placement relative to the radio mesh, in the room's own local units: up and
// slightly toward the camera so the notes clear the shelf instead of starting
// inside it.
const OFFSET = { x: -0.4, y: 0.4, z: 0.2 };

// The vertex shader REPLACES the model-view matrix's rotation/scale columns to
// billboard the sprite, which throws away the parent's scale along with the
// rotation — so the room's own scale has to be fed back in by hand, or the
// notes come out ~2x too big for the desk they belong to. Travel distance goes
// through the same columns, so this one uniform covers size and reach both.
const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uIndex;
uniform float uScale;

varying vec2 vUv;
varying float vAlpha;

#define TOTAL_COLS 4.
#define TOTAL_ROWS 4.
#define FRAME_X 0.
#define FRAME_Y 3.
#define SCALE 0.4
#define PI 3.14159

vec2 rotate2D(vec2 pos, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * pos.x - s * pos.y, s * pos.x + c * pos.y);
}

void main() {
    mat4 spriteViewMatrix = modelViewMatrix;

    float progress = fract(uTime * 0.15 + uIndex);

    float scale = SCALE * uScale * (1.0 - progress * 0.4);

    spriteViewMatrix[0][0] = scale;
    spriteViewMatrix[0][1] = 0.0;
    spriteViewMatrix[0][2] = 0.0;

    spriteViewMatrix[1][0] = 0.0;
    spriteViewMatrix[1][1] = scale;
    spriteViewMatrix[1][2] = 0.0;

    vec3 transformed = position;

    vec2 pos = position.xy;
    float rotationAngle = sin(progress * PI * 6.0) * PI * 0.1;
    pos = rotate2D(pos, rotationAngle);
    transformed.xy = pos;

    transformed.x += progress * 2.5;
    transformed.y += progress * 6.0;

    gl_Position = projectionMatrix * spriteViewMatrix * vec4(transformed, 1.0);

    vUv = uv;
    vUv.x = (uv.x + FRAME_X) / TOTAL_COLS;
    vUv.x += 0.25 * (uIndex * 3.0);
    vUv.y = (uv.y + (TOTAL_ROWS - 1.0 - FRAME_Y)) / TOTAL_ROWS;

    float fadeIn = smoothstep(0.0, 0.15, progress);
    float fadeOut = smoothstep(1.0, 0.7, progress);
    vAlpha = fadeIn * fadeOut;
}
`;

const fragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uOpacity;

varying vec2 vUv;
varying float vAlpha;

void main() {
    vec4 textureColor = texture2D(uTexture, vUv);
    gl_FragColor = vec4(textureColor.rgb, vAlpha * textureColor.a * uOpacity);
}
`;

let geometry: PlaneGeometry | null = null;
let texture: Texture | null = null;
const materials: ShaderMaterial[] = [];
const meshes: Mesh[] = [];

// Shared uniform OBJECTS, spread into every material — the spread copies the
// reference, not the value, so one write here reaches all three sprites.
const shared = {
  uTime: { value: 0 },
  uOpacity: { value: 0 },
  uScale: { value: AVATAR_SCALE },
  uTexture: { value: null as Texture | null },
};

export const musicNotes = {
  /** Resolves false on a texture failure — the radio just plays silently. */
  async init(parent: Object3D, radioPosition: Vector3): Promise<boolean> {
    try {
      texture = await new TextureLoader().loadAsync(SPRITE_URL);
    } catch {
      return false;
    }
    shared.uTexture.value = texture;

    geometry = new PlaneGeometry(1, 1);

    for (let i = 0; i < SPRITE_COUNT; i++) {
      const material = new ShaderMaterial({
        vertexShader,
        fragmentShader,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        uniforms: { ...shared, uIndex: { value: i / SPRITE_COUNT } },
      });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = -1;
      mesh.position.set(
        radioPosition.x + OFFSET.x,
        radioPosition.y + OFFSET.y,
        radioPosition.z + OFFSET.z,
      );
      parent.add(mesh);
      materials.push(material);
      meshes.push(mesh);
    }
    return true;
  },

  tick(dt: number, progress: number): void {
    if (meshes.length === 0) return;
    // The radio climbs out of frame with the desk in phase 2, so the notes go
    // quiet with it rather than trailing across an empty sky.
    const opacity = 1 - phase2Progress(progress);
    shared.uOpacity.value = opacity;
    const visible = opacity > 0.01;
    for (const mesh of meshes) mesh.visible = visible;
    if (!visible) return;
    shared.uTime.value += dt;
  },

  destroy(): void {
    for (const mesh of meshes) mesh.removeFromParent();
    meshes.length = 0;
    for (const material of materials) material.dispose();
    materials.length = 0;
    geometry?.dispose();
    geometry = null;
    texture?.dispose();
    texture = null;
    shared.uTexture.value = null;
    shared.uTime.value = 0;
  },
};
