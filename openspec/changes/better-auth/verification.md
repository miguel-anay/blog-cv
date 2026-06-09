# better-auth — Verification Checklist

Manual acceptance scenarios to validate before marking the change as complete.

## Setup

- [ ] `.env` tiene todas las variables requeridas: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/SECRET`
- [ ] Las 4 tablas de auth existen en Turso: `user`, `session`, `account`, `verification`
- [ ] Redirect URIs configurados en cada proveedor OAuth:
  - Google: `{BETTER_AUTH_URL}/api/auth/callback/google`
  - Facebook: `{BETTER_AUTH_URL}/api/auth/callback/facebook`
  - LinkedIn: `{BETTER_AUTH_URL}/api/auth/callback/linkedin`

## Build

- [ ] `npm run build` completa sin errores TypeScript
- [ ] `Astro.locals.user` y `Astro.locals.session` no generan errores de tipo en ninguna página

## Página de login

- [ ] `GET /login` renderiza los tres botones (Google, Facebook, LinkedIn)
- [ ] Si hay sesión activa, `GET /login` redirige a `/courses`
- [ ] El `?redirect` param se preserva en cada href de proveedor como `callbackURL`

## Flujo OAuth

- [ ] Click en Google inicia el flujo OAuth sin error
- [ ] Tras login exitoso con Google, se crea fila en tabla `user` y `session` en Turso
- [ ] El usuario es redirigido a la ruta original (`callbackURL`)
- [ ] `context.locals.user` contiene `id`, `name`, `email`, `image` del usuario

## Protección de rutas

- [ ] `GET /courses` sin sesión → redirige a `/login?redirect=%2Fcourses`
- [ ] `GET /courses/[slug]` sin sesión → redirige a `/login?redirect=%2Fcourses%2F{slug}`
- [ ] `GET /courses` con sesión → renderiza sin redirección
- [ ] `GET /` sin sesión → accesible sin redirección
- [ ] `GET /blog` sin sesión → accesible sin redirección
- [ ] `GET /cv` sin sesión → accesible sin redirección
- [ ] `GET /about` sin sesión → accesible sin redirección

## Handler de auth

- [ ] `GET /api/auth/session` devuelve la sesión actual o null
- [ ] `POST /api/auth/signout` destruye la sesión (cookie eliminada)

## CI

- [ ] El workflow de CI pasa con `BETTER_AUTH_SECRET` configurado como secret
