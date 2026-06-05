# GSAP Interactive Redesign — Delta Specification

## Purpose

Define all behavior that MUST be true after the `gsap-redesign` change is applied to
`callous-cluster` (Astro v5.14.1 SSR). The CSS token system is already aligned with
the design; this spec covers the additive interaction and motion layer only. No
existing animation spec exists to delta against.

---

## Global Hard Constraints

These rules apply to every surface in scope. Any requirement below that conflicts with
a global constraint is invalid.

### HARD-001 Build Must Succeed

`npm run build` MUST complete without errors or warnings that relate to gsap imports,
missing types, or missing CSS classes introduced by this change.

### HARD-002 Reduced Motion

Every GSAP animation MUST be wrapped in `gsap.matchMedia()` and MUST respect
`prefers-reduced-motion: reduce`. When that media query matches, all tweens MUST use
`duration: 0` (instantaneous) or be skipped entirely. No animation MAY play at full
duration when the user has opted into reduced motion. CSS animations added by this
change MUST be suppressed with `@media (prefers-reduced-motion: reduce)`.

#### Scenario: Reduced-motion suppresses hero animation

- GIVEN the OS accessibility setting "reduce motion" is enabled
- WHEN the home page loads
- THEN no animated entrance (words staggering, fades, counters) occurs in the hero

---

### HARD-003 SplitText Font-Ready Guard

Every callsite that uses `SplitText.create()` MUST await `document.fonts.ready` before
calling `SplitText.create()`. Splitting before fonts are loaded is forbidden.

#### Scenario: SplitText waits for fonts

- GIVEN a custom web font is used in `.hero__title`
- WHEN the page loads and fonts have not yet resolved
- THEN `SplitText.create()` is NOT called until `document.fonts.ready` resolves

---

### HARD-004 No CLS Regression on Hero Title

While awaiting font load + SplitText, `.hero__title` MUST be set to
`visibility: hidden` and MUST have a `min-height` that reserves the full occupied
height. The element MUST become visible only after the split and animation begin.

#### Scenario: Hero title does not shift layout

- GIVEN the home or CV page is loading
- WHEN the hero renders before the GSAP animation fires
- THEN no cumulative layout shift is introduced by the SplitText split or animation start

---

### HARD-005 No CDN Script Tags

All GSAP imports MUST come through the npm package `gsap` (≥ 3.13.0) via Vite ES
module imports. No CDN `<script>` tags (unpkg, cdnjs, gsap.com) are permitted.

### HARD-006 Plugin Registration

`ScrollTrigger`, `SplitText`, and any other GSAP plugin used MUST be registered via
`gsap.registerPlugin()` before first use. Registration MUST happen in
`src/lib/gsap-utils.ts` (shared) or inline at the top of the consuming module.

### HARD-007 No Markers in Production

`markers: true` MUST NOT appear in any `scrollTrigger` config in the shipped build.

### HARD-008 ScrollTrigger Cleanup on Navigation

Because this change does not adopt Astro View Transitions, each navigation is a full
page load and ScrollTrigger instances initialize fresh per page. If Astro View
Transitions is later adopted, all init code MUST be moved to `astro:page-load` handlers
with `ScrollTrigger.refresh()`. This coupling MUST be documented in code as a comment.

---

## Section 1 — CSS Additions (global.css)

### REQ-CSS-001 Cursor System CSS

`src/styles/global.css` MUST add rules for `.cursor-dot`, `.cursor-ring`, and
`body.cursor-on`. When `body.cursor-on` is NOT present (default), the native system
cursor MUST remain visible. `cursor: none` on `body` MUST only appear when
`body.cursor-on` is set. Touch/coarse-pointer devices MUST never receive `cursor: none`
at any time — this gating MUST be enforced in CSS, not only in JavaScript.

#### Scenario: Native cursor on touch devices

- GIVEN a touch device where `pointer: coarse` media query matches
- WHEN any page loads
- THEN `cursor: none` is never applied to `body` or any ancestor

