# Design: lambda-api

**Change**: lambda-api
**Date**: 2026-05-16
**Status**: designed
**Artifact store**: hybrid

---

## 1. Arquitectura general

### Flujo de datos

```
                       BUILD TIME (CI / local)
  ┌─────────────────┐    fetch (HTTPS)    ┌──────────────────────┐
  │  Astro (SSG)    │ ──────────────────► │ Lambda Function URL  │
  │  src/lib/api.ts │ ◄────────────────── │  (Hono app)          │
  └─────────────────┘    JSON responses   └──────────┬───────────┘
                                                     │ libSQL HTTP
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Turso (libSQL)      │
                                          │  Drizzle ORM         │
                                          └──────────────────────┘
                                                     │
                                                     │ S3 SDK (signed URLs solo en write)
                                                     ▼
                                          ┌──────────────────────┐
                                          │  S3 (media público)  │
                                          └──────────────────────┘
```

- **Reads**: Astro durante `astro build` consume `GET /articles`, `/categories`, `/cv`, `/config`. SSG-only.
- **Writes**: `POST /newsletter/subscribe` en runtime del frontend (Astro endpoint o fetch directo). Admin writes (`POST/PATCH`) vía curl/Postman con `Authorization: Bearer`.
- **Media**: URLs absolutas a S3 público (`https://{bucket}.s3.{region}.amazonaws.com/...`); no se proxy-pasa por Lambda.

### Inicialización Hono en Lambda

`src/interfaces/lambda/handler.ts` es el entry point del bundle esbuild. Pattern:

```ts
// Module-scope: ejecutado UNA vez por warm container
import { handle } from '@hono/aws-lambda';
import { createApp } from '../http/app';
import { createContainer } from '../../infrastructure/container';

const container = createContainer(); // crea Turso client singleton + repos
const app = createApp(container);

export const handler = handle(app);
```

- **Cold start** (~400-700 ms): bundle parse + `createClient({ url, authToken })` + Drizzle wrap.
- **Warm** (~10-30 ms): reusa `container` y conexión HTTP keep-alive a Turso.
- **No IoC container**: DI manual. `createContainer()` retorna `{ articleRepo, cvRepo, configRepo, newsletter }`. Cada handler recibe lo que necesita por closure.

### Inyección de dependencias entre capas

```
domain (interfaces puras)
   ▲
   │ implements
infrastructure (DrizzleArticleRepository, ResendNewsletter)
   ▲
   │ injected into
application (use cases: GetArticlesUseCase recibe IArticleRepository en constructor)
   ▲
   │ wired in
interfaces/http (handler invoca useCase.execute(input))
```

`createContainer()` es la composition root — único lugar donde domain conoce a infrastructure.

---

## 2. Schema Drizzle completo

Archivo: `blog-api/src/infrastructure/db/schema.ts`

