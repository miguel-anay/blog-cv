# Verification Report — lambda-api

**Date**: 2026-05-16
**Phase**: sdd-verify
**Project**: blog (callous-cluster + blog-api)

---

## File Completeness: 48/48 expected files present

All listed files exist. Architecture directory tree matches the spec.

Notes:
- `blog-api/.env.example` documented as MISSING in apply-progress (harness denies dotfile writes). README documents env vars instead — acceptable deviation.

---

## Strapi Elimination: PASS

- `src/lib/strapi.ts` → DELETED
- `src/lib/strapi-types.ts` → DELETED
- No `import` or `from` referencing `strapi` in any `.ts`/`.astro` under `src/`
- Only residual reference: a UI display string (`"astro · strapi · aws"`) in `src/pages/index.astro` line 93 — cosmetic copy, not a code dependency. Recommend updating to remove Strapi mention.

---

## Spec Compliance

### Core implementations
- **ReadMin formula**: PASS — `read-min.ts` line 22 implements `Math.max(1, Math.ceil(wordCount / 200))` exactly. Word extraction is recursive over nested TextNode/ListItemNode.
- **ArticleBlock union (6 variants)**: PASS — `types.ts` lines 16-22 has paragraph, heading, list, code, quote, image.
- **Error shape**: PASS — `error.ts` middleware consistently returns `{ error: { code, message } }`. All domain error classes carry typed `code` constants.
- **Auth `timingSafeEqual`**: PASS — `auth.ts` line 1 imports from `node:crypto`; line 23 compares with length check + `timingSafeEqual`.
- **Turso singleton**: PASS — `client.ts` uses module-scope `_db` variable cached on first `getDb()` call.
- **Route order `/categories/counts` before `/:slug`**: PASS — `categories.ts` declares `/counts` (line 10) before `/` (line 17). Note: there is no `/:slug` GET route on categories at all, but the order is still correct.
- **Newsletter no DB**: PASS — `resend-newsletter.ts` only calls `fetch` to Resend API; no Turso/Drizzle imports.
- **Migration `DRY_RUN` defaults to "true"**: PASS — `migrate-from-strapi.ts` line 16: `(process.env.DRY_RUN ?? 'true') !== 'false'`. Idempotent via `onConflictDoNothing()`.
- **Frontend `api.ts` try/catch**: PASS — all 7 exported functions wrap `apiFetch` in try/catch and return safe defaults (`EMPTY_LIST`, `null`, `[]`, `{}`, `{ ok: false }`).
- **`blog/[page].astro` pagination 2..pageCount**: PASS — `getStaticPaths` generates `pageCount - 1` paths starting at page 2.

### Spec divergences (CRITICAL)

1. **JSON field naming — camelCase vs snake_case**
   - Spec §4 defines responses in snake_case (`read_min`, `cover_url`, `published_at`, `created_at`, `updated_at`, `site_title`, `site_description`, `about_markdown`, `og_image`).
   - Implementation serializes camelCase (`readMin`, `coverUrl`, `publishedAt`, `siteTitle`, etc.).
   - Frontend `api-types.ts` and pages (`blog/[page].astro`, `blog/[...slug].astro`, `index.astro`) ALSO use camelCase, so backend+frontend agree internally — runtime works.
   - **Impact**: ext API consumers won't match the spec contract. Migration script will not feed third-party tools. Decide: update spec to camelCase OR add mapper layer at HTTP boundary.

2. **Category list/counts response wrapping**
   - Spec FR-C1: `{ "data": [Category] }`. Implementation: `c.json(categories)` returns flat array.
   - Spec FR-C2: `{ "data": { "<slug>": <count> } }`. Implementation: returns flat `Record<string, number>`.
   - Frontend matches the flat shape, so runtime is consistent, but contract differs from spec.

3. **CV types mismatch (frontend-facing)**
   - Backend domain (`blog-api/src/domain/cv/types.ts`): `educacion: CvEducacion[]` (flat array) + separate `cursos: CvCurso[]`.
   - Frontend `src/lib/cv-types.ts` (re-exported via `api-types.ts`): `educacion: CvEducacion` (single object with `universidades` and `especializaciones`); NO top-level `cursos`.
   - `src/pages/cv.astro` reads `cvData.cursos` (line 22) and `educacion.length` (line 125) — these are runtime fields the backend sends, but the frontend type system rejects them.
   - **`astro check` reports**: `Property 'cursos' does not exist on type 'CvData'`, `'never[] | CvEducacion'` errors, type assignment failures. This is type-broken; the cv page will likely run but fails strict checks.

