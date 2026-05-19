# lambda-api — Apply Progress

## Completed Tasks

### Backend (blog-api)

- [x] T-01 blog-api/package.json, tsconfig.json (pre-existing)
- [x] T-02 blog-api/esbuild.config.mjs (pre-existing)
- [x] T-03 blog-api/drizzle.config.ts (pre-existing)
- [ ] T-04 blog-api/.env.example — BLOCKED: dotfile write permission denied by harness settings
- [x] T-05 domain/shared/slug.ts, errors.ts (pre-existing)
- [x] T-06 domain/article/types.ts, read-min.ts (pre-existing)
- [x] T-07 domain/article/article-repository.ts, category-repository.ts (pre-existing)
- [x] T-08 domain/cv/types.ts, cv-repository.ts (pre-existing)
- [x] T-09 domain/site-config/types.ts, site-config-repository.ts (pre-existing)
- [x] T-10 domain/newsletter/newsletter-service.ts
- [x] T-11 infrastructure/db/schema.ts (all 11 tables with drizzle-orm/sqlite-core)
- [x] T-12 infrastructure/db/client.ts (singleton pattern with libsql)
- [x] T-13 infrastructure/db/migrations/0001_initial.sql (all 11 tables in FK order)
- [x] T-14 infrastructure/article/mappers.ts + drizzle-article-repository.ts
- [x] T-15 infrastructure/category/drizzle-category-repository.ts
- [x] T-16 infrastructure/cv/assemble-cv-data.ts + drizzle-cv-repository.ts
- [x] T-17 infrastructure/site-config/drizzle-site-config-repository.ts
- [x] T-18 infrastructure/newsletter/resend-newsletter.ts
- [x] T-19 infrastructure/container.ts
- [x] T-20 application/article/dto.ts (Zod schemas + types)
- [x] T-21 application/article/{get-articles,get-article-by-slug,create-article,update-article}.ts
- [x] T-22 application/category/{get-categories,get-category-counts}.ts
- [x] T-23 application/cv/get-cv.ts
- [x] T-24 application/site-config/{get-site-config,update-site-config}.ts
- [x] T-25 application/newsletter/subscribe-newsletter.ts
- [x] T-26 interfaces/http/middleware/auth.ts (timing-safe token check)
- [x] T-27 interfaces/http/middleware/error.ts (domain error → HTTP status mapping)
- [x] T-28 (not listed in tasks — skipped)
- [x] T-29 interfaces/http/routes/articles.ts (4 routes)
- [x] T-30 interfaces/http/routes/categories.ts (counts before /:id)
- [x] T-31 interfaces/http/routes/cv.ts
- [x] T-32 interfaces/http/routes/config.ts (PATCH protected)
- [x] T-33 interfaces/http/routes/newsletter.ts
- [x] T-34 interfaces/http/app.ts (Hono app factory with CORS + bodyLimit + logger)
- [x] T-35 (not listed in tasks — skipped)
- [x] T-36 interfaces/lambda/handler.ts
- [x] T-37 scripts/migrate-from-strapi.ts (full migration with DRY_RUN support)
- [x] T-38 scripts/seed-dev.ts (minimal dev fixtures, idempotent)
- [x] T-39 src/lib/api-types.ts (pre-existing)
- [x] T-40 src/lib/api.ts (pre-existing)

### Frontend (src/)

- [x] T-41 DELETE strapi.ts and strapi-types.ts ✅
- [x] T-42 src/pages/index.astro — already using api.ts, no change needed
- [x] T-43 src/pages/blog/index.astro — replaced strapi imports with api.ts, getCategoryCounts(), real pagination meta
- [x] T-44 src/pages/blog/[...slug].astro — replaced strapi imports with api.ts
- [x] T-45 src/pages/blog/category/[slug].astro — replaced strapi imports with api.ts, uses getArticles({ category })
- [x] T-46 NEW src/pages/blog/[page].astro — pagination from meta.pageCount
- [x] T-47 src/pages/cv.astro — replaced JSON import with getCv(); about.astro is fully static (no change)
- [x] T-48 astro.config.mjs — no STRAPI_* references found, clean
- [x] T-49 blog-api/README.md
- [x] T-50 openspec/changes/lambda-api/verification.md

## Deviations

1. **T-04 (.env.example)**: Write tool cannot create dotfiles in blog-api/ (permission denied by harness settings). Deviation: file not created. Workaround: run `cp blog-api/.env.example .env` won't work — user must manually create `.env` from the env var table in README.md.

2. **T-28 and T-35**: Not present in the task list — skipped.

3. **T-47 cv.astro**: The old cv.astro used a JSON file import with the legacy `cv-types.ts` shape (nested `educacion.universidades` + `educacion.especializaciones`). The new domain `CvData` has flat `educacion: CvEducacion[]` and `cursos: CvCurso[]`. The template was adapted to the new flat shape with cursos grouped by `categoria` for display.

4. **T-44 [...slug].astro**: Removed `getStrapiMedia()` import (deleted with strapi.ts). `coverUrl` is now a full URL from the API, so no transformation needed.

5. **drizzle-article-repository.ts findAll with categorySlug**: Due to drizzle-orm/libsql query API constraints, the category-filtered path makes a secondary query to get filtered article IDs, then a final paginated query. This is slightly less optimal than a single query but correct and readable.
