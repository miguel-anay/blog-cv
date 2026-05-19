# Spec: lambda-api

**Change**: lambda-api
**Date**: 2026-05-16
**Status**: specified
**Artifact store**: hybrid

---

## Overview

This is a full spec for a greenfield backend (no prior `openspec/specs/` to delta against). Six capabilities are new: `blog-api`, `cv-api`, `site-config`, `newsletter-subscribe`, `media-storage`, and `frontend-api-client`.

All routes are prefixed `/api/v1` in external documentation; the Lambda app mounts them without prefix internally (Function URL is the root). The spec uses `/api/v1/` notation throughout for clarity.

---

## 1. Functional Requirements

### 1.1 Blog Domain

**RF-BLOG-1**: The endpoint `GET /api/v1/articles` MUST return only articles where `publishedAt IS NOT NULL`, ordered by `publishedAt` descending by default.

**RF-BLOG-2**: The endpoint `GET /api/v1/articles` MUST support query parameters `page` (integer ≥ 1, default 1), `pageSize` (integer 1–100, default 10), `categorySlug` (string, optional), and `sort` (enum `publishedAt:desc | publishedAt:asc | title:asc`, default `publishedAt:desc`).

**RF-BLOG-3**: The response of `GET /api/v1/articles` MUST include a `meta.pagination` object with `page`, `pageSize`, `pageCount`, and `total` fields computed from the filtered result set.

**RF-BLOG-4**: The endpoint `GET /api/v1/articles/:slug` MUST return the full `ArticleResponse` including `author` and `body: ArticleBlock[]`. If no article matches the slug, the endpoint MUST return 404.

**RF-BLOG-5**: The `body` field on every article response MUST be a single unified `ArticleBlock[]`. There MUST NOT be separate `blocks` and `body_bloq` fields.

**RF-BLOG-6**: The `readMin` field MUST be `Math.ceil(wordCount / 200)` where `wordCount` is the count of whitespace-separated tokens across all text nodes in `body`. The minimum value MUST be 1.

**RF-BLOG-7**: `readMin` MUST be computed at write time (on `POST /articles` or `PATCH /articles/:id`) and stored in the database. It MUST NOT be recomputed on every GET.

**RF-BLOG-8**: `POST /api/v1/articles` MUST require `Authorization: Bearer {API_KEY}` and MUST return 401 if the token is absent or incorrect.

**RF-BLOG-9**: `PATCH /api/v1/articles/:id` MUST require `Authorization: Bearer {API_KEY}` and MUST recalculate and persist `readMin` whenever `body` is included in the patch payload.

**RF-BLOG-10**: Article slugs MUST be unique. Attempting to create or update an article to a slug that already exists MUST return 409 Conflict.

**RF-BLOG-11**: `GET /api/v1/categories` MUST return all categories, ordered by `name` ascending.

**RF-BLOG-12**: `GET /api/v1/categories/:slug/articles` MUST return the same paginated shape as `GET /api/v1/articles` but filtered to articles in that category.

**RF-BLOG-13**: `GET /api/v1/authors/:id` MUST return the author with the given integer id, or 404 if not found.

### 1.2 CV Domain

**RF-CV-1**: `GET /api/v1/cv` MUST return a single `CvResponse` object assembling `personal`, `proyectos` (ordered by `orden` asc), `experiencia` (ordered by `orden` asc), and `educacion` (universities + specializations with embedded courses).

**RF-CV-2**: `CvExperienciaResponse.tecnologias` MUST be `string[]`, not a comma-separated string.

**RF-CV-3**: `PATCH /api/v1/cv/personal` MUST require `Authorization: Bearer {API_KEY}` and MUST update the singleton row (id=1).

**RF-CV-4**: `POST /api/v1/cv/proyectos` MUST require `Authorization: Bearer {API_KEY}` and MUST append a new project record.

**RF-CV-5**: `PATCH /api/v1/cv/proyectos/:id` MUST require `Authorization: Bearer {API_KEY}` and MUST return 404 if the project does not exist.

**RF-CV-6**: `POST /api/v1/cv/experiencia` MUST require `Authorization: Bearer {API_KEY}` and MUST append a new experience record.

**RF-CV-7**: `PATCH /api/v1/cv/experiencia/:id` MUST require `Authorization: Bearer {API_KEY}` and MUST return 404 if the experience record does not exist.