### Other functional gaps

4. **`articles.ts` does not catch invalid POST/PATCH JSON or validation errors explicitly**
   - `CreateArticleUseCase`/`UpdateArticleUseCase` throw `ValidationError`, which `error.ts` maps to 422 — OK.
   - However, `dto.ts` `CreateArticleSchema` accepts snake_case (`cover_url`, `author_id`, `published_at`, `categories`) on the WRITE side, while the response shape and frontend use camelCase. Asymmetric.

5. **`DrizzleArticleRepository.findAll` with category filter**
   - Runs the unfiltered query first AND a second filtered query. The result of the first is discarded. Wasted DB calls (2 extra queries) but no correctness bug.
   - Unused `inArray` import (line 1) and unused `filtered` variable (line 41) flagged by tsc.

6. **`article_categories` no CASCADE on delete**
   - Tasks T-11 mention "composite PK + CASCADE". Schema (line 41-45) and migration SQL (line 34-35) have FK references but NO `ON DELETE CASCADE`. Deleting an article will fail FK constraint when category links exist.

7. **`Authors` in spec marked `email: string` required**
   - Domain `Author.email` is `string` required; mapper enforces. Schema OK.

### Missing/skipped tasks

- T-04 `.env.example` not created (documented in README — acceptable).

---

## TypeScript

### `blog-api` tsc results
- `node_modules` not installed (blog-api has no `node_modules` directory). Cannot run an authoritative tsc check.
- `tsconfig.json` misconfigured: `rootDir: "src"` conflicts with `include: ["src", "scripts"]` — tsc raises TS6059. To check, override rootDir.
- With rootDir override: ~80% of errors are "Cannot find module" (hono, drizzle-orm, @libsql/client, @hono/aws-lambda, @types/node) — all resolve once `pnpm install` runs.
- Real-code errors (not module-resolution):
  - `drizzle-article-repository.ts` lines 50, 52, 66, 92, 129, 180 — implicit `any` on callback params (`r`, `row`, `tx`). Should annotate.
  - `drizzle-category-repository.ts` line 18 — implicit `any`.
  - `db/schema.ts` line 47 — implicit `any` on `t` in composite PK closure.
  - Multiple Hono callback `c` parameters — implicit `any` (`hono/cors`, `hono/logger` types resolve under `node_modules`).
  - `routes/newsletter.ts` line 11 — `c.req.json<...>()` "Untyped function calls may not accept type arguments" — Hono `json<T>()` works when Hono types are resolved.
- **Estimate**: with `node_modules` present, ~10-15 real implicit-any errors remain. All non-blocking but should be cleaned up.

### `astro check` results (frontend, `/home/k3n5h1n/Escritorio/strapi/callous-cluster`)
- 92 errors / 6 hints / 0 warnings.
- Significant share (~40) come from a stale `astro-output/` directory at the repo root containing copies of OLD pages still importing `../lib/strapi`. These are NOT in `src/` and don't affect the build — but `astro check` scans them.
- Real `src/` errors:
  - `src/components/DynamicContent.astro:19` — `TextNode.underline` not in domain type.
  - `src/pages/blog/components/RichTextRenderer.astro` — uses `TextNode.underline` and `TextNode.strikethrough` (not in domain) + camelCase SVG attrs that Astro rejects (`strokeLinecap` etc.).
  - `src/pages/blog/categories.astro:76` — passes `index` prop to a component that doesn't declare it.
  - `src/pages/blog/[...slug].astro:30` — `BlogPost` Props mismatch: declared `description: string` but article gives `string | null`.
  - `src/layouts/BlogPost.astro:43` — `string | null` → `string | undefined` for hero image.
  - `src/pages/cv.astro` — uses `cvData.cursos`, `educacion.length`, `educacion.map`, plus implicit any on map params. Caused by CV types divergence.
  - `src/pages/index.astro:124` — overload mismatch on a component.

### Verdict
- Backend types are mostly clean once `pnpm install` happens; a handful of `implicit any` from Drizzle callbacks.
- Frontend has real type issues stemming from (a) CV types mismatch, (b) RichTextRenderer extra TextNode properties (`underline`, `strikethrough`) not modelled in the domain.

---

## Architecture Integrity: PASS

- `domain/**` imports only from itself — no infrastructure or interfaces imports. Verified via grep.
- `application/**` imports only from `domain/**` and zod — no infrastructure or interfaces imports.
- `infrastructure/**` imports from `domain/**` only — no application imports.
- `interfaces/**` imports from `application/**` and `infrastructure/**` (container) — consistent with hexagonal layering.

