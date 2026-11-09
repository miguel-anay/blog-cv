# Magic Link Specification

## Purpose

Define all behavior that MUST be true after the `magic-link` change. This extends the existing Better Auth setup (REQ-001 through REQ-007 from the `better-auth` spec remain in force). Only new or changed behavior is specified here.

## Requirements

### Requirement: REQ-001 Magic Link Request

When a user submits their email address on the login page, Better Auth MUST generate a single-use token, persist it in the `verification` table, and invoke the `sendMagicLink` callback. The callback MUST deliver the link to the user's inbox via Resend.

#### Scenario: Valid email submitted

- GIVEN the user is not authenticated
- WHEN the user enters a valid email address in the magic-link form and submits
- THEN Better Auth creates a verification token for that email
- AND the `sendMagicLink` callback is invoked with the token URL and the email address
- AND Resend delivers an email containing the magic link to that address
- AND the login page shows a "check your email" confirmation message

#### Scenario: Email address is blank

- GIVEN the user is not authenticated
- WHEN the user submits the magic-link form with an empty email field
- THEN the form shows a validation error and does NOT call the Better Auth endpoint

#### Scenario: Resend API key is missing or invalid

- GIVEN `RESEND_API_KEY` is not set or is invalid
- WHEN the `sendMagicLink` callback fires
- THEN the error is caught and logged server-side
- AND the user sees a generic "could not send email" error message
- AND no unhandled exception propagates to the client

---

### Requirement: REQ-002 Magic Link Authentication

Clicking a valid, unexpired magic link MUST create an authenticated session identical in structure and privileges to a Google OAuth session.

#### Scenario: User clicks a valid unexpired link

- GIVEN the user received a magic link email and the token has not expired
- WHEN the user navigates to the magic-link callback URL
- THEN Better Auth validates the token
- AND creates a session row in the `session` table
- AND sets the session cookie
- AND redirects the user to the originally requested path (or `/` if none)
- AND `Astro.locals.user` and `Astro.locals.session` are populated on subsequent requests

#### Scenario: Magic link is used a second time

- GIVEN the user has already consumed a magic link token
- WHEN the user navigates to the same magic-link callback URL again
- THEN Better Auth rejects the token as already used
- AND returns an error response (invalid or expired link page)
- AND no new session is created

---

### Requirement: REQ-003 Expired or Invalid Link

An expired or malformed magic link MUST surface a clear, actionable error page. The user MUST be able to request a new link from that same page without navigating back manually.

#### Scenario: User clicks an expired link

- GIVEN the magic link token has surpassed `MAGIC_LINK_EXPIRY_SECONDS` seconds since issuance
- WHEN the user navigates to the callback URL
- THEN Better Auth rejects the token
- AND the user sees an error message indicating the link has expired
- AND a "Request a new link" call-to-action is visible that navigates to `/login`

#### Scenario: User clicks a malformed or tampered link

- GIVEN the callback URL contains an invalid or nonexistent token
- WHEN the user navigates to that URL
- THEN Better Auth rejects the token
- AND the user sees an error message indicating the link is invalid
- AND a "Request a new link" call-to-action is visible that navigates to `/login`

---

### Requirement: REQ-004 Account Linking

If the submitted email is already associated with a user who signed in via Google, Better Auth MUST resolve to that existing user row. No duplicate user record MUST be created.

#### Scenario: Magic link for an email already registered via Google

- GIVEN a user with email `alice@example.com` previously authenticated via Google OAuth
- AND a `user` row exists with that email
- WHEN `alice@example.com` requests and clicks a magic link
- THEN Better Auth resolves the login to the existing `user` row
- AND no new `user` row is created
- AND the resulting session has the same `userId` as the Google-linked account

#### Scenario: Magic link for a brand-new email

- GIVEN no user exists with email `newuser@example.com`
- WHEN `newuser@example.com` requests and clicks a magic link
- THEN Better Auth creates a new `user` row for that email
- AND creates a new `session` row
- AND the user is authenticated as a new account

---

### Requirement: REQ-005 Login Page Dual Options

The `/login` page MUST present both the Google OAuth button and the magic-link email form simultaneously. Neither option MUST be hidden or degraded based on the user's browser environment.

#### Scenario: Login page renders both auth methods

- GIVEN the user is not authenticated
- WHEN the user navigates to `/login`
- THEN a "Continue with Google" button is visible
- AND an email input field with a "Send magic link" submit button is also visible

#### Scenario: Authenticated user visits login page

- GIVEN the user has an active session
- WHEN the user navigates to `/login`
- THEN the user is redirected to `/courses` (unchanged from existing behavior per better-auth REQ-001)

---

### Requirement: REQ-006 Configurable Link Expiry

The magic link token lifetime MUST be controlled by the `MAGIC_LINK_EXPIRY_SECONDS` environment variable. A value of `0` MUST disable expiration entirely.

#### Scenario: Default expiry of 30 minutes

- GIVEN `MAGIC_LINK_EXPIRY_SECONDS` is not set
- WHEN a magic link is issued
- THEN the token expires after 1800 seconds (30 minutes)

#### Scenario: Custom expiry value

- GIVEN `MAGIC_LINK_EXPIRY_SECONDS` is set to `3600`
- WHEN a magic link is issued
- THEN the token expires after 3600 seconds (60 minutes)

#### Scenario: No expiry when value is zero

- GIVEN `MAGIC_LINK_EXPIRY_SECONDS` is set to `0`
- WHEN a magic link is issued
- THEN the token does NOT expire regardless of elapsed time

---

### Requirement: REQ-007 Route Protection Unchanged

The existing middleware session guard for `/courses/*` MUST continue to function without modification. A magic-link session MUST satisfy the guard identically to a Google OAuth session.

#### Scenario: Unauthenticated user redirected regardless of auth method

- GIVEN the user has no active session
- WHEN the user navigates to any path under `/courses`
- THEN the middleware redirects to `/login?redirect=<original-path>`
- AND this behavior is independent of which auth method the user would use

#### Scenario: Magic-link session grants access to /courses

- GIVEN the user authenticated via magic link and has an active session
- WHEN the user navigates to `/courses` or any `/courses/[slug]` path
- THEN the page renders without redirection
- AND the session check uses `Astro.locals.session` (unchanged)
