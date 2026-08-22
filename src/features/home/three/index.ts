import gsap from "gsap"; // already in the `/` graph (index.astro:230-234) — keeps this chunk three-only
import { stage, type StageContext } from "./stage";
import { sceneWeights, attachScrollDriver } from "./sceneWeights";
import { heroBlob } from "./heroBlob";
import { avatar } from "./avatar";
import { room } from "./room";
import { floor } from "./floor";
import { notes3d } from "./notes";
import { copyFadeForProgress } from "./avatar";
import { hologram } from "./hologram";
import { camera3d } from "./camera";

type SceneObject = {
  resize(aspect: number): void;
  tick(dt: number): void;
  destroy(): void;
};

let started = false;
let ctx: StageContext | null = null;
let detach: (() => void) | null = null;
let stageEl: Element | null = null;
let contentEl: HTMLElement | null = null;
let active: SceneObject[] = [];

const tick = (_time: number, deltaTime: number) => {
  try {
    if (!ctx || active.length === 0) return;
    const dt = deltaTime / 1000;
    sceneWeights.tick();

    // Fade the flowing page copy out from under the HUD notes. They are pinned
    // to world anchors over the whole viewport, so anything still scrolling
    // through underneath collides with them. The notes are a SIBLING of this
    // wrapper, not a child, precisely so they survive the fade.
    // Both orientations: the notes overlay the scene either way (projected in
    // landscape, docked to the viewport bottom in portrait), so the page copy
    // scrolling underneath has to clear out of the frame regardless.
    if (contentEl) {
      contentEl.style.opacity = String(1 - copyFadeForProgress(sceneWeights.get("hero").progress));
    }
    for (const obj of active) {
      obj.resize(ctx.camera.aspect); // cheap (position.x + scale set); stage.ts owns the aspect update
      obj.tick(dt);
    }
    if (sceneWeights.get("hero").weight === 0) return; // hero off-screen: zero GPU cost
    ctx.renderer.render(ctx.scene, ctx.camera);
  } catch {
    // Mirrors DiagramBlock.astro's try/catch + silent-fallback pattern.
    destroy();
  }
};

export async function init(canvas: HTMLCanvasElement): Promise<void> {
  if (started) return; // idempotency guard — no double ticker registration
  started = true; // claim early: blocks re-entrant init() calls during the async GLTF load below

  ctx = stage.init(canvas, destroy); // 1. GPU first; bail before anything else allocates
  if (!ctx) {
    started = false;
    ctx = null;
    return;
  }

  stageEl = canvas.closest(".scene-stage");
  contentEl = stageEl?.querySelector<HTMLElement>(".scene-stage__content") ?? null;
  if (stageEl) {
    detach = attachScrollDriver(stageEl, "hero"); // 2. driver starts writing
  }

  // Avatar load is async and third-party (may 404/fail to parse) — never let it break the page.
  let usedAvatar = false;
  try {
    usedAvatar = await avatar.init(ctx);
  } catch {
    usedAvatar = false;
  }

  if (!started || !ctx) {
    avatar.destroy(); // destroy() ran mid-load (e.g. context lost) — undo any partial allocation
    return;
  }

  if (usedAvatar) {
    active = [avatar];
    // Room is a purely decorative desk backdrop — its own failure (404, bad
    // parse) should never take the avatar down with it, so it's tried
    // independently and just omitted from the scene on failure.
    try {
      if (await room.init(ctx)) active.push(room);
    } catch {
      room.destroy();
    }

    // Hologram twin and camera waypoints are both derived purely from the
    // already-loaded avatar (no I/O) — hologram failing (mismatched mesh
    // attributes) just means no dissolve twin; the camera still works fine
    // without it, so it's tried independently too.
    try {
      if (hologram.init(ctx)) active.push(hologram);
    } catch {
      hologram.destroy();
    }

    // Ground disc and skill labels are both pure decoration derived from the
    // avatar's own transform — no I/O, no shared state — so each is tried
    // independently and simply omitted if it throws.
    try {
      if (floor.init(ctx)) active.push(floor);
    } catch {
      floor.destroy();
    }
    try {
      if (notes3d.init(ctx)) active.push(notes3d);
    } catch {
      notes3d.destroy();
    }
    camera3d.init(ctx);
    active.push(camera3d);

    if (!started || !ctx) {
      for (const obj of active) obj.destroy(); // context lost mid-room-load — undo everything
      active = [];
      return;
    }
  } else {
    avatar.destroy(); // no-op if init() failed before allocating anything
    heroBlob.init(ctx);
    active = [heroBlob];
  }

  gsap.ticker.add(tick); // 4. loop last — nothing renders a half-built scene
}

export function destroy(): void {
  if (!started) return;
  gsap.ticker.remove(tick); // FIRST — nothing may render a disposed scene
  detach?.();
  detach = null;
  if (contentEl) contentEl.style.opacity = ""; // hand the copy back to the stylesheet
  contentEl = null;
  stageEl = null;
  for (const obj of active) obj.destroy();
  active = [];
  stage.destroy();
  ctx = null;
  started = false;
}
