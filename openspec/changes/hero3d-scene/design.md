# Design: Hero 3D Scene Skeleton

A `<canvas>` behind the homepage hero, driven by four plain-TypeScript modules under `src/features/home/three/`, mounted by one self-contained `.astro` component. The dependency graph is a **tree rooted at `index.ts`** — no module imports a sibling at runtime, so circular imports are impossible by construction and each piece is independently deletable.

## Quick path

1. `HeroCanvas.astro` renders the canvas + scoped CSS, runs two gates (reduced-motion, WebGL), then `await import()`s the three entry on idle.
2. `index.ts` calls `stage.init(canvas)` → gets a `StageContext`, passes it down to `heroBlob.init(ctx)`, attaches the weight driver, adds ONE `gsap.ticker` callback.
3. Each frame: `sceneWeights.tick()` → `heroBlob.tick(dt)` → `renderer.render()`, skipped entirely when weight is 0.

---

## 1. File tree

```
src/features/home/
├── components/
│   └── HeroCanvas.astro     # canvas element + scoped CSS + gate script + dynamic import. The ONLY importer of ../three
└── three/
    ├── index.ts             # entry singleton: init(canvas)/destroy(); owns wiring + the ticker callback
    ├── stage.ts             # renderer, scene, camera, ResizeObserver, context-loss. Returns StageContext
    ├── sceneWeights.ts      # weight store (get/set/tick) + the swappable IntersectionObserver driver
    └── heroBlob.ts          # placeholder mesh: geometry, ShaderMaterial, inline GLSL, palette, tick, dispose
```

Four files, zero subdirectories. The reference repo's `{core, objects, shaders, utils}` split exists to organise dozens of modules; here each of those buckets would hold exactly one file, so the directories are pure ceremony. **Add a directory the first time a bucket holds a second file** — that is the trigger, not a guess about the future.

`index.astro` changes by exactly two lines: one import, one `<HeroCanvas />` inside `.hero`.

### Refinement vs. the proposal (not a re-opened decision)

The proposal listed the canvas markup/script in `index.astro` and the canvas rule in `global.css`. This design moves both into `HeroCanvas.astro`:

| Reason | Detail |
|--------|--------|
| Repo convention | `MagneticCursor.astro` and `MatrixIntro.astro` are already self-contained `.astro` + `<script>` + `<style>` units. This is the same shape. |
| `global.css` untouched | Astro-scoped `<style>` covers the canvas; `.hero { position: relative }` already exists in `global.css:1038`. Fewer files changed than the proposal projected. |
| Rollback shrinks | Delete one directory + one import line. |
| Isolation is unchanged | `HeroCanvas.astro` is imported only by `index.astro`, so `/` is still the only route in the three graph. |

The locked decision says "plain `<script>` in an `.astro` component" — this satisfies it literally.

---

## 2. Module contracts

### Dependency graph (acyclic by construction)

```
index.ts ──> stage.ts          (runtime)
         ├─> sceneWeights.ts   (runtime)
         └─> heroBlob.ts       (runtime)
                  ├─> sceneWeights.ts        (runtime, READ ONLY)
                  └─> stage.ts               (TYPE ONLY — erased at build, no runtime edge)
```

**The rule that keeps it acyclic:** `stage` exposes no module-level mutable state for others to reach back into. It *returns* its context, and `index.ts` hands that context down. Nothing has to import "the scene" from a global.

### `stage.ts`

```ts
export type StageContext = {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
};

export const stage = {
  /** null = WebGLRenderer construction failed (blocklisted GPU, OOM). Caller bails silently. */
  init(canvas: HTMLCanvasElement, onContextLost: () => void): StageContext | null;
  destroy(): void;
};
```

`onContextLost` is injected rather than imported, so `stage` never needs to know `index.ts` exists.

### `sceneWeights.ts`

```ts
export type SceneKey = "hero";
export type SceneWeight = { in: number; out: number; weight: number };

export const sceneWeights = {
  get(key: SceneKey): Readonly<SceneWeight>;              // objects READ
  set(key: SceneKey, edge: "in" | "out", v: number): void; // drivers WRITE
  tick(): void;                                            // weight = clamp(in * (1 - out), 0, 1)
};

/** Swappable driver. Returns its own cleanup. */
export function attachIntersectionDriver(el: Element, key: SceneKey): () => void;
```

### `heroBlob.ts`

