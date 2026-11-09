# Sitio personal de Miguel Anay

Blog, CV, cursos, exámenes de práctica y documentación de proyectos en un solo sitio.

**Producción:** https://miguel-anay.nom.pe

## Stack

- **Framework:** Astro 5 con SSR (`output: 'server'`), React 19 y Tailwind 4
- **Datos:** Turso (libSQL) con Drizzle ORM; el contenido se carga con skills de Claude Code, sin panel
- **Hosting:** Vercel (preview por PR, producción al hacer merge a `main`)
- **Animación:** GSAP y three.js (portada)
- **Pruebas:** Vitest y Playwright
- **CI:** GitHub Actions

## Empezar

Requisitos: Node 22 y pnpm. Copiar `.env.example` a `.env` y completar `TURSO_URL` y `TURSO_TOKEN`.

```bash
pnpm install
pnpm dev          # http://localhost:4321
```

| Comando | Qué hace |
|---|---|
| `pnpm build` | Compila el sitio (consulta Turso) |
| `pnpm check` | Verificación de tipos con `astro check` |
| `pnpm test:unit` | Pruebas unitarias (Vitest) |
| `pnpm test` | Pruebas E2E (Playwright) |
| `pnpm db:migrate` | Aplica las migraciones SQL pendientes en Turso |

## Estructura

```
src/
├── components/   # Solo código usado por 2 o más features
├── features/     # blog, courses, docs, exams, home (código de una sola feature)
├── lib/          # db, schema, acceso a datos, migraciones
├── pages/        # Rutas
└── middleware.ts # Invitado anónimo para exámenes
```

Regla de organización (Scope Rule): lo que usa una sola feature vive en `src/features/<feature>/`.

## Documentación

Los documentos siguen un pipeline y cada uno responde al anterior. Índice en [docs/README.md](docs/README.md).

- [PRD](docs/PRD.md): qué promete el sitio
- [TECH-DESIGN](docs/TECH-DESIGN.md): cómo está construido
- [DEPLOY](docs/DEPLOY.md): despliegue y CI
- [SECURITY](docs/SECURITY.md): reporte de seguridad
- [CHANGELOG](CHANGELOG.md)
- [BACKLOG](BACKLOG.md)

Decisiones de arquitectura en [docs/adr/](docs/adr/README.md). La documentación del stack anterior (Strapi +
AWS) está en [docs/archive/](docs/archive/).
