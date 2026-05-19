# Proposal: lambda-api

**Change**: lambda-api
**Status**: proposed
**Date**: 2026-05-16
**Author**: Miguel Anay
**Artifact store**: hybrid

---

## Intent

Reemplazar Strapi v5 por un backend propio TypeScript desplegado como **una sola AWS Lambda** (Hono + @hono/aws-lambda), con Turso/libSQL + Drizzle ORM, S3 para media y Clean Architecture interna. Strapi es sobre-engineered para un blog personal (>200 MB en node_modules, Admin Panel poco usado, pricing escalable de Strapi Cloud). El nuevo backend cuesta efectivamente cero en free tier, da control total del schema/API, y permite cerrar 6 gaps reales del codebase (body dual, tecnologías CSV, About hardcodeado, paginación rota, readMin fijo, newsletter sin handler).

## Scope

### In Scope
- Repo/directorio `blog-api/` con backend Hono + Lambda + Clean Architecture 4 capas
- Schema Drizzle: Article, Category, Author, ArticleCategory, CvPersonal, CvProyectos, CvExperiencia, CvCursos, SiteConfig
- Endpoints GET completos + POST/PATCH con `Authorization: Bearer` para escritura
- Script de migración Strapi → Turso (con dry-run)
- Frontend: reemplazar `src/lib/strapi.ts` por `src/lib/api.ts`; CV deja JSON local; About/Global desde `/config`
- Paginación real del blog (`/blog/[page]`), `readMin` calculado en use-case
- `POST /newsletter/subscribe` delegando a Resend o Buttondown (no almacena emails)

### Out of Scope
- Admin Panel UI (Drizzle Studio CLI como sustituto temporal)
- Búsqueda fulltext (FTS5, iteración futura)
- SSR del frontend (sigue SSG)
- Auth de usuarios, comentarios, analytics, i18n

## Capabilities

### New Capabilities
- `blog-api`: backend Lambda + Turso para artículos, categorías, autores
- `cv-api`: endpoints `/cv` que sustituyen el JSON local
- `site-config`: singleton `/config` que reemplaza About/Global hardcodeados
- `newsletter-subscribe`: proxy a servicio externo de email
- `media-storage`: S3 bucket para cover images y media del CV
- `frontend-api-client`: nuevo `src/lib/api.ts` consumido por las páginas Astro

### Modified Capabilities
None (no existen specs previos en `openspec/specs/` que cambien a nivel de requisitos — es greenfield).

## Approach

