# Better Auth Specification

## Purpose

Define all behavior that MUST be true after the `better-auth` change. This is a new capability — no existing spec exists to delta against.

## Requirements

### Requirement: REQ-001 Social Login Providers

The site MUST provide login via Google, Facebook, and LinkedIn OAuth providers. The `/api/auth/[...all]` endpoint MUST delegate all auth handling to Better Auth.

#### Scenario: Login page shows three providers

- GIVEN the user is not authenticated
- WHEN the user navigates to `/login`
- THEN three login buttons are visible: Google, Facebook, and LinkedIn

#### Scenario: Redirect if already authenticated

- GIVEN the user has an active session
- WHEN the user navigates to `/login`
- THEN the user is redirected to `/courses`

---

### Requirement: REQ-002 Route Protection for /courses

Any route under `/courses` MUST require an active session. Unauthenticated users MUST be redirected to `/login` with the original path preserved as `?redirect=`.

#### Scenario: Unauthenticated access to /courses

- GIVEN the user has no active session
- WHEN the user navigates to `/courses`
- THEN the user is redirected to `/login?redirect=%2Fcourses`

#### Scenario: Unauthenticated access to /courses/[slug]

- GIVEN the user has no active session
- WHEN the user navigates to `/courses/mi-curso`
- THEN the user is redirected to `/login?redirect=%2Fcourses%2Fmi-curso`

#### Scenario: Authenticated access to /courses

- GIVEN the user has an active session
- WHEN the user navigates to `/courses`
- THEN the page renders without redirection

---

### Requirement: REQ-003 Public Routes Remain Accessible

Routes outside `/courses` MUST remain publicly accessible without authentication.

#### Scenario: Public routes accessible without session

- GIVEN the user has no active session
- WHEN the user navigates to `/`, `/blog`, `/cv`, or `/about`
- THEN the page renders without redirection

---

### Requirement: REQ-004 Session in Astro Locals

Every request MUST have `Astro.locals.user` and `Astro.locals.session` populated server-side. Both MUST be `null` when no session exists.

#### Scenario: Locals populated on authenticated request

- GIVEN the user has an active session
- WHEN any Astro page renders
- THEN `Astro.locals.user` contains `id`, `name`, `email`, `image`
- AND `Astro.locals.session` contains the session object

#### Scenario: Locals null on unauthenticated request

- GIVEN the user has no session
- WHEN any Astro page renders
- THEN `Astro.locals.user` is `null`
- AND `Astro.locals.session` is `null`

---

### Requirement: REQ-005 OAuth Callback Preserves Redirect

After successful OAuth login the user MUST land on the route they originally attempted to access.

#### Scenario: Deep link preserved after login

- GIVEN the user attempted to access `/courses/mi-curso`
- WHEN the user completes the Google OAuth flow with `callbackURL=/courses/mi-curso`
- THEN the user lands on `/courses/mi-curso` after login

---

### Requirement: REQ-006 Auth Tables in Turso

Better Auth MUST persist users and sessions in Turso via Drizzle adapter. Tables `user`, `session`, `account`, and `verification` MUST exist in the database.

#### Scenario: User created on first login

- GIVEN no user exists with a given email
- WHEN the user logs in with Google for the first time
- THEN a new row is inserted in `user`
- AND a new row is inserted in `session`
- AND a new row is inserted in `account` with `providerId = "google"`

---

### Requirement: REQ-007 Environment Variables

The auth instance MUST read credentials from environment variables with `import.meta.env` fallback to `process.env`.

#### Scenario: Missing secret causes build failure

- GIVEN `BETTER_AUTH_SECRET` is not set
- WHEN `astro build` runs
- THEN the build fails with a clear error
