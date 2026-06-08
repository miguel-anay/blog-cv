# Proposal: Make callous-cluster Fully Responsive (Mobile-First)

## Intent

The blog is unusable on mobile: the primary navigation is hidden with `display: none` at 768px and no replacement is provided. Vertical padding, grid layouts (`stack-row`, `blog-card`), and feature components (TOC, CourseNav, SectionList) were authored desktop-first and never received mobile breakpoints. This blocks the core reader journey on phones — the largest traffic source for a personal blog — and degrades perceived quality of the CV/About pages where recruiters increasingly browse from mobile.

We fix this NOW because the next planned content/feature work (courses, newsletter) will compound the debt and force a more expensive rewrite later.

## Scope

### In Scope
- New `src/components/layout/MobileNav.astro` hamburger + slide-in drawer with full ARIA semantics (`aria-expanded`, focus trap, ESC to close, body scroll lock).
- Update `Header.astro` to render `MobileNav` below the 768px breakpoint and hide the desktop `.site-nav` symmetrically.
- Introduce responsive design tokens in `src/styles/global.css`: `--section-pad-y`, `--hero-pad-y`, `--stack-col-width` with mobile overrides.
- Mobile breakpoints for: `.stack-row` (about.astro, cv.astro), `.blog-card` (blog index), `.cat-grid`, `.site-footer__bottom`.
- Fix feature components: `SectionList.astro` (replace hardcoded `padding-left: 56px`), `CourseCard.astro` (replace hardcoded `-24px`), `CourseNav` (cap height on mobile), `BlogPost.astro` TOC (collapsible or hide on mobile).
- Verify across viewports: 360, 414, 768, 1024, 1440.

### Out of Scope
- Migration to Tailwind utility classes (keep current CSS architecture).
- Redesign of any page (visual identity stays).
- Dark mode toggle or theme switching.
- Touch gestures beyond standard tap (no swipe-to-close drawer).
- Server-side mobile detection or device-specific routing.

## Capabilities

### New Capabilities
- `responsive-layout`: site-wide mobile-first layout system (tokens, breakpoints, mobile nav contract).

### Modified Capabilities
- None — no existing capability spec files to delta.

## Approach

**Mobile-First Refactor with Hamburger Nav (exploration Approach B).**

1. Establish responsive tokens in `global.css` as the single source of truth for spacing — feature CSS consumes the tokens, never hardcoded px.
2. Build `MobileNav.astro` as a self-contained component with its own scoped `<style>` and a tiny inline `<script>` for toggle/focus-trap/ESC.
3. Update `Header.astro` to swap nav variants at `min-width: 768px` via CSS (no JS branching).
4. Sweep all components touched by exploration findings, replacing hardcoded widths/columns with token-driven or media-queried rules. Mobile gets 1-column or stacked layouts; desktop preserves current grids.
5. Manual viewport QA at the five breakpoints listed in scope; commit one work unit per file group (layout, blog, courses, polish).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/layout/MobileNav.astro` | New | Hamburger + drawer with ARIA, focus trap, ESC. |
| `src/components/layout/Header.astro` | Modified | Mount MobileNav; symmetric breakpoint for `.site-nav`. |
| `src/styles/global.css` | Modified | Responsive tokens, vertical-padding overrides. |
| `src/pages/about.astro`, `src/pages/cv.astro` | Modified | `.stack-row` mobile breakpoint. |
| `src/pages/blog/index.astro` | Modified | `.blog-card` mobile breakpoint. |
| `src/features/courses/components/SectionList.astro` | Modified | Replace hardcoded `padding-left: 56px`. |
| `src/features/courses/components/CourseCard.astro` | Modified | Replace hardcoded `-24px` hover with token. |
| `src/features/courses/components/CourseNav.astro` | Modified | Max-height cap on mobile. |
| `src/layouts/BlogPost.astro` | Modified | TOC aside collapsible/hidden on mobile. |
| Footer + `.cat-grid` styles | Modified | Wrap + 1-column at 480px. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ARIA focus trap edge cases (Tab/Shift+Tab cycling, restore focus on close) | Med | Follow WAI-ARIA Dialog (Modal) pattern; test with keyboard and VoiceOver. |
| IDE theme `body` padding conflicts with fixed/overlay nav | Med | Audit `global.css` for body-level padding before adding drawer; use `position: fixed` with safe-area-inset. |
| Mixed CSS ownership (global.css vs scoped Astro `<style>`) causes specificity surprises | Low | Tokens in `:root`; component overrides use scoped class + token, never raw px. |
| Scope creep into visual redesign | Med | Strict review against "Out of Scope" — geometry-only changes, no color/type/spacing identity shifts. |
| PR size exceeds 400-line budget | Med | Plan two slices in tasks: (1) tokens + MobileNav + Header, (2) sweep remaining components. |

## Rollback Plan

Each work unit is a single commit on `feature/N-web-responsive`. To revert: `git revert` the offending commit(s) on the feature branch, or close the PR without merging. MobileNav is additive — removing it and reverting `Header.astro` restores prior desktop-only behavior with zero data impact. Tokens in `global.css` default to current desktop values, so a partial revert remains visually consistent.

## Dependencies

- None. No new npm packages, no external services. Pure CSS + tiny vanilla JS for nav toggle.

## Success Criteria

- [ ] Primary navigation reachable and usable on viewports 360–767px via hamburger drawer.
- [ ] Drawer passes keyboard-only navigation (Tab cycles inside, ESC closes, focus restores to toggle).
- [ ] No horizontal scrollbars at 360, 414, 768, 1024, 1440 on `/`, `/blog`, `/blog/[slug]`, `/about`, `/cv`, `/courses`.
- [ ] Section/hero vertical padding visibly reduced on mobile (no 80–96px gaps on 360px screens).
- [ ] `.stack-row` and `.blog-card` collapse to single-column layouts below 768px.
- [ ] Lighthouse mobile accessibility score ≥ 95 on `/` and `/blog`.
- [ ] No hardcoded px widths remain in the components listed in Affected Areas.
