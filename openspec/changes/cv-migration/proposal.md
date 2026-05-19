# Proposal: Migrate CV from Next.js to Astro as `/cv` page

## Intent

Miguel's CV currently lives as a standalone Next.js app (`/cv_miguelanay`), duplicating infrastructure (Tailwind v3, build pipeline, hosting) and forcing visitors to context-switch between two domains/styles. By migrating to the existing Astro blog as `/cv`, we unify Miguel's professional presence under one static site, share layout/theme/SEO components, eliminate the Next.js codebase, and gain consistent dark-mode UX. The CV is fully static JSON-driven — no API, no DB — so Astro is the right target.

## Scope

### In Scope
- New route `src/pages/cv.astro` rendering full CV
- Feature folder `src/features/cv/` with section components (Hero, ProjectCard, ExperienceTimeline, Education)
- CV data ported to `src/data/cv-data.json`
- CV types ported to `src/lib/cv-types.ts` (only the CV-related types, lines 91-159 of original definitions.ts)
- Nav link to `/cv` added in shared `Header.astro`
- Footer social links corrected to point to Miguel's accounts (replace Astro template defaults)
- Logo/image assets copied to `public/`
- Tailwind v3 → v4 class/syntax adaptation
- `next/image` → standard `<img>` or `astro:assets` Image

### Out of Scope
- Decommissioning/archiving the old Next.js repo (separate follow-up)
- CMS-driven CV content (stays JSON for now)
- i18n (single language, as it is today)
- Print stylesheet / PDF export
- Redirects from old CV domain (handled at DNS/hosting layer later)
- Visual redesign — we homogenize to blog look, not redesign

## Capabilities

### New Capabilities
- `cv-page`: Static `/cv` route rendering hero, projects, experience timeline, and education from a local JSON data source, integrated with the blog's shared layout, theme, and SEO components.

### Modified Capabilities
- None (Header nav and Footer links are layout updates, not spec-level capability changes).

## Approach

JSON-driven static rendering. Copy `cv-data.json` and the CV-relevant types into the Astro project. Build four small Astro components inside `src/features/cv/components/` (Hero, ProjectCard, ExperienceTimeline, Education) — none are shared, so the Scope Rule keeps them feature-local. Compose them in `src/pages/cv.astro` using the existing `BaseHead`, `Header`, and `Footer`. Rewrite Tailwind v3 utilities to v4 syntax (no `tailwind.config.js`; CSS-first config) and swap `next/image` for `<img>` or `astro:assets`. Dark mode already uses the `.dark` class on both sides, so no theming changes are needed. Static output deploys via the existing S3 + CloudFront pipeline.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/cv.astro` | New | Route composing CV sections |
| `src/features/cv/components/` | New | Hero, ProjectCard, ExperienceTimeline, Education |
| `src/data/cv-data.json` | New | Port from Next.js app |
| `src/lib/cv-types.ts` | New | CV-only types (drop tutorial leftovers) |
| `src/components/layout/Header.astro` | Modified | Add `/cv` nav link |
| `src/components/layout/Footer.astro` | Modified | Replace Astro template socials with Miguel's |
| `public/` | Modified | Add CV logos/images |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind v3 → v4 syntax drift breaks styling | Med | Audit each utility; use v4 CSS-first config; visual diff against Next.js original |
| Image handling regression vs `next/image` | Low | Use `astro:assets` Image where optimization matters; plain `<img>` for logos in `/public/` |
| Footer change affects blog pages (shared component) | Low | Verify links are Miguel's across blog too; this is desired, not a regression |
| CV types file pollution (lines 91-159 only) | Low | Hand-pick only CV types; drop tutorial residuals on copy |

## Rollback Plan

Single feature folder + one new page + two small edits. To revert: `git revert` the migration commit(s). Old Next.js CV repo remains untouched and deployable. No data migration, no DB, no external service contracts to unwind.

## Dependencies

- Access to original CV repo at `/home/k3n5h1n/Escritorio/strapi/cv_miguelanay` for JSON, types, and assets
- Tailwind v4 already configured in target project
- Existing CI/CD (S3 + CloudFront) requires no changes

## Success Criteria

- [ ] `/cv` renders all four sections (Hero, Projects, Experience, Education) with parity to Next.js version
- [ ] Dark mode toggle works on `/cv` via existing `ThemeToggle`
- [ ] Header shows `/cv` link; clicking from any blog page navigates correctly
- [ ] Footer shows Miguel's real social links (not Astro template defaults)
- [ ] `npm run build` succeeds; static output deploys to S3 + CloudFront
- [ ] Lighthouse score for `/cv` ≥ existing blog pages (performance/accessibility/SEO)
- [ ] No `next/image` or Tailwind v3 residuals in the codebase
