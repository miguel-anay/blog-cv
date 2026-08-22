import { Vector3, type PerspectiveCamera } from "three";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import { phase2Progress } from "./avatar";

type Waypoint = { position: [number, number, number]; focus: [number, number, number] };
type WaypointSet = { hero: Waypoint; about: Waypoint };

// Reference portfolio's calibrated waypoints (verbatim — do not re-derive).
// "about" is the reference's name for the second beat; in this build that's
// our skills-reveal section. Camera lookAt()s the blended focus every frame,
// so an elevated y=6 position with focus y=3 reads as a three-quarter view
// from behind the seated avatar. Landscape vs. portrait use the same aspect
// convention heroBlob.ts already uses (`aspect > 1.2`).
const WAYPOINTS: { landscape: WaypointSet; portrait: WaypointSet } = {
  landscape: {
    hero: { position: [9, 4, 7], focus: [0, 2, 0] },
    about: { position: [0, 4.5, 15.5], focus: [0, 2.2, 6] },
  },
  // Re-derived for the current standing target (figure 5.16u tall at
  // STANDING_SCALE, landing at x=0 z=6). A portrait viewport keeps the same
  // 38-degree VERTICAL fov but loses width, so both beats sit further back than
  // landscape: 13.6u puts the standing figure at ~55% of screen height with
  // 4.3u of width to spare, which clears the silhouette.
  // hero focuses x=3 because the seated figure and desk live there and portrait
  // has no side column to balance against.
  portrait: {
    hero: { position: [3, 4.8, 13], focus: [3, 3.0, 0] },
    about: { position: [0, 1.7, 17], focus: [0, 1.7, 6] },
  },
};

// Mouse parallax — camera offset from cursor position, reference values
// verbatim. Applied straight to the blended camera position (equivalent to
// the reference's "camera inside an offset Group": lookAt() re-derives
// orientation from the new eye position either way, no separate Object3D
// needed). Damped per-tick toward the target by PARALLAX_SPEED each frame,
// mirroring the reference's per-frame lerp.
const PARALLAX_INTENSITY = 1;
const PARALLAX_SPEED = 0.6;

// Offset from the avatar's own origin to the point the skills copy visually
// "attaches" to — roughly its head/shoulder. Must be applied on top of the
// avatar's CURRENT position, not a fixed world point: the figure walks forward
// to STANDING_Z as it stands, so a static anchor would be left metres behind it
// by the end of the beat and the copy would drift off the hologram.

let camera: PerspectiveCamera | null = null;

let parallaxEnabled = false;
let cursorX = 0; // normalised clientX/innerWidth - 0.5
let cursorY = 0;
let parallaxX = 0; // damped, currently-applied offset
let parallaxY = 0;
let onMouseMove: ((e: MouseEvent) => void) | null = null;

const tmpPos = new Vector3();
const tmpFocus = new Vector3();

function lerp3(a: [number, number, number], b: [number, number, number], t: number, out: Vector3): Vector3 {
  return out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

export const camera3d = {
  init(ctx: StageContext): void {
    camera = ctx.camera;
    // Progressive enhancement: querying/caching this element and transforming
    // it is the ONLY thing this module does to `.skills` — the section's base
    // CSS already lays it out in normal flow (see index.astro), so if this
    // module never runs (no avatar, no WebGL) the section is untouched.

    // Parallax opt-out: reduced-motion (per HeroCanvas.astro's own gate) and
    // touch/coarse-pointer devices (no meaningful cursor to track). No
    // listener is attached at all in either case, not just a no-op tick.
    parallaxEnabled =
      !matchMedia("(prefers-reduced-motion: reduce)").matches && matchMedia("(pointer: fine)").matches;
    if (parallaxEnabled) {
      onMouseMove = (e: MouseEvent) => {
        cursorX = e.clientX / window.innerWidth - 0.5;
        cursorY = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("mousemove", onMouseMove);
    }
  },

  resize(_aspect: number): void {
    // Waypoint set is chosen live from camera.aspect in tick() — nothing to precompute.
  },

  tick(_dt: number): void {
    if (!camera) return;
    const { weight, progress } = sceneWeights.get("hero");
    if (weight === 0) return; // off-screen: skip the projection/DOM write too

    // Same ramp the walk uses, so the camera arrives when the figure does and
    // then HOLDS. On wipeProgressFor (which runs to 1.0) the camera kept
    // travelling for the whole scroll after the avatar had already stopped,
    // which read as the camera backing away from a standing figure.
    const t = phase2Progress(progress);
    const set = camera.aspect > 1.2 ? WAYPOINTS.landscape : WAYPOINTS.portrait;

    lerp3(set.hero.position, set.about.position, t, tmpPos);
    lerp3(set.hero.focus, set.about.focus, t, tmpFocus);

    if (parallaxEnabled) {
      parallaxX += (cursorX * PARALLAX_INTENSITY - parallaxX) * PARALLAX_SPEED;
      parallaxY += (-cursorY * PARALLAX_INTENSITY - parallaxY) * PARALLAX_SPEED;
      tmpPos.x += parallaxX;
      tmpPos.y += parallaxY;
    }

    camera.position.copy(tmpPos);
    camera.lookAt(tmpFocus);
  },

  destroy(): void {
    if (onMouseMove) {
      window.removeEventListener("mousemove", onMouseMove);
      onMouseMove = null;
    }
    parallaxEnabled = false;
    cursorX = 0;
    cursorY = 0;
    parallaxX = 0;
    parallaxY = 0;
    camera = null;
  },
};