### 1.3 SiteConfig Domain

**RF-CFG-1**: `GET /api/v1/config` MUST return the singleton `SiteConfigResponse` (id=1). If no row exists, it MUST return 404.

**RF-CFG-2**: `PATCH /api/v1/config` MUST require `Authorization: Bearer {API_KEY}` and MUST upsert the singleton row.

**RF-CFG-3**: `SiteConfigResponse` MUST include: `siteTitle`, `siteDescription`, `aboutMarkdown`, `email`, `rol`, `linkedin`, and optionally `github`, `twitter`, `ogImage`.

**RF-CFG-4**: After `PATCH /api/v1/config`, `GET /api/v1/config` MUST reflect the updated values immediately.

### 1.4 Newsletter Domain

**RF-NL-1**: `POST /api/v1/newsletter/subscribe` MUST accept `{ "email": string }` in the request body.

**RF-NL-2**: The newsletter endpoint MUST delegate to Resend (external service) and MUST NOT store the email address in Turso.

**RF-NL-3**: If the email format is invalid, the endpoint MUST return 400 with `{ "error": { "code": "VALIDATION", "message": "..." } }`.

**RF-NL-4**: If Resend returns a non-2xx response, the endpoint MUST return 502 with `{ "error": { "code": "UPSTREAM_ERROR", "message": "..." } }`.

**RF-NL-5**: On success, the endpoint MUST return 200 with `{ "ok": true }`.

### 1.5 Health

**RF-HEALTH-1**: `GET /api/v1/health` MUST return 200 with `{ "ok": true, "db": "connected" }` when the Turso connection is reachable.

### 1.6 Frontend API Client

**RF-FE-1**: `src/lib/strapi.ts` MUST be removed (or replaced) by `src/lib/api.ts` with the required function signatures.

**RF-FE-2**: `src/lib/api-types.ts` MUST define `ArticleBlock`, `ArticleResponse`, `ArticleListResponse`, `Category`, `Author`, `SiteConfig`, and re-export or alias CV types from `cv-types.ts`.

**RF-FE-3**: The environment variable `BLOG_API_URL` MUST replace `STRAPI_URL`. `STRAPI_URL` and `STRAPI_API_TOKEN` MUST NOT be referenced in any source file after migration.

**RF-FE-4**: All Astro pages that currently import from `src/lib/strapi.ts` MUST be updated to import from `src/lib/api.ts`.

**RF-FE-5**: `src/pages/about.astro` MUST render `siteConfig.aboutMarkdown` from `GET /api/v1/config` and MUST NOT contain any hardcoded literal strings for about content.

**RF-FE-6**: `src/pages/cv.astro` MUST call `getCv()` and MUST NOT import from `src/data/cv-data.json`.

**RF-FE-7**: Real blog pagination MUST exist: `/blog/2`, `/blog/3`, etc. MUST be generated as static paths based on `meta.pagination.pageCount` returned by the API.

---

## 2. Non-Functional Requirements

**RNF-1 (Error format)**: All error responses MUST use the shape `{ "error": { "code": string, "message": string } }`. The `code` field MUST be one of `NOT_FOUND`, `UNAUTHORIZED`, `VALIDATION`, `UPSTREAM_ERROR`, or `INTERNAL`.

**RNF-2 (Auth)**: `POST` and `PATCH` write endpoints (except `POST /newsletter/subscribe`) MUST require `Authorization: Bearer {API_KEY}`. All `GET` endpoints and `POST /newsletter/subscribe` MUST be publicly accessible without auth.

**RNF-3 (CORS)**: The Lambda MUST respond to `OPTIONS` preflight requests and MUST include `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS` on all responses.

**RNF-4 (Response time)**: All GET endpoints MUST respond in under 2000 ms at warm-container (p95) for Astro build-time SSG calls.

**RNF-5 (Content-Type)**: All responses MUST use `Content-Type: application/json`.

**RNF-6 (Bundle size)**: The esbuild Lambda bundle MUST be under 2 MB to support cold starts under 1 second for build-time usage.

---

## 3. API Contracts

### GET /api/v1/health

```
Request: none
Response 200: { "ok": true, "db": "connected" }
```

---

### GET /api/v1/articles

