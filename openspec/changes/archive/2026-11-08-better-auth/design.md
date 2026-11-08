# Design: better-auth

**Change**: better-auth
**Date**: 2026-06-08
**Status**: implemented
**Artifact store**: hybrid

---

## 1. Arquitectura general

### Flujo de datos

```
                        SSR REQUEST
  ┌─────────────────┐   headers     ┌──────────────────────────┐
  │  Astro Middleware│ ────────────► │  auth.api.getSession()   │
  │  src/middleware.ts│ ◄──────────── │  Better Auth             │
  └────────┬────────┘  Session|null  └──────────┬───────────────┘
           │                                    │ Drizzle adapter
           │ context.locals.user/session        ▼
           ▼                         ┌──────────────────────────┐
  ┌─────────────────┐                │  Turso (libSQL)          │
  │  Astro Page/API │                │  user, session, account, │
  │  Astro.locals   │                │  verification tables     │
  └─────────────────┘                └──────────────────────────┘

                        OAUTH FLOW
  Browser → /api/auth/signin/google?callbackURL=...
          → Better Auth → Google OAuth → callback
          → /api/auth/callback/google → sesión creada → redirect
```

---

## 2. Archivos implementados

### `src/lib/auth.ts` — Instancia Better Auth

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from './db';
import * as schema from './schema';

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: 'sqlite',
    schema: { user, session, account, verification },
  }),
  secret: import.meta.env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
  baseURL: import.meta.env.BETTER_AUTH_URL ?? process.env.BETTER_AUTH_URL,
  socialProviders: {
    google:   { clientId, clientSecret },
    facebook: { clientId, clientSecret },
    linkedin: { clientId, clientSecret },
  },
});

export type Session = typeof auth.$Infer.Session;
```

**Decisión**: Se usa `import.meta.env` con fallback a `process.env` para soportar tanto Astro SSR como scripts Node fuera de Astro (migraciones, seeds).

### `src/lib/schema.ts` — Tablas Better Auth

Tablas agregadas al schema Drizzle existente:

| Tabla | Descripción |
|-------|-------------|
| `user` | Perfil de usuario (id text PK — Better Auth usa UUIDs) |
| `session` | Sesión activa con token único |
| `account` | Cuenta OAuth por proveedor (accountId + providerId) |
| `verification` | Tokens de verificación (email, etc.) |

**Decisión clave**: Las columnas `createdAt`/`updatedAt` en Better Auth usan `integer({ mode: 'timestamp' })` (Unix timestamp), distinto a las otras tablas del proyecto que usan `text` ISO 8601. Esto es un requisito del adapter de Better Auth — no modificable sin parchear la librería.

### `src/middleware.ts` — Guard de rutas

```ts
export const onRequest = defineMiddleware(async (context, next) => {
  const session = await auth.api.getSession({ headers: context.request.headers });

  context.locals.user    = session?.user    ?? null;
  context.locals.session = session?.session ?? null;

  if (context.url.pathname.startsWith('/courses')) {
    if (!session) {
      return context.redirect('/login?redirect=' + encodeURIComponent(context.url.pathname));
    }
  }

  return next();
});
```

**Orden de operaciones**: 1) obtener sesión siempre (incluso para rutas públicas — esto popula locals), 2) guard condicional solo para `/courses`, 3) next().

**Decisión**: Se verifica `pathname.startsWith('/courses')` en vez de una lista blanca de rutas protegidas, para que cualquier subruta nueva de cursos quede automáticamente protegida sin modificar el middleware.

### `src/pages/api/auth/[...all].ts` — Handler catch-all

```ts
export const ALL: APIRoute = async ({ request }) => {
  return auth.handler(request);
};
```

Better Auth expone un único handler que maneja internamente todos sus endpoints (`/signin/*`, `/callback/*`, `/signout`, etc.).

### `src/pages/login.astro` — Página de login

- Server-side: si hay sesión activa → redirect `/courses`
- Preserva el `?redirect` param en cada href de proveedor como `callbackURL`
- Tres botones: Google (blanco), Facebook (#1877F2), LinkedIn (#0A66C2)
- Layout mínimo sin Header/Footer del sitio — página aislada

### `src/env.d.ts` — Tipos de Astro.locals

```ts
declare namespace App {
  interface Locals {
    user:    import('./lib/auth').Session['user']    | null;
    session: import('./lib/auth').Session['session'] | null;
  }
}
```

Los tipos se infieren directamente del `auth` instance via `$Infer.Session` — no requieren mantenimiento manual.

---

## 3. CI — `.github/workflows/ci.yml`

Se agrega `BETTER_AUTH_SECRET` como secret requerido en el job de build para que Astro no falle al inicializar el módulo de auth durante SSR build.

---

## 4. Architecture Decisions (ADR summary)

| # | Decision | Rechazada | Razón |
|---|----------|-----------|-------|
| 1 | Better Auth | NextAuth, Auth.js, Lucia | Better Auth tiene adapter oficial Drizzle, soporte nativo Astro SSR, y no requiere adaptar el handler a formato Astro manualmente |
| 2 | Drizzle adapter sobre Turso | Prisma adapter, adapter custom | Consistencia con el resto del schema del proyecto que ya usa Drizzle |
| 3 | Guard via middleware Astro | Guard en cada página | Un solo punto de control — nuevas páginas de cursos quedan protegidas automáticamente |
| 4 | `startsWith('/courses')` | Array de rutas protegidas | Más DRY — no hay que actualizar el middleware al añadir subrutas |
| 5 | Login page sin layout compartido | Usar el Header/Footer del blog | La página de acceso a cursos es un contexto distinto (no es parte del blog público) |
| 6 | callbackURL = redirect param | Hardcoded `/courses` | Permite deep-linking: el usuario llega directamente al recurso que intentaba ver |

---

## 5. Variables de entorno

| Variable | Requerida | Origen |
|----------|-----------|--------|
| `BETTER_AUTH_SECRET` | sí | `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | sí | URL del sitio en producción |
| `GOOGLE_CLIENT_ID` | sí | Google Cloud Console → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | sí | Google Cloud Console |
| `FACEBOOK_CLIENT_ID` | sí | Meta Developers → App ID |
| `FACEBOOK_CLIENT_SECRET` | sí | Meta Developers → App Secret |
| `LINKEDIN_CLIENT_ID` | sí | LinkedIn Developers → Client ID |
| `LINKEDIN_CLIENT_SECRET` | sí | LinkedIn Developers → Client Secret |

**Redirect URIs a configurar en cada proveedor**:
```
https://{BETTER_AUTH_URL}/api/auth/callback/google
https://{BETTER_AUTH_URL}/api/auth/callback/facebook
https://{BETTER_AUTH_URL}/api/auth/callback/linkedin
```

---

## 6. Open Questions

- [ ] ¿Se necesita un botón de logout en `/courses`? Actualmente no está implementado.
- [ ] ¿Qué pasa cuando expira la sesión estando dentro de `/courses`? El próximo request al middleware detectará `null` y redirigirá a login — comportamiento correcto pero no hay notificación al usuario.
- [ ] ¿`BETTER_AUTH_URL` en preview/staging apunta a la URL de Vercel preview o a producción? (Afecta los redirect URIs del OAuth provider.)

---

**End of design.**
