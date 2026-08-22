import { Vector3, type PerspectiveCamera } from "three";
import type { StageContext } from "./stage";
import { sceneWeights } from "./sceneWeights";
import { avatarPositionForProgress, avatarScaleForProgress, phase2Progress } from "./avatar";

// HUD notes pinned around the standing figure.
//
// Modelled on the reference portfolio's projected boxes (davidhckh/portfolio-2025,
// https://david-hckh.com), which anchors BoxDetails/BoxDescription/BoxServices
// at (-0.76, 3.6, 6.75), (-0.9, 2, 6.75) and (0.75, 2.75, 6.75) — three fixed
// world points, each carrying one bordered panel, all on the same z plane as
// the standing avatar.
//
// The notes are the page's OWN elements, only repositioned. Without this module
// (no WebGL, reduced motion, JS error, portrait) they stay in normal flow,
// readable and in document order. WebGL text was rejected for the usual
// reasons: needs a font atlas or SDF pass, resamples badly, cannot see the
// site's theme tokens, invisible to search and assistive tech.

// One anchor per note, in the DOM order the notes appear.
//
// These are OFFSETS FROM THE AVATAR in avatar-local units, not fixed world
// points. They used to be fixed points, which meant the notes stayed put while
// the figure rose, walked and grew — pinned to the scene rather than to him.
// Multiplying by his live scale keeps them the same distance from his body as
// he grows, instead of the gap opening up.
//
// The model is ~4.3 local units tall and ~4.3 wide, so ±2 clears the silhouette
// with a little air. z is 0: the notes ride his own depth plane, so none of them
// float in front of or behind him. `side` is which edge the leader line hangs
// off, so a note to his LEFT points right, back at him.
type Anchor = { offset: Vector3; side: "left" | "right" };

const ANCHORS: Anchor[] = [
  { offset: new Vector3(-2.0, 3.3, 0), side: "right" },
  { offset: new Vector3(-2.2, 1.6, 0), side: "right" },
  { offset: new Vector3(2.0, 2.9, 0), side: "left" },
  { offset: new Vector3(2.2, 1.2, 0), side: "left" },
];

// Notes stagger in rather than all appearing together: note i starts at
// i * STAGGER of the reveal and takes the remainder to finish.
const STAGGER = 0.12;

// Breathing room between the figure's feet and the docked panel, and the inset
// that keeps the panel off the canvas edges.
const GAP = 14;

type Note = { el: HTMLElement; anchor: Anchor; delay: number };

let camera: PerspectiveCamera | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let listEl: HTMLElement | null = null;
// Which layout the notes are currently in. Portrait DOCKS them to the bottom of
// the viewport instead of projecting (see tick), so this tracks the mode and
// only writes styles on a change rather than every frame.
type Mode = "pinned" | "docked" | null;
let mode: Mode = null;
let notes: Note[] = [];

const tmp = new Vector3();

// Same aspect convention the camera waypoints use.
const isLandscape = (camera: PerspectiveCamera): boolean => camera.aspect > 1.2;

function clearInlineLayout(el: HTMLElement): void {
  el.style.position = "";
  el.style.left = "";
  el.style.top = "";
  el.style.margin = "";
  el.style.transform = "";
}

function setMode(next: Mode): void {
  if (mode === next) return;
  for (const { el, anchor } of notes) {
    clearInlineLayout(el);
    if (next === null) {
      el.style.willChange = "";
      el.style.pointerEvents = "";
      el.style.opacity = "";
      el.style.visibility = "";
      delete el.dataset.projected;
      delete el.dataset.side;
      continue;
    }
    el.style.willChange = "transform, opacity";
    el.style.pointerEvents = "none";
    el.dataset.projected = "true"; // both modes get the hologram panel styling
    if (next === "pinned") {
      // Only the projected mode positions each note itself; docked leaves the
      // whole list to the stylesheet, which anchors it to the viewport bottom.
      el.style.position = "fixed";
      el.style.left = "0";
      el.style.top = "0";
      el.style.margin = "0";
      el.dataset.side = anchor.side;
    } else {
      delete el.dataset.side; // no leader line when there is no figure to point at
    }
  }
  mode = next;
}

