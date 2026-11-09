# CLAUDE.md

Agent guide for this repo (personal site of Miguel Anay, https://miguel-anay.nom.pe). Docs are in Spanish;
code and this file are in English.

## Stack

Astro 5.14 SSR (`output: 'server'`, `@astrojs/vercel`) · React 19 islands · Tailwind 4 + CSS tokens
(`src/styles/global.css`) · GSAP + three.js (home hero only) · Turso/libSQL via Drizzle · Vercel hosting ·
pnpm · Vitest · Playwright. The old Strapi + AWS S3/CloudFront stack is gone (see `docs/archive/`).

## Commands

```bash
pnpm dev                 # astro dev, localhost:4321
pnpm build               # astro build (queries Turso: needs TURSO_URL/TURSO_TOKEN)
pnpm check               # astro check (types); also pnpm type-check (tsc --noEmit)
pnpm test:unit           # vitest run (src/**/*.test.ts); pnpm test:unit:watch for watch mode
pnpm test                # Playwright E2E (tests/e2e, dev server on :4322)
pnpm db:migrate          # apply pending src/lib/migrations/*.sql to Turso (idempotent)
```

Before a PR: `pnpm check && pnpm test:unit && pnpm test && pnpm build` (CI runs the same). Production deploys
only from CI after migrations (`vercel.json` disables Vercel's Git deploy of `main`).

## Architecture

**Scope Rule (absolute):** code used by one feature lives in `src/features/<feature>/`; code used by 2+
features goes to `src/components/` or `src/lib/`. No exceptions.

| Feature | Routes | Notes |
|---|---|---|
| blog | `pages/blog/**`, `rss.xml.js`, `sitemap.xml.js` | articles from Turso; RSS reads the `blog` content collection (loaded at build) |
| cv | `pages/cv.astro`, `about.astro` | `getCv()` over `cv_*` tables |
| courses | `pages/courses/**` | `features/courses` |
| exams | `pages/exams/**`, `pages/api/exams/attempts/**` | `lib/exam-api.ts`; pure `timer.ts` / `scoring.ts` |
| docs | `pages/docs/**` | reads READMEs/docs from GitHub per request; allowlist `DOC_REPOS` in `features/docs/repos.ts` |
| home | `pages/index.astro` | `features/home/three` hero scene |

## Data access

- `src/lib/db.ts` `getDb()` (lazy Drizzle client); schema in `src/lib/schema.ts`; read helpers in
  `src/lib/api.ts` and `src/lib/exam-api.ts` (they log and return empty/`null` on DB errors).
- Content is loaded straight into Turso by Claude Code skills (`/publish-articulo`, `/publish-cv`,
  `/publish-pregunta`) and `scripts/ingest-*.mjs`. There is no admin UI.
- Schema changes: add `src/lib/migrations/NNN_name.sql` (+ optional `_rollback.sql`), keep it backward
  compatible; migrations run before each production deploy.

## Env vars

`TURSO_URL`, `TURSO_TOKEN` (required), `GITHUB_TOKEN` (optional, raises GitHub API limit for `/docs`). Set in
Vercel for Production and Preview; local in `.env` (see `.env.example`). Never commit secrets.

## Docs pipeline (each doc answers the previous one)

`docs/PRD.md` -> `docs/DESIGN.md` -> `docs/TECH-DESIGN.md` -> `docs/adr/` -> `BACKLOG.md` -> specs/tasks
(`odd/tasks/`, past changes in `openspec/`) -> `docs/SECURITY.md`. Index: `docs/README.md`. Deploy/CI:
`docs/DEPLOY.md`. If you change behavior, update the doc that owns it in the same PR.

## Conventions

- Conventional commits (`feat:`, `fix:`, `docs:`, ...). No AI attribution or Co-Authored-By in commits.
- Branches: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/` + issue number, e.g. `feat/35-course-docs`.
- Docs in Spanish, neutral register; real dates only.
- Reuse existing helpers (`resolveOwnedAttemptId`, `getDb`, `findDocRepo`) instead of re-implementing them.

## Gotchas

- GSAP vs CSS: do not add CSS `transition` to properties GSAP animates (e.g. `opacity`); GSAP ends on a wrong
  value.
- Mobile grids: use `minmax(0, 1fr)`, not `1fr`, or content overflows horizontally at 390 px.
- `guest_id` cookie must be a UUID: it becomes part of the DB key (`guest_<uuid>`); the middleware regenerates
  anything else. Only `/exams` and `/api/exams` get a guest; the user row is inserted on non-GET/HEAD only.
- Every exam attempt route must go through `resolveOwnedAttemptId` (403 if not the owner).
- Leftover auth tables `session`, `account`, `verification` (from better-auth) are unused; `user` is still
  used for guests. Don't build on them.
- `/docs` must stay behind the `DOC_REPOS` allowlist (no open proxy). GitHub failure -> 502 for `/docs` only.
- Legacy AWS files (`infra/`, `blog-api/`, `buildspec.yml`, `azure-pipelines.yml`) are not used by Vercel.
