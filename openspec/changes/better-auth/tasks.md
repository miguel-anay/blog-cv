# Tasks: better-auth

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 (additions) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-to-main

---

## Phase 1: Schema — tablas Better Auth

- [x] 1.1 Agregar tabla `user` en `src/lib/schema.ts`
- [x] 1.2 Agregar tabla `session` en `src/lib/schema.ts`
- [x] 1.3 Agregar tabla `account` en `src/lib/schema.ts`
- [x] 1.4 Agregar tabla `verification` en `src/lib/schema.ts`

## Phase 2: Auth instance

- [x] 2.1 Crear `src/lib/auth.ts` con `betterAuth()` + Drizzle adapter
- [x] 2.2 Configurar `socialProviders`: Google, Facebook, LinkedIn
- [x] 2.3 Exportar `Session` type via `auth.$Infer.Session`

## Phase 3: API Handler

- [x] 3.1 Crear `src/pages/api/auth/[...all].ts` con handler catch-all

## Phase 4: Middleware

- [x] 4.1 Crear `src/middleware.ts` con `defineMiddleware`
- [x] 4.2 Inyectar `context.locals.user` y `context.locals.session`
- [x] 4.3 Guard: redirigir a `/login?redirect=...` si `/courses/*` sin sesión

## Phase 5: Login page

- [x] 5.1 Crear `src/pages/login.astro` con los tres botones de login social
- [x] 5.2 Redirigir a `/courses` si ya hay sesión activa
- [x] 5.3 Preservar `?redirect` param en cada `callbackURL`

## Phase 6: Tipos

- [x] 6.1 Actualizar `src/env.d.ts` con `App.Locals` tipado

## Phase 7: CI

- [x] 7.1 Agregar `BETTER_AUTH_SECRET` como secret en `.github/workflows/ci.yml`

## Phase 8: Verificación

- [x] 8.1 Ejecutar checklist de `verification.md`
- [x] 8.2 Crear `verify-report.md` con resultados
- [ ] 8.3 Archivar el cambio
