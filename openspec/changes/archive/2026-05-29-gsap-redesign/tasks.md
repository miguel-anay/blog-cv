# GSAP Redesign — Implementation Task Checklist

## Slice 1 — Foundation (sequential; must land first)

### TASK-1.1 — Install gsap package

- **Files**: `package.json`, `pnpm-lock.yaml`
- **Action**: `pnpm add gsap` (≥3.13.0). Verify no `.npmrc` auth token is added.
- **Spec**: HARD-005 (npm only, no CDN)
- **Constraint**: No CDN script tags. All plugins included in the public `gsap` npm package — no Club auth needed.
- **Commit**: `chore(deps): add gsap ≥3.13.0`

### TASK-1.2 — Create `src/lib/gsap-utils.ts`

- **Files**: `src/lib/gsap-utils.ts` (NEW)
- **Action**: Implement and export four functions:
  - `whenFontsReady(): Promise<void>` — wraps `document.fonts.ready`
  - `registerPlugins(): void` — idempotent; calls `gsap.registerPlugin(ScrollTrigger, SplitText)`
  - `splitWords(el: HTMLElement): Promise<SplitText>` — awaits `whenFontsReady()` internally, then calls `SplitText.create(el, { type: "words", autoSplit: true, mask: "words" })`
  - `makeMagnetic(el: HTMLElement, strength?: number): () => void` — uses paired `gsap.quickTo(el, "x"/"y", { duration: 0.4, ease: "power3" })` on `pointermove`; returns cleanup fn
- **Spec**: REQ-UTILS-001, REQ-UTILS-002, REQ-UTILS-003, HARD-003
- **Constraint**: Module must have zero side-effects on import. `registerPlugins()` must be called explicitly by each page script.
- **Commit**: `feat(gsap): add gsap-utils module (registerPlugins, splitWords, makeMagnetic, whenFontsReady)`

### TASK-1.3 — CSS additions to `src/styles/global.css`

- **Files**: `src/styles/global.css`
- **Action**: Append 8 labeled sections (do NOT touch existing rules):
  1. `/* === GSAP: Cursor === */` — `.cursor-dot`, `.cursor-ring`, `body.cursor-on { cursor: none }`, descendants `cursor: none`. Gate with `@media (pointer: fine)`.
  2. `/* === GSAP: Nav Pill === */` — `.site-nav { position: relative }`, `.nav-pill { position: absolute; inset: 0 auto 0 0; background: var(--bg-overlay); border: 1px solid var(--border); border-radius: 6px; z-index: -1; pointer-events: none }`
  3. `/* === GSAP: Hero Grid === */` — `.hero { position: relative }`, `.hero::before { content:""; crosshatch SVG bg + mask-image gradient; pointer-events: none }`
  4. `/* === GSAP: Button Shimmer === */` — `.btn-primary { position: relative; overflow: hidden }`, `.btn-primary::after { position: absolute; translateX -100%→100% on hover; pointer-events: none }`
  5. `/* === GSAP: Blog Card Hover === */` — `.blog-card { position: relative; overflow: hidden }`, `.blog-card::before { transform-origin: left; transform: scaleX(0); will-change: transform }`, `.blog-card:hover::before { transform: scaleX(1) }`, `.blog-card__arrow { transition: transform .2s }`
  6. `/* === GSAP: Category Bar === */` — `.cat-cell__bar-fill { transform-origin: left; transform: scaleX(0); will-change: transform }`
  7. `/* === GSAP: Progress Bar === */` — `.progress-bar { position: fixed; top: 0; left: 0; right: 0; height: 2px; background: var(--accent); transform-origin: left; transform: scaleX(0); z-index: 9999; will-change: transform }`
  8. `/* === GSAP: Reduced Motion === */` — `@media (prefers-reduced-motion: reduce)` block suppressing all CSS transitions/animations for above selectors
- **Spec**: REQ-CSS-001 through REQ-CSS-009, HARD-002, HARD-004
- **Constraint**: `.hero__title` must start with `visibility: hidden` + `min-height` reserve to prevent CLS. Visibility restored by JS after timeline completes (HARD-004).
- **Commit**: `style(gsap): add GSAP-driven CSS sections to global.css`