```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import type { ArticleBlock } from '../../domain/article/types';

// ── Blog ────────────────────────────────────────────────────────────────
export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  body: text('body', { mode: 'json' }).$type<ArticleBlock[]>().notNull(),
  coverUrl: text('cover_url'),
  coverAlt: text('cover_alt'),
  authorId: integer('author_id').references(() => authors.id),
  readMin: integer('read_min').notNull(),
  publishedAt: text('published_at').notNull(), // ISO 8601
  createdAt: text('created_at').notNull().default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').notNull().default('CURRENT_TIMESTAMP'),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
});

export const authors = sqliteTable('authors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email'),
  avatarUrl: text('avatar_url'),
});

export const articleCategories = sqliteTable(
  'article_categories',
  {
    articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.articleId, t.categoryId] }) })
);

// ── CV ──────────────────────────────────────────────────────────────────
// Singleton: SIEMPRE id=1.
export const cvPersonal = sqliteTable('cv_personal', {
  id: integer('id').primaryKey(),
  nombre: text('nombre').notNull(),
  sitio: text('sitio').notNull(),
  descripcion: text('descripcion').notNull(),
  empresasDestacadas: text('empresas_destacadas', { mode: 'json' }).$type<[string, string]>().notNull(),
  tecnologiasDestacadas: text('tecnologias_destacadas').notNull(), // CSV display string
  linkedin: text('linkedin').notNull(),
  anio: text('anio').notNull(),
});

export const cvProyectos = sqliteTable('cv_proyectos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull(),
  titulo: text('titulo').notNull(),
  empresa: text('empresa').notNull(),
  descripcion: text('descripcion').notNull(),
  url: text('url').notNull(),
  imagen: text('imagen').notNull(),
  tecnologias: text('tecnologias', { mode: 'json' }).$type<CvTecnologia[]>().notNull(),
});
// CvTecnologia = { nombre: string; icono: string; clases: string }

export const cvExperiencia = sqliteTable('cv_experiencia', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull(),
  periodo: text('periodo').notNull(),
  cargo: text('cargo').notNull(),
  empresa: text('empresa').notNull(),
  certificado: text('certificado'),
  logo: text('logo').notNull(),
  tecnologias: text('tecnologias', { mode: 'json' }).$type<string[]>().notNull(), // NORMALIZADO
  proyectos: text('proyectos', { mode: 'json' }).$type<CvSubProyecto[]>().notNull(),
});

export const cvEducacion = sqliteTable('cv_educacion', {
  id: integer('id').primaryKey(),
  universidades: text('universidades', { mode: 'json' }).$type<CvUniversidad[]>().notNull(),
  especializaciones: text('especializaciones', { mode: 'json' }).$type<CvEspecializacion[]>().notNull(),
});

export const cvCursos = sqliteTable('cv_cursos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull(),
  categoria: text('categoria').notNull(),
  nombre: text('nombre').notNull(),
  institucion: text('institucion').notNull(),
  fecha: text('fecha').notNull(),
  certificado: text('certificado'),
  externo: integer('externo', { mode: 'boolean' }).notNull().default(false),
});

// ── Site config (singleton) ─────────────────────────────────────────────
export const siteConfig = sqliteTable('site_config', {
  id: integer('id').primaryKey(), // siempre 1
  siteTitle: text('site_title').notNull(),
  siteDescription: text('site_description').notNull(),
  aboutMarkdown: text('about_markdown').notNull(),
  email: text('email').notNull(),
  rol: text('rol').notNull(),
  linkedin: text('linkedin').notNull(),
  github: text('github'),
  twitter: text('twitter'),
  ogImage: text('og_image'),
});
```

**Decisiones JSON**: usamos `mode: 'json'` con `$type<T>()` — Drizzle serializa/deserializa automáticamente y el tipo viaja al dominio sin parsing manual.

**Decisión clave**: `cvExperiencia.tecnologias` pasa de `string` CSV (Strapi) a `string[]` JSON. Normalización en script de migración (split por `,` + trim).

---

## 3. Capa Domain

`blog-api/src/domain/`

### Entidades (tipos puros)

```ts
// domain/article/types.ts
export type ArticleBlock =
  | SharedRichText | SharedCode | SharedMedia | SharedSlider | SharedQuote;

export type Article = {
  id: number;
  slug: Slug;          // value object
  title: string;
  description: string;
  body: ArticleBlock[];
  coverUrl?: string;
  coverAlt?: string;
  author?: Author;
  categories: Category[];
  readMin: ReadMin;    // value object
  publishedAt: Date;
};
// Author, Category similares (POJOs).

// domain/cv/types.ts — reusa shapes de src/lib/cv-types.ts del frontend
// domain/site-config/types.ts — SiteConfig POJO
```

### Value Objects

```ts
// domain/shared/slug.ts
export class Slug {
  private constructor(public readonly value: string) {}
  static fromString(raw: string): Slug {
    const v = raw.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
    if (!v) throw new Error('Invalid slug');
    return new Slug(v);
  }
}

// domain/article/read-min.ts
export class ReadMin {
  private constructor(public readonly minutes: number) {}
  static fromBlocks(blocks: ArticleBlock[]): ReadMin {
    const text = extractTextFromBlocks(blocks);   // concatena todos los nodos text
    const words = text.split(/\s+/).filter(Boolean).length;
    return new ReadMin(Math.max(1, Math.ceil(words / 200)));
  }
}
```

### Interfaces de repositorio

```ts
// domain/article/article-repository.ts
export interface IArticleRepository {
  findAll(params: { page: number; pageSize: number; categorySlug?: string }): Promise<{ items: Article[]; total: number }>;
  findBySlug(slug: string): Promise<Article | null>;
  create(input: NewArticle): Promise<Article>;
  update(slug: string, patch: Partial<NewArticle>): Promise<Article>;
}

// domain/article/category-repository.ts
export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findBySlug(slug: string): Promise<Category | null>;
  countByCategory(): Promise<Record<string, number>>; // slug → count
}

// domain/cv/cv-repository.ts
export interface ICvRepository {
  getFullCv(): Promise<CvData>; // assembles personal + proyectos + experiencia + educacion + cursos
}

// domain/site-config/site-config-repository.ts
export interface ISiteConfigRepository {
  get(): Promise<SiteConfig>;
  update(patch: Partial<SiteConfig>): Promise<SiteConfig>;
}

// domain/newsletter/newsletter-service.ts
export interface INewsletterService {
  subscribe(email: string): Promise<{ ok: true } | { ok: false; reason: string }>;
}
```