---

### REQ-CSS-002 Nav Pill CSS

`global.css` MUST add `.nav-pill` as an absolutely positioned element with:
- A background using the `--color-overlay` or equivalent token
- A visible border (1px, using a border token)
- `border-radius: 6px`
- `pointer-events: none` so it does not block link clicks
- Initial state: positioned behind the active nav link

### REQ-CSS-003 Hero Grid Decoration

`global.css` MUST add a `.hero::before` pseudo-element implementing the crosshatch grid
background with a mask gradient that fades edges, matching the design prototype. The
decoration MUST be purely presentational (no impact on text legibility or layout).

### REQ-CSS-004 Button Shimmer

`global.css` MUST add `.btn-primary::after` implementing a shimmer slide (`translate-x`
from `-100%` to `100%` via `linear-gradient`). The shimmer MUST only run on
`:hover` or when triggered by JavaScript. The shimmer layer MUST be `pointer-events: none`.

### REQ-CSS-005 Ghost Button Hover

`global.css` MUST add `.btn-ghost:hover` styles aligned to the design (background
fill, color inversion, or border change) using existing CSS tokens.

### REQ-CSS-006 Blog Card Hover Reveal

`global.css` MUST add `.blog-card::before` with an `overflow: hidden` + `scaleX`
reveal on `:hover`. The reveal element MUST be positioned below the card content and
MUST NOT obscure text. It MUST use `will-change: transform`.

### REQ-CSS-007 Category Bar Baseline

`global.css` MUST add `.cat-cell::after` at `transform: scaleX(0)`,
`transform-origin: left`, so that GSAP can animate `scaleX` to `1` on scroll. The
element MUST be paired with `will-change: transform`.

### REQ-CSS-008 Progress Bar Baseline

`global.css` MUST add `.progress-bar` as a `position: fixed; top: 0; left: 0; width:
100%; height: 3px` element with `transform: scaleX(0)` and `transform-origin: left`.
It MUST be `z-index` above the header. `will-change: transform` MUST be set.

### REQ-CSS-009 Header Sticky + Backdrop Filter

`global.css` MUST apply `position: sticky; top: 0; backdrop-filter: blur(12px)`
(or token-driven equivalent) to the site header. The header MUST NOT reflow page
content when sticking.

---

## Section 2 — Shared Utilities (`src/lib/gsap-utils.ts`)

### REQ-UTILS-001 Module Exports

`src/lib/gsap-utils.ts` MUST export at minimum:
- `registerPlugins()` — registers `ScrollTrigger`, `SplitText`, and any other plugins
  used across the codebase
- `makeMagnetic(el: Element, strength?: number)` — attaches mouse-follow magnetic
  behavior to an element using `gsap.quickTo`
- `splitWords(el: Element): SplitText` — wraps `SplitText.create` with font-ready guard
  and word-level split; returns the SplitText instance

### REQ-UTILS-002 Font-Ready Guard in splitWords

`splitWords()` MUST internally await `document.fonts.ready` before calling
`SplitText.create()`. Callers MAY await the returned promise or chain `.then()`.

### REQ-UTILS-003 No Side Effects at Import

Importing `gsap-utils.ts` MUST NOT trigger any DOM mutation or plugin registration.
`registerPlugins()` MUST be called explicitly by each consuming module.

---

## Section 3 — Magnetic Cursor

### REQ-CURSOR-001 Component Existence

`src/components/MagneticCursor.astro` MUST exist and MUST be mounted from the base
layout (the root layout that wraps every page). It MUST NOT be mounted more than once
per page.

### REQ-CURSOR-002 DOM Structure

The component MUST render exactly two elements: `.cursor-dot` (small filled circle) and
`.cursor-ring` (larger ring). Both MUST be appended directly to `<body>` to avoid
stacking context conflicts with `mix-blend-mode: difference`.

#### Scenario: Cursor elements on body