---

## Slice 2 — Global Components (sequential after Slice 1)

### TASK-2.1 — Create `src/components/MagneticCursor.astro`

- **Files**: `src/components/MagneticCursor.astro` (NEW)
- **Action**:
  - Render two bare divs with NO wrapper: `<div class="cursor-dot" aria-hidden="true"></div><div class="cursor-ring" aria-hidden="true"></div>`
  - Inline `<script>` (ES module): early-exit if `!matchMedia("(pointer: fine)").matches`; add `body.cursor-on`; create two `gsap.quickTo` pairs (dot x/y, ring x/y with slight lag); attach single `pointermove` listener to `document`; scale ring on hoverable elements (`a`, `button`, `[data-magnetic]`)
  - Wrap all GSAP calls in `gsap.matchMedia({ ok: "(prefers-reduced-motion: no-preference)" }, ...)`
- **Spec**: REQ-CURSOR-001 through REQ-CURSOR-006
- **Constraint**: Elements must be direct children of `<body>`. Do NOT mount in `BaseHead.astro` (which is in `<head>`). `mix-blend-mode: difference` on `.cursor-dot` breaks under any ancestor with a CSS `transform`.
- **Commit**: `feat(gsap): add MagneticCursor component`

### TASK-2.2 — Mount `<MagneticCursor />` in all pages and layouts

- **Files** (all must be updated):
  - `src/pages/index.astro`
  - `src/pages/about.astro`
  - `src/pages/cv.astro`
  - `src/pages/blog/index.astro`
  - `src/pages/blog/[...slug].astro`
  - `src/layouts/BlogPost.astro`
  - `src/pages/courses/index.astro`
  - `src/pages/courses/[slug].astro`
- **Action**: Import `MagneticCursor` and place it as a direct child of the outermost `<body>` wrapper in each file (after `<Header />`, before or after `<main>`). Must NOT be inside `<head>` or inside a transformed container.
- **Spec**: REQ-CURSOR-001, REQ-CURSOR-002
- **Constraint**: DO NOT mount in `BaseHead.astro`. Every route must have exactly one cursor instance.
- **Commit**: `feat(gsap): mount MagneticCursor on all page routes`

### TASK-2.3 — Header nav pill

- **Files**: `src/components/layout/Header.astro`
- **Action**:
  - Add `<span class="nav-pill" aria-hidden="true"></span>` as the first child of `<nav class="site-nav">`
  - Add inline `<script>` (ES module): import `gsap`; on DOMContentLoaded, measure active link rect via `getBoundingClientRect()`, set pill x/width with `gsap.set()`; `mouseenter` per `<a>` tweens pill (`power3.out`, duration ≤0.3s); `mouseleave` on `.site-nav` returns to active link; `ResizeObserver` re-snaps on resize
  - Wrap tween calls in `gsap.matchMedia({ ok: "(prefers-reduced-motion: no-preference)" }, ...)` — reduced motion: `gsap.set()` only (instantaneous snap)
- **Spec**: REQ-NAV-001 through REQ-NAV-006
- **Constraint**: Pill snaps with `gsap.set()` (no animation) on page load even without reduced motion (REQ-NAV-002). `pointer-events: none` comes from CSS (REQ-NAV-005).
- **Commit**: `feat(gsap): add animated nav pill to Header`

---

## Slice 3 — Home Page Animations (parallel-safe with Slices 4 & 5, after Slice 2)

### TASK-3.1 — Home hero SplitText + eyebrow/CTA/counter timeline