```
Request:
  Query params:
    page:         integer, default 1, min 1
    pageSize:     integer, default 10, min 1, max 100
    categorySlug: string, optional
    sort:         enum [publishedAt:desc, publishedAt:asc, title:asc], default publishedAt:desc

Response 200:
  {
    data: ArticleResponse[],   // author NOT included in list (see RF-BLOG-4)
    meta: {
      pagination: {
        page: integer,
        pageSize: integer,
        pageCount: integer,    // ceil(total / pageSize)
        total: integer
      }
    }
  }

Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
```

---

### GET /api/v1/articles/:slug

```
Request: none
Response 200: ArticleResponse (includes author)
Response 404: { "error": { "code": "NOT_FOUND", "message": "Article not found" } }
```

---

### POST /api/v1/articles

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON):
    title:       string, required
    description: string, required
    slug:        string, required, must be unique
    body:        ArticleBlock[], required
    coverUrl:    string | null, optional
    authorId:    integer, optional
    categoryIds: integer[], optional
    publishedAt: string (ISO 8601) | null, optional

Response 201: ArticleResponse
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 409: { "error": { "code": "CONFLICT", "message": "Slug already exists" } }
```

---

### PATCH /api/v1/articles/:id

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): Partial of POST body (all fields optional)

Response 200: ArticleResponse
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 404: { "error": { "code": "NOT_FOUND", "message": "Article not found" } }
Response 409: { "error": { "code": "CONFLICT", "message": "Slug already exists" } }
```

---

### GET /api/v1/categories

```
Request: none
Response 200: CategoryResponse[]   // ordered by name asc
```

---

### GET /api/v1/categories/:slug/articles

```
Request:
  Query params: same as GET /articles (page, pageSize, sort)
Response 200: same shape as GET /articles (ArticleListResponse)
Response 404: { "error": { "code": "NOT_FOUND", "message": "Category not found" } }
```

---

### GET /api/v1/authors/:id

```
Request: none (id is path param, integer)
Response 200: AuthorResponse
Response 404: { "error": { "code": "NOT_FOUND", "message": "Author not found" } }
```

---

### GET /api/v1/cv

```
Request: none
Response 200: CvResponse
```

---

### PATCH /api/v1/cv/personal

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): Partial<CvPersonalResponse>

Response 200: CvPersonalResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
```

---

### POST /api/v1/cv/proyectos

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): CvProyectoInput (titulo, empresa, descripcion, url, imagen, tecnologias: CvTecnologia[], orden)

Response 201: CvProyectoResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
```

---

### PATCH /api/v1/cv/proyectos/:id

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): Partial<CvProyectoInput>

Response 200: CvProyectoResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 404: { "error": { "code": "NOT_FOUND", "message": "Project not found" } }
```

---

### POST /api/v1/cv/experiencia

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): CvExperienciaInput (periodo, cargo, empresa, certificado, logo, tecnologias: string[], proyectos: CvSubProyecto[], orden)

Response 201: CvExperienciaResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
```

---

### PATCH /api/v1/cv/experiencia/:id

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): Partial<CvExperienciaInput>

Response 200: CvExperienciaResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 404: { "error": { "code": "NOT_FOUND", "message": "Experience not found" } }
```

---

### GET /api/v1/config

```
Request: none
Response 200: SiteConfigResponse
Response 404: { "error": { "code": "NOT_FOUND", "message": "Config not initialized" } }
```

---

### PATCH /api/v1/config

```
Request:
  Headers: Authorization: Bearer {API_KEY}
  Body (JSON): Partial<SiteConfigResponse>

Response 200: SiteConfigResponse
Response 401: { "error": { "code": "UNAUTHORIZED", "message": "..." } }
Response 400: { "error": { "code": "VALIDATION", "message": "..." } }
```

---

### POST /api/v1/newsletter/subscribe

```
Request:
  Body (JSON): { "email": string }

Response 200: { "ok": true }
Response 400: { "error": { "code": "VALIDATION", "message": "Invalid email format" } }
Response 502: { "error": { "code": "UPSTREAM_ERROR", "message": "..." } }
```

---

## 4. Entity Response Shapes (DTOs)

```typescript
// Shared block types (unchanged from current strapi-types.StrapiBlock shape)
type ArticleTextNode = {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
};

