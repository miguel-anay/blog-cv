# Exploration: lambda-api

**Change**: lambda-api
**Status**: explored
**Date**: 2026-05-16
**Author**: Miguel Anay

---

## 1. Resumen del cambio

### Qué se reemplaza
Strapi v5 auto-hosted (o Strapi Cloud) como backend del blog personal de Miguel Anay. Strapi actualmente provee: colecciones Article, Author, Category, Global, About, Inicio; Media upload; Admin Panel; REST API.

### Qué se construye
Un backend propio minimalista desplegado como **una única función AWS Lambda** (handler Hono + @hono/aws-lambda), base de datos Turso/libSQL con Drizzle ORM, Media en S3, arquitectura Clean Architecture de 4 capas. El frontend Astro (ya en S3+CloudFront) consume este nuevo backend en build-time.

### Por qué
1. Strapi es sobre-engineered para un blog personal: pesa >200 MB en node_modules, requiere servidor persistente, y su Admin Panel es más overhead que valor real.
2. Turso tiene free tier generoso (9 GB, 10M rows/mes, 500 DBs), Lambda tiene free tier de 1M req/mes — costo operativo efectivamente cero.
3. Se elimina la dependencia de Strapi Cloud (pricing puede escalar) y se gana control total del schema, queries, y API surface.
4. Permite resolver los 7 gaps identificados en el codebase actual de forma limpia.

---

## 2. Opciones de diseño consideradas

### 2A. Estructura del backend Lambda

| Approach | Pros | Cons | Esfuerzo |
|---|---|---|---|
| **Single Lambda + Hono router** (elegido) | Un deploy, un contexto, routing interno eficiente, cold start único, SDK @hono/aws-lambda oficial | Si crece mucho hay que migrar; Lambda tiene límite 15min pero para APIs es irrelevante | Bajo |
| Multi-Lambda (una función por recurso) | Isolación, scaling independiente | Complejidad de deploys, múltiples cold starts, SAM/CDK overhead | Alto |
| Lambda + API Gateway HTTP API | Routing nativo AWS, IAM auth | Lock-in mayor, mayor latencia, pricing adicional | Medio |
| Fargate / ECS | Siempre caliente, sin cold starts | Costo ~$15-30/mes mínimo, over-engineered | Alto |

**Decisión**: Single Lambda con Hono. Para el volumen de un blog personal el cold start de <500ms es aceptable (el frontend es static, las llamadas son build-time). Hono tiene el bundle más liviano del ecosistema (~15 KB) y adapter oficial para Lambda.

### 2B. Base de datos

| Approach | Pros | Cons | Esfuerzo |
|---|---|---|---|
| **Turso (libSQL) + Drizzle** (elegido) | Edge-ready, free tier 9 GB, branching de DBs, HTTP protocol compatible con Lambda, TypeScript-first | Vendor lock-in leve (libSQL es SQLite fork), no ACID avanzado | Bajo |
| PlanetScale (MySQL) | Branching de schemas, generous free tier | Free tier eliminado en 2024 (ahora pago) | Medio |
| Neon (PostgreSQL serverless) | Postgres compatible, branching | Cold start de la DB se suma al de Lambda, free tier limitado a 0.5 GB | Bajo |
| DynamoDB | Siempre disponible, sin cold start de DB | No relacional, difícil querying, sobre-engineered para blog | Alto |

**Decisión**: Turso + Drizzle. El HTTP client de @libsql/client funciona sin connection pooling (stateless), ideal para Lambda. Drizzle genera SQL type-safe sin runtime overhead.

### 2C. Formato del body de artículos

| Approach | Pros | Cons | Esfuerzo |
|---|---|---|---|
| **StrapiBlock JSON** (elegido) | Ya definido en strapi-types.ts, portable, soporta código/imágenes/listas, renderizable en Astro | JSON en columna TEXT, búsqueda fulltext imposible sin FTS | Bajo |
| Markdown string | Human-readable, búsqueda fulltext nativa | Require parser (remark/unified) en build-time o runtime | Medio |
| MDX | Máxima flexibilidad | Imposible almacenar en DB relacional limpiamente | Alto |
| HTML string | Render trivial | XSS surface, difícil de editar | Bajo |

