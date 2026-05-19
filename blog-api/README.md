# blog-api

Lambda-ready Hono API for the Miguel Anay blog. Backed by Turso (libSQL) via Drizzle ORM.

## Commands

```bash
pnpm dev          # local dev with tsx watch
pnpm build        # bundle to dist/ with esbuild
pnpm seed         # insert dev fixtures into local DB
pnpm migrate      # migrate data from Strapi
pnpm db:generate  # generate Drizzle migrations
pnpm db:migrate   # run pending migrations
```

## Environment variables

| Variable            | Required | Description                              |
|---------------------|----------|------------------------------------------|
| `TURSO_URL`         | Yes      | libSQL URL (`libsql://...` or `file:...`) |
| `TURSO_TOKEN`       | No       | Auth token (omit for local file DB)      |
| `API_SECRET`        | Yes      | Bearer token for write endpoints         |
| `RESEND_API_KEY`    | Yes      | Resend API key for newsletter            |
| `RESEND_AUDIENCE_ID`| Yes      | Resend audience ID                       |
| `PUBLIC_SITE_URL`   | Yes      | Frontend URL for CORS                    |
| `DRY_RUN`           | No       | Set `false` to actually write in migrate |

Copy `.env.example` to `.env` and fill in values.

## Lambda configuration

- **Handler**: `dist/handler.handler`
- **Runtime**: Node.js 22.x
- **Memory**: 256 MB recommended
- **Timeout**: 10 seconds
- **Trigger**: API Gateway HTTP API (v2)

## Migration from Strapi

```bash
STRAPI_URL=https://your-strapi.com \
STRAPI_TOKEN=your-token \
TURSO_URL=libsql://your-db.turso.io \
TURSO_TOKEN=your-token \
DRY_RUN=false \
pnpm migrate
```

Set `DRY_RUN=true` (default) to preview without writing.

## Routes

| Method | Path                  | Auth | Description            |
|--------|-----------------------|------|------------------------|
| GET    | /health               | No   | Health check           |
| GET    | /articles             | No   | List articles          |
| GET    | /articles/:slug       | No   | Get article by slug    |
| POST   | /articles             | Yes  | Create article         |
| PATCH  | /articles/:slug       | Yes  | Update article         |
| GET    | /categories           | No   | List categories        |
| GET    | /categories/counts    | No   | Article counts by cat  |
| GET    | /cv                   | No   | Get CV data            |
| GET    | /config               | No   | Get site config        |
| PATCH  | /config               | Yes  | Update site config     |
| POST   | /newsletter/subscribe | No   | Subscribe to newsletter|
