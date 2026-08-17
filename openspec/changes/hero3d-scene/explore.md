# Exploration: Hero 3D Scene

Adding a Three.js hero scene skeleton to the homepage (`/`), inspired by `davidhckh/portfolio-2025`. Scope explored: core three.js setup + `sceneWeights` state + one placeholder geometry. No avatar/GLTF, no audio, no multi-scene choreography.

## Current State

| Area | Finding |
|------|---------|
| `src/pages/index.astro:54-97` | `.hero` section markup |
| `src/styles/global.css:1038-1056` | `.hero::before` decorative bg at `z-index: 0`, `.hero__inner` at `z-index: 1` — an existing layering slot for a canvas |
| `src/pages/index.astro:229-336` | Inline `<script>` importing gsap directly. No React. Existing page-level interactivity pattern |
| `client:*` directives | ZERO live usages in real code. Only appear inside blog post markdown as documentation examples |
| `MobileMenu.tsx`, `ThemeToggle.tsx` | React components that exist but are DEAD CODE (zero usages). `Header.astro` uses `ThemeSwitcher.astro` / `ModeToggle.astro` / `MobileNav.astro` instead |
| `astro.config.mjs` | `output: 'server'` + `@astrojs/vercel`. `vite.plugins` has only `tailwindcss()` — no glsl plugin |
| `package.json` | `gsap ^3.15.0` present. No `three`, no `vite-plugin-glsl`. pnpm, no workspace file |
| `src/features/` | `blog`, `courses`, `exams` exist. No `home/`. No top-level `src/three/` precedent |
| `public/` | No matcap textures, no `.glb` assets |

### Established interactive-script pattern

`src/components/MagneticCursor.astro`, `src/components/MatrixIntro.astro` (raw Canvas2D + rAF), `src/components/layout/Header.astro:56-144`. The best template is `src/features/blog/components/DiagramBlock.astro:76-153`: dynamic `await import("gsap")` in try/catch, reduced-motion gate via `matchMedia` BEFORE the import, `IntersectionObserver`-gated activation, graceful no-op fallback to static SSR'd content.

## Recommendations

| # | Question | Recommendation | Rationale |
|---|----------|----------------|-----------|
| A | Island type | Plain `<script>` in the `.astro` file, NOT a React island | Matches 100% of repo convention. Avoids being the first place React ships client JS (~130KB) for a purely imperative, non-reactive use case. No custom-element precedent either |
| B | Code location | `src/features/home/three/`, not top-level `src/three/` | CLAUDE.md Scope Rule is explicit and absolute; canvas is single-page-scoped, so this is textbook single-feature code. **Flag as open judgment call for the proposal** — it deviates from the reference repo's layout |
| C | Shaders | Inline template-literal GLSL (`/* glsl */` tagged consts), NOT `vite-plugin-glsl` | Only one shader in skeleton scope. New Vite plugin is premature (YAGNI); revisit when shader count grows |
| D | Scroll driver | Native `IntersectionObserver` writes `sceneWeights.hero.{in,out}`; `gsap.ticker` is the render loop | No Lenis (not installed, unjustified for one section). No ScrollTrigger needed for a binary in/out weight. gsap is already a dependency. Design the weight-writer as swappable so later multi-scene work upgrades the driver without touching the three.js read side |
| E | Budget / isolation | ~60-80KB gzip for `/` only. Must client-side `dynamic import()` the three entry | Zero-three-on-other-routes holds naturally as long as ONLY `src/pages/index.astro` imports the mount script — never a shared layout. `output: 'server'` still runs `index.astro` frontmatter server-side |
| F | Degradation | Gate BOTH `prefers-reduced-motion` and WebGL feature detection BEFORE the dynamic import | So the chunk is never fetched by users who can't use it. Fallback for both: do nothing extra — the existing `.hero::before` crosshatch (`global.css:1042-1051`) is a zero-new-UI fallback. Canvas gets `aria-hidden="true"` + `pointer-events: none` (decorative only, no raycast yet) |

## Reference Architecture (`davidhckh/portfolio-2025`)

Singleton module pattern (`export const x = { init, destroy }`), one canvas, one `gsap.ticker`, and a central `sceneWeights` mechanism: scroll writes per-section `{in, out}`, a tick computes `weight = clamp(in * (1 - out), 0, 1)`, and each 3D object reads the global weights in its own tick. Full decoupling — scroll knows nothing about the objects. Materials are matcap `ShaderMaterial` with zero lights and zero real shadow maps; that is why the reference is small and fast.

## Learned

The reference repo's top-level `src/three/` and persistent-canvas design don't map cleanly onto this codebase's Scope Rule or the "canvas only on `/`" constraint. This is the single most consequential open question for the proposal phase, not a mechanical detail.

## Open Questions for Proposal

1. No matcap texture asset exists — source/create one, or use a lights-free procedural shader?
2. Resource-loading gate may be overkill for a single static geometry. Full gate, minimal gate, or none?
3. `devicePixelRatio` capping policy not decided.
4. Confirm `three` version and that `/` isn't prerendered/cached in a way that breaks `getArticles()` per-request freshness.