- GIVEN any page on a pointer-fine device
- WHEN the DOM is inspected
- THEN `.cursor-dot` and `.cursor-ring` are direct children of `<body>`

---

### REQ-CURSOR-003 Pointer-Fine Gate

The cursor system MUST activate only when `window.matchMedia("(pointer: fine)").matches`
is `true` at script execution time. On coarse/touch devices the script MUST exit early
and the cursor elements MUST remain hidden (`display: none` or `visibility: hidden`).
`body.cursor-on` MUST NOT be set on coarse-pointer devices.

#### Scenario: Cursor inactive on touch

- GIVEN a device where `(pointer: fine)` does not match
- WHEN any page loads
- THEN `.cursor-dot` and `.cursor-ring` are not visible
- AND `body.cursor-on` is not present on the body element

---

### REQ-CURSOR-004 quickTo Implementation

On pointer-fine devices, both `.cursor-dot` and `.cursor-ring` MUST follow the pointer
using `gsap.quickTo()` for `x` and `y`. A separate `quickTo` instance MUST be created
for each axis of each element. Direct `gsap.to()` on every `mousemove` is forbidden.

#### Scenario: Cursor follows pointer

- GIVEN a pointer-fine desktop device
- WHEN the user moves the mouse
- THEN `.cursor-dot` and `.cursor-ring` translate to follow the pointer position
  using `gsap.quickTo`

---

### REQ-CURSOR-005 Mix-Blend-Mode

`.cursor-dot` MUST have `mix-blend-mode: difference` applied in CSS. `.cursor-ring`
MAY also have it. This behavior MUST be verifiable by DOM inspection.

### REQ-CURSOR-006 Reduced Motion

When `prefers-reduced-motion: reduce` matches, the cursor elements MUST either be
hidden or snap to the pointer position without animation lag (duration 0 on quickTo).

---

## Section 4 — Animated Navigation Pill

### REQ-NAV-001 Pill Element

`src/components/layout/Header.astro` MUST add a `<span class="nav-pill">` inside the
`.site-nav` element, positioned absolutely and sized to fit behind the currently active
or hovered link.

### REQ-NAV-002 Page-Load Snap

On `astro:page-load` (or `DOMContentLoaded` if View Transitions is not used), the pill
MUST snap instantaneously (no animation) to the position and dimensions of the active
nav link. "Active" is determined by comparing `window.location.pathname` against each
link's `href`.

#### Scenario: Pill snaps to active link on load

- GIVEN the user navigates to `/blog`
- WHEN the page finishes loading
- THEN `.nav-pill` is positioned behind the Blog nav link with no visible animation

---

### REQ-NAV-003 Hover Animation

On `mouseenter` of any nav link, the pill MUST animate to that link's position and
dimensions using a GSAP tween (duration ≤ 0.3s, `ease: "power2.out"` or similar).

#### Scenario: Pill moves to hovered link

- GIVEN the nav pill is behind the Home link
- WHEN the user hovers over the About link
- THEN the pill animates from Home to About

---

### REQ-NAV-004 Return to Active on Mouse Leave

On `mouseleave` of the entire `.site-nav` container, the pill MUST animate back to the
active link's position. It MUST NOT remain at the last-hovered link.

#### Scenario: Pill returns on mouse leave

- GIVEN the user hovered the About link while Blog is active
- WHEN the mouse leaves the nav
- THEN the pill animates back to the Blog link position

---

### REQ-NAV-005 Pill Does Not Block Clicks

`.nav-pill` MUST have `pointer-events: none` so all click events reach the underlying
nav links.

### REQ-NAV-006 Reduced Motion

When `prefers-reduced-motion: reduce` matches, nav pill transitions MUST be
instantaneous (no animated movement between links).

---

## Section 5 — Hero Animations (Home + CV Pages)

### REQ-HERO-001 SplitText Word Stagger (Home)