type ArticleBlock =
  | { type: 'paragraph'; children: ArticleTextNode[] }
  | { type: 'heading'; level: 1|2|3|4|5|6; children: ArticleTextNode[] }
  | { type: 'list'; format: 'ordered'|'unordered'; children: { type:'list-item'; children: ArticleTextNode[] }[] }
  | { type: 'code'; language?: string; children: ArticleTextNode[] }
  | { type: 'quote'; children: ArticleTextNode[] }
  | { type: 'image'; image: { url: string; alternativeText?: string; caption?: string }; children: ArticleTextNode[] };

type AuthorResponse = {
  id: number;
  name: string;
  avatarUrl: string | null;
  email?: string;            // omitted from list endpoints
};

type CategoryResponse = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

type ArticleResponse = {
  id: number;
  title: string;
  description: string;
  slug: string;
  body: ArticleBlock[];      // single unified field — no body_bloq or blocks
  coverUrl: string | null;
  coverAlt: string | null;
  readMin: number;           // integer, min 1
  publishedAt: string | null; // ISO 8601; null means draft (never returned by GET /articles)
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  author: AuthorResponse | null;   // present only in GET /articles/:slug
  categories: CategoryResponse[];
};

// ArticleListResponse wraps ArticleResponse without author
type ArticleListResponse = {
  data: Omit<ArticleResponse, 'author'>[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
};

type CvTecnologia = {
  nombre: string;
  icono: string;
  clases: string;
};

type CvSubProyecto = {
  nombre: string;
  descripcion: string;
};

type CvPersonalResponse = {
  nombre: string;
  sitio: string;
  descripcion: string;
  empresasDestacadas: [string, string];
  tecnologiasDestacadas: string;
  linkedin: string;
  anio: string;
};

type CvProyectoResponse = {
  id: number;
  orden: number;
  titulo: string;
  empresa: string;
  descripcion: string;
  url: string;
  imagen: string;
  tecnologias: CvTecnologia[];
};

type CvExperienciaResponse = {
  id: number;
  orden: number;
  periodo: string;
  cargo: string;
  empresa: string;
  certificado: string | null;
  logo: string;
  tecnologias: string[];     // MUST be string[], not CSV string
  proyectos: CvSubProyecto[];
};

type CvEducacionResponse = {
  universidades: { nombre: string; titulo: string }[];
  especializaciones: {
    categoria: string;
    cursos: {
      nombre: string;
      institucion: string;
      fecha: string;
      certificado: string | null;
      externo?: boolean;
    }[];
  }[];
};

type CvResponse = {
  personal: CvPersonalResponse;
  proyectos: CvProyectoResponse[];
  experiencia: CvExperienciaResponse[];
  educacion: CvEducacionResponse;
};

type SiteConfigResponse = {
  siteTitle: string;
  siteDescription: string;
  aboutMarkdown: string;
  email: string;
  rol: string;
  linkedin: string;
  github?: string;
  twitter?: string;
  ogImage?: string;
};
```

---

## 5. Business Rules

| # | Rule |
|---|------|
| BR-1 | Draft articles (`publishedAt IS NULL`) MUST NOT appear in `GET /articles` or `GET /categories/:slug/articles` responses. |
| BR-2 | `readMin` MUST equal `Math.ceil(wordCount / 200)`, minimum 1. Zero-word body → readMin = 1. |
| BR-3 | `Article.slug` MUST be unique across the articles table. |
| BR-4 | `Category.slug` MUST be unique across the categories table. |
| BR-5 | Newsletter emails MUST NOT be stored in Turso or any database. The endpoint is a proxy to Resend only. |
| BR-6 | `SiteConfig` is a singleton: there MUST be exactly one row with `id = 1`. `PATCH /config` MUST upsert, not insert. |
| BR-7 | Write endpoints (`POST`, `PATCH`) except `POST /newsletter/subscribe` MUST require `Authorization: Bearer {API_KEY}`. |
| BR-8 | `CvExperiencia.tecnologias` MUST be stored and returned as `string[]`, not a comma-separated string. |
| BR-9 | `readMin` MUST be recomputed and persisted whenever `PATCH /articles/:id` includes `body` in the payload. |

---

## 6. Acceptance Scenarios

### 6.1 Blog — Articles

#### Scenario: Paginated article list returns correct metadata
- GIVEN the database has 25 published articles and 0 drafts
- WHEN `GET /api/v1/articles?page=2&pageSize=10` is called
- THEN the response status is 200
- AND `data` contains 10 articles
- AND `meta.pagination.page` equals 2
- AND `meta.pagination.pageSize` equals 10
- AND `meta.pagination.pageCount` equals 3
- AND `meta.pagination.total` equals 25

#### Scenario: Draft articles are excluded from the list
- GIVEN the database has 5 published articles and 3 draft articles (publishedAt IS NULL)
- WHEN `GET /api/v1/articles` is called
- THEN the response status is 200
- AND `meta.pagination.total` equals 5
- AND no article in `data` has `publishedAt: null`

#### Scenario: Filter by category
- GIVEN the database has 10 published articles, 4 tagged with category slug `typescript`
- WHEN `GET /api/v1/articles?categorySlug=typescript` is called
- THEN the response status is 200
- AND `meta.pagination.total` equals 4

#### Scenario: Article by slug returns unified body
- GIVEN an article with slug `mi-articulo` and `body: [{ type: "paragraph", children: [...] }]`
- WHEN `GET /api/v1/articles/mi-articulo` is called
- THEN the response status is 200
- AND `body` is an array of `ArticleBlock` objects
- AND there are NO `blocks` or `body_bloq` fields in the response
- AND `author` is present in the response

#### Scenario: Unknown slug returns 404
- GIVEN no article exists with slug `does-not-exist`
- WHEN `GET /api/v1/articles/does-not-exist` is called
- THEN the response status is 404
- AND `error.code` equals `NOT_FOUND`

#### Scenario: readMin calculated correctly at write time
- GIVEN a POST request with `body` containing blocks totalling 450 text words
- WHEN `POST /api/v1/articles` is called with valid `Authorization: Bearer {API_KEY}`
- THEN the response status is 201
- AND `readMin` equals 3 (ceil(450/200) = 3)

#### Scenario: readMin minimum is 1 for empty body
- GIVEN a POST request with `body: []`
- WHEN `POST /api/v1/articles` is called with valid auth
- THEN the response status is 201
- AND `readMin` equals 1

#### Scenario: Write endpoint rejects missing auth
- GIVEN no `Authorization` header is present
- WHEN `POST /api/v1/articles` is called
- THEN the response status is 401
- AND `error.code` equals `UNAUTHORIZED`

#### Scenario: Duplicate slug rejected
- GIVEN an article with slug `existing-slug` already exists
- WHEN `POST /api/v1/articles` is called with `slug: "existing-slug"`
- THEN the response status is 409
- AND `error.code` equals `CONFLICT`

### 6.2 CV

#### Scenario: GET /cv returns tecnologias as string array
- GIVEN an experience record has `tecnologias: ["TypeScript", "React", "AWS"]` in the database
- WHEN `GET /api/v1/cv` is called
- THEN the response status is 200
- AND `experiencia[0].tecnologias` is an array of strings, NOT a comma-separated string

#### Scenario: GET /cv assembles all sections
- GIVEN the database has cv_personal, 2 cv_proyectos, 1 cv_experiencia, 1 cv_educacion
- WHEN `GET /api/v1/cv` is called
- THEN the response status is 200
- AND the response contains `personal`, `proyectos`, `experiencia`, and `educacion` fields

#### Scenario: PATCH cv/personal requires auth
- GIVEN no `Authorization` header is present
- WHEN `PATCH /api/v1/cv/personal` is called
- THEN the response status is 401

### 6.3 SiteConfig

#### Scenario: GET /config returns singleton
- GIVEN the database has a `site_config` row with id=1 and `siteTitle: "Miguel Anay"`
- WHEN `GET /api/v1/config` is called
- THEN the response status is 200
- AND `siteTitle` equals `"Miguel Anay"`

#### Scenario: PATCH /config updates and is immediately readable
- GIVEN `Authorization: Bearer {API_KEY}` is provided
- WHEN `PATCH /api/v1/config` is called with `{ "rol": "Software Architect" }`
- THEN the response status is 200
- AND a subsequent `GET /api/v1/config` returns `rol: "Software Architect"`

#### Scenario: GET /config returns 404 when uninitialized
- GIVEN the `site_config` table is empty
- WHEN `GET /api/v1/config` is called
- THEN the response status is 404

### 6.4 Newsletter

#### Scenario: Valid subscription succeeds
- GIVEN Resend API is reachable and the audience is configured
- WHEN `POST /api/v1/newsletter/subscribe` is called with `{ "email": "user@example.com" }`
- THEN the response status is 200
- AND the response body is `{ "ok": true }`
- AND no record is written to Turso

#### Scenario: Invalid email format rejected
- GIVEN a request with `{ "email": "not-an-email" }`
- WHEN `POST /api/v1/newsletter/subscribe` is called
- THEN the response status is 400
- AND `error.code` equals `VALIDATION`

#### Scenario: Resend upstream failure returns 502
- GIVEN Resend API returns a 500 response
- WHEN `POST /api/v1/newsletter/subscribe` is called with a valid email
- THEN the response status is 502
- AND `error.code` equals `UPSTREAM_ERROR`

### 6.5 Health

#### Scenario: Health check passes when DB is connected
- GIVEN the Lambda is running and Turso is reachable
- WHEN `GET /api/v1/health` is called
- THEN the response status is 200
- AND the response is `{ "ok": true, "db": "connected" }`

### 6.6 Frontend Migration

#### Scenario: About page has no hardcoded literals
- GIVEN `GET /api/v1/config` returns `aboutMarkdown: "## About me\n..."`
- WHEN `about.astro` renders
- THEN the rendered HTML contains content from `aboutMarkdown`
- AND there are no hardcoded about-content strings in the `.astro` source

#### Scenario: CV page reads from API, not local JSON
- GIVEN `src/data/cv-data.json` has been deleted
- WHEN `cv.astro` renders during `astro build`
- THEN the build succeeds and CV content is populated from `GET /api/v1/cv`

#### Scenario: Real blog pagination is generated
- GIVEN `GET /api/v1/articles?page=1&pageSize=10` returns `meta.pagination.pageCount = 4`
- WHEN `astro build` runs
- THEN static pages for `/blog/1`, `/blog/2`, `/blog/3`, and `/blog/4` are generated

---

## 7. Frontend Migration Contracts

### 7.1 Environment Variables

| Old (Strapi) | New (lambda-api) |
|---|---|
| `STRAPI_URL` | `BLOG_API_URL` |
| `STRAPI_API_TOKEN` | `BLOG_API_KEY` |

`STRAPI_URL` and `STRAPI_API_TOKEN` MUST NOT appear in any source file or GitHub Secret after cutover.

### 7.2 Required Functions in `src/lib/api.ts`

```typescript
export async function getArticles(opts?: {
  page?: number;
  pageSize?: number;
  category?: string;
  sort?: 'publishedAt:desc' | 'publishedAt:asc' | 'title:asc';
}): Promise<ArticleListResponse>;

export async function getArticleBySlug(slug: string): Promise<ArticleResponse | null>;

export async function getCategories(): Promise<CategoryResponse[]>;

export async function getCategoryCounts(): Promise<Record<string, number>>;

export async function getCv(): Promise<CvResponse>;

export async function getSiteConfig(): Promise<SiteConfigResponse>;

export async function subscribeNewsletter(
  email: string
): Promise<{ ok: boolean; message?: string }>;

export function getMediaUrl(url: string | undefined): string | undefined;
```

### 7.3 Required Types in `src/lib/api-types.ts`

The file MUST export or re-export: `ArticleBlock`, `ArticleTextNode`, `ArticleResponse`, `ArticleListResponse`, `AuthorResponse`, `CategoryResponse`, `SiteConfigResponse`, `Pagination`.

CV types (`CvResponse`, `CvPersonalResponse`, `CvProyectoResponse`, `CvExperienciaResponse`, `CvTecnologia`, `CvSubProyecto`, `CvEducacionResponse`) MUST be exported from `src/lib/cv-types.ts` (unchanged shape, except `CvExperiencia.tecnologias: string[]`).

---

## 8. Out-of-Scope (Explicit Exclusions)

- Admin Panel UI
- Full-text search (FTS5)
- SSR mode for the Astro frontend
- User authentication, comments, analytics, i18n
- Programmatic media upload endpoints (`POST /media`)
- Soft-delete / restore for articles
- Rate limiting on public GET endpoints