**Decisión**: Almacenar body como **JSON serializado (StrapiBlock[])** en columna TEXT. El tipo ya está definido, el renderer en Astro ya existe, y la búsqueda fulltext no es prioritaria (se puede añadir FTS5 de SQLite después).

---

## 3. Decisiones tomadas (stack confirmado)

| Decisión | Elección | Justificación |
|---|---|---|
| Framework HTTP | Hono + @hono/aws-lambda | Bundle <15 KB, TypeScript-first, adapter oficial Lambda |
| ORM | Drizzle ORM | Type-safe sin runtime overhead, migrations CLI, compatible con libSQL |
| DB driver | @libsql/client | Cliente HTTP stateless, ideal para Lambda sin connection pooling |
| DB hosting | Turso | Free tier 9 GB, branching, edge replicas si se necesitan |
| Deployment | Single AWS Lambda + Function URL | Simplicidad, costo cero en volumen de blog personal |
| Media | S3 + CloudFront | Ya existente para el frontend, extensible para media |
| Arquitectura interna | Clean Architecture 4 capas | Separación de concerns, testeable, sin acoplamiento a framework |
| Artifact store | hybrid (engram + openspec) | Persistencia cross-session + trail local committable |

---

## 4. Entidades de dominio propuestas

### Capa Domain (sin dependencias externas)

```typescript
interface Article {
  id: string;           // UUID
  title: string;
  description: string;
  slug: string;         // unique, URL-safe
  body: ArticleBlock[]; // StrapiBlock compatible
  coverUrl: string | null;
  readMin: number;      // calculado en aplicación al guardar
  authorId: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Category {
  id: string;
  name: string;
  slug: string;   // unique
  description: string | null;
}

interface Author {
  id: string;
  name: string;
  email: string;        // único, para auth futura
  bio: string | null;
  avatarUrl: string | null;
  role: string | null;  // "ingeniero · Lima, PE · @miguel-anay"
}

interface CvPersonal {
  id: string;           // singleton row, id = 'main'
  nombre: string;
  sitio: string;
  descripcion: string;
  empresasDestacadas: [string, string];
  tecnologiasDestacadas: string;
  linkedin: string;
  anio: string;
}

interface CvProyecto {
  id: string;
  titulo: string;
  empresa: string;
  descripcion: string;
  url: string;
  imagenUrl: string;
  tecnologias: CvTecnologia[]; // JSON column — normalizado como array
  orden: number;
}

interface CvExperiencia {
  id: string;
  periodo: string;
  cargo: string;
  empresa: string;
  certificadoUrl: string | null;
  logoUrl: string;
  tecnologias: string[];    // NORMALIZADO: era string CSV, ahora array JSON
  proyectos: CvSubProyecto[]; // JSON column
  orden: number;
}

interface SiteConfig {
  id: string;           // singleton 'main'
  siteName: string;
  siteDescription: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  authorLocation: string;
  bioHtml: string;      // párrafos del about
  stack: string[];
  nowSection: string;
  lastUpdate: Date;
}
```

---

## 5. Contratos de API REST

**Base URL**: `https://{lambda-function-url}/api/v1`

- Build-time (Astro SSG): todas las llamadas son GET, no auth requerida
- Write operations: requieren `Authorization: Bearer {API_KEY}`

### Blog

| Method | Endpoint | Descripción |
|---|---|---|
| GET | /articles | Lista paginada. Query: `page`, `pageSize`, `categorySlug`, `sort` |
| GET | /articles/:slug | Artículo completo con author y categories |
| POST | /articles | Crear artículo (write, auth) |
| PATCH | /articles/:id | Actualizar artículo (write, auth) |
| GET | /categories | Lista de categorías |
| GET | /categories/:slug/articles | Artículos de una categoría (paginado) |
| GET | /authors/:id | Autor por ID |

**Response shape** (listado):
```json
{
  "data": [...],
  "meta": { "pagination": { "page": 1, "pageSize": 10, "pageCount": 3, "total": 25 } }
}
```

### CV

| Method | Endpoint | Descripción |
|---|---|---|
| GET | /cv | Todo el CV (personal + proyectos + experiencia + educacion) |
| PATCH | /cv/personal | Actualizar datos personales (write, auth) |
| POST | /cv/proyectos | Añadir proyecto (write, auth) |
| PATCH | /cv/proyectos/:id | Actualizar proyecto (write, auth) |
| POST | /cv/experiencia | Añadir experiencia (write, auth) |
| PATCH | /cv/experiencia/:id | Actualizar experiencia (write, auth) |