- **Files**: `src/pages/index.astro`
- **Action**: Add `<script>` ES module block:
  - Import `gsap`, `ScrollTrigger`, `SplitText` from their `gsap/*` paths; import `registerPlugins`, `splitWords` from `~/lib/gsap-utils`
  - Call `registerPlugins()`
  - Set `visibility: hidden` on `.hero__title` immediately (before matchMedia block) to reserve space
  - Wrap in `gsap.matchMedia({ ok: "(prefers-reduced-motion: no-preference)" }, async () => { ... })`
  - Inside: `const split = await splitWords(heroTitleEl)` (fonts guarded inside `splitWords`)
  - Build `gsap.timeline()`: eyebrow fade-in (autoAlpha 0→1, ≤0.5s) → `split.words` stagger (y:40, autoAlpha:0→1, ≤0.8s per word, stagger ≤0.1s, power3.out) → CTA stagger (≤0.15s) → stat counter tweens (0→target, ≤1.5s, `onUpdate` rounds display value)
  - After timeline `.then()` or `onComplete`: restore `visibility: visible` on `.hero__title`
- **Spec**: REQ-HERO-001, REQ-HERO-003, REQ-HERO-004, REQ-HERO-005, REQ-HERO-006, REQ-HERO-007, HARD-003, HARD-004
- **Constraint**: `splitWords()` guarantees `whenFontsReady()` internally — no extra font guard needed at callsite. No manual delay chaining — use `gsap.timeline()` only.
- **Commit**: `feat(gsap): home hero SplitText + eyebrow/CTA/counter timeline`

### TASK-3.2 — Home ScrollTrigger: card batch + featured parallax + category bars

- **Files**: `src/pages/index.astro`
- **Action**: Continue in the same `<script>` block, inside the same matchMedia callback after the hero timeline:
  - Featured image parallax: `gsap.to(".featured-img", { yPercent: 15, ease: "none", scrollTrigger: { trigger: ".featured", scrub: true } })` — verify container has `overflow: hidden`
  - Blog cards batch: `ScrollTrigger.batch(".blog-card", { onEnter: elements => gsap.from(elements, { autoAlpha: 0, y: 24, stagger: 0.15 }), start: "top 85%", once: true })`
  - Category bars: per-element top-level `ScrollTrigger` (NOT nested in a timeline), `toggleActions: "play none none none"`, `scaleX: 0→1`, `transformOrigin: "left"`, created in DOM order top-to-bottom
- **Spec**: REQ-ST-001 through REQ-ST-007, HARD-007
- **Constraint**: No `markers: true` in production code. ScrollTriggers created in document top-to-bottom order. No nested ScrollTrigger inside a GSAP timeline (REQ-ST-006).
- **Commit**: `feat(gsap): home ScrollTrigger reveals (cards, parallax, category bars)`

---

## Slice 4 — CV Page Animations (parallel-safe with Slices 3 & 5, after Slice 2)

### TASK-4.1 — CV hero SplitText + experience slide-in

- **Files**: `src/pages/cv.astro`
- **Action**: Add `<script>` ES module block:
  - Import gsap, ScrollTrigger; import `registerPlugins`, `splitWords` from `~/lib/gsap-utils`
  - Call `registerPlugins()`
  - Set `visibility: hidden` on `.hero__title` before matchMedia block
  - Wrap in `gsap.matchMedia({ ok: "(prefers-reduced-motion: no-preference)" }, async () => { ... })`
  - Hero: `await splitWords(cvHeroTitleEl)` → `gsap.timeline()` with eyebrow fade → word stagger (same pattern as home) → CTA cascade; restore visibility on complete
  - Experience items: `ScrollTrigger.batch(".cv-exp-item", { onEnter: els => gsap.from(els, { x: 30, autoAlpha: 0, stagger: 0.15 }), once: true, start: "top 85%" })`
- **Spec**: REQ-HERO-002, REQ-HERO-003, REQ-HERO-004, REQ-HERO-006, REQ-HERO-007, REQ-ST-005, HARD-003, HARD-004
- **Constraint**: Font-ready guard via `splitWords()`. ScrollTriggers created top-to-bottom.
- **Commit**: `feat(gsap): CV hero SplitText + experience ScrollTrigger reveal`

### TASK-4.2 — CV magnetic project cards

