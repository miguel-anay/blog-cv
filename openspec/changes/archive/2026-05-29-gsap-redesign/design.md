# Design: GSAP Interactive Redesign

## Technical Approach

Per-page Astro `<script>` blocks import `gsap` and the plugins each route actually uses. Vite bundles per route, tree-shakes plugins, and dedupes the shared core. Shared helpers live in `src/lib/gsap-utils.ts`. The cursor is a single `<MagneticCursor />` component mounted once from `BaseHead.astro` so it exists on every page. All scroll work uses ScrollTrigger; the reading progress bar uses a plain `rAF` scroll listener (no plugin). Every animation block is wrapped in `gsap.matchMedia()` to honor `prefers-reduced-motion`.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Animation delivery | Per-page `<script>` + ES module imports | Global `animations.ts`; React island | Vite tree-shakes plugins per route; no hydration cost; cursor on/off tunable per page. |
| Plugin registration | `registerPlugins()` in `gsap-utils`, called inside each page script | Auto-register on import | Explicit, idempotent, survives HMR; `gsap.registerPlugin()` is safe to call repeatedly. |
| Cursor mount point | Append to `<body>` directly via `MagneticCursor.astro` rendered inside `BaseHead.astro` | Mount inside `<main>` | `mix-blend-mode: difference` breaks under any ancestor with `transform`. Direct body child is the only safe stacking context. |
| Touch gate | CSS `@media (pointer: fine)` + JS early-return on `matchMedia("(pointer: fine)").matches === false` | Show cursor everywhere | Touch/keyboard users keep native cursor. |
| SplitText timing | `await document.fonts.ready` before `SplitText.create()` | Split on DOMContentLoaded | Web fonts arriving after split cause re-layout into wrong line breaks. GSAP-recommended pattern. |
| Reading progress bar | Vanilla `rAF` scroll listener writing `transform: scaleX(p)` | ScrollTrigger | Single value per page, no need for plugin overhead. |
| CSS placement | Append to `src/styles/global.css` in labeled sections | Per-component `<style>` blocks | Existing convention is centralized; tokens already drive the design. |
| Plugin set | core + ScrollTrigger + SplitText (+ Flip held back) | Add ScrollSmoother | ScrollSmoother is Club-only; native scroll is sufficient here. |
| Reduced motion | `gsap.matchMedia({ reduce: "(prefers-reduced-motion: reduce)" })` per script | Global toggle | Standard GSAP 3.11+ pattern; auto-reverts on media change. |

## Module Architecture — `src/lib/gsap-utils.ts`

```ts
// Idempotent — safe to call from every page script
export function registerPlugins(): void;

// Cursor / project-card magnet. strength ~0.2–0.4 typical.
// Returns cleanup fn that removes the listeners.
export function makeMagnetic(el: HTMLElement, strength?: number): () => void;

// Splits a heading into per-word spans AFTER fonts are ready.
// Returns the SplitText instance so callers can animate `.words`.
export function splitWords(el: HTMLElement): Promise<SplitText>;

// Resolves once document.fonts is ready (or immediately if unsupported).
export function whenFontsReady(): Promise<void>;
```

Internally `makeMagnetic` uses `gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" })` + `quickTo("y", ...)` per the performance skill. `splitWords` awaits `whenFontsReady()` and calls `SplitText.create(el, { type: "words", autoSplit: true, mask: "words" })`.

## Component Contract — `MagneticCursor.astro`

DOM (appended directly under `<body>`):
```html
<div class="cursor-dot" aria-hidden="true"></div>
<div class="cursor-ring" aria-hidden="true"></div>
```

Inline `<script>`: import `gsap`, early-return if `!matchMedia("(pointer: fine)").matches`. Add `body.cursor-on`. Set up two `quickTo` pairs (dot, ring). One `pointermove` listener writes both. On `mouseenter` of `a, button, .magnet` scale the ring; reset on `mouseleave`.

## Header Nav Pill — DOM + Script

Add as the first child of `<nav class="site-nav">`:
```html
<span class="nav-pill" aria-hidden="true"></span>
```

Script (bottom of `Header.astro`): on `astro:page-load` (and DOMContentLoaded fallback), measure the `.is-active` link's `offsetLeft`/`offsetWidth` relative to `.site-nav`, set pill x/width via `gsap.set`. Bind `mouseenter` on each `a` to `gsap.to(pill, { x, width, duration: 0.35, ease: "power3.out" })`; `mouseleave` on `.site-nav` returns to active. Snap on resize via `ResizeObserver`.

## Per-Page Scripts