### Site Config

| Method | Endpoint | Descripción |
|---|---|---|
| GET | /config | Configuración del sitio (reemplaza About hardcodeado + Global) |
| PATCH | /config | Actualizar configuración (write, auth) |

### Utilitarios

| Method | Endpoint | Descripción |
|---|---|---|
| POST | /newsletter/subscribe | Suscripción — delega a Resend/Buttondown, no almacena emails |
| GET | /health | Health check con estado de DB |

---

## 6. Infraestructura propuesta

### AWS Resources

```
Lambda Function (blog-api)
  Runtime: Node.js 22.x
  Memory: 512 MB
  Timeout: 10s
  Function URL: https://{hash}.lambda-url.{region}.on.aws
  Env: TURSO_URL, TURSO_AUTH_TOKEN, API_KEY, S3_BUCKET, S3_REGION

S3 Bucket (blog-media)
  Purpose: media uploads (cover images, CV images)
  Access: public-read para covers, pre-signed URLs para uploads

CloudFront (existente)
  Origin 1: S3 blog-frontend (Astro static)
  Origin 2 (nuevo): S3 blog-media

Turso DB
  Database: blog-prod
  Branch: blog-dev (para desarrollo)
```

### Estructura del repo del backend

```
blog-api/
├── src/
│   ├── domain/
│   │   ├── entities/          Article.ts, Category.ts, Author.ts, CvPersonal.ts...
│   │   ├── repositories/      IArticleRepository.ts, ICategoryRepository.ts...
│   │   └── value-objects/     Slug.ts, ReadMin.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── article/       GetArticles.ts, GetArticleBySlug.ts, CreateArticle.ts
│   │   │   ├── category/      GetCategories.ts, GetCategoryArticles.ts
│   │   │   ├── cv/            GetCv.ts, UpdateCvPersonal.ts
│   │   │   └── config/        GetSiteConfig.ts, UpdateSiteConfig.ts
│   │   └── dtos/              ArticleDto.ts, CategoryDto.ts, CvDto.ts
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── schema.ts      Drizzle schema
│   │   │   ├── migrations/    Drizzle migration files
│   │   │   └── repositories/  DrizzleArticleRepository.ts...
│   │   └── storage/
│   │       └── S3MediaStorage.ts
│   └── interfaces/
│       ├── http/
│       │   ├── app.ts         Hono app factory
│       │   ├── routes/        articles.ts, categories.ts, cv.ts, config.ts, newsletter.ts
│       │   └── middleware/    auth.ts, cors.ts, error.ts
│       └── lambda/
│           └── handler.ts     handle(app) — AWS Lambda entry point
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

### Schema Drizzle (tablas principales)

```typescript
export const articles = sqliteTable('articles', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  slug: text('slug').notNull().unique(),
  body: text('body').notNull(),       // JSON: ArticleBlock[]
  coverUrl: text('cover_url'),
  readMin: integer('read_min').notNull().default(5),
  authorId: text('author_id').references(() => authors.id),
  publishedAt: text('published_at'),  // ISO string, null = draft
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const cvExperiencia = sqliteTable('cv_experiencia', {
  id: text('id').primaryKey(),
  periodo: text('periodo').notNull(),
  cargo: text('cargo').notNull(),
  empresa: text('empresa').notNull(),
  certificadoUrl: text('certificado_url'),
  logoUrl: text('logo_url').notNull(),
  tecnologias: text('tecnologias').notNull(), // JSON: string[] (NORMALIZADO desde string CSV)
  proyectos: text('proyectos').notNull(),     // JSON: CvSubProyecto[]
  orden: integer('orden').notNull().default(0),
});
```

---

## 7. Gaps que resuelve

| # | Gap | Situación actual | Solución |
|---|---|---|---|
| 1 | body dual (body_bloq vs blocks) | DynamicZone con SharedRichText.body_bloq anidado — confuso | Un solo campo `body: ArticleBlock[]` directo en Article |
| 2 | tecnologias string CSV en CvExperiencia | string CSV vs array de objetos en CvProyecto | `tecnologias: string[]` normalizado en DB como JSON |
| 3 | About hardcodeado | bio/stack/now en about.astro como literales | SiteConfig en DB con GET /config |
| 4 | Email/rol hardcodeados | BlogPost.astro línea 28 y cv.astro como strings | Author.role y SiteConfig.authorEmail desde DB |
| 5 | Paginación rota | blog/index.astro solo sirve página 1, rutas /blog/2 no existen | GET /articles?page=X con meta.pagination real |
| 6 | Búsqueda decorativa | input sin lógica de filtrado | **Fuera del alcance** — FTS5 en siguiente iteración |
| 7 | readMin hardcodeado | readMin={5} en index.astro, default 6 en BlogPost.astro | Calculado: `Math.ceil(wordCount / 200)` en use-case, almacenado en DB |

---

## 8. Riesgos

### R1: Cold start de Lambda — MEDIO
Bundle estimado: ~2 MB. Cold start Node.js 22: ~200-400ms. Para SSG las llamadas son en build-time (CI/CD), no runtime del usuario. Riesgo real: bajo.

### R2: Migración de datos desde Strapi — MEDIO
El body de artículos está en DynamicZone (SharedRichText con body_bloq dentro de blocks[]). El script de migración debe flatten cuidadosamente. Mitigación: dry-run con validación por conteo.

### R3: Turso pricing — BAJO
Free tier: 9 GB, 10M row reads/mes, 500 DBs. Un blog personal con ~50 artículos y builds ocasionales está muy dentro del límite.

### R4: Sin Admin Panel — BAJO-MEDIO
Strapi tiene Admin UI. El nuevo backend no. Mitigación: Drizzle Studio CLI para edición directa en desarrollo; API Key + REST para edición en producción. Admin UI queda fuera del alcance.

### R5: CORS — BAJO
SSG llama desde CI/CD (Node.js), no desde browser. Configurar CORS permisivo en Hono middleware desde el inicio para future-proofing.

### R6: URLs de media — BAJO
getStrapiMedia() resuelve URLs relativas. Con el nuevo backend todas las URLs son absolutas (S3 https://). Simplificar a identidad.

---

## 9. Alcance del cambio

### En alcance
- Repo `blog-api/` con backend Hono + Lambda
- Schema Drizzle completo (Article, Category, Author, CV*, SiteConfig)
- Use cases READ para todas las entidades
- Use cases WRITE básicos (CreateArticle, UpdateArticle, UpdateSiteConfig, UpdateCv*)
- Endpoints REST: GET completo, POST/PATCH con auth
- Script de migración Strapi → Turso
- Frontend: reemplazar `src/lib/strapi.ts` → `src/lib/api.ts`
- Paginación real del blog
- readMin calculado automáticamente
- About y SiteConfig desde DB
- Newsletter: POST /newsletter/subscribe con Resend/Buttondown

### Fuera del alcance
- Admin Panel UI
- Búsqueda fulltext (FTS5)
- SSR del frontend
- Autenticación de usuarios / comentarios
- Analytics
- Media upload UI

---

## Affected Areas (frontend)

| Archivo | Cambio |
|---|---|
| `src/lib/strapi.ts` | Reemplazar por `src/lib/api.ts` |
| `src/lib/strapi-types.ts` | Reemplazar por `src/lib/api-types.ts` |
| `src/pages/index.astro` | getInicio → getArticles + getConfig |
| `src/pages/blog/index.astro` | Añadir paginación real |
| `src/pages/blog/[...slug].astro` | Cambiar fuente de datos |
| `src/pages/blog/category/[slug].astro` | Cambiar fuente de datos |
| `src/pages/cv.astro` | JSON local → GET /cv |
| `src/pages/about.astro` | Hardcoded → GET /config |
| `src/layouts/BlogPost.astro` | author/readMin desde API |

---

## Recommendation

**Proceder con la propuesta.** El stack elegido (Hono + Lambda + Turso + Drizzle + Clean Architecture) es técnicamente sólido, de costo cero para el volumen de un blog personal, y resuelve los 7 gaps identificados de forma limpia.

El riesgo más concreto es el script de migración de datos desde Strapi — requiere atención especial al formato DynamicZone del body de artículos.

**Next**: sdd-propose