export const notes3d = {
  /** Resolves false when the page ships no notes — caller just skips it. */
  init(ctx: StageContext): boolean {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".hud-note"));
    if (els.length === 0) return false;
    listEl = els[0]!.closest<HTMLElement>(".hud-notes");

    camera = ctx.camera;
    // project() yields coordinates in the CANVAS's own box, so the notes have
    // to be placed against that box — not against the viewport. They are only
    // the same rect while the pin is latched; once it releases at the end of
    // the stage the canvas scrolls away and viewport maths would leave the
    // notes behind, floating over the page.
    canvasEl = ctx.renderer.domElement;
    notes = els.map((el, i) => {
      // Cycle if the page ever ships more notes than there are anchors, rather
      // than silently dropping them off-screen at (0,0,0).
      const anchor = ANCHORS[i % ANCHORS.length]!;
      return { el, anchor, delay: i * STAGGER };
    });
    return true;
  },

  resize(_aspect: number): void {
    // Anchors are world-space and re-projected every tick — nothing to precompute.
  },

  tick(_dt: number): void {
    if (!camera || notes.length === 0) return;

    const landscape = isLandscape(camera);
    setMode(landscape ? "pinned" : "docked");

    const { weight, progress } = sceneWeights.get("hero");

    const reveal = phase2Progress(progress);
    if (weight === 0 || reveal === 0) {
      for (const { el } of notes) {
        el.style.opacity = "0";
        el.style.visibility = "hidden"; // also drops them out of hit-testing
      }
      return;
    }

    // Live rect: the pin is sticky, so this is (0, 0, vw, vh) while latched and
    // slides off as it releases. One read per frame, shared by every note.
    const rect = canvasEl!.getBoundingClientRect();

    // Portrait DOCKS instead of projecting: four boxes orbiting a figure on a
    // 390px screen is unreadable, and there is no room beside the silhouette to
    // put them. The reference does the same — it only projects in landscape and
    // otherwise pins the panel below the figure, full width.
    //
    // The stylesheet lays the panel out (full width, grid) but does NOT place it
    // vertically: a CSS `bottom` is viewport-relative, so the panel stayed glued
    // to the bottom of the screen while the scene scrolled out from behind it.
    // Placement is driven from the figure's own feet instead, then clamped
    // inside the canvas so the panel can never outlive the frame it belongs to.
    if (!landscape) {
      if (!listEl) return;
      const [ax, ay, az] = avatarPositionForProgress(progress);
      tmp.set(ax, ay, az).project(camera); // the origin sits at the feet (STANDING_Y === floor)
      const feetY = rect.top + (1 - (tmp.y * 0.5 + 0.5)) * rect.height;

      const h = listEl.offsetHeight;
      const lo = rect.top + GAP;
      const hi = rect.bottom - h - GAP;
      // hi < lo means the canvas is too short (or too far gone) to hold the
      // panel at all — better to drop it than to squeeze it half outside.
      const visible = hi >= lo;
      listEl.style.visibility = visible ? "visible" : "hidden";
      if (!visible) return;

      listEl.style.transform = `translateY(${Math.min(hi, Math.max(lo, feetY + GAP)).toFixed(1)}px)`;
      for (const { el } of notes) {
        el.style.visibility = "visible";
        el.style.opacity = String(reveal);
      }
      return;
    }
    if (listEl) {
      // Landscape places each note itself; hand the list back.
      listEl.style.transform = "";
      listEl.style.visibility = "";
    }


    // Re-read the figure every frame — he rises, walks and grows, and the notes
    // are attached to him, not to the world.
    const [ax, ay, az] = avatarPositionForProgress(progress);
    const scale = avatarScaleForProgress(progress);

    for (const { el, anchor, delay } of notes) {
      // Remaining window shrinks as the delay grows, so every note still
      // finishes at reveal === 1 no matter where it started.
      const span = 1 - delay;
      const t = span <= 0 ? 1 : Math.min(1, Math.max(0, (reveal - delay) / span));
      if (t === 0) {
        el.style.opacity = "0";
        el.style.visibility = "hidden";
        continue;
      }

      tmp.set(
        ax + anchor.offset.x * scale,
        ay + anchor.offset.y * scale,
        az + anchor.offset.z * scale,
      ).project(camera);
      const x = rect.left + (tmp.x * 0.5 + 0.5) * rect.width;
      const y = rect.top + (1 - (tmp.y * 0.5 + 0.5)) * rect.height;

      // Anchored by the edge the leader hangs off, so the copy grows away from
      // the figure instead of creeping over it as the text gets longer.
      const originX = anchor.side === "right" ? "-100%" : "0%";

      // Clip to the scene. The notes are position:fixed, so nothing stops them
      // being painted over whatever sits beyond the canvas once the pin starts
      // releasing at the end of the stage — they must never outlive the frame
      // they belong to. Bounds are the canvas box itself, with a small inset so
      // a note is dropped as its anchor reaches the edge rather than after it
      // has already half-escaped.
      const M = 8;
      const inside =
        x >= rect.left - M &&
        x <= rect.right + M &&
        y >= rect.top + M &&
        y <= rect.bottom - M;
      if (!inside) {
        el.style.opacity = "0";
        el.style.visibility = "hidden";
        continue;
      }

      el.style.visibility = "visible";
      el.style.opacity = String(t);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(${originX}, -50%)`;
    }
  },

  destroy(): void {
    setMode(null);
    if (listEl) {
      listEl.style.transform = "";
      listEl.style.visibility = "";
    }
    listEl = null;
    notes = [];
    canvasEl = null;
    camera = null;
  },
};
