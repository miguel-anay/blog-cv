import gsap from "gsap"; // already in the `/` graph (index.astro:230-234) — keeps this chunk three-only
import { stage, type StageContext } from "./stage";
import { sceneWeights, attachIntersectionDriver } from "./sceneWeights";
import { heroBlob } from "./heroBlob";

let started = false;
let ctx: StageContext | null = null;
let detach: (() => void) | null = null;
let heroEl: Element | null = null;

const tick = (_time: number, deltaTime: number) => {
  try {
    if (!ctx) return;
    const dt = deltaTime / 1000;
    sceneWeights.tick();
    heroBlob.resize(ctx.camera.aspect); // cheap (position.x + scale set); stage.ts owns the aspect update
    heroBlob.tick(dt);
    if (sceneWeights.get("hero").weight === 0) return; // hero off-screen: zero GPU cost
    ctx.renderer.render(ctx.scene, ctx.camera);
  } catch {
    // Mirrors DiagramBlock.astro's try/catch + silent-fallback pattern.
    destroy();
  }
};

export function init(canvas: HTMLCanvasElement): void {
  if (started) return; // idempotency guard — no double ticker registration

  ctx = stage.init(canvas, destroy); // 1. GPU first; bail before anything else allocates
  if (!ctx) {
    ctx = null;
    return;
  }

  heroEl = canvas.closest(".hero");
  if (heroEl) {
    detach = attachIntersectionDriver(heroEl, "hero"); // 2. driver starts writing
  }

  heroBlob.init(ctx); // 3. object reads ctx + weights

  gsap.ticker.add(tick); // 4. loop last — nothing renders a half-built scene
  started = true;
}

export function destroy(): void {
  if (!started) return;
  gsap.ticker.remove(tick); // FIRST — nothing may render a disposed scene
  detach?.();
  detach = null;
  heroEl = null;
  heroBlob.destroy();
  stage.destroy();
  ctx = null;
  started = false;
}
