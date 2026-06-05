# Design: Web Responsive (Mobile-First Refactor)

## Technical Approach

Mobile-first refactor in two slices. Slice 1 lays the foundation: responsive design tokens in `global.css`, a new self-contained `MobileNav.astro` with ARIA + focus trap, and `Header.astro` wiring. Slice 2 is a surgical sweep replacing hardcoded widths in feature components with token-driven or media-queried rules. No new dependencies; pure CSS plus a tiny inline `<script>` per the proposal's Approach B.

Tokens live in `:root`; components consume `var(--section-pad-y)` / `var(--hero-pad-y)` and override only via scoped `<style>` when they need component-specific geometry. Breakpoints follow the existing `max-width: 768px` convention already present in `global.css` (line 900).

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Nav pattern | WAI-ARIA disclosure (`aria-expanded` button + nav drawer) | Full Dialog/modal pattern with `role="dialog"`; React/Vue island | It is navigation, not a modal — disclosure semantics are correct and lighter. Astro static + inline script avoids hydration cost. |
| Script placement | Inline `<script>` inside `MobileNav.astro` | Separate `mobile-nav.ts` module; client directive | Astro processes inline scripts at build time; co-location keeps the component self-contained and aligns with the existing `ThemeSwitcher`/`ModeToggle` pattern. |
| Toggle contract | `data-mobile-nav-toggle` on button, `data-mobile-nav` on drawer, `.is-open` class + `aria-expanded` | IDs only; class-name selectors | Data attributes survive CSS refactors and are decoupled from styling hooks. Class `.is-open` mirrors existing `.is-active` convention in `Header.astro`. |
| Token strategy | `--section-pad-y` / `--hero-pad-y` in `:root`, overridden inside `@media (max-width: 767px)` | Per-component media queries; SCSS mixins | One source of truth in `global.css`. Existing `--pad-x` already follows this pattern (overridden at 768px). |
| Breakpoint contract | mobile ≤767 / tablet 768–1023 / desktop ≥1024; small mobile ≤480 (cat-grid); stack collapse ≤600 (stack-row, blog-card) | Tailwind defaults (640/768/1024); single 768 cutoff | Matches existing 768px breakpoint in `global.css`; adds 480/600 only where the proposal requires denser collapse. |
| CSS ownership | Tokens + layout primitives → `global.css`. Component overrides → scoped `<style>` in the `.astro` file. | Single global stylesheet; all scoped styles | Prevents specificity wars (proposal risk #3). Scoped styles never need `!important` because they outrank global by Astro's hashing. |
| Focus trap | Vanilla JS inside MobileNav `<script>`: query focusables, Tab/Shift+Tab cycle, ESC closes, restore focus to toggle | `focus-trap` npm package; HTML `inert` only | Zero dependencies; ~25 LOC. `inert` alone does not cycle focus inside the drawer. |
| Body scroll lock | Toggle `document.documentElement.style.overflow = 'hidden'` when open | `position: fixed` on body | IDE theme already sets `padding-left: 220px` on body; mutating `position` would break that layout. |

## Data Flow

```
User taps hamburger ──► button[data-mobile-nav-toggle].click
                              │
                              ▼
                      toggle .is-open on nav[data-mobile-nav]
                      flip aria-expanded
                      lock <html> overflow
                      focus first link in drawer
                              │
                       ┌──────┴───────┐
                       ▼              ▼
              Tab / Shift+Tab    ESC or backdrop
              cycle inside       close → restore focus
              focusables         to toggle button
```

CSS-only swap at the 768px boundary: desktop sees `.site-nav` (existing), mobile sees `MobileNav` slot. No JS branching for variant selection.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/layout/MobileNav.astro` | Create | Hamburger button + drawer markup, scoped `<style>`, inline `<script>` for toggle/focus-trap/ESC. |
| `src/components/layout/Header.astro` | Modify | Mount `<MobileNav nav={nav} />` next to `.site-nav`; pass shared nav array. |
| `src/styles/global.css` | Modify | Add `--section-pad-y`, `--hero-pad-y`, `--stack-col-width` in `:root` and `@media (max-width: 767px)` override; ensure `.site-nav` hide stays at ≤767. |
| `src/pages/about.astro`, `src/pages/cv.astro` | Modify | `.stack-row` → `grid-template-columns: 1fr` at ≤600px. |
| `src/pages/blog/index.astro` | Modify | `.blog-card` single-column at ≤600px. |
| `src/features/courses/components/SectionList.astro` | Modify | Replace hardcoded `padding-left: 56px` with `var(--pad-x)` / responsive value. |
| `src/features/courses/components/CourseCard.astro` | Modify | Replace hardcoded `-24px` hover offset with token. |
| `src/features/courses/components/CourseNav.astro` | Modify | `max-height: 50vh; overflow-y: auto;` at ≤767. |
| `src/layouts/BlogPost.astro` | Modify | TOC `<aside>` becomes `<details>` collapsible at ≤1023, hidden at ≤767. |
| `.cat-grid` rules (in `global.css`) | Modify | Wrap to 1 column at ≤480. |
| `.site-footer__bottom` (in `global.css`) | Modify | `flex-wrap: wrap` at ≤767. |

## Interfaces / Contracts

```astro
---
// MobileNav.astro
interface Props {
  nav: Array<{ href: string; label: string }>;
  currentPath: string;
}
const { nav, currentPath } = Astro.props;
---
<button
  type="button"
  class="mobile-nav-toggle"
  data-mobile-nav-toggle
  aria-expanded="false"
  aria-controls="mobile-nav-drawer"
  aria-label="Abrir navegación"
>…</button>

<nav
  id="mobile-nav-drawer"
  class="mobile-nav"
  data-mobile-nav
  aria-label="Navegación móvil"
  hidden
>…</nav>
```

CSS contract (in `global.css`):

```css
:root {
  --section-pad-y: 80px;
  --hero-pad-y: 96px;
  --stack-col-width: 280px;
}
@media (max-width: 767px) {
  :root {
    --section-pad-y: 40px;
    --hero-pad-y: 48px;
    --stack-col-width: 100%;
  }
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Manual viewport QA | 360, 414, 768, 1024, 1440 across `/`, `/blog`, `/blog/[slug]`, `/about`, `/cv`, `/courses` | Chrome DevTools device toolbar; check no horizontal scroll, drawer opens/closes, focus trap holds. |
| Keyboard-only | Tab cycles inside drawer; ESC closes and restores focus; Shift+Tab wraps backward | Manual keyboard nav with screen reader off, then with VoiceOver/NVDA. |
| Accessibility | Lighthouse mobile a11y ≥95 on `/` and `/blog` | `npm run build && npm run preview` then Lighthouse mobile audit. |
| Visual regression | Desktop layouts unchanged at ≥1024 | Side-by-side with `main` branch screenshots. |

No unit/integration tests — this is presentation-only static Astro. Project has no Vitest/Playwright setup (confirmed in `package.json`).

## Migration / Rollout

No data migration. Single feature branch `feature/N-web-responsive` with two work-unit commits (Slice 1 foundation, Slice 2 sweep). Each slice is independently revertable. Tokens default to current desktop values so a partial revert stays visually consistent.

## Open Questions

- [ ] BlogPost TOC at mobile: collapse via `<details>` or hide entirely? Recommend collapse to preserve nav utility on long posts.
- [ ] Drawer animation: instant vs `transition: transform 200ms ease`? Recommend transition.
