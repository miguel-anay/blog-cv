# GitHub Actions

Un solo workflow: [`ci.yml`](ci.yml). Protocolo completo y brechas conocidas en
[docs/DEPLOY.md](../../docs/DEPLOY.md#6-ci-githubworkflowsciyml).

## ci.yml

**Disparadores:** `push` a `main` y `pull_request` hacia `main`. Node 22, pnpm.

| Job | Cuándo | Pasos |
|---|---|---|
| `validate` (Typecheck + Tests + Build) | push y PR | `pnpm install --frozen-lockfile`, `pnpm astro check`, `pnpm test:unit`, Playwright (`pnpm test`), `pnpm build` |
| `deploy` (Deploy to Vercel) | solo push a `main`, después de `validate` | `pnpm db:migrate`, `vercel deploy --prod --yes` |

**Secrets usados:** `TURSO_URL`, `TURSO_TOKEN`, `VERCEL_TOKEN`. Producción solo se publica desde `deploy`:
`vercel.json` desactiva el deploy automático de `main` en Vercel.

No ejecuta pruebas unitarias ni E2E. El workflow `deploy.yml` a S3/CloudFront que describía este archivo antes
ya no existe.