On `src/pages/index.astro`, the `.hero__title` element MUST be split by SplitText into
words. The words MUST animate in with a stagger (`from: y: 40, autoAlpha: 0` →
natural position, duration ≤ 0.8s per word, stagger interval ≤ 0.1s,
`ease: "power3.out"`). The animation MUST run only after `document.fonts.ready`
resolves.

#### Scenario: Home hero words stagger in

- GIVEN the home page loads on a device without reduced motion
- WHEN fonts are ready
- THEN each word in `.hero__title` fades and slides up with a stagger

---

### REQ-HERO-002 SplitText Word Stagger (CV)

On `src/pages/cv.astro`, the same word stagger pattern MUST apply to the CV hero
title. Font-ready guard applies identically.

### REQ-HERO-003 Eyebrow Fade

On both pages, the hero eyebrow element (the small label above the title, e.g.
`.hero__eyebrow`) MUST fade in before the title stagger begins (delay 0 or first in
timeline sequence, `autoAlpha: 0 → 1`, duration ≤ 0.5s).

#### Scenario: Eyebrow visible before title

- GIVEN the home page loads
- WHEN the hero animation starts
- THEN the eyebrow fades in first, then the title words stagger

---

### REQ-HERO-004 CTA Cascade

The hero CTA button(s) (`.hero__cta` or equivalent) MUST animate in after the title
stagger completes. Multiple CTAs MUST stagger with an interval ≤ 0.15s.

### REQ-HERO-005 Stat Counters (Home)

Stat/number elements in the home hero (if present in the DOM as `.hero__stat` or
equivalent) MUST tween from `0` to their target value over ≤ 1.5s using
`gsap.to(obj, { value: target, onUpdate })`. The display MUST round or format numbers
correctly on each tick.

#### Scenario: Stat counter increments

- GIVEN the home page hero contains a stat element showing "150+"
- WHEN the hero animation fires
- THEN the counter increments from 0 to 150 before settling at the displayed value

---

### REQ-HERO-006 Hero Animation Timeline Order

The hero animation MUST run as a GSAP `gsap.timeline()` in this sequence:
eyebrow → title words → CTA(s) → stat counters. Each step MUST be a timeline position
or `+=` offset — no manual `delay` chaining on individual tweens.

### REQ-HERO-007 Visibility Restoration

After the hero timeline completes, `visibility` MUST be restored on `.hero__title`
(via `autoAlpha` reaching `1` or `clearProps: "visibility"`). The element MUST be
fully interactive and readable after animation.

---

## Section 6 — ScrollTrigger Reveals

### REQ-ST-001 Plugin Registration

`ScrollTrigger` MUST be registered via `gsap.registerPlugin(ScrollTrigger)` before any
ScrollTrigger usage. Registration MUST happen once per page module.

### REQ-ST-002 Featured Image Parallax (Home)

The featured/hero post image on `index.astro` MUST apply a parallax effect via
`scrollTrigger: { scrub: true }` animating `yPercent` or `y` on the image element
(not the container). The parallax range MUST NOT cause the image to move outside its
container (overflow hidden on the container is required).

#### Scenario: Featured image parallaxes on scroll

- GIVEN the user scrolls down on the home page
- WHEN the featured post section enters the viewport
- THEN the featured image moves at a slower rate than the scroll (parallax)

---

### REQ-ST-003 Blog Card Stagger (Home)

`.blog-card` elements on `index.astro` MUST animate in using `ScrollTrigger.batch()`
or per-card `scrollTrigger` with `toggleActions: "play none none none"`. Cards MUST
start at `autoAlpha: 0, y: 24` and animate to natural position with a stagger
≤ 0.15s. Each card MUST animate at most once (use `once: true` or `toggleActions`
that does not reverse).

#### Scenario: Blog cards stagger in on scroll

- GIVEN the user has not scrolled to the blog card section
- WHEN the user scrolls until blog cards enter the viewport
- THEN cards appear with a staggered fade-and-rise animation

---

### REQ-ST-004 Category Bar scaleX (Home)

