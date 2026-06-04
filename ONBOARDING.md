# ONBOARDING.md

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro v5.14.1 (SSR, Vercel adapter) |
| Language | TypeScript strict |
| Frontend | Astro + React 19 + Tailwind CSS v4 |
| Backend | Hono v4 + Drizzle ORM (workspace: `blog-api/`) |
| Database | Turso / LibSQL |
| Deployment | Vercel (frontend) |
| CI | Azure Pipelines |
| Testing | Playwright 1.60 (E2E) |

## Estructura del proyecto

```
callous-cluster/
├── src/
│   ├── components/layout/   # Header, Footer, BaseHead (shared)
│   ├── features/            # Scope Rule: código de un solo feature
│   │   ├── blog/
│   │   └── courses/
│   ├── pages/               # File-based routing
│   ├── layouts/             # BlogPost.astro
│   ├── lib/                 # schema.ts, api.ts, constants.ts
│   └── styles/global.css    # Tokens CSS + breakpoints globales
├── blog-api/                # Backend Hono + Drizzle (workspace separado)
├── tests/e2e/               # Playwright E2E specs
├── openspec/                # Artefactos SDD (spec, design, tasks)
└── playwright.config.ts
```

## Flujo de trabajo (Trunk-Based Development)

- **Feature/cambio grande**: `/sdd-new` → `/tbd` → `/sdd-ff` → `/sdd-apply` → `/sdd-verify` → `/tbd`
- **Bug/cambio pequeño**: `/tbd "descripción"` → fix → `/tbd`
- Las ramas viven **1-2 días máximo**
- Todo mergea directo a `main`

## Branch strategy

- `main` — única rama permanente, siempre deployable
- `feat/N-nombre` — features con SDD (vida corta)
- `fix/N-nombre` — bugs y cambios pequeños (vida corta)

## Comandos frecuentes

```bash
npm run dev          # Dev server → http://localhost:4321
npm run build        # Build de producción
npm run type-check   # tsc --noEmit
npm run lint         # astro check
npm test             # Playwright E2E (requiere: npm install + npx playwright install chromium)
npm run test:ui      # Playwright con UI interactiva
```

## Variables de entorno

```bash
TURSO_URL=           # URL de la base de datos Turso
TURSO_TOKEN=         # Token de autenticación Turso
RESEND_API_KEY=      # API key de Resend (newsletter)
RESEND_AUDIENCE_ID=  # ID de audiencia en Resend
```

## Cambios completados

### #1 — Make the site fully responsive (feat/1-web-responsive) — 2026-05-26

- **MobileNav.astro** — hamburger + drawer con ARIA completo (disclosure pattern, no dialog); focus trap vanilla JS; scroll lock en `<html>` (compatible con IDE theme)
- **Tokens responsivos** en `global.css`: `--section-pad-y`, `--hero-pad-y`, `--stack-col-width`; override a ≤767px
- **Sweep** de componentes: `.stack-row`, `.blog-card`, `SectionList`, `CourseCard`, `CourseNav`, TOC BlogPost, `.cat-grid`, footer
- **Decisión**: `documentElement.overflow` en lugar de `body` para scroll lock — evita conflicto con `body { padding-left: 220px }` del IDE theme
- **Fuera de scope**: migración a utilidades Tailwind, rediseño visual, dark mode toggle, `<details>` para TOC (queda como mejora futura)
- **Pendiente post-merge**: `npm install && npx playwright install chromium` para activar E2E tests
