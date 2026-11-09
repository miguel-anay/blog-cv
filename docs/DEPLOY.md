# DEPLOY — Protocolo de despliegue y CI

- **Estado:** Vigente
- **Última revisión:** 2026-11-08
- **Documento relacionado:** [TECH-DESIGN.md](TECH-DESIGN.md) §9 · [SECURITY.md](SECURITY.md)

> Reemplaza a `doc/DEPLOY.md` y `doc/CI-CD.md`, que describían S3 + CloudFront + Strapi
> ([archivados](archive/)). Hoy el sitio corre en Vercel con base en Turso.

## 1. Resumen

| Entorno | Cuándo se crea | URL |
|---|---|---|
| Preview | Por cada pull request (integración Git de Vercel) | `https://<proyecto>-<hash>-<equipo>.vercel.app` |
| Producción | Al hacer merge a `main` (job `deploy` de CI) | https://miguel-anay.nom.pe |

`www.miguel-anay.nom.pe` redirige de forma permanente al dominio sin `www` (`vercel.json`).

> El repo solo prueba el despliegue a producción desde CI. Que Vercel cree los previews por PR depende de la
> integración Git del proyecto, configurada en el panel de Vercel y no versionada; se verifica en la pestaña
> *Deployments* del proyecto.

## 2. Variables de entorno

Se definen en Vercel (*Settings > Environment Variables*), no en el repo. Valores reales en `.env` local
(ignorado por git); el formato está en `.env.example`.

| Variable | Producción | Preview | Uso |
|---|---|---|---|
| `TURSO_URL` | sí | sí | URL de la base libSQL |
| `TURSO_TOKEN` | sí | sí | Token de la base |
| `GITHUB_TOKEN` | opcional | opcional | Sube el límite de la API de GitHub de 60 a 5000 pedidos/hora para `/docs` |
| `RESEND_API_KEY`, `RESEND_AUDIENCE_ID` | no | no | Solo `subscribeNewsletter` (`src/lib/api.ts`), que ninguna página llama hoy |

Sin `TURSO_URL` la app lanza `TURSO_URL env var is not set`. Las variables `BETTER_AUTH_*`, `GOOGLE_*`,
`FACEBOOK_*` y `LINKEDIN_*` quedaron sin uso desde [ADR 0002](adr/0002-sin-login.md) y se pueden borrar de
Vercel y de los secrets de GitHub. Ninguna lleva prefijo `PUBLIC_`, así que no llegan al cliente.

## 3. Flujo de despliegue

1. Rama `feat/…`, `fix/…`, etc. y pull request contra `main`.
2. CI corre `astro check`, Vitest, Playwright y `build` (§6). Vercel publica un preview.
3. Se revisa el preview (§5) y se hace merge.
4. En el push a `main`, CI vuelve a validar y, si pasa, el job `deploy`:
   1. `pnpm db:migrate` aplica contra Turso las migraciones SQL pendientes de `src/lib/migrations/`
      (registra lo aplicado en `_migrations`; es seguro repetirlo; ignora los `*_rollback.sql`).
   2. `vercel deploy --prod --yes` publica a producción.
5. Smoke check (§5).

Las migraciones corren antes del deploy: un cambio de esquema debe ser compatible con el código anterior
(agregar antes de quitar), porque durante unos segundos el código viejo ve el esquema nuevo.

Cambios de **contenido** (artículos, cursos, preguntas) no se despliegan: se cargan en Turso con las skills
`/publish-*` y aparecen sin build. Excepción: el RSS se carga en el build ([TECH-DESIGN](TECH-DESIGN.md) §10).

## 4. Rollback

Código:

```bash
vercel ls                       # lista los despliegues
vercel rollback                 # vuelve al despliegue de producción anterior
vercel rollback <url-o-id>      # vuelve a uno concreto
vercel promote <url-o-id>       # promueve un despliegue (p. ej. un preview ya verificado)
```

