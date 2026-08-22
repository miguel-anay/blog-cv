import { Mesh, ShaderMaterial, PlaneGeometry, Color } from "three";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import { avatarPositionForProgress, phase2Progress } from "./avatar";

// Grid floor under the standing figure.
//
// Modelled on the reference portfolio's `grid-floor` (davidhckh/portfolio-2025,
// https://david-hckh.com) — same idea, own GLSL. An earlier version of this
// file was a radial shadow disc, which was simply the wrong object: with ZERO
// lights in this scene (see stage.ts) a "shadow" has nothing to cast, and a
// flat dark blob at hip height reads as a smudge, not as ground. A lit grid
// gives the eye actual parallax cues, which is what makes the figure look
// planted rather than pasted on.

// Plane size and grid density are SEPARATE. They used to be one constant, which
// meant making the floor bigger also stretched every cell. The plane has to
// reach well past the camera (which sits ~9.5 units in front of the figure at
// the end of the scroll) or the page background shows through below the grid.
const PLANE_SIZE = 44;
const CELLS = 44; // one cell per world unit
const LINE_WIDTH = 0.012;
const SCROLL_SPEED = 0.35; // cells per second, travelling away from the viewer

const COLOR_BASE = "#0157a0";
const COLOR_LINE = "#34bcfd";

// Drop below the avatar's origin, in world units. Zero because STANDING_Y is
// also zero: the figure's origin and the grid end up on the same plane by
// construction, so they cannot drift apart when either is retuned. Only a knob
// if the animated pose turns out to sit off its own origin.
const FOOT_DROP = 0;

const MAX_OPACITY = 0.9;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Dots at the intersections plus faint connecting lines, faded radially so the
// plane never shows its square edge, and darkened at dead centre so the figure
// reads as sitting in a pool of its own shadow.
const fragmentShader = /* glsl */ `
varying vec2 vUv;

uniform vec3 uColor;
uniform vec3 uLineColor;
uniform float uOpacity;
uniform float uTime;

#define CELLS ${CELLS.toFixed(1)}
#define LINE_WIDTH ${LINE_WIDTH.toFixed(3)}

void main() {
  vec2 coord = vUv * CELLS;
  coord.y += uTime * ${SCROLL_SPEED.toFixed(2)};
  vec2 grid = abs(fract(coord) - 0.5);

  float gx = smoothstep(0.0, 0.5, grid.x);
  float gy = smoothstep(0.0, 0.5, grid.y);

  // Intersections read brightest: the product is only near 1 where BOTH axes
  // are far from a line, so inverting it isolates the crossings.
  float dots = 1.0 - smoothstep(LINE_WIDTH - 0.005, LINE_WIDTH, 1.0 - gx * gy);
  float lines = (1.0 - smoothstep(LINE_WIDTH * 0.5 - 0.005, LINE_WIDTH * 0.5, 1.0 - max(gx, gy))) * 0.1;
  float pattern = max(dots, lines);

  // Fade only over the outermost band, so the grid still covers the frame
  // instead of dying halfway to the plane's edge.
  float distToCentre = distance(vUv, vec2(0.5));
  float alpha = 1.0 - smoothstep(0.30, 0.5, distToCentre);

  // Contact shadow right under the feet. Radius is in UV, so it has to shrink
  // as PLANE_SIZE grows or it would swell into a huge dark disc.
  float contact = smoothstep(0.031, 0.024, distToCentre) * 0.45;

  vec3 colour = mix(uColor, uLineColor, pattern);
  colour = mix(colour, vec3(0.0, 0.0, 0.075), contact);

  gl_FragColor = vec4(colour, alpha * uOpacity);
}
`;

let mesh: Mesh | null = null;
let elapsed = 0;

const uniforms = {
  uColor: { value: new Color(COLOR_BASE).convertLinearToSRGB() },
  uLineColor: { value: new Color(COLOR_LINE).convertLinearToSRGB() },
  uOpacity: { value: 0 },
  uTime: { value: 0 },
};

export const floor = {
  /** Never fails on I/O — geometry and shader are built in-process. */
  init(ctx: StageContext): boolean {
    const geometry = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE, CELLS, CELLS);
    geometry.rotateX(-Math.PI / 2); // bake the lay-flat into the geometry, not the node

    mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        // Must not write depth: the plane is huge and would otherwise punch a
        // hole through everything drawn after it in the transparent pass.
        depthWrite: false,
        uniforms,
      }),
    );
    // The plane extends well past the avatar, so its bounding sphere leaves the
    // frustum long before the visible part does.
    mesh.frustumCulled = false;
    mesh.renderOrder = -100; // behind every other transparent object
    ctx.scene.add(mesh);
    return true;
  },

  resize(_aspect: number): void {
    // Position is re-derived from the avatar every tick — nothing to precompute.
  },

  tick(dt: number): void {
    if (!mesh) return;
    const { weight, progress } = sceneWeights.get("hero");
    if (weight === 0) return;

    const reveal = phase2Progress(progress);
    uniforms.uOpacity.value = MAX_OPACITY * reveal;
    mesh.visible = uniforms.uOpacity.value > 0.001;
    if (!mesh.visible) return;

    // Own accumulator rather than gsap.ticker.time: this stays in step with the
    // same dt the mixers use, and stops when the scene is off-screen.
    elapsed += dt;
    uniforms.uTime.value = elapsed;

    // Follow the figure as it walks in, so the grid's centre (and its contact
    // shadow) stays under the feet.
    const [x, y, z] = avatarPositionForProgress(progress);
    mesh.position.set(x, y - FOOT_DROP, z);
  },

  destroy(): void {
    if (!mesh) return;
    mesh.geometry.dispose();
    (mesh.material as ShaderMaterial).dispose();
    mesh.removeFromParent();
    mesh = null;
    elapsed = 0;
    uniforms.uOpacity.value = 0;
  },
};