---

## 4. Capa Application

`blog-api/src/application/`

### Use cases (entrada → salida)

| Use case | Input | Output |
|----------|-------|--------|
| `GetArticlesUseCase` | `{ page, pageSize, categorySlug? }` | `{ items: ArticleDto[]; meta: { page, pageSize, pageCount, total } }` |
| `GetArticleBySlugUseCase` | `{ slug }` | `ArticleDto \| null` |
| `CreateArticleUseCase` | `CreateArticleInput` | `ArticleDto` |
| `UpdateArticleUseCase` | `{ slug, patch }` | `ArticleDto` |
| `GetCategoriesUseCase` | `void` | `CategoryDto[]` |
| `GetCategoryCountsUseCase` | `void` | `Record<slug, number>` |
| `GetCvUseCase` | `void` | `CvDto` |
| `GetSiteConfigUseCase` | `void` | `SiteConfigDto` |
| `UpdateSiteConfigUseCase` | `Partial<SiteConfig>` | `SiteConfigDto` |
| `SubscribeNewsletterUseCase` | `{ email }` | `{ ok: boolean; message?: string }` |

### DTO shape (ejemplo)

```ts
// application/article/dto.ts
export type ArticleDto = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: ArticleBlock[];
  cover?: { url: string; alt?: string };
  author?: { name: string; avatarUrl?: string };
  categories: { slug: string; name: string }[];
  readMin: number;
  publishedAt: string; // ISO
};

export type ArticlesListDto = {
  data: ArticleDto[];
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } };
};
```

### Cálculo de readMin

**Dónde**: dentro del use case `CreateArticleUseCase` y `UpdateArticleUseCase` (NO en el handler HTTP, NO en infraestructura). Cuando llega un input con `body: ArticleBlock[]`, el use case llama `ReadMin.fromBlocks(body)` y persiste `readMin.minutes`. En `GetArticles*` el valor ya está en DB — no se recalcula en cada GET.

**Por qué**: write-time computation es más eficiente (un cálculo por publicación vs N por lectura) y mantiene consistencia con `wordCount/200`.

---

## 5. Capa Infrastructure

`blog-api/src/infrastructure/`

### Inicialización Turso (singleton por warm invocation)

```ts
// infrastructure/db/client.ts
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  _db = drizzle(client, { schema });
  return _db;
}
```

Module-scope cache → cold start crea conexión, warm reusa. `@libsql/client` usa HTTP keep-alive, no hay socket persistente que pueda romperse entre invocaciones.

### DrizzleArticleRepository

```ts
// infrastructure/article/drizzle-article-repository.ts
export class DrizzleArticleRepository implements IArticleRepository {
  constructor(private db: ReturnType<typeof getDb>) {}

  async findAll({ page, pageSize, categorySlug }) {
    const offset = (page - 1) * pageSize;
    const where = categorySlug
      ? inArray(articles.id, this.db.select({ id: articleCategories.articleId })
          .from(articleCategories)
          .innerJoin(categories, eq(categories.id, articleCategories.categoryId))
          .where(eq(categories.slug, categorySlug)))
      : undefined;
    const [items, totalRow] = await Promise.all([
      this.db.query.articles.findMany({
        where, limit: pageSize, offset,
        orderBy: [desc(articles.publishedAt)],
        with: { author: true, categoriesJoin: { with: { category: true } } },
      }),
      this.db.select({ c: sql<number>`count(*)` }).from(articles).where(where ?? sql`1=1`),
    ]);
    return { items: items.map(toDomain), total: totalRow[0].c };
  }

  async findBySlug(slug) { /* findFirst con joins de author + categories */ }
  async create(input) { /* insert articles + insert article_categories en transaction */ }
  async update(slug, patch) { /* update + reemplazar article_categories si patch.categories */ }
}
```

### DrizzleCvRepository