- **Files**: `src/pages/cv.astro`
- **Action**: In the same `<script>` block, add a `(pointer: fine)` condition to the `gsap.matchMedia` call (as a second key alongside `ok`):
  - When `(pointer: fine)` matches: query all `.cv-proj-item`; call `makeMagnetic(el)` for each (imported from `~/lib/gsap-utils`)
  - Store returned cleanup functions; call them if needed on navigation (Astro full-page nav means cleanup is automatic on unload)
- **Spec**: REQ-MICRO-004, REQ-MICRO-005
- **Constraint**: `makeMagnetic` internally uses `gsap.quickTo()` — never `gsap.to()` in a loop on pointermove. Coarse/touch devices: no magnetic effect.
- **Commit**: `feat(gsap): CV magnetic project cards via makeMagnetic`

---

## Slice 5 — Blog & About Page (parallel-safe with Slices 3 & 4, after Slice 2)

### TASK-5.1 — BlogPost reading progress bar

- **Files**: `src/layouts/BlogPost.astro`
- **Action**:
  - Add `<div class="progress-bar" aria-hidden="true"></div>` as a direct child of the outermost wrapper (not inside `<main>`, not inside any transformed container)
  - Add `<script>` ES module: check `matchMedia("(prefers-reduced-motion: reduce)").matches` — if true, skip listener; otherwise use `requestAnimationFrame` loop: `p = Math.min(1, window.scrollY / (document.documentElement.scrollHeight - window.innerHeight))`, write `el.style.transform = \`scaleX(\${p})\``
- **Spec**: REQ-PROGRESS-001 through REQ-PROGRESS-004
- **Constraint**: Progress bar exists ONLY in BlogPost.astro. `aria-hidden="true"` is required. No GSAP plugin needed — vanilla rAF only (GSAP core is not imported in this file per design, only the rAF pattern).
- **Commit**: `feat(gsap): reading progress bar in BlogPost`

### TASK-5.2 — About page section reveals

- **Files**: `src/pages/about.astro`
- **Action**: Add `<script>` ES module:
  - Import gsap, ScrollTrigger; import `registerPlugins`, `splitWords` from `~/lib/gsap-utils`
  - Call `registerPlugins()`
  - Wrap in `gsap.matchMedia({ ok: "(prefers-reduced-motion: no-preference)" }, async () => { ... })`
  - Hero title: `await splitWords(aboutHeroTitleEl)` → fade-in timeline (eyebrow → words → CTAs, same pattern)
  - Per-section ScrollTrigger: `toggleActions: "play none none none"`, `autoAlpha: 0, y: 20 → natural`, one ST per `.section` element, created top-to-bottom in DOM order
  - NO DOM modifications — only animate existing elements
- **Spec**: REQ-ABOUT-001, REQ-ABOUT-002, REQ-HERO-003, HARD-003
- **Constraint**: Do not restructure any HTML in about.astro. Use existing `.section` selectors only.
- **Commit**: `feat(gsap): about page ScrollTrigger section reveals`

---

## Slice 6 — Quality Gate (sequential; after all Slices 1–5)

### TASK-6.1 — Build verification

- **Files**: none (verification only)
- **Action**:
  - Run `pnpm build`; confirm zero errors
  - Search dist output: `grep -r "markers: true" dist/` must return nothing (HARD-007)
  - Confirm no CDN script tags in dist HTML
- **Spec**: HARD-001, HARD-007
- **Commit**: none

### TASK-6.2 — CLS regression check

- **Files**: none (verification only)
- **Action**:
  - Load home and CV pages in browser (disable JS first, re-enable)
  - `.hero__title` must be `visibility: hidden` with reserved `min-height` before JS runs
  - After JS init: title becomes visible with no layout jump
  - Check with Lighthouse or DevTools Performance panel — CLS score must not regress
- **Spec**: HARD-004, REQ-HERO-007
- **Commit**: none

### TASK-6.3 — Touch / coarse-pointer simulation check

- **Files**: none (verification only)
- **Action**:
  - In browser DevTools, enable touch simulation / set UA to mobile
  - Verify: `.cursor-dot` and `.cursor-ring` not rendered, `body.cursor-on` class absent, `cursor: none` not applied anywhere, `.cv-proj-item` not magnetic
