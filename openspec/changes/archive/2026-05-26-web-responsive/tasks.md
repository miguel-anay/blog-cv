# Tasks: Web Responsive (Mobile-First Refactor)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 220–310 (additions + deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR (two work-unit commits: Slice 1 + Slice 2) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| Slice 1 | Tokens + MobileNav + Header wiring | PR 1 | Foundation — all of Slice 2 depends on tokens being in place |
| Slice 2 | Component sweep (hardcoded values → tokens/responsive) | PR 1 | Same PR; can be a second commit for clean revert boundary |

---

## Phase 1: Foundation (tokens + breakpoint fix)

- [x] 1.1 In `src/styles/global.css` `:root`, add `--section-pad-y: 80px`, `--hero-pad-y: 96px`, `--stack-col-width: 280px`
- [x] 1.2 In `src/styles/global.css`, add `@media (max-width: 767px)` override: `--section-pad-y: 40px`, `--hero-pad-y: 48px`, `--stack-col-width: 100%`
- [x] 1.3 In `src/styles/global.css`, fix existing breakpoint `@media (max-width: 768px)` → `767px` (line ~900) to unify the boundary

## Phase 2: MobileNav Component (REQ-001, REQ-002, REQ-003)

- [x] 2.1 Create `src/components/layout/MobileNav.astro` with Props interface: `nav: Array<{ href: string; label: string }>; currentPath: string`
- [x] 2.2 Add hamburger `<button type="button" data-mobile-nav-toggle aria-expanded="false" aria-controls="mobile-nav-drawer">` markup with SVG icon
- [x] 2.3 Add `<nav id="mobile-nav-drawer" data-mobile-nav aria-label="Mobile navigation" hidden>` drawer with nav links
- [x] 2.4 Add scoped `<style>`: button hidden at `≥768px` via `display: none`; drawer hidden/shown via `.is-open`; optional `transition: transform 200ms ease`
- [x] 2.5 Add inline `<script>`: toggle `.is-open` + `aria-expanded` on button click; lock `document.documentElement.style.overflow = 'hidden'` on open; restore on close
- [x] 2.6 In the inline `<script>`, implement focus trap: `querySelectorAll` focusable elements; Tab/Shift+Tab cycle within drawer; ESC closes and returns focus to toggle button

## Phase 3: Header Wiring (REQ-001)

- [x] 3.1 In `src/components/layout/Header.astro`, import `MobileNav` and pass the shared nav array and `currentPath` prop
- [x] 3.2 In `src/components/layout/Header.astro`, add `display: none` at `≤767px` to `.site-nav` (scoped style or existing MQ)

## Phase 4: Component Sweep — Pages (REQ-006)

- [x] 4.1 In `src/pages/about.astro`, add `@media (max-width: 600px)` rule: `.stack-row` → `flex-direction: column` (or equivalent single-column layout)
- [x] 4.2 In `src/pages/cv.astro`, add same `@media (max-width: 600px)` rule for `.stack-row`
- [x] 4.3 In `src/pages/blog/index.astro`, add `@media (max-width: 600px)` rule: `.blog-card` → single column

## Phase 5: Component Sweep — Courses + Global (REQ-007)

- [x] 5.1 In `src/features/courses/components/SectionList.astro`, replace `padding-left: 56px` with `var(--pad-x)` (or add `@media (max-width: 767px) { padding-left: var(--pad-x) }`)
- [x] 5.2 In `src/features/courses/components/CourseCard.astro`, replace hardcoded `-24px` hover offset with `calc(var(--pad-x) * -1)`
- [x] 5.3 In `src/features/courses/components/CourseNav.astro`, add `@media (max-width: 767px) { max-height: 50vh; overflow-y: auto }`
- [x] 5.4 In `src/layouts/BlogPost.astro`, wrap TOC in `<details>` at `≤767px` (or add `display: none` at `≤767px`); resolve open question: use `<details>` collapse
- [x] 5.5 In `src/styles/global.css`, add `@media (max-width: 480px)` rule: `.cat-grid` → `grid-template-columns: 1fr`
- [x] 5.6 In `src/styles/global.css`, add `@media (max-width: 767px)` rule: `.site-footer__bottom` → `flex-wrap: wrap`

## Phase 6: Verification (REQ-004, all)

- [ ] 6.1 Run `tests/e2e/responsive.spec.ts` after Slice 1 (Phases 1–3) and confirm no failures before starting Slice 2
- [ ] 6.2 Run `tests/e2e/responsive.spec.ts` after Slice 2 (Phases 4–5) and confirm all scenarios pass
- [ ] 6.3 Manual viewport QA in Chrome DevTools at 360, 414, 768, 1024, 1440px across `/`, `/blog`, `/blog/[slug]`, `/about`, `/cv`, `/courses` — verify no horizontal scroll (`document.documentElement.scrollWidth === window.innerWidth`)
- [ ] 6.4 Keyboard-only test: Tab cycle in drawer, ESC closes and returns focus to toggle, Shift+Tab wraps correctly
- [ ] 6.5 Run `npm run build && npm run preview` and confirm Lighthouse mobile a11y score ≥ 95