```ts
// infrastructure/cv/drizzle-cv-repository.ts
export class DrizzleCvRepository implements ICvRepository {
  constructor(private db: ReturnType<typeof getDb>) {}
  async getFullCv(): Promise<CvData> {
    const [personal, proyectos, experiencia, educacion, cursos] = await Promise.all([
      this.db.query.cvPersonal.findFirst({ where: eq(cvPersonal.id, 1) }),
      this.db.query.cvProyectos.findMany({ orderBy: [asc(cvProyectos.orden)] }),
      this.db.query.cvExperiencia.findMany({ orderBy: [asc(cvExperiencia.orden)] }),
      this.db.query.cvEducacion.findFirst({ where: eq(cvEducacion.id, 1) }),
      this.db.query.cvCursos.findMany({ orderBy: [asc(cvCursos.orden)] }),
    ]);
    return assembleCvData(personal, proyectos, experiencia, educacion, cursos);
  }
}
```

`assembleCvData` agrupa `cvCursos` bajo `educacion.especializaciones[].cursos` por `categoria`.

### DrizzleSiteConfigRepository

Métodos: `get()` (findFirst id=1), `update(patch)` (upsert id=1).

### S3MediaStorage — **OUT OF SCOPE**

Decisión: en este change **no hay upload programático**. Las imágenes ya existen en `public/cv/` y `src/assets/`. Subida inicial a S3 se hace **manualmente** (AWS CLI `aws s3 sync`) durante migración. Endpoints de upload quedan como future work. Se incluye en `infrastructure/media/s3-config.ts` solo la URL builder:

```ts
export function s3Url(key: string) {
  return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
}
```

### ResendNewsletter (decisión §8)

```ts
// infrastructure/newsletter/resend-newsletter.ts
export class ResendNewsletter implements INewsletterService {
  constructor(private apiKey: string, private audienceId: string) {}
  async subscribe(email: string) {
    const res = await fetch(`https://api.resend.com/audiences/${this.audienceId}/contacts`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    if (!res.ok) return { ok: false, reason: `resend_${res.status}` };
    return { ok: true };
  }
}
```

### Composition root

```ts
// infrastructure/container.ts
export function createContainer() {
  const db = getDb();
  return {
    articleRepo: new DrizzleArticleRepository(db),
    categoryRepo: new DrizzleCategoryRepository(db),
    cvRepo: new DrizzleCvRepository(db),
    configRepo: new DrizzleSiteConfigRepository(db),
    newsletter: new ResendNewsletter(process.env.RESEND_API_KEY!, process.env.RESEND_AUDIENCE_ID!),
  };
}
export type Container = ReturnType<typeof createContainer>;
```

---

## 6. Capa Interfaces (HTTP)

`blog-api/src/interfaces/http/`

### Hono app factory

```ts
// interfaces/http/app.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { auth } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { articleRoutes } from './routes/articles';
import { categoryRoutes } from './routes/categories';
import { cvRoutes } from './routes/cv';
import { configRoutes } from './routes/config';
import { newsletterRoutes } from './routes/newsletter';

export function createApp(container: Container) {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'] }));

  app.get('/health', (c) => c.json({ ok: true, db: 'connected' }));

  app.route('/articles',  articleRoutes(container));
  app.route('/categories', categoryRoutes(container));
  app.route('/cv',         cvRoutes(container));
  app.route('/config',     configRoutes(container));
  app.route('/newsletter', newsletterRoutes(container));

  app.onError(errorHandler);
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404));

  return app;
}
```

### Middleware stack (orden)

```
logger → cors → [per-route: auth en write methods] → handler → errorHandler
```

### Auth middleware

```ts
// interfaces/http/middleware/auth.ts
export const auth = async (c, next) => {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || token !== process.env.API_KEY) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key' } }, 401);
  }
  await next();
};
```

Aplicado solo en rutas mutating: `POST/PATCH /articles`, `PATCH /config`. `GET *` y `POST /newsletter/subscribe` son públicos.

### Rutas por dominio

| Method | Path | Use case | Returns |
|--------|------|----------|---------|
| GET | `/articles?page&pageSize&category` | `GetArticlesUseCase` | `ArticlesListDto` |
| GET | `/articles/:slug` | `GetArticleBySlugUseCase` | `ArticleDto \| 404` |
| POST | `/articles` (auth) | `CreateArticleUseCase` | `ArticleDto` |
| PATCH | `/articles/:slug` (auth) | `UpdateArticleUseCase` | `ArticleDto` |
| GET | `/categories` | `GetCategoriesUseCase` | `CategoryDto[]` |
| GET | `/categories/counts` | `GetCategoryCountsUseCase` | `Record<string, number>` |
| GET | `/cv` | `GetCvUseCase` | `CvDto` |
| GET | `/config` | `GetSiteConfigUseCase` | `SiteConfigDto` |
| PATCH | `/config` (auth) | `UpdateSiteConfigUseCase` | `SiteConfigDto` |
| POST | `/newsletter/subscribe` | `SubscribeNewsletterUseCase` | `{ ok, message? }` |

Handler ejemplo:

```ts
// interfaces/http/routes/articles.ts
export const articleRoutes = (c: Container) => new Hono()
  .get('/', async (ctx) => {
    const page = Number(ctx.req.query('page') ?? 1);
    const pageSize = Number(ctx.req.query('pageSize') ?? 10);
    const category = ctx.req.query('category') ?? undefined;
    const useCase = new GetArticlesUseCase(c.articleRepo);
    const out = await useCase.execute({ page, pageSize, categorySlug: category });
    return ctx.json(out);
  })
  .get('/:slug', async (ctx) => {
    const useCase = new GetArticleBySlugUseCase(c.articleRepo);
    const article = await useCase.execute({ slug: ctx.req.param('slug') });
    return article ? ctx.json(article) : ctx.json({ error: { code: 'NOT_FOUND' } }, 404);
  })
  .post('/', auth, async (ctx) => { /* ... */ })
  .patch('/:slug', auth, async (ctx) => { /* ... */ });