```ts
export const heroBlob = {
  init(ctx: StageContext): void;     // build mesh, add to ctx.scene, read palette, attach theme listeners
  tick(dt: number): void;            // smooth toward weight, write uniforms
  resize(aspect: number): void;      // reposition/rescale for the layout breakpoint
  destroy(): void;                   // remove from scene, dispose geometry + material, drop listeners
};
```

### `index.ts` — init order

```ts
export function init(canvas: HTMLCanvasElement): void {
  if (started) return;                          // idempotency guard — no double ticker registration
  const ctx = stage.init(canvas, destroy);      // 1. GPU first; bail before anything else allocates
  if (!ctx) return;
  detach = attachIntersectionDriver(hero, "hero"); // 2. driver starts writing
  heroBlob.init(ctx);                              // 3. object reads ctx + weights
  gsap.ticker.add(tick);                           // 4. loop last — nothing renders a half-built scene
  started = true;
}
```

Order matters in one direction only: **the ticker is added last and removed first.** Everything else is allocation order.

---

## 3. `sceneWeights` — the decoupling seam

```ts
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const state: Record<SceneKey, SceneWeight> = { hero: { in: 0, out: 0, weight: 0 } };

tick() {
  for (const k in state) {
    const s = state[k as SceneKey];
    s.weight = clamp01(s.in * (1 - s.out));
  }
}
```

### Why this is swappable without touching objects

The seam is the **function signature, not the file boundary**. Drivers may only call `set`; objects may only call `get`. Neither side can reach the other.

| Today (IntersectionObserver) | Later (ScrollTrigger / Lenis) |
|------------------------------|-------------------------------|
| `isIntersecting` → `set("hero","in",1)`, `set("hero","out",0)` | `onUpdate: self => set("hero","in", self.progress)` |
| leaves viewport → `set("hero","out",1)` | second trigger writes fractional `out` |
| `weight` is effectively binary | `weight` is a continuous ramp |

`heroBlob.tick` reads `get("hero").weight` in both worlds and changes by zero lines. The swap replaces one function with the same `(el, key) => cleanup` shape.

The driver lives in `sceneWeights.ts` rather than its own file because ~20 lines of `IntersectionObserver` in a separate module buys nothing the signature doesn't already guarantee. Split it when a **second** driver exists.

### Binary weight is not a visual pop

`heroBlob` keeps its own smoothed value, so no scroll library is needed for a soft fade:

```ts
displayed += (sceneWeights.get("hero").weight - displayed) * Math.min(1, dt * 4);
```

---

## 4. Render loop ownership

**One `gsap.ticker` callback for the whole scene. `renderer.setAnimationLoop` is explicitly NOT used** — it would open a second `requestAnimationFrame` loop competing with GSAP's.

```ts
// deltaTime arrives in MILLISECONDS from gsap.ticker
const tick = (_time: number, deltaTime: number) => {
  const dt = deltaTime / 1000;
  sceneWeights.tick();
  const w = sceneWeights.get("hero").weight;
  if (w === 0 && displayed < 0.001) return;   // hero off-screen: zero GPU cost
  heroBlob.tick(dt);
  ctx.renderer.render(ctx.scene, ctx.camera);
};
```

### Coexistence with existing GSAP usage on `/`

`src/pages/index.astro:230-234` **already statically imports `gsap` + `ScrollTrigger` and calls `registerPlugins()`**. `DiagramBlock.astro:91` does `await import("gsap")`. Vite dedupes all of these to one module instance, therefore one `gsap.ticker`.

| Concern | Resolution |
|---------|------------|
| Double registration | `index.ts` guards with `started`; `gsap.ticker.add(tick)` runs exactly once with a stable function reference, `remove(tick)` uses the same reference. |
| Fighting for the ticker | `ticker.add` appends a callback — it does not take ownership. ScrollTrigger registered earlier at module-eval, so its update runs *before* ours each frame. Our reads are already fresh; no ordering work needed. |
| `DiagramBlock` conflict | It only builds timelines; it never adds ticker callbacks and never touches ticker globals. No interaction. |
| **Hard rule** | Never call `gsap.ticker.fps()`, `gsap.ticker.lagSmoothing()`, or `gsap.ticker.remove()` on a callback we did not add. Those are process-global and would silently alter every existing tween and ScrollTrigger on `/`. |