| Page | Plugins imported | Bottom-of-file script does |
|---|---|---|
| `index.astro` | `gsap`, `ScrollTrigger`, `SplitText` | `registerPlugins()` → matchMedia → `whenFontsReady` → hero `splitWords` + eyebrow/CTA stagger timeline → counter tweens on `.stat__v` → ScrollTrigger batch for `.blog-card` + featured image `y` parallax + `.cat-cell__bar-fill` `scaleX`. |
| `cv.astro` | `gsap`, `ScrollTrigger` | hero fade-in timeline → `ScrollTrigger.batch(".cv-exp-item", ...)` x:30 stagger → `makeMagnetic` on each `.cv-proj-item`. |
| `about.astro` | `gsap`, `ScrollTrigger` | `whenFontsReady` → hero `splitWords` reveal → `ScrollTrigger.batch(".section", ...)` simple fade-up. No DOM changes. |
| `BlogPost.astro` | `gsap` only | progress-bar `rAF` listener writes `--progress`; small reveal on `.article-title`. |

Astro `<script>` is module-scoped, deferred, and Vite-deduped by default — no manual `DOMContentLoaded` wiring needed. `registerPlugins()` is idempotent so calling it per page is safe.

## CSS Additions to `global.css` (sections, appended)

| Section | Selectors | Enables |
|---|---|---|
| Cursor | `.cursor-dot`, `.cursor-ring`, `body.cursor-on { cursor: none }`, `body.cursor-on a, …{ cursor: none }` | Magnetic cursor (fine pointer only). |
| Nav Pill | `.site-nav { position: relative }`, `.nav-pill { position:absolute; inset:0 auto 0 0; background: var(--bg-overlay); border:1px solid var(--border); border-radius:6px; z-index:-1 }` | Active-link pill animation. |
| Hero Grid | `.hero { position:relative }`, `.hero::before { …crosshatch + mask… }` | Background grid layer. |
| Button Shimmer | `.btn-primary { position:relative; overflow:hidden }`, `.btn-primary::after { …translateX slide… }` | Hover shimmer. |
| Blog Card Hover | `.blog-card { position:relative }`, `.blog-card::before { transform-origin:left; scaleX(0) }`, `.blog-card__arrow { transition: transform .2s }` | Hover reveal + arrow nudge. |
| Category Bar | `.cat-cell__bar-fill { transform-origin:left; transform: scaleX(0) }` | ScrollTrigger fills it. |
| Progress Bar | `.progress-bar { position:fixed; top:0; left:0; right:0; height:2px; background: var(--accent); transform-origin:left; transform: scaleX(var(--progress,0)) }` | Reading progress on blog posts. |
| Section-head | `.section-head__left { display:flex; align-items:baseline; gap:16px }` (extract from inline) | Cleanup. |

## Reduced Motion

Every per-page script wraps work in:
```ts
const mm = gsap.matchMedia();
mm.add({ ok: "(prefers-reduced-motion: no-preference)" }, (ctx) => { /* animations */ });
```
When the user prefers reduced motion, the block never runs and elements stay in their static (final) state — no fade-from-hidden traps. CSS sets initial `autoAlpha`/`scaleX` defaults only on elements the JS will animate.

## Future-Coupling Notes

- View Transitions: not adopted here. If introduced later, add `document.addEventListener("astro:page-load", () => ScrollTrigger.refresh())` and rewrap inits.
- Flip filter: deferred to a separate change; nothing in this design blocks it.

## Files Affected

| File | Action |
|---|---|
| `package.json` | add `gsap` |
| `src/lib/gsap-utils.ts` | NEW |
| `src/components/MagneticCursor.astro` | NEW |
| `src/components/seo/BaseHead.astro` | render `<MagneticCursor />` after the bootstrap script |
| `src/components/layout/Header.astro` | add `.nav-pill` span + pill script |
| `src/layouts/BlogPost.astro` | add `.progress-bar` div + scroll listener |
| `src/pages/index.astro` | append home animation script |
| `src/pages/cv.astro` | append CV animation script |
| `src/pages/about.astro` | append about reveal script |
| `src/styles/global.css` | ~50 rules in labeled sections above |

## Open Questions

- None blocking. `BaseHead.astro` lives inside `<head>` today — `<MagneticCursor />` must be mounted in `<body>` instead. Resolution: keep `BaseHead` in `<head>`; mount `<MagneticCursor />` as the first child of `<body>` in every page that consumes `BaseHead`. Tasks phase will enumerate the call sites (5 page-level files: `index`, `about`, `cv`, `blog/index`, `BlogPost` layout, `courses` pages).