```

### Error handler global

```ts
// interfaces/http/middleware/error.ts
export const errorHandler = (err: Error, c: Context) => {
  console.error('[error]', err);
  const status = err instanceof HttpError ? err.status : 500;
  return c.json({
    error: { code: err.code ?? 'INTERNAL', message: err.message ?? 'Internal Server Error' }
  }, status);
};
```

Shape de error response (estándar):
```json
{ "error": { "code": "NOT_FOUND" | "UNAUTHORIZED" | "VALIDATION" | "INTERNAL", "message": "..." } }
```

---

## 7. Lambda handler

`blog-api/src/interfaces/lambda/handler.ts`:

```ts
import { handle } from '@hono/aws-lambda';
import { createApp } from '../http/app';
import { createContainer } from '../../infrastructure/container';

const container = createContainer();
const app = createApp(container);

export const handler = handle(app);
```

### Variables de entorno

| Var | Requerida | Origen |
|-----|-----------|--------|
| `TURSO_URL` | sí | Turso CLI `turso db show blog-prod --url` |
| `TURSO_AUTH_TOKEN` | sí | Turso CLI `turso db tokens create blog-prod` |
| `API_KEY` | sí | `openssl rand -hex 32` |
| `RESEND_API_KEY` | sí | dashboard Resend |
| `RESEND_AUDIENCE_ID` | sí | dashboard Resend |
| `S3_BUCKET` | sí | nombre del bucket |
| `S3_REGION` | sí | ej. `us-east-1` |

Bundle: `esbuild src/interfaces/lambda/handler.ts --bundle --platform=node --target=node22 --format=cjs --outfile=dist/handler.js --external:@libsql/client` (libsql tiene native binding — se incluye en Layer o `external` + Lambda layer prebuilt).

---

## 8. Newsletter: Resend vs Buttondown

**Decisión: Resend.**

| Criterio | Resend | Buttondown |
|----------|--------|------------|
| API moderna REST/JSON | ✓ | ✓ |
| Free tier | 3,000 emails/mes + audiencias | 100 subs gratis |
| Audiencias (lista persistente) | ✓ nativa | ✓ |
| Tooling para Node (`resend` SDK) | ✓ oficial | ✗ solo REST |
| Mejor para developer/blog técnico | ✓ marca dev-first | mejor para creators no-tech |

**Razón**: Resend tiene SDK oficial Node y free tier más holgado para volumen de un blog técnico. Para no atarnos al SDK (cold start), llamamos su REST API directamente con `fetch` desde `ResendNewsletter`. Si en el futuro queremos transactional emails (confirmación, notificaciones), Resend ya está integrado.

**Integración**: `POST /audiences/{id}/contacts` con `{ email, unsubscribed: false }`. Sin doble opt-in en MVP (configurable en dashboard Resend si se quiere agregar).

---

## 9. Migración de datos

Script: `blog-api/scripts/migrate-from-strapi.ts`

### Variables
```
STRAPI_URL=https://...  STRAPI_API_TOKEN=...
TURSO_URL=...  TURSO_AUTH_TOKEN=...
DRY_RUN=true|false  (default true)
```

### Algoritmo

```
1. Conectar a Strapi y fetch:
     GET /articles?populate=*&pagination[pageSize]=200
     GET /categories?populate=*&pagination[pageSize]=200
     GET /authors?populate=*&pagination[pageSize]=200
     GET /inicio?populate=*
     GET /about?populate=*
     GET /global?populate=*

