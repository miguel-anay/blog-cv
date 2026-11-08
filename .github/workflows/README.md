# GitHub Actions

Un solo workflow: [`ci.yml`](ci.yml). Protocolo completo y brechas conocidas en
[docs/DEPLOY.md](../../docs/DEPLOY.md#6-ci-githubworkflowsciyml).

## ci.yml

**Disparadores:** `push` a `main` y `pull_request` hacia `main`. Node 22, pnpm.

| Job | Cuándo | Pasos |
|---|---|---|
| `validate` (Typecheck + Build) | push y PR | `pnpm install --frozen-lockfile`, `pnpm astro check`, `pnpm build` |
| `deploy` (Deploy to Vercel) | solo push a `main`, después de `validate` | `pnpm db:migrate`, `vercel deploy --prod --yes` |

**Secrets usados:** `TURSO_URL`, `TURSO_TOKEN`, `VERCEL_TOKEN`. El paso de build todavía exporta secrets de
better-auth y OAuth que el código ya no lee.

No ejecuta pruebas unitarias ni E2E. El workflow `deploy.yml` a S3/CloudFront que describía este archivo antes
ya no existe.
