// Decoupling seam between scroll drivers (WRITE in/out) and 3D objects (READ weight only).
// See design.md §3 — the seam is this function signature, not a file boundary.

export type SceneKey = "hero";
export type SceneWeight = { in: number; out: number; weight: number };

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

const state: Record<SceneKey, SceneWeight> = {
  hero: { in: 0, out: 0, weight: 0 },
};

export const sceneWeights = {
  get(key: SceneKey): Readonly<SceneWeight> {
    return state[key];
  },
  set(key: SceneKey, edge: "in" | "out", v: number): void {
    state[key][edge] = v;
  },
  tick(): void {
    for (const k in state) {
      const s = state[k as SceneKey];
      s.weight = clamp01(s.in * (1 - s.out));
    }
  },
};

/**
 * Swappable driver: writes `in`/`out` from IntersectionObserver visibility.
 * Lives here (not its own file) until a second driver exists — see design.md §3.
 */
export function attachIntersectionDriver(el: Element, key: SceneKey): () => void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      sceneWeights.set(key, "in", entry.isIntersecting ? 1 : 0);
      sceneWeights.set(key, "out", entry.isIntersecting ? 0 : 1);
    }
  });
  observer.observe(el);
  return () => observer.disconnect();
}