2. Transform:
   - Authors → authors[] (drop documentId, mantener name/email/avatar.url → coverUrl absoluta)
   - Categories → categories[] (drop documentId)
   - Articles:
       a. body = flatten(blocks):
            - filter blocks por __component
            - case 'shared.rich-text' → push ...block.body_bloq (StrapiBlock[])
            - case 'shared.code'      → push { type: 'code', language: 'typescript', children: [{ type:'text', text: block.TYPESCRIPT }] }
            - case 'shared.media'     → push { type: 'image', image: { url: media.url, alternativeText: media.alternativeText, caption: media.caption }, children: [] }
            - case 'shared.slider'    → push N image blocks (uno por file)
            - case 'shared.quote'     → push { type: 'quote', children: [] }
       b. readMin = ReadMin.fromBlocks(body).minutes
       c. coverUrl = absolute(article.cover?.url)
       d. authorId = lookup(authors, by article.author?.documentId)
   - SiteConfig:
       siteTitle = global.siteName
       siteDescription = global.siteDescription
       email = (preguntar al user o hardcodear)
       rol = (preguntar al user)
       aboutMarkdown = renderBlocksToMarkdown(about.blocks)
       ogImage = absolute(global.defaultSeo?.shareImage?.url)
   - CV: SE LEE de src/data/cv-data.json (no de Strapi) — ya está en JSON local.
       cvExperiencia.tecnologias: split(',').map(trim) → string[]

3. Validation (DRY_RUN print only):
   - assert authors.length == strapi.authors.length
   - assert articles.length == strapi.articles.length
   - for each article: assert body.length > 0
   - assert categories.length == strapi.categories.length
   - print: "Migration plan: 4 authors, 12 articles, 8 categories, 1 site_config, 1 cv_personal, 4 proyectos, ..."

4. Insert (orden estricto — FK):
   a. authors
   b. categories
   c. articles  (capturar id ↔ slug)
   d. article_categories  (junction)
   e. site_config (id=1)
   f. cv_personal (id=1)
   g. cv_proyectos, cv_experiencia, cv_cursos (con orden)
   h. cv_educacion (id=1)

5. Post-check: GET /articles?page=1, GET /cv, GET /config contra Lambda staging y validar 3 slugs específicos.
```

### Dry-run obligatorio
Script aborta sin escribir si `DRY_RUN !== 'false'`. Output: plan de inserción + diffs detectados.

### Media a S3 (paso manual previo)
```
aws s3 sync public/cv s3://{bucket}/cv --acl public-read
aws s3 sync uploads-strapi s3://{bucket}/uploads --acl public-read
```
Luego el script reescribe `coverUrl` y `imagen` con `s3Url(key)`.

---

## 10. Frontend: reemplazo del cliente

### `src/lib/api-types.ts` (firma)

```ts
export type ArticleBlock = /* mismo shape que strapi-types.StrapiBlock + variantes media/code */;

export interface Media { url: string; alt?: string; }
export interface Author { name: string; avatarUrl?: string; }
export interface Category { slug: string; name: string; description?: string; }

export interface Article {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: ArticleBlock[];
  cover?: Media;
  author?: Author;
  categories: Category[];
  readMin: number;
  publishedAt: string;
}

export interface Pagination { page: number; pageSize: number; pageCount: number; total: number; }
export interface ArticleListResponse { data: Article[]; meta: { pagination: Pagination }; }

export interface SiteConfig {
  siteTitle: string; siteDescription: string;
  aboutMarkdown: string;
  email: string; rol: string;
  linkedin: string; github?: string; twitter?: string;
  ogImage?: string;
}

// CV types: reuse src/lib/cv-types.ts unchanged (CvData, CvPersonal, etc.)
```

### `src/lib/api.ts` (firma)

```ts
import type { Article, ArticleListResponse, Category, SiteConfig } from './api-types';
import type { CvData } from './cv-types';

const API_URL = import.meta.env.BLOG_API_URL ?? process.env.BLOG_API_URL!;
const API_KEY = import.meta.env.BLOG_API_KEY ?? process.env.BLOG_API_KEY; // opcional para reads

