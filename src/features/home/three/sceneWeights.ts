// Decoupling seam between scroll drivers (WRITE in/out/progress) and 3D objects
// (READ weight/progress only). See design.md §3 — the seam is this function
// signature, not a file boundary.

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger); // idempotent — safe even if index.astro already ran registerPlugins()

export type SceneKey = "hero";
export type SceneWeight = { in: number; out: number; weight: number; progress: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const state: Record<SceneKey, SceneWeight> = {
  hero: { in: 0, out: 0, weight: 0, progress: 0 },
};

export const sceneWeights = {
  get(key: SceneKey): Readonly<SceneWeight> {
    return state[key];
  },
  set(key: SceneKey, edge: "in" | "out", v: number): void {
    state[key][edge] = v;
  },
  setProgress(key: SceneKey, v: number): void {
    state[key].progress = clamp01(v);
  },
  tick(): void {
    for (const k in state) {
      const s = state[k as SceneKey];
      s.weight = clamp01(s.in * (1 - s.out));
    }
  },
};

/**
 * Scroll-driven driver — two ScrollTrigger instances on the same tall stage element:
 *
 * - visibility ("top bottom" → "bottom top", the same wide window the old
 *   IntersectionObserver used): writes in/out → weight. Answers "is the stage
 *   anywhere near the viewport" — gates render/skinning cost.
 * - narrative ("top top" → "bottom bottom", exactly the sticky-pin's stuck
 *   duration regardless of stage height): writes progress 0→1. Answers "how far
 *   through the pinned scene" — drives the avatar's typing → standing crossfade.
 *
 * 3D objects only ever read `.weight` / `.progress` via sceneWeights.get(); they
 * never touch scroll or ScrollTrigger directly.
 */
export function attachScrollDriver(el: Element, key: SceneKey): () => void {
  const syncVisibility = (self: ScrollTrigger) => {
    sceneWeights.set(key, "in", self.isActive ? 1 : 0);
    sceneWeights.set(key, "out", self.isActive ? 0 : 1);
  };
  const visibilityTrigger = ScrollTrigger.create({
    trigger: el,
    start: "top bottom",
    end: "bottom top",
    onUpdate: syncVisibility,
    onToggle: syncVisibility,
    onRefresh: syncVisibility,
  });
  syncVisibility(visibilityTrigger);

  const syncProgress = (self: ScrollTrigger) => sceneWeights.setProgress(key, self.progress);
  const progressTrigger = ScrollTrigger.create({
    trigger: el,
    start: "top top",
    end: "bottom bottom",
    onUpdate: syncProgress,
    onRefresh: syncProgress,
  });
  syncProgress(progressTrigger);

  return () => {
    visibilityTrigger.kill();
    progressTrigger.kill();
  };
}