`gsap` is imported **statically** in `index.ts` (not `await import`) — it is already in the `/` graph, so Vite hoists it to a shared chunk and the three chunk stays three-only, which also makes the budget measurement honest.

---

## 5. Teardown

### Exact dispose sequence

```
1. gsap.ticker.remove(tick)            // FIRST — nothing may render a disposed scene
2. detach()                            // IntersectionObserver.disconnect()
3. heroBlob.destroy()
     document.removeEventListener("themechange", readPalette)
     document.removeEventListener("modechange",  readPalette)
     ctx.scene.remove(mesh)
     mesh.geometry.dispose()
     mesh.material.dispose()           // ShaderMaterial; no textures exist to dispose
4. stage.destroy()
     resizeObserver.disconnect()
     canvas.removeEventListener("webglcontextlost", handler)
     renderer.dispose()
     renderer.forceContextLoss()       // AFTER dispose(); frees the GPU context immediately
5. started = false; ctx = null
```

### What triggers it

| Trigger | Behaviour |
|---------|-----------|
| `webglcontextlost` | Call `destroy()`. Deliberately **do NOT** `preventDefault()` — we do not want restoration; the `.hero::before` crosshatch is the fallback and it is already on screen. Also do NOT call `forceContextLoss()` from inside this handler (already lost). |
| Page navigation | Full document unload. The browser reclaims the GPU context. Nothing to do. |
| `astro:before-swap` | **Not applicable and must not be added.** `ClientRouter`/`ViewTransitions` are not used anywhere in `src/` (verified: zero matches). A listener for an event that never fires is dead code. Add it in the same change that adopts ViewTransitions, not before. |
| `beforeunload` / `pagehide` | **Do not add.** A `beforeunload` listener disqualifies the page from the bfcache in Chrome and Firefox — a real regression traded for cleanup the browser does for free. |

`destroy()` stays exported as the escape hatch context-loss and dev-HMR need. That is its only job.

---

## 6. The shader

Unlit fresnel rim over a two-colour gradient. No lights, no shadow maps, no textures — that is what keeps a three scene cheap.

```glsl
// vertex — view-space normal + view vector
vNormal  = normalize(normalMatrix * normal);
vViewPos = -(modelViewMatrix * vec4(position, 1.0)).xyz;

// fragment
float f = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPos)), 0.0, 1.0), uFresnelPower);
vec3  c = mix(uColorB, uColorA, f);
gl_FragColor = vec4(c, f * uProgress * uOpacity);
```

`ShaderMaterial({ transparent: true, depthWrite: false, blending: NormalBlending })`. Additive blending is rejected: it blows out against light mode's `#fafaf6` background.

| Uniform | Source |
|---------|--------|
| `uTime` | accumulated `dt`, **only while rendering** — so scrolling back does not jump the animation |
| `uProgress` | the smoothed `sceneWeights.get("hero").weight`. This is the weight→visual proof the change exists to demonstrate |
| `uColorA` | `--accent` |
| `uColorB` | `--border-strong` |
| `uFresnelPower`, `uOpacity` | constants (≈3.0, ≈0.5) |

### Theme: REACTIVE, via the events the app already dispatches — decided

The shader reads CSS custom properties at init and re-reads on theme change. It is not theme-neutral.

```ts
const readPalette = () => {
  const cs = getComputedStyle(document.documentElement);
  uniforms.uColorA.value.set(cs.getPropertyValue("--accent").trim());
  uniforms.uColorB.value.set(cs.getPropertyValue("--border-strong").trim());
};
document.addEventListener("themechange", readPalette);  // ThemeSwitcher.astro:37
document.addEventListener("modechange",  readPalette);  // ModeToggle.astro:30
```