---

## Package.json

`blog-api/package.json`: PASS. Dependencies include all required: `hono`, `@hono/node-server`, `@hono/aws-lambda`, `@libsql/client`, `drizzle-orm`, `zod`. Dev deps include `tsx`, `esbuild`, `drizzle-kit`, `typescript`, `@types/node`, `@types/aws-lambda`. Scripts cover dev/build/migrate/seed/db.

**Action needed**: run `pnpm install` (no `node_modules` present yet).

---

## Overall Verdict: PASS WITH WARNINGS

Backend implementation is structurally complete and follows the SDD plan. Architecture is clean. All required files exist. Critical flows (auth, readMin, error shape, migration DRY_RUN, Resend integration) work as specified.

### Issues requiring action before archive

**CRITICAL (block merge)**:
1. **CV type mismatch** — frontend `cv.astro` uses `cvData.cursos` and `educacion.length`, but `api-types.ts` re-exports the OLD `cv-types.ts` shape. Type system rejects this even though runtime would work. Fix: update `src/lib/cv-types.ts` (or create new shape in `api-types.ts`) to match the backend's flat `educacion: CvEducacion[]` + `cursos: CvCurso[]`. Otherwise `astro build` fails strict TypeScript checks.

**WARNINGS (should fix, do not block)**:
2. **camelCase vs snake_case JSON keys** — implementation diverges from spec §4. Either update spec to camelCase (recommended; matches frontend + idiomatic TS) or add a snake_case serialization layer. Document decision in archive.
3. **Category routes return flat arrays/objects** instead of `{ data: ... }` wrappers from spec FR-C1/FR-C2. Frontend already matches the flat shape; update spec or add wrapper.
4. **`article_categories` lacks `ON DELETE CASCADE`** in schema and migration SQL. Add `.onDelete('cascade')` to drizzle schema FK + update SQL.
5. **`DrizzleArticleRepository.findAll` runs the unfiltered query even when category filter applies** — wasted DB work. Refactor to skip the unfiltered branch when `categorySlug` is set.
6. **Drizzle callback implicit-any** errors (~10) once `pnpm install` runs. Annotate `r`, `row`, `tx` params.
7. **`RichTextRenderer.astro` uses `TextNode.underline` and `strikethrough`** not in the domain type. Either add these to the `TextNode` interface or strip them from the renderer.
8. **Stale `astro-output/` directory at repo root** contains old `strapi.ts` import copies; these pollute `astro check`. Either delete or `.gitignore`.
9. **`src/pages/index.astro` line 93** still has the cosmetic string `"astro · strapi · aws"`. Cosmetic — change to reflect new stack.
10. **`tsconfig.json` rootDir/include conflict** in `blog-api` prevents direct `tsc --noEmit`. Either drop `scripts` from `include` and run scripts via tsx only, or move rootDir to `.`.
11. **`.env.example` missing in blog-api** (harness denial). Document or commit manually.

### Ready for archive: NO

Recommendation: fix CRITICAL #1 (CV types) before archiving. The other warnings can be resolved post-merge or in a follow-up PR. Without #1, `astro build` will likely fail strict checks.

---

## Return Contract

```yaml
verdict: PASS WITH WARNINGS
critical_issues:
  - CV type mismatch: cv.astro uses cursos + educacion.length but api-types.ts re-exports old cv-types.ts shape (educacion as object, no top-level cursos). astro build will fail strict type checks.
warnings:
  - camelCase JSON keys diverge from spec section 4 snake_case contract
  - Categories routes return flat shape, not { data: ... } wrapper
  - article_categories junction lacks ON DELETE CASCADE
  - DrizzleArticleRepository.findAll runs an unused unfiltered query when categorySlug set
  - Drizzle/Hono callback parameters have implicit any (~10 instances)
  - RichTextRenderer uses TextNode.underline/strikethrough not in domain types
  - Stale astro-output/ directory pollutes astro check
  - index.astro still has the string "astro · strapi · aws" (cosmetic)
  - tsconfig rootDir/include conflict in blog-api (cannot tsc --noEmit directly)
  - blog-api .env.example missing (harness blocked dotfile write)
tsc_errors: ~10 real (implicit any), ~70 module-resolution (resolve once node_modules installed)
astro_check_errors: 92 (split: ~40 from stale astro-output/, ~50 from real src/ — CV types, RichTextRenderer extras, BlogPost prop types)
ready_for_archive: false
```
