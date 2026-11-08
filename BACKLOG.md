# Backlog

- **Última revisión:** 2026-11-08
- **Responde a:** [PRD](docs/PRD.md): cada ítem cita el requisito (RF/RNF) u objetivo (O) que cubre.
- **Seguimiento:** issues de GitHub y el tablero [Project #7](https://github.com/users/miguel-anay/projects/7).
  Cada ítem en curso tiene un issue; la rama lleva su número (`feat/N-slug`).

Prioridad: **Must** (sin esto el producto no cumple el PRD), **Should**, **Could**.

## Pendiente

| ID | Ítem | Requisito | Prioridad | Origen |
|---|---|---|---|---|
| B-01 | Eliminar las tablas sin uso `session`, `account` y `verification`, con su migración | RNF2 | Should | [ADR 0002](docs/adr/0002-sin-login.md) |
| B-02 | Borrar las variables `BETTER_AUTH_*` de Vercel | RNF2 | Should | ADR 0002 |
| B-03 | Borrar las filas `guest_*` de prueba en la tabla `user` de producción | RF6 | Could | Prueba del #32 |
| B-04 | Cargar `GITHUB_TOKEN` en Preview para no pegar contra el límite de la API | RF7, RNF4 | Could | [ADR 0001](docs/adr/0001-docs-desde-github.md) |
| B-05 | Resolver los hallazgos abiertos de [SECURITY.md](docs/SECURITY.md) | RNF2, RNF3 | Must | Pase de seguridad |
| B-06 | Documentar más repos en `/docs` (agregarlos a `DOC_REPOS`) | RF7, O5 | Could | — |
| B-07 | Cerrar el issue #33 tras validar el rediseño en producción | O4 | Should | #33 |
| B-08 | Correr Vitest y Playwright en CI: hoy `ci.yml` solo corre `astro check` y `build` | RNF5 | Must | [TECH-DESIGN](docs/TECH-DESIGN.md) |
| B-09 | RSS sin build (hoy se arma en el build desde Turso) y artículos y cursos en el sitemap | RF2, O2 | Should | TECH-DESIGN |
| B-10 | Confirmar que producción no se despliega dos veces (CI con `vercel deploy --prod` más la integración Git de Vercel) | RNF5 | Should | [DEPLOY](docs/DEPLOY.md) |
| B-11 | Quitar del CI los secretos `BETTER_AUTH_*` y OAuth, y el código muerto `subscribeNewsletter` y `RESEND_*` | RNF2 | Should | [SECURITY](docs/SECURITY.md) S-09 |
| B-12 | Actualizar `astro` y `drizzle-orm` y revisar el resto de `pnpm audit` | RNF2 | Must | SECURITY S-01 |
| B-13 | Headers de seguridad y CSP en `vercel.json` | RNF2 | Should | SECURITY S-02 |

## Hecho

| Issue | Ítem | Requisito | PR |
|---|---|---|---|
| #33 | Rediseño con el lenguaje visual de Mintlify | O4, RF8, RNF1 | #34 |
| — | Quitar el login; exámenes con invitado anónimo | RF5, RF6, O3 | #32 |
| #29 | Módulo `/docs` que publica docs de repos de GitHub | RF7, O5 | #30, #31 |
| #16 | Exámenes de certificación cronometrados | RF5, RF6, O3 | — |
| #14 | La intro se cerraba según la carga real (luego se eliminó en #34) | O4 | #15 |
| #3 | Hero animado con GSAP y escena 3D | RF9 | — |
| #1 | Sitio responsive, primero celular | RNF1, O4 | #2 |

## Descartado

| Issue | Ítem | Motivo |
|---|---|---|
| #9 | Login con Better Auth y proveedores sociales | Implementado y luego retirado: el blog no tiene login ([ADR 0002](docs/adr/0002-sin-login.md)) |
| #7 | API de blog en .NET 8 | El contenido vive en Turso y se lee desde Astro; un backend aparte no aporta |