Why reactive wins on cost: the site has **3 themes × 2 modes × 4 accents**, and `BaseHead.astro:64-69` sets `data-mode`/`data-accent` before paint, so the first read is already correct with no flash. There is no new mechanism to build — the `themechange`/`modechange` `CustomEvent`s exist today. A hardcoded palette would need per-mode tuning anyway (light mode's near-white `#fafaf6` background makes a dark-tuned rim invisible), so "neutral" is more work *and* worse.

Two gotchas worth writing down:

- `getPropertyValue` returns a leading-space string → `.trim()` before `Color.set()`. Read only the plain-hex tokens; `--accent-soft` is `rgba(...)` and `Color.set()` will not parse it.
- No `accentchange` event exists because no accent switcher UI ships yet. `--accent` is therefore read at init and on the two events that do exist. Correct today; add the third listener in the change that adds the switcher.
- three's `ColorManagement` is on by default (r152+) and `renderer.outputColorSpace` defaults to sRGB, so `Color.set('#7cf08c')` converts to linear working space correctly. **Do not "fix" this with a manual conversion.**

GLSL lives as template-literal consts inside `heroBlob.ts` (one shader, one consumer). Split into a `shaders/` file when a second object needs the same source or the GLSL passes ~80 lines.

---

## 7. Bundle strategy

**Named imports from `three` core only.** Never `import * as THREE`, never `three/examples/jsm/*` (controls, loaders and post-processing each drag in large graphs):

```ts
import {
  WebGLRenderer, Scene, PerspectiveCamera,
  Mesh, IcosahedronGeometry, ShaderMaterial, Color,
} from "three";
```

### Verifying the budget

```bash
npm run build
ls -l dist/client/_astro/            # find the three chunk by size
gzip -c dist/client/_astro/<chunk>.js | wc -c   # the number that matters
```

Route isolation, verified against build output rather than intent — `output: 'server'` means `/` has no static HTML, so check at runtime:

```bash
npm run preview
# the three chunk filename must appear for / and for nothing else
curl -s localhost:4321/       | rg '<chunk>'   # expect a hit
curl -s localhost:4321/blog/  | rg '<chunk>'   # expect zero hits
```

### RISK: the ≤80KB gzip target is probably not reachable

`WebGLRenderer` transitively references most of three's material and shader-chunk graph, so it tree-shakes far less than people expect. A minimal `WebGLRenderer + Scene + PerspectiveCamera + Mesh + ShaderMaterial` build on recent three versions commonly lands **~110-130KB gzip** — over the proposal's 100KB hard ceiling, let alone the 80KB target.

**Do not design around a guess. Measure first**: install `three`, build the skeleton with one mesh, read the gzipped chunk. That is a short spike, and it is the gate for everything below.

| If measured | Do this |
|-------------|---------|
| ≤100KB | Ship. Record the real number as the regression baseline. |
| >100KB | **Renegotiate the budget, do not swap the library.** The mitigating facts are strong: `/`-only, dynamically imported, deferred to idle after LCP, and never fetched at all under reduced-motion or no-WebGL. |
| >100KB and the budget is non-negotiable | Only then reconsider the library — and note that dropping three means hand-rolling ~2KB of WebGL2 for one fullscreen fresnel quad, which is genuinely viable *for this skeleton* but must be rewritten the moment the deferred GLTF avatar lands. Paying that rewrite is almost certainly worse than paying the bytes. |

Also verify at install whether the installed `three` ships its own `.d.ts` (check the `types` field in `node_modules/three/package.json`). Recent versions do; add `@types/three` only if that check fails.

---

## 8. Camera, renderer and geometry

| Choice | Value | Why |
|--------|-------|-----|
| Camera | `PerspectiveCamera(35, aspect, 0.1, 100)` at `z = 6`, looking at origin | Fresnel is a function of view direction. Orthographic gives a perfectly uniform rim that reads as a flat sticker. FOV 35 is narrow enough to avoid edge distortion. |
| Geometry | `IcosahedronGeometry(1.4, 4)` | Procedural, zero asset bytes, ~5k tris, even vertex distribution, and the natural base for the vertex-displacement blob a later change will want. |
| Renderer | `WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power" })` + `setClearAlpha(0)` | **`alpha: true` is load-bearing** — without it the canvas paints an opaque black rectangle over `.hero::before` and destroys light mode. AA off is free here (soft fresnel, no hard silhouette); turn it on only if the rim visibly stair-steps. |
| DPR | `setPixelRatio(Math.min(devicePixelRatio, 2))`, reapplied on every resize | Locked decision. Above 2 is invisible and quadratically expensive. |
| Resize | `ResizeObserver` on the canvas parent, **not** `window.resize` | `.hero` is content-sized, so it reflows without a window resize — the typewriter at `index.astro:251` sets `minHeight` after font load, which `window.resize` would miss entirely. RO also fires at frame granularity, so no debounce, and teardown is one `disconnect()`. Guard against 0×0. |

### Composing with `.hero__inner`

Hero content is left-aligned: title `max-width: 980px`, lede `640px`, stats `900px`, inside a `1180px` container. The empty space is on the **right**.

```ts
resize(aspect) {
  const wide = aspect > 1.2;
  mesh.position.x = wide ? 1.8 : 0;
  mesh.scale.setScalar(wide ? 1 : 0.6);
}
```

No JS media queries — the aspect ratio the camera already tracks is the same signal. Three independent guarantees keep the text readable: `.hero__inner { z-index: 1 }` (`global.css:1053`) sits above the canvas at `z-index: 0`, the mesh is offset right of the type, and `uOpacity ≈ 0.5` keeps it faint. Canvas carries `aria-hidden="true"` and `pointer-events: none`.

### Gate order in `HeroCanvas.astro`

```ts
if (!canvas) return;
if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;   // 1
if (!hasWebGL()) return;                                              // 2
const load = () => import("../three").then(m => m.init(canvas)).catch(() => {});
"requestIdleCallback" in window                                       // 3
  ? requestIdleCallback(load, { timeout: 2000 })
  : setTimeout(load, 300);
```

Both gates run **before** the dynamic import, so gated-out users never fetch the chunk. `hasWebGL()` creates a throwaway probe context (`getContext("webgl2") || getContext("webgl")`) rather than checking `typeof WebGL2RenderingContext` — the cheap check only proves the API symbol exists, not that a context can actually be created on a blocklisted GPU. Idle-deferral keeps a ~120KB parse away from the hero LCP and the typewriter that starts immediately at `index.astro:240`.

Note that the `IntersectionObserver` here is **not** an import gate — the hero is at page top and always visible on load. The only `IntersectionObserver` in this design is `sceneWeights`' weight driver.

---

## Alternatives considered / rejected

| # | Decision | Rejected alternative | Why |
|---|----------|---------------------|-----|
| 1 | `stage.init()` **returns** a context, passed down | Module-level `export let scene` that siblings import | Nullable module globals force null-checks everywhere and create the exact import cycles the tree shape makes impossible. |
| 2 | 4 flat files | Scaffold `core/ objects/ shaders/ utils/` like the reference | Each bucket would hold one file. Directories are a response to file count, not a prediction of it. |
| 3 | Driver inside `sceneWeights.ts` | Separate `weightDriver.ts` | The seam is `get`/`set`, not the filename. Split at the second driver. |
| 4 | `gsap.ticker.add` | `renderer.setAnimationLoop` | Two rAF loops on a page that already runs ScrollTrigger. |
| 5 | Reactive theme via existing `themechange`/`modechange` | Fixed theme-neutral palette | 6 theme×mode combos; light mode's near-white bg would swallow a dark-tuned rim. The events already exist — reactive is *less* work than tuning a neutral. |
| 6 | `ResizeObserver` | `window.resize` | The hero reflows on font load without a window resize. |
| 7 | `IcosahedronGeometry` | `SphereGeometry` (pole pinching, UV seam), `TorusKnotGeometry` (visually busy, competes with the type) | Even tessellation, and the right base for a future displacement blob. |
| 8 | Probe-context WebGL detection | `typeof WebGL2RenderingContext !== "undefined"` | Only proves the symbol exists, not that a context can be created. |
| 9 | Do not `preventDefault()` on `webglcontextlost` | Restore the context and rebuild | Restoration is a retry loop for a device that already failed. The CSS fallback is already on screen and costs nothing. |
| 10 | No `astro:before-swap`, no `beforeunload` | Wire both "for safety" | ViewTransitions are not in use (event never fires); `beforeunload` actively disqualifies the bfcache. |
| 11 | Keep `three`, renegotiate the budget if over | Hand-rolled WebGL2 to hit 80KB | ~2KB and viable *for this skeleton only* — it must be thrown away when the deferred GLTF avatar lands. |

## Checklist for the tasks phase

- [ ] Bundle spike runs **before** the shader/geometry work — its number gates the budget decision.
- [ ] `sceneWeights.tick()` clamp math is pure and `vitest` is already installed: one small unit test covers `in`/`out` → `weight`, including the `in=1, out=1 → 0` case. Nothing else here needs a test.
- [ ] Route isolation is verified against `npm run preview` output, not against intent.
- [ ] Confirm `three` ships bundled types before adding `@types/three`.

## Next step

`sdd-tasks` — after `sdd-spec` lands `openspec/changes/hero3d-scene/specs/hero3d/spec.md`.
