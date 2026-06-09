# Better Auth Specification

## Purpose

Define all behavior that MUST be true after the `better-auth` change. This is a new capability — no existing spec exists to delta against.

## Requirements

### Requirement: REQ-001 Social Login Providers

The site MUST provide login via Google, Facebook, and LinkedIn OAuth providers. No email/password login is required.

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

Any route under `/courses` MUST require an active session. Unauthenticated users MUST be redirected to `/login` with the original path preserved.

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

Every server-side request MUST have `Astro.locals.user` and `Astro.locals.session` populated. Both MUST be `null` when no session exists.

#### Scenario: Locals populated on authenticated request

- GIVEN the user has an active session
- WHEN any Astro page or API route renders
- THEN `Astro.locals.user` contains `id`, `name`, `email`, `image`
- AND `Astro.locals.session` contains the session object

#### Scenario: Locals null on unauthenticated request

- GIVEN the user has no session
- WHEN any Astro page renders
- THEN `Astro.locals.user` is `null`
- AND `Astro.locals.session` is `null`

---

### Requirement: REQ-005 OAuth Callback Preserves Redirect

After a successful OAuth login, the user MUST be redirected to the original route they attempted to access.

#### Scenario: Deep link preserved after login

- GIVEN the user attempted to access `/courses/mi-curso`
- WHEN the user completes the Google OAuth flow with `callbackURL=/courses/mi-curso`
- THEN the user lands on `/courses/mi-curso` after login

---

### Requirement: REQ-006 Auth Tables in Turso

Better Auth MUST persist sessions and users in Turso via Drizzle adapter. The following tables MUST exist: `user`, `session`, `account`, `verification`.

#### Scenario: User created on first login

- GIVEN no user exists with email `user@example.com`
- WHEN the user logs in with Google for the first time
- THEN a new row is inserted in the `user` table
- AND a new row is inserted in the `session` table
- AND a new row is inserted in the `account` table with `providerId = "google"`