Each `.cat-cell::after` fill element MUST animate from `scaleX: 0` to `scaleX: 1`
on scroll, using `scrollTrigger` with `toggleActions: "play none none none"` and
`transformOrigin: "left"`. Bars MUST fill left-to-right.

#### Scenario: Category bars fill on scroll

- GIVEN the category grid is below the fold
- WHEN the user scrolls until it enters the viewport
- THEN each bar fills from left to right

---

### REQ-ST-005 CV Experience Slide-In

On `cv.astro`, each experience/timeline item (e.g. `.cv-experience__item` or equivalent)
MUST animate in from `x: 30, autoAlpha: 0` → natural position on scroll, with
`toggleActions: "play none none none"` and a stagger between items ≤ 0.15s.

#### Scenario: CV experience items slide in

- GIVEN the CV experience section is below the fold
- WHEN the user scrolls to it
- THEN each experience item slides in from the right with a stagger

---

### REQ-ST-006 No Nested ScrollTriggers in Timelines

ScrollTrigger configurations MUST only be placed on top-level tweens or on the
`gsap.timeline()` itself — never on a child tween inside a timeline. Violations are
spec failures.

### REQ-ST-007 ScrollTrigger Creation Order

ScrollTriggers MUST be created in the order they appear on the page (top to bottom,
scroll 0 → max). When async creation is unavoidable, `refreshPriority` MUST be set on
each instance so that refresh order matches document order.

---

## Section 7 — Micro-Interactions

### REQ-MICRO-001 Button Primary Shimmer

`.btn-primary` elements MUST show a shimmer (`::after` slide, implemented in CSS per
REQ-CSS-004) on `:hover`. The shimmer MUST be CSS-driven (no GSAP required). The
shimmer MUST run at most once per hover interaction (no loop).

### REQ-MICRO-002 Ghost Button Hover

`.btn-ghost` MUST display a hover state (background, border, or color change using CSS
tokens) on `:hover`. The hover MUST use CSS transitions, not GSAP.

### REQ-MICRO-003 Blog Card Hover

`.blog-card:hover` MUST trigger the `::before` reveal via CSS transition on `scaleX`
(per REQ-CSS-006). The `.blog-card__arrow` (if present) MUST translate or rotate on
hover using a CSS transition.

#### Scenario: Blog card arrow animates on hover

- GIVEN a `.blog-card` element
- WHEN the user hovers over it
- THEN the card's arrow icon translates or rotates to indicate interactivity

---

### REQ-MICRO-004 Magnetic Project Cards (CV)

On `cv.astro`, project card elements MUST have the magnetic effect applied via
`makeMagnetic()` from `gsap-utils.ts`. The effect MUST use `gsap.quickTo()` internally.
The effect MUST be gated by `(pointer: fine)` — it MUST NOT activate on touch.

#### Scenario: Magnetic effect on CV project cards

- GIVEN a pointer-fine desktop device and the CV page
- WHEN the user moves the mouse near a project card
- THEN the card shifts slightly toward the cursor (magnetic pull)

#### Scenario: No magnetic effect on touch

- GIVEN a touch device
- WHEN the CV page loads
- THEN `makeMagnetic()` is NOT called on any element

---

### REQ-MICRO-005 Reduced Motion for Micro-interactions

CSS transitions for blog card hover and button shimmer MUST be suppressed under
`@media (prefers-reduced-motion: reduce)`. Magnetic effects MUST be disabled or
set to instant-snap under reduced motion.

---

## Section 8 — Reading Progress Bar

### REQ-PROGRESS-001 Scope

The reading progress bar MUST only exist on blog post pages rendered via
`src/layouts/BlogPost.astro`. It MUST NOT appear on any other page.

### REQ-PROGRESS-002 DOM Element