1. **Backend nuevo**: monorepo con `callous-cluster/` (frontend Astro existente) + `blog-api/` (backend Hono). Estructura Clean Architecture: `domain/` (entidades + repos interfaces), `application/` (use cases + DTOs), `infrastructure/` (Drizzle repos + S3), `interfaces/http/` (Hono routes/middleware) + `interfaces/lambda/handler.ts`.
2. **DB**: Turso con dos branches (`blog-prod`, `blog-dev`). Drizzle migrations versionadas en `infrastructure/db/migrations/`.
3. **Body de artículos**: JSON serializado (`ArticleBlock[]`) en columna TEXT — el tipo ya existe en `strapi-types.ts`, el renderer Astro está parcialmente hecho.
4. **Deployment**: Lambda Function URL (sin API Gateway), Node.js 22.x, 512 MB, timeout 10s. Build con esbuild bundle.
5. **Migración**: script único que lee Strapi REST, flatten del DynamicZone `blocks[].__component === 'shared.rich-text'` → `ArticleBlock[]`, recalcula `readMin = Math.ceil(words / 200)`, escribe a Turso. Dry-run con conteo antes del commit real.
6. **Cutover**: feature flag `BLOG_API_URL` en `.env`. Una vez migrado, deprecar `STRAPI_URL`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `blog-api/` (nuevo) | New | Backend Hono + Lambda + Drizzle |
| `src/lib/strapi.ts` | Removed | Reemplazado por `src/lib/api.ts` |
| `src/lib/strapi-types.ts` | Modified | Renombrado a `src/lib/api-types.ts` |
| `src/pages/index.astro` | Modified | `getInicio` → `getArticles` + `getConfig` |
| `src/pages/blog/index.astro` | Modified | Paginación real |
| `src/pages/blog/[...slug].astro` | Modified | Nueva fuente de datos |
| `src/pages/blog/category/[slug].astro` | Modified | Nueva fuente de datos |
| `src/pages/cv.astro` | Modified | JSON local → `GET /cv` |
| `src/pages/about.astro` | Modified | Hardcoded → `GET /config` |
| `src/layouts/BlogPost.astro` | Modified | `author`/`readMin` desde API |
| `src/data/cv-data.json` | Removed | Migrado a Turso |
| `.env` / GitHub Secrets | Modified | `STRAPI_*` → `BLOG_API_URL`, `BLOG_API_KEY` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Script de migración pierde formato del DynamicZone (SharedRichText body_bloq) | Medium | Dry-run obligatorio con conteo de blocks por artículo; validación visual de 3 artículos antes del cutover; mantener Strapi corriendo en paralelo hasta verificar |
| Cold start de Lambda + Turso degrada experiencia | Low | Llamadas son build-time (SSG), no runtime de usuario; bundle target <2 MB con esbuild; medir en staging antes de archivar |
| Sin Admin Panel — edición de contenido se vuelve fricción | Medium | Drizzle Studio CLI para dev; endpoints PATCH/POST con `Bearer API_KEY` para edición vía REST; tracking explícito como future work |

## Rollback Plan

1. Mantener Strapi corriendo en paralelo durante 2 builds completos del frontend post-cutover.
2. Si falla algo crítico: revertir `BLOG_API_URL` → `STRAPI_URL` en GitHub Secrets, re-deploy Astro. Frontend vuelve a Strapi inmediatamente.
3. Turso DB queda como artifact de respaldo (no se destruye hasta archivado del cambio).
4. El repo del backend sigue versionado en git para retomar si se decide volver.

## Dependencies

- Cuenta Turso creada + DB `blog-prod` + DB `blog-dev` + auth tokens
- Cuenta AWS con permisos para Lambda + S3 + IAM (ya existente para frontend)
- Cuenta en Resend o Buttondown para newsletter (decisión final en `sdd-design`)
- Node.js 22.x en CI/CD para build del bundle Lambda
- GitHub Secrets: `TURSO_URL`, `TURSO_AUTH_TOKEN`, `BLOG_API_KEY`, `S3_BUCKET`, `S3_REGION`

## Success Criteria

- [ ] Lambda desplegada con Function URL respondiendo `GET /health` con 200 OK y `db: "connected"`
- [ ] `GET /articles?page=1&pageSize=10` devuelve todos los artículos migrados desde Strapi con `meta.pagination` correcto
- [ ] `GET /articles/:slug` devuelve `body: ArticleBlock[]` renderizable sin pérdida vs Strapi original (validado en 3 artículos)
- [ ] `GET /cv` devuelve datos equivalentes al JSON local actual; `cv.astro` renderiza sin cambios visuales
- [ ] `GET /config` devuelve SiteConfig; `about.astro` renderiza sin literales hardcodeados
- [ ] `POST /newsletter/subscribe` con email válido devuelve 200; el suscriptor aparece en Resend/Buttondown
- [ ] Frontend Astro builds exitosamente contra `BLOG_API_URL` sin referencias residuales a `STRAPI_URL`
- [ ] `readMin` en todos los artículos coincide con `Math.ceil(wordCount / 200)`
- [ ] Paginación real funciona: `/blog/2`, `/blog/3` existen y muestran página correspondiente
- [ ] Costo mensual estimado AWS + Turso < $1 para uso típico
