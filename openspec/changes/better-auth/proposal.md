# Proposal: better-auth

**Change**: better-auth
**Status**: implemented
**Date**: 2026-06-08
**Author**: Miguel Anay
**Artifact store**: hybrid

---

## Intent

Agregar autenticación social al blog para proteger la sección `/courses`. El contenido de cursos es exclusivo para usuarios registrados. La solución usa **Better Auth** con Drizzle adapter sobre Turso (SQLite) ya existente, integrando tres proveedores sociales: Google, Facebook y LinkedIn.

## Scope

### In Scope
- Instancia Better Auth con Drizzle adapter (`src/lib/auth.ts`)
- Tablas de auth en el schema Drizzle existente (`user`, `session`, `account`, `verification`)
- Middleware Astro que protege `/courses/*` y popula `Astro.locals`
- Handler catch-all `/api/auth/[...all]` que delega a Better Auth
- Página `/login` con tres botones de login social
- Tipos `App.Locals` en `src/env.d.ts`

### Out of Scope
- Login con email/contraseña
- Roles y permisos granulares
- Botón de logout
- Protección de rutas de API
- Two-factor authentication

## Capabilities

### New Capabilities
- `auth-social`: login con Google, Facebook y LinkedIn via OAuth
- `route-guard`: protección automática de `/courses/*` via middleware

### Modified Capabilities
- `courses`: pasa de acceso libre a acceso autenticado

## Approach

1. **Librería**: Better Auth v1 con Drizzle adapter — compatible con Turso/libSQL sin configuración extra.
2. **Schema**: 4 tablas nuevas añadidas al `src/lib/schema.ts` existente (no schema separado).
3. **Guard**: un único middleware Astro que verifica sesión y redirige a `/login?redirect=<ruta>` si no hay sesión activa para `/courses/*`.
4. **Login page**: página SSR mínima sin layout compartido del blog.
5. **Handler**: endpoint catch-all que delega 100% a `auth.handler(request)`.

## Affected Areas

| Area | Impact | Descripción |
|------|--------|-------------|
| `src/lib/auth.ts` | New | Instancia Better Auth con 3 proveedores |
| `src/lib/schema.ts` | Modified | 4 tablas nuevas (user, session, account, verification) |
| `src/middleware.ts` | New | Guard de rutas y population de locals |
| `src/pages/api/auth/[...all].ts` | New | Handler catch-all |
| `src/pages/login.astro` | New | Página de login con 3 proveedores |
| `src/env.d.ts` | Modified | `App.Locals` con user y session tipados |
| `package.json` | Modified | Dependencia `better-auth` añadida |
| `.github/workflows/ci.yml` | Modified | `BETTER_AUTH_SECRET` como secret requerido |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Redirect URIs no configurados en cada proveedor OAuth | High | Documentar exactamente las URLs en design.md |
| `BETTER_AUTH_SECRET` ausente rompe el build SSR | Medium | Añadido como secret requerido en CI |
| Sesión expirada dentro de `/courses` sin feedback al usuario | Low | El middleware redirige automáticamente en el siguiente request |

## Dependencies

- Turso DB con las 4 tablas de auth migradas
- App OAuth creada en Google Cloud Console
- App OAuth creada en Meta Developers
- App OAuth creada en LinkedIn Developers
- Variables de entorno configuradas en `.env` y GitHub Secrets

## Success Criteria

- [ ] `GET /login` muestra los tres botones de login
- [ ] Click en Google inicia el flujo OAuth y crea sesión en Turso
- [ ] `GET /courses` sin sesión redirige a `/login?redirect=%2Fcourses`
- [ ] `GET /courses` con sesión activa renderiza la página sin redirección
- [ ] `GET /` y `/blog` accesibles sin autenticación
- [ ] `Astro.locals.user` tipado correctamente en TypeScript