- **Spec**: REQ-CURSOR-003, REQ-MICRO-004, HARD-002
- **Commit**: none

### TASK-6.4 — Console error + reduced-motion audit

- **Files**: none (verification only)
- **Action**:
  - Open every page; check DevTools console — zero errors
  - Enable `prefers-reduced-motion: reduce` in OS/DevTools emulation; reload all pages
  - Verify: no y/x/alpha tweens run, no SplitText stagger visible, progress bar frozen at 0, pill snaps without tween
  - Verify `gsap.registerPlugin()` call present before first use in every page script (no console warnings)
- **Spec**: HARD-002, HARD-006, REQ-CURSOR-006, REQ-MICRO-005, REQ-PROGRESS-004, REQ-NAV-006
- **Commit**: none

---

## Execution Order (Dependency Graph)

```
TASK-1.1
  └─► TASK-1.2
        └─► TASK-1.3
              └─► TASK-2.1
                    └─► TASK-2.2
                          └─► TASK-2.3
                                ├─► TASK-3.1 ──► TASK-3.2   (Group A, index.astro)
                                ├─► TASK-4.1 ──► TASK-4.2   (Group B, cv.astro)
                                └─► TASK-5.1                 (Group C, BlogPost.astro)
                                      └─► TASK-5.2           (Group C, about.astro)
                                            └─► TASK-6.1 ──► TASK-6.2 ──► TASK-6.3 ──► TASK-6.4
```

**Parallel-safe after TASK-2.3**: Groups A, B, and C can run concurrently (each touches separate files).

---

## Review Workload Forecast

| Metric | Value |
|---|---|
| Estimated changed lines (additions + deletions) | ~630–750 LOC |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Decision needed before apply | **Yes** |

**LOC breakdown by slice:**

| Slice | Description | Est. LOC |
|---|---|---|
| Slice 1 | package.json + gsap-utils.ts + global.css | ~120 |
| Slice 2 | MagneticCursor + 8 page mounts + Header pill | ~180 |
| Slice 3 | index.astro script (hero + ST) | ~130 |
| Slice 4 | cv.astro script (hero + ST + magnetic) | ~110 |
| Slice 5 | BlogPost progress + about reveals | ~90 |
| Slice 6 | Verification (no code changes) | 0 |
| **Total** | | **~630 LOC** |

**Suggested PR split** (delivery_strategy: ask-on-risk):

| PR | Slices | Approx. LOC | Notes |
|---|---|---|---|
| PR #1 | Slices 1–2 | ~300 | Foundation + global components; reviewable independently |
| PR #2 | Slices 3–5 | ~330 | Page-level animations; depends on PR #1 merged |
| PR #3 | Slice 6 | 0 | Verification only; can be documented in PR #2 |

---

## Hard Constraints Summary

| ID | Rule | Enforced by |
|---|---|---|
| HARD-001 | `npm run build` succeeds | TASK-6.1 |
| HARD-002 | All animations in `gsap.matchMedia()` with reduced-motion key | All page scripts + TASK-6.4 |
| HARD-003 | `SplitText.create()` only after `whenFontsReady()` | `splitWords()` in TASK-1.2; callsites in 3.1, 4.1, 5.2 |
| HARD-004 | `.hero__title` visibility:hidden + min-height until JS | TASK-1.3 CSS + TASK-3.1, 4.1 |
| HARD-005 | No CDN script tags | TASK-1.1, TASK-6.1 |
| HARD-006 | `gsap.registerPlugin()` before first use | `registerPlugins()` called in every page script |
| HARD-007 | No `markers: true` in production | TASK-6.1 grep check |
| HARD-008 | No View Transitions (out of scope) | Not implemented |

---

## Out-of-Scope Guard

The following must NOT be touched during apply:
- Blog Flip filter (React + GSAP Flip)
- ScrollSmoother
- `[data-theme]` / `[data-mode]` toggle system
- CV terminal typing animation
- Astro View Transitions
- Turso / Drizzle / data layer
- Tailwind utility classes
- About page HTML restructuring
- Courses page logic or schema