`vercel rollback` solo cambia el alias de producción al despliegue indicado; no toca la base. Después hay que
arreglar `main` con un `revert` para que el siguiente deploy no vuelva a publicar el defecto.

Base de datos: no hay rollback automático. Los `src/lib/migrations/*_rollback.sql` existen para
`003_course_type` y `006_exams` y se ejecutan a mano contra Turso. Antes de una migración destructiva, tomar un
respaldo o una rama de la base en Turso.

## 5. Verificación (smoke check)

Después de cada deploy a producción deben responder 200:

| URL | Qué prueba |
|---|---|
| `/` | Portada y `getSiteConfig` |
| `/blog` | Listado desde Turso |
| `/cv` | Tablas `cv_*` |
| `/courses` | Cursos |
| `/exams` | Exámenes y middleware de invitado |
| `/docs` y `/docs/duck-kit` | Integración con GitHub |
| `/rss.xml`, `/sitemap.xml`, `/docs/search.json` | Feeds e índice de búsqueda |

```bash
for p in / /blog /cv /courses /exams /docs /docs/duck-kit /rss.xml /sitemap.xml /docs/search.json; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://miguel-anay.nom.pe$p"
done
```

**Previews protegidos.** Si el preview exige autenticación de Vercel, `curl` recibe 401. Usar
`vercel curl <ruta> --deployment <url-del-preview>`, que agrega el bypass de protección, o abrir el preview
con sesión iniciada. Si falla `/docs`, revisar primero el límite de GitHub (502) antes de culpar al deploy
([ADR 0001](adr/0001-docs-desde-github.md)).

## 6. CI: `.github/workflows/ci.yml`

Un solo workflow, `CI`.

| Campo | Valor |
|---|---|
| Disparadores | `push` a `main` y `pull_request` hacia `main` |
| Runner / Node | `ubuntu-24.04` en `validate` (Playwright 1.60 no soporta Chromium en 26.04), `ubuntu-latest` en `deploy`; Node 22, pnpm instalado con `npm install -g pnpm` |

**Job `validate` (Typecheck + Tests + Build)** — en push y PR, con `TURSO_URL` y `TURSO_TOKEN` desde secrets:

1. `pnpm install --frozen-lockfile`
2. `pnpm astro check`
3. `pnpm test:unit` (Vitest)
4. `pnpm exec playwright install --with-deps chromium` y `pnpm test` (E2E en 4 viewports)
5. `pnpm build` (el build consulta la base para el RSS).

**Job `deploy` (Deploy to Vercel)** — `needs: validate`, solo en `push` a `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm db:migrate` con `TURSO_URL` y `TURSO_TOKEN`
3. `npm install -g vercel` y `vercel deploy --prod --yes` con `VERCEL_TOKEN`; el equipo y el proyecto de
   Vercel se fijan con `VERCEL_ORG_ID` y `VERCEL_PROJECT_ID` en el propio workflow.

Secrets de GitHub usados: `TURSO_URL`, `TURSO_TOKEN`, `VERCEL_TOKEN`.

**Un solo camino a producción.** `vercel.json` tiene `git.deploymentEnabled.main: false`: la integración Git
de Vercel ya no publica `main` y solo arma previews de los PR. Producción sale únicamente de este job, después
de las migraciones. Hasta #36 se desplegaba dos veces por merge.

Correr lo mismo en local antes de abrir el PR:

```bash
pnpm install --frozen-lockfile && pnpm check && pnpm test:unit && pnpm test && pnpm build
```

## 7. Archivos del stack anterior

`buildspec.yml`, `azure-pipelines.yml`, `infra/` (Terraform de S3/CloudFront/Lambda), `blog-api/` y
`scripts/deploy.sh`, `install.sh`, `setup-cloudfront.sh` pertenecen al despliegue anterior en AWS. Vercel no
los usa; siguen en el repo y están pendientes de limpieza.
