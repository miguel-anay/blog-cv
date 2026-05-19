# lambda-api — Verification Checklist

Manual acceptance scenarios to validate before marking the change as complete.

## Infrastructure

- [ ] `blog-api/.env.example` exists with all required vars documented
- [ ] `pnpm db:migrate` runs without errors against a fresh Turso DB
- [ ] All 11 tables exist after migration: `authors`, `categories`, `articles`, `article_categories`, `site_config`, `cv_personal`, `cv_proyectos`, `cv_experiencia`, `cv_educacion`, `cv_cursos`
- [ ] `pnpm seed` inserts fixtures without errors (idempotent — running twice doesn't fail)
- [ ] `pnpm build` produces `dist/` bundle without TypeScript errors

## API — Health

- [ ] `GET /health` returns `{ ok: true, ts: "..." }` with status 200

## API — Articles

- [ ] `GET /articles` returns `{ data: [...], meta: { page, pageSize, pageCount, total } }`
- [ ] `GET /articles?page=2&pageSize=5` paginates correctly
- [ ] `GET /articles?category=tech` filters by category slug
- [ ] `GET /articles/:slug` returns a single article with `author` and `categories` populated
- [ ] `GET /articles/nonexistent` returns 404 `{ error: { code: "NOT_FOUND", ... } }`
- [ ] `POST /articles` without Authorization returns 401
- [ ] `POST /articles` with wrong token returns 401
- [ ] `POST /articles` with valid token and valid body creates article (201)
- [ ] `POST /articles` with duplicate slug returns 409
- [ ] `POST /articles` with invalid body returns 422
- [ ] `PATCH /articles/:slug` with valid token updates article (200)
- [ ] `PATCH /articles/nonexistent` with valid token returns 404

## API — Categories

- [ ] `GET /categories` returns array ordered by name
- [ ] `GET /categories/counts` returns `{ todos: N, "slug-1": M, ... }`
- [ ] Counts only include published articles (publishedAt IS NOT NULL)

## API — CV

- [ ] `GET /cv` returns full CvData with `personal`, `proyectos`, `experiencia`, `educacion`, `cursos`
- [ ] Returns gracefully if tables are empty (no 500)

## API — Site Config

- [ ] `GET /config` returns SiteConfig object or null if not seeded
- [ ] `PATCH /config` without token returns 401
- [ ] `PATCH /config` with valid token updates and returns updated config

## API — Newsletter

- [ ] `POST /newsletter/subscribe` with valid email calls Resend and returns `{ ok: true }`
- [ ] `POST /newsletter/subscribe` with invalid email returns 422
- [ ] `POST /newsletter/subscribe` when `RESEND_AUDIENCE_ID` is missing returns 503

## API — Error handling

- [ ] All errors return `{ error: { code: "...", message: "..." } }` shape
- [ ] 500 errors log to CloudWatch but return generic message (not stack trace)
- [ ] Unknown routes return 404 with error shape

## CORS

- [ ] Requests from `PUBLIC_SITE_URL` succeed
- [ ] Requests from `http://localhost:4321` succeed in development
- [ ] Requests from unlisted origins are rejected (CORS header absent)

## Lambda

- [ ] Handler exports `handler` from `src/interfaces/lambda/handler.ts`
- [ ] Cold start initializes container and DB connection once
- [ ] `pnpm build` produces a single bundled file suitable for Lambda deployment

## Migration from Strapi

- [ ] `DRY_RUN=true pnpm migrate` prints summary table without writing
- [ ] `DRY_RUN=false pnpm migrate` inserts authors, categories, articles
- [ ] Running migration twice is idempotent (ON CONFLICT DO NOTHING)
- [ ] DynamicZone blocks transform correctly: rich-text, code, media, slider, quote

## Frontend

- [ ] `src/lib/strapi.ts` and `src/lib/strapi-types.ts` deleted
- [ ] `src/pages/index.astro` builds without errors, shows articles from API
- [ ] `src/pages/blog/index.astro` shows paginated articles with category counts from API
- [ ] `src/pages/blog/[...slug].astro` renders article body from API
- [ ] `src/pages/blog/category/[slug].astro` shows filtered articles
- [ ] `src/pages/blog/[page].astro` generates pages 2..N from API
- [ ] `src/pages/cv.astro` loads CV data from API (or shows fallback if empty)
- [ ] `astro.config.mjs` has no STRAPI_* references
- [ ] `astro build` completes without errors (with API running or mocked)