`BlogPost.astro` MUST render `<div class="progress-bar" aria-hidden="true"></div>`
as a direct child of `<body>` (or within the layout's outermost wrapper), using the
CSS baseline from REQ-CSS-008. `aria-hidden="true"` is required so screen readers skip it.

### REQ-PROGRESS-003 Scroll-Driven scaleX

The progress bar MUST update its `transform: scaleX(progress)` on `scroll` events
using `requestAnimationFrame` or equivalent. GSAP is NOT required for this feature.
The progress value MUST be calculated as:
`scrollTop / (scrollHeight - clientHeight)`, clamped to `[0, 1]`.

#### Scenario: Progress bar fills on scroll

- GIVEN a user is reading a blog post
- WHEN the user scrolls to the midpoint of the article
- THEN the progress bar `scaleX` is approximately 0.5

#### Scenario: Progress bar full at bottom

- GIVEN a user scrolls to the very bottom of a blog post
- WHEN the bottom is reached
- THEN the progress bar `scaleX` is 1 (fully filled)

---

### REQ-PROGRESS-004 Reduced Motion

Under `prefers-reduced-motion: reduce`, the progress bar MUST either be hidden or
update without transition (immediate `scaleX` snap, no smoothing).

---

## Section 9 — About Page (Light Reveals Only)

### REQ-ABOUT-001 Scope Constraint

The about page (`src/pages/about.astro`) MUST receive only lightweight scroll-triggered
reveals on its existing DOM structure. No HTML restructuring is permitted in this
change.

### REQ-ABOUT-002 Reveal Pattern

Text sections and image elements on the about page MUST animate in with
`autoAlpha: 0, y: 20` → natural position on scroll via ScrollTrigger,
`toggleActions: "play none none none"`. The pattern MUST match the blog card stagger
pattern from REQ-ST-003 in structure.

---

## Section 10 — Out of Scope

The following items are explicitly excluded from this change. Any implementation that
touches these areas is out of scope and MUST be rejected in verify:

| Item | Deferred to |
|------|-------------|
| Blog Flip filter (React island + GSAP Flip) | Separate SDD change |
| About page structural redesign (timeline, skills grid HTML) | Separate SDD change |
| ScrollSmoother | Not in scope — requires paid Club GSAP historically; native scroll only |
| Tweaks panel / matrix intro overlay | Prototype-only UI, not for production |
| 3-identities toggle (`[data-theme]`, `[data-mode]`) | Existing system, no changes |
| CV terminal typing animation | Deferred polish |
| Astro View Transitions integration | Separate decision; changes ScrollTrigger refresh semantics |
| Data layer changes (Turso, Drizzle, routes, content schemas) | Out of scope entirely |
| New Tailwind utility classes | Styling stays in `global.css` with CSS custom properties |

---

## Acceptance Summary

An implementation passes this spec when ALL of the following hold:

1. `npm run build` succeeds with no errors.
2. All GSAP animations are wrapped in `gsap.matchMedia()` with a `prefers-reduced-motion` branch that runs at duration 0 or skips entirely.
3. No `SplitText.create()` call runs before `document.fonts.ready` resolves.
4. `.hero__title` shows no CLS while awaiting fonts (visibility hidden + min-height reserved).
5. No GSAP CDN script tags are present anywhere in the codebase.
6. All GSAP plugins used are registered via `gsap.registerPlugin()` before first use.
7. `cursor: none` never applies on coarse-pointer devices, enforced in CSS.
8. `.cursor-dot` and `.cursor-ring` are direct children of `<body>`.
9. `gsap.quickTo()` is used for cursor and magnetic element tracking (not repeated `gsap.to()` on mousemove).
10. `.nav-pill` snaps to active link on page load and animates to hovered link on hover.
11. Reading progress bar exists only in `BlogPost.astro` and is `aria-hidden`.
12. ScrollTrigger instances are created top-to-bottom in document order, or carry correct `refreshPriority`.
13. `markers: true` is absent from the production build.
14. No ScrollTriggers appear as child tweens inside a `gsap.timeline()`.
15. All out-of-scope items are untouched.
