# GSAP Redesign — Verify Report

**Date**: 2026-05-27
**Branch**: feat/3-gsap-redesign-p2 (Slices 3–5)
**Verdict**: PASS WITH WARNINGS

## Summary

1 CRITICAL issue (blocks merge), 2 WARNINGS, 2 SUGGESTIONS. Build passes clean.

---

## Critical Issues (blocks merge)

### CRITICAL-001: `.cv-name` and `.about-title` permanently hidden under `prefers-reduced-motion: reduce`

- **Files**: `src/pages/cv.astro` line 245 / `src/pages/about.astro` line 180
- **Root cause**: Both pages unconditionally set `el.style.visibility = 'hidden'` outside the matchMedia block. Visibility is only restored inside `gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', ...)`. Under reduced motion that callback never runs.
- **Contrast**: `index.astro` is safe — `.hero__title` has a CSS override in the global.css reduced-motion block (`visibility: visible`). `.cv-name` and `.about-title` have no such CSS rule.
- **Fix options** (pick one):
  1. Add a `gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => { el.style.visibility = ''; })` branch in each page.
  2. Add CSS overrides to the reduced-motion block in `global.css` for `.cv-name` and `.about-title`.
  3. Only set `visibility: hidden` after confirming `prefers-reduced-motion: no-preference` matches.

---

## Warnings

### WARNING-001: Featured image parallax — container `overflow: hidden` missing

- **File**: `src/pages/index.astro` (featured section)
- **Spec**: REQ-ST-002 requires the container have `overflow: hidden`
- **Impact**: Image bleeds outside `.featured__r` on scroll; visual regression
- **Fix**: Add `overflow: hidden` to `.featured__r` in the page's `<style>` block

### WARNING-002: TASK-4.1 + TASK-4.2 in same commit (32c95de)

- Traceability divergence from task spec; no code correctness impact

---

## Suggestions

### SUGGESTION-001: `gsap-utils.ts` module-level plugin imports

Top-level `import { ScrollTrigger }` and `import { SplitText }` are bundled regardless of which export is used. Vite tree-shakes correctly so this is low priority. Could lazy-import inside functions for a lighter utility if `whenFontsReady`-only consumers appear.

### SUGGESTION-002: Confirm `mix-blend-mode: difference` on `.cursor-dot`

Confirmed in global.css line 982 — included here for reference only.

---

## Hard Constraint Results

| ID | Constraint | Result | Notes |
|---|---|---|---|
| HARD-001 | `npm run build` passes | PASS | Zero errors; Node 22 warning is pre-existing |
| HARD-002 | All animations in `gsap.matchMedia()` | FAIL | `cv-name`/`about-title` hidden unconditionally (see CRITICAL-001) |
| HARD-003 | `SplitText.create()` only via `splitWords()` | PASS | Only in `gsap-utils.ts:splitWords()` |
| HARD-004 | Hero title visibility:hidden + restore | PARTIAL | index.astro PASS; cv.astro + about.astro FAIL under reduced-motion |
| HARD-005 | No CDN script tags | PASS | Zero CDN src found |
| HARD-006 | `registerPlugins()` before first use | PASS | First statement in each page script |
| HARD-007 | No `markers: true` in production | PASS | Zero occurrences in src/ and dist/ |
| HARD-008 | No View Transitions | PASS | Zero `ClientRouter`/`astro:page-load` added |

---

## Key Requirement Spot-Checks

| Requirement | Result | Notes |
|---|---|---|
| REQ-UTILS-001/002/003 | PASS | All 4 exports; font-ready guard; no side effects |
| REQ-CURSOR-001/003/006 | PASS | Direct body children, coarse-pointer exit, reduced-motion safe |
| REQ-NAV-001/002/005 | PASS | `span.nav-pill` exists, snaps on load, pointer-events:none |
| REQ-HERO-001/002 | PASS | SplitText via `splitWords()` on home and CV |
| REQ-ST-001/006 | PASS | `registerPlugins()` first; no nested ST in timeline |
| REQ-ST-002 parallax overflow | WARNING | `.featured__r` missing `overflow: hidden` |
| REQ-PROGRESS-001/003/004 | PASS | Only in BlogPost, aria-hidden, reduced-motion guard |
| REQ-MICRO-004 | PASS | `makeMagnetic` gated to `(pointer: fine)` matchMedia |
| REQ-CSS-001 to 009 | PASS | All 8 sections present with correct labels |

---

## Out-of-Scope Guard

| Check | Result |
|---|---|
| Turso/Drizzle data layer | PASS — courses schema changes are pre-existing from prior branch, not gsap-redesign commits |
| Tailwind utility classes | PASS — none added |
| `[data-theme]`/`[data-mode]` toggle | PASS — only pre-existing ThemeSwitcher/ModeToggle components |
| Blog Flip filter | PASS — not present |
| ScrollSmoother | PASS — not present |
| View Transitions | PASS — not present |
| About page HTML restructuring | PASS — only existing `.section` selectors used |

---

## Build Output

```
[vite] dist/client/_astro/gsap-utils.BafUv6nH.js  52.13 kB │ gzip: 21.69 kB
[vite] dist/client/_astro/index.CzGW6FVa.js        70.46 kB │ gzip: 27.81 kB
[vite] dist/client/_astro/client.CxNunIk4.js      194.63 kB │ gzip: 60.99 kB
[vite] ✓ built in 1.24s
[WARN] [@astrojs/vercel] Node.js 24 not supported; runtime uses 22 (pre-existing)
[build] Server built in 10.87s
[build] Complete!
```

---

## Next Steps

Fix CRITICAL-001 before merging:

```typescript
// Option 1 — in cv.astro and about.astro, add after the no-preference block:
gsap.matchMedia().add('(prefers-reduced-motion: reduce)', () => {
  if (cvHeroTitle) cvHeroTitle.style.visibility = '';
});
```

or in `src/styles/global.css` reduced-motion block:

```css
@media (prefers-reduced-motion: reduce) {
  .cv-name,
  .about-title {
    visibility: visible;
  }
}
```

After fixing CRITICAL-001 and optionally WARNING-001, run `sdd-archive`.