async function api<T>(path: string, init?: RequestInit): Promise<T> { /* fetch wrapper */ }

export async function getArticles(opts?: { page?: number; pageSize?: number; category?: string }): Promise<ArticleListResponse>;
export async function getArticleBySlug(slug: string): Promise<Article | null>;
export async function getCategories(): Promise<Category[]>;
export async function getCategoryCounts(): Promise<Record<string, number>>;
export async function getCv(): Promise<CvData>;
export async function getSiteConfig(): Promise<SiteConfig>;
export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; message?: string }>;
export function getMediaUrl(url: string | undefined): string | undefined; // pass-through (URLs ya absolutas)
```

### Variables de entorno frontend

```
# .env (Astro)
BLOG_API_URL=https://xxx.lambda-url.us-east-1.on.aws
BLOG_API_KEY=...   # solo si se hacen writes desde frontend (no en MVP)
```

GitHub Actions: `STRAPI_URL`, `STRAPI_API_TOKEN` → `BLOG_API_URL`, `BLOG_API_KEY`.

### Cambios por página

| Página | Cambio |
|--------|--------|
| `src/pages/index.astro` | `import { getArticles, getSiteConfig } from '../lib/api'` — usar `siteConfig.siteTitle/siteDescription` en hero |
| `src/pages/blog/index.astro` | `getArticles({ page: 1, pageSize: 10 })` — `articles = res.data`; counts vía `getCategoryCounts()`; paginación real con `res.meta.pagination` |
| `src/pages/blog/[...slug].astro` | `getArticleBySlug` retorna `Article` directo (no Strapi wrapper); `article.body` ya es `ArticleBlock[]` unificado, eliminar fallback `body_bloq \|\| blocks` |
| `src/pages/blog/category/[slug].astro` | `getArticles({ category: slug })` |
| `src/pages/blog/[page].astro` (NEW) | nuevo dynamic route para paginación `/blog/2`, `/blog/3` — getStaticPaths basado en `meta.pagination.pageCount` |
| `src/pages/cv.astro` | `const cv = await getCv()` — reemplaza `import data from '../data/cv-data.json'` |
| `src/pages/about.astro` | `const cfg = await getSiteConfig()` — render `cfg.aboutMarkdown` con remark; eliminar literales |
| `src/layouts/BlogPost.astro` | reads `pubDate`, `description`, `heroImage` de props; cambio cosmético: tipo `Article` |
| `src/components/seo/BaseHead.astro` | usar `siteConfig.siteTitle/Description/ogImage` (vía prop o `Astro.locals.siteConfig` set en middleware build-time) |
| `src/lib/constants.ts` | DEPRECATED — los valores vienen de `getSiteConfig()` |
| `src/data/cv-data.json` | DELETE post-migración verificada |

---

## 11. Estructura de directorios completa

```
blog-api/
├── package.json                       # scripts: dev, build, migrate, deploy
├── tsconfig.json
├── drizzle.config.ts                  # generación de migraciones
├── esbuild.config.mjs
├── .env.example
├── README.md
├── scripts/
│   ├── migrate-from-strapi.ts         # script de migración (§9)
│   └── seed-dev.ts                    # datos demo para Turso dev
├── src/
│   ├── domain/
│   │   ├── article/
│   │   │   ├── types.ts               # Article, ArticleBlock, NewArticle
│   │   │   ├── read-min.ts            # ReadMin value object
│   │   │   ├── article-repository.ts  # IArticleRepository
│   │   │   ├── category.ts            # Category type
│   │   │   ├── category-repository.ts # ICategoryRepository
│   │   │   └── author.ts              # Author type
│   │   ├── cv/
│   │   │   ├── types.ts               # CvData, CvPersonal, etc.
│   │   │   └── cv-repository.ts       # ICvRepository
│   │   ├── site-config/
│   │   │   ├── types.ts
│   │   │   └── site-config-repository.ts
│   │   ├── newsletter/
│   │   │   └── newsletter-service.ts  # INewsletterService
│   │   └── shared/
│   │       ├── slug.ts                # Slug value object
│   │       └── errors.ts              # HttpError, NotFoundError, ValidationError
│   ├── application/
│   │   ├── article/
│   │   │   ├── dto.ts                 # ArticleDto, ArticlesListDto
│   │   │   ├── get-articles.ts
│   │   │   ├── get-article-by-slug.ts
│   │   │   ├── create-article.ts
│   │   │   └── update-article.ts
│   │   ├── category/
│   │   │   ├── get-categories.ts
│   │   │   └── get-category-counts.ts
│   │   ├── cv/
│   │   │   └── get-cv.ts
│   │   ├── site-config/
│   │   │   ├── get-site-config.ts
│   │   │   └── update-site-config.ts
│   │   └── newsletter/
│   │       └── subscribe-newsletter.ts
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── client.ts              # getDb() singleton
│   │   │   ├── schema.ts              # Drizzle tables (§2)
│   │   │   └── migrations/            # generadas por drizzle-kit
│   │   ├── article/
│   │   │   ├── drizzle-article-repository.ts
│   │   │   └── mappers.ts             # row ↔ Article
│   │   ├── category/
│   │   │   └── drizzle-category-repository.ts
│   │   ├── cv/
│   │   │   ├── drizzle-cv-repository.ts
│   │   │   └── assemble-cv-data.ts
│   │   ├── site-config/
│   │   │   └── drizzle-site-config-repository.ts
│   │   ├── newsletter/
│   │   │   └── resend-newsletter.ts
│   │   ├── media/
│   │   │   └── s3-config.ts           # s3Url() helper
│   │   └── container.ts               # createContainer()
│   └── interfaces/
│       ├── http/
│       │   ├── app.ts                 # createApp(container)
│       │   ├── middleware/
│       │   │   ├── auth.ts
│       │   │   └── error.ts
│       │   └── routes/
│       │       ├── articles.ts
│       │       ├── categories.ts
│       │       ├── cv.ts
│       │       ├── config.ts
│       │       └── newsletter.ts
│       └── lambda/
│           └── handler.ts             # entry point esbuild (§7)
└── tests/                              # placeholder — sin tests en MVP
```

---

## Architecture Decisions (ADR summary)

| # | Decision | Rejected | Rationale |
|---|----------|----------|-----------|
| 1 | Hono + @hono/aws-lambda | Express, Fastify, raw Lambda | Edge-ready, tiny bundle, native Lambda handler wrapper, mejor TS DX |
| 2 | Clean Arch 4 capas con DI manual | hexagonal con DI container (tsyringe) | DI container añade cold start y dependencia; con 4 use cases reales la composition root manual es trivial |
| 3 | Drizzle + libSQL HTTP | Prisma, raw SQL | Prisma genera client masivo (cold start); Drizzle ofrece tipos + queries SQL-like sin bloat; libSQL HTTP funciona en Lambda sin TCP |
| 4 | `body` como JSON unificado (`ArticleBlock[]`) | Dual columns (blocks/body_bloq) o relación blocks→article | El frontend ya tiene types; renderizar un único array elimina la rama `\|\|` actual; SQLite TEXT-JSON es performant para reads |
| 5 | `readMin` calculado en write-time | en read-time | Una vez por publicación vs N por lectura; consistencia con `Math.ceil(words/200)` |
| 6 | Resend para newsletter | Buttondown | Free tier, SDK oficial, mismo proveedor sirve transactional emails futuros |
| 7 | Singleton Turso client por warm Lambda | Conexión por request | HTTP keep-alive ahorra ~50 ms por request en warm |
| 8 | Lambda Function URL (sin API Gateway) | API Gateway HTTP API | Un solo recurso, sin costo extra ni complejidad de stages; CORS configurado en Hono |
| 9 | Auth: `Bearer ${API_KEY}` único | OAuth, JWT, Cognito | MVP — solo el owner edita; API_KEY rotable manualmente |
| 10 | S3 público + URLs absolutas en DB | CloudFront firmado, proxy por Lambda | Reads desde build no necesitan privacy; URL pública es la más simple y barata |
| 11 | Sin upload programático en este change | Endpoint `POST /media` | Aguas abajo; migración inicial es CLI `aws s3 sync` — el blog rara vez agrega media |
| 12 | DI manual via `createContainer()` | inversify/tsyringe | Zero deps, sin reflection, sin decoradores; suficiente para 5 servicios |

---

## Open Questions

- [ ] ¿Email y rol concretos para `site_config` (hoy hardcodeados en Astro)? Default: `mba.miguel18@gmail.com` / `Full Stack Developer & DevOps`.
- [ ] ¿Resend Audience existe o se crea durante setup? (Asume creación manual previa.)
- [ ] ¿Mantener `src/lib/constants.ts` como fallback estático para builds offline, o eliminarlo definitivamente?

---

**End of design.**
