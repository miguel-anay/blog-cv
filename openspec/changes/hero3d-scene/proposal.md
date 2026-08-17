# Proposal: Hero 3D Scene Skeleton

## Intent

The homepage hero is flat: static type over a CSS crosshatch (`.hero::before`). We want a WebGL layer there, but the real target (an avatar, multi-section choreography) is large. Building it in one pass means a monolithic PR and a rendering architecture chosen by accident. This change lands the **load-bearing skeleton only** — canvas lifecycle, the `sceneWeights` decoupling mechanism, one render loop, one placeholder object — so later scenes are additive, not archaeological.

## Scope

### In Scope

- One `<canvas>` inside `.hero` on `/`, behind `.hero__inner`, decorative (`aria-hidden`, `pointer-events: none`).
- Singleton `init`/`destroy` three.js module: renderer, scene, camera, resize, context-loss handling.
- `sceneWeights` store: `IntersectionObserver` writes `hero.{in,out}`; a tick derives `weight = clamp(in * (1 - out), 0, 1)`; objects read it.
- Single `gsap.ticker` render loop (gsap already a dependency).
- One procedural-shader placeholder mesh proving the weight → visual path end to end.
- Double gate (`prefers-reduced-motion`, WebGL support) **before** the dynamic import.

### Out of Scope

- Avatar / GLTF / any `.glb`, textures, or loaders.
- Audio, multi-scene choreography, raycast interaction, post-processing.
- Persistent canvas across routes (ViewTransitions). SPA migration — Astro stays.
- Canvas on any route other than `/`.

## Capabilities

### New Capabilities

- `hero-3d-scene`: canvas lifecycle, scroll-weight state, render loop, and degradation contract for the homepage WebGL layer.

### Modified Capabilities

- None.

## Approach

Mirror `DiagramBlock.astro:76-153`, the repo's proven pattern: an inline `<script>` in `index.astro` runs both gates, then `await import()`s the three entry. Failure at any step is a silent no-op — the existing `.hero::before` background is already the fallback, so there is no second UI to build or keep in sync.

The three.js code is framework-agnostic TypeScript with a two-function surface (`init(canvas)` / `destroy()`). Astro owns mounting; three owns nothing about the DOM beyond the canvas.

## Key Decisions

| # | Decision | Rationale / Tradeoff |
|---|----------|----------------------|
| **B** | Code lives in **`src/features/home/three/`**, not top-level `src/three/` | Headline decision. CLAUDE.md's Scope Rule ("used by 1 feature → stays local") is stated as absolute, and the canvas is `/`-only by locked decision. The reference repo uses top-level `src/three/` because its canvas is site-wide — a different constraint, so copying its layout would import a premise we rejected. **Migration path**: if a later change makes the canvas site-wide, the modules move to `src/components/` or top-level unchanged; they are plain TS with no Astro or feature coupling. Cheap move, so locality costs nothing to reverse |
| **A** | Plain `<script>`, not a React island | 100% of live interactive code uses this. React ships zero client JS today; the two `.tsx` files are dead code. Three.js is imperative and needs no reactive rendering — an island would make `/` the first route to pay ~130KB of React for nothing |
| **C** | Inline template-literal GLSL | One shader. A `vite-plugin-glsl` dependency for one string is premature. Revisit when shader count grows |
| **D** | `IntersectionObserver` → weights; `gsap.ticker` → loop | No Lenis, no ScrollTrigger: the skeleton's weight is effectively binary. The writer is a swappable module so a scroll-progress driver can replace it later without touching the three.js read side |
| **1** | **No resource-load gate** | The reference's `resources.once("ready")` gates GLB + room assets. We load nothing async. A gate here is a factory with one product. Add it in the change that introduces the first real asset |
| **2** | **Procedural shader, no matcap texture** | No matcap exists in the repo, so "matcap" means sourcing, licensing, color-space and encoding decisions for an asset the skeleton doesn't need. A fresnel/gradient fragment shader is zero bytes of asset, zero loader, and still lights-free. Tradeoff: the placeholder won't look like the reference — acceptable, it is a placeholder |
| **3** | **`Math.min(devicePixelRatio, 2)`**, reapplied on resize | Above 2 is invisible and quadratically expensive. No adaptive/dynamic quality scaling — add only if measurement shows a problem |
| **4** | Add `three` (pnpm), pin the current stable `r19x` at install | Verify at install whether bundled types suffice; add `@types/three` as a devDependency only if they don't. No workspace file, no hoisting concerns |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/index.astro` | Modified | Canvas element in `.hero` + gated mount script. **Only** importer of the three entry — never a shared layout |
| `src/features/home/three/` | New | Entry singleton, `sceneWeights` store, weight writer, placeholder object, shader consts |
| `src/styles/global.css` | Modified | Canvas absolute in `.hero`, `z-index: 0`, below `.hero__inner` |
| `package.json` | Modified | `+ three` |
| Every other route | None | Zero three.js bytes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| three chunk exceeds budget | Med | Target ≤80KB gzip, hard ceiling 100KB, measured on the build output. Core-only imports; no `three/examples` |
| Route isolation silently broken by a future import from a shared layout | Med | Success criterion asserts it; verify against build output, not intent |
| Three imported in `index.astro` frontmatter (runs server-side under `output: 'server'`) | Low | Client-side `dynamic import()` only |
| WebGL context loss on low-end mobile | Med | `webglcontextlost` → `destroy()`, leave the CSS background |
| Canvas hurts hero text contrast | Low | Decorative, behind `.hero__inner`, low opacity |
| Scope creep into avatar/audio | Med | Out-of-scope list is explicit; those are separate changes |

## Rollback Plan

Remove the canvas element and script block from `index.astro`, delete `src/features/home/`, `pnpm remove three`, drop the canvas CSS rule. `.hero::before` is untouched, so the hero reverts byte-identically. No data, no migration, no other consumer.

## Dependencies

- `three` (new). `gsap ^3.15.0` already present. Nothing blocks this change.

## Success Criteria

- [ ] `/` renders a canvas in the hero whose placeholder mesh visibly responds to `sceneWeights.hero`.
- [ ] `/` three chunk ≤80KB gzip (hard fail >100KB).
- [ ] Every route except `/` ships zero three.js bytes, verified in build output.
- [ ] With `prefers-reduced-motion: reduce`, no WebGL support, or JS disabled: no chunk is fetched and the hero renders exactly as it does today.
- [ ] Zero new asset files in `public/`.
- [ ] `npm run validate` (type-check + build) passes.

## Deferred to Follow-up Changes

Avatar/GLTF + resource-load gate · matcap or lit materials · multi-scene choreography and a scroll-progress weight driver · audio · raycast interaction · persistent cross-route canvas.
