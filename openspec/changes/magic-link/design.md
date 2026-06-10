# Design: magic-link

## Architecture Overview

The magic link feature adds a passwordless, email-based authentication path that
coexists with the existing Google OAuth flow. It is built entirely on first-party
Better Auth machinery (`magicLink` plugin from `better-auth/plugins`, already
available at `better-auth@^1.6.14`) plus the Resend SDK as the email transport.

### Integration with the existing Better Auth setup

`src/lib/auth.ts` currently configures a single `betterAuth(...)` instance with the
Drizzle adapter, a `secret`, a `baseURL`, and `socialProviders.google`. The magic
link plugin is purely additive:

- Add a `plugins: [magicLink({ ... })]` array to the existing `betterAuth(...)`
  config object. No existing field is modified.
- The plugin registers two new server endpoints on the same Better Auth handler
  that the catch-all route (`src/pages/api/auth/[...all].ts`) already serves:
  - `POST /api/auth/sign-in/magic-link` — accepts `{ email, callbackURL }`,
    generates a single-use token, persists it in the `verification` table, and
    invokes the `sendMagicLink` callback.
  - `GET /api/auth/magic-link/verify?token=...&callbackURL=...` — validates the
    token, creates the `user` (if new) and `session` rows, sets the session
    cookie, and redirects to `callbackURL`.
- No change to `src/pages/api/auth/[...all].ts` is needed — the `ALL` handler
  already forwards every `/api/auth/*` request into `auth.handler(request)`, so the
  new plugin endpoints are routed automatically. (Confirmed by reading the file.)
- No change to `src/middleware.ts` is needed — the guard checks
  `Astro.locals.session` and is agnostic to how the session was created. A
  magic-link session is structurally identical to an OAuth session.

### Where the Resend client lives — `src/lib/email.ts` (new)

A new module `src/lib/email.ts` owns the Resend integration. This keeps the email
transport a single, testable, replaceable concern, separate from auth wiring
(Scope Rule: this logic is used only by the magic-link callback today, but email
sending is a cross-cutting capability that warrants its own module rather than
inlining a network client inside `auth.ts`).

It exports:
- A lazily-constructed Resend client (instantiated from `RESEND_API_KEY`).
- `sendMagicLinkEmail({ email, url })` — a thin helper that builds a minimal
  functional HTML email and calls `resend.emails.send(...)`. It catches and logs
  Resend failures server-side and rethrows a sanitized error so the auth layer
  surfaces a generic "could not send email" response (REQ-001, missing-key
  scenario).

`auth.ts` imports `sendMagicLinkEmail` and calls it from inside the plugin's
`sendMagicLink` callback. `auth.ts` never imports the `resend` SDK directly.

### Account linking strategy

Better Auth resolves accounts by **email match** out of the box. When the
`magic-link/verify` endpoint runs, the plugin looks up an existing `user` row by
the verification `identifier` (the email). If a row exists (e.g. created earlier by
Google OAuth), the session is attached to that same `userId`; no duplicate `user`
row is created. For a brand-new email, a new `user` row is created. This satisfies
REQ-004 without custom code.

Caveat handled in design: email casing/normalization. Better Auth stores and
matches the email as provided by the plugin. To avoid casing-based duplicate users,
the login form normalizes the email to lowercase + trim before submission, and the
`sendMagicLink` callback receives the same normalized value. This is the
deterministic guard against the account-linking edge case flagged as a risk in the
proposal.

### How `MAGIC_LINK_EXPIRY_SECONDS=0` (no expiry) is handled

The `magicLink` plugin accepts an `expiresIn` option (seconds). The config logic
lives in `auth.ts` as a small pure resolver:

```
const raw = readEnv('MAGIC_LINK_EXPIRY_SECONDS');
const parsed = raw === undefined ? 1800 : Number(raw);
// 0 means "no expiry": use a very large value (effectively infinite)
const expiresIn = parsed === 0 ? 60 * 60 * 24 * 365 * 100 : parsed; // ~100 years
```

Rationale: Better Auth requires a finite `expiresIn`; there is no native
"never expires" sentinel. We map `0` to a 100-year window, which is operationally
indistinguishable from "no expiry" for a magic link. The resolver is extracted into
a pure exported function `resolveMagicLinkExpiry(raw: string | undefined): number`
so it can be unit-tested in isolation (REQ-006).

## Data Flow

```
 ┌──────────┐   1. POST /api/auth/sign-in/magic-link        ┌──────────────────┐
 │  Browser │ ─────────{ email, callbackURL }─────────────► │  Better Auth     │
 │ (login   │                                               │  magicLink plugin│
 │  page)   │                                               └────────┬─────────┘
 └────┬─────┘                                                        │
      │                                          2. generate token,  │
      │                                             INSERT into      ▼
      │                                          ┌──────────────────────────┐
      │                                          │ verification table (Turso)│
      │                                          │ identifier=email          │
      │                                          │ value=token               │
      │                                          │ expires_at=now+expiresIn  │
      │                                          └──────────────────────────┘
      │                                                        │
      │                                3. sendMagicLink({ email, url, token })
      │                                                        ▼
      │                                          ┌──────────────────────────┐
      │                                          │ src/lib/email.ts          │
      │                                          │ sendMagicLinkEmail()      │
      │                                          └────────────┬──────────────┘
      │                                                       │ 4. resend.emails.send
      │                                                       ▼
      │                                          ┌──────────────────────────┐
      │  5. "check your email" confirmation      │  Resend API → user inbox  │
      │ ◄────────────────────────────────────    └────────────┬──────────────┘
      │                                                        │
      │                              6. user clicks link in email
      │                                                        ▼
      │  7. GET /api/auth/magic-link/verify?token=...&callbackURL=...
      └──────────────────────────────────────────────────────►┐
                                                               │
                              8. validate token (lookup in verification,
                                 check not expired, not used),
                                 resolve/create user (email match),
                                 INSERT session, set cookie, DELETE token
                                                               │
                                                               ▼
                              9. 302 redirect → callbackURL (e.g. /courses)
                                 Astro.locals.{user,session} populated on
                                 subsequent requests via middleware.
```

## File Implementation Plan

### `src/lib/email.ts` — NEW

Create the Resend transport module.

- Import `Resend` from `resend`.
- Read `RESEND_API_KEY` and `RESEND_FROM_EMAIL` via the project's existing env
  pattern: `import.meta.env.X ?? process.env.X` (matches `db.ts` / `auth.ts`).
- Export `function getResend(): Resend` — lazy singleton, constructed from the API
  key. Throws a clear error if the key is missing (caught upstream).
- Export `async function sendMagicLinkEmail(params: { email: string; url: string }): Promise<void>`:
  - Builds a minimal HTML body: a heading, one sentence, and an anchor button to
    `url`, plus the raw URL as fallback text.
  - Calls `getResend().emails.send({ from: RESEND_FROM_EMAIL, to: email, subject, html })`.
  - Wraps the call in try/catch: on failure, `console.error(...)` server-side and
    rethrow a generic `Error('Failed to send magic link email')`.
- All copy/identifiers in English (subject line may be Spanish-neutral to match the
  Spanish-language login UI; default to a neutral professional Spanish subject like
  "Tu enlace de acceso" since the site UI is Spanish).

### `src/lib/auth.ts` — MODIFIED

- Add import: `import { magicLink } from 'better-auth/plugins';`
- Add import: `import { sendMagicLinkEmail } from './email';`
- Add an exported pure helper (top of file, before `betterAuth(...)`):
  ```ts
  export function resolveMagicLinkExpiry(raw: string | undefined): number {
    if (raw === undefined || raw === '') return 1800;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return 1800;
    if (n === 0) return 60 * 60 * 24 * 365 * 100; // no expiry
    return n;
  }
  ```
- Inside the existing `betterAuth({ ... })` object, add a `plugins` array:
  ```ts
  plugins: [
    magicLink({
      expiresIn: resolveMagicLinkExpiry(
        import.meta.env.MAGIC_LINK_EXPIRY_SECONDS ?? process.env.MAGIC_LINK_EXPIRY_SECONDS
      ),
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
    }),
  ],
  ```
- Leave `database`, `secret`, `baseURL`, `socialProviders` untouched.

### `src/pages/login.astro` — MODIFIED

- **Markup**: below the existing `#btn-google` button, add:
  - A visual divider ("o" / "or").
  - A `<form id="form-magic">` with a labelled `<input type="email" id="ml-email" required>`
    and a submit `<button id="btn-magic">Enviar enlace de acceso</button>`.
  - A hidden confirmation block `#magic-confirm` ("Revisá tu email — te enviamos un
    enlace de acceso a <email>"), shown after a successful request.
  - A hidden inline error block `#magic-error` for the "could not send email" case.
- **Script** (`define:vars={{ redirect }}`, extend existing inline script):
  - On submit: `preventDefault`, read + normalize email (`trim().toLowerCase()`),
    HTML5 `required`/`type=email` covers the blank/invalid case (REQ-001 blank
    scenario) — guard explicitly too.
  - Disable button, POST to `/api/auth/sign-in/magic-link` with
    `{ email, callbackURL: redirect }`.
  - On `res.ok`: hide the form, show `#magic-confirm` with the email.
  - On non-ok / network error: re-enable button, show `#magic-error`.
- **Styles**: add `.divider`, `.field`, `.btn-magic`, `.magic-confirm`,
  `.magic-error`, reusing existing CSS custom properties (`--accent`, `--border`,
  `--text-*`, `--font-*`). Keep the dual-option layout (REQ-005).
- The Google button and its handler remain unchanged.

### Expired/invalid link UX (REQ-003)

Better Auth's `magic-link/verify` endpoint redirects to an error `callbackURL` on
failure. Configure the plugin/login flow so verification failures land on
`/login?error=magic-link` (Better Auth supports an `errorCallbackURL` or query
param convention — confirm exact option name during apply). `login.astro` reads
`Astro.url.searchParams.get('error')`; when `=== 'magic-link'`, it renders an error
banner with a "Solicitar un nuevo enlace" CTA (the form itself, already on the
page). No separate page is created.

### `package.json` — MODIFIED

- Add `"resend"` to `dependencies` (latest stable, e.g. `^4.x`). Run
  `npm install resend` so the lockfile updates.

### Environment variables needed

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `RESEND_API_KEY` | Yes (prod) | — | Authenticates the Resend SDK. |
| `RESEND_FROM_EMAIL` | Yes (prod) | — | Verified sender address (e.g. `acceso@dominio.com`). Must be on a Resend-verified domain for production deliverability. |
| `MAGIC_LINK_EXPIRY_SECONDS` | No | `1800` | Token lifetime in seconds; `0` = no expiry. |

Add these to Vercel project env and to any local `.env` / env documentation. They
follow the existing `import.meta.env.X ?? process.env.X` access pattern. No secret
is committed.

## TDD Strategy

**Strict TDD is ACTIVE.** Write the failing test first, then the minimum code to
pass, then refactor.

### Unit tests (Vitest) — `src/lib/*.test.ts`

1. **`src/lib/auth.test.ts` — `resolveMagicLinkExpiry`** (REQ-006). Pure function,
   no mocks needed:
   - `undefined` → `1800`
   - `''` → `1800`
   - `'3600'` → `3600`
   - `'0'` → a value `> 1800` and very large (assert `>= 60*60*24*365`)
   - `'-5'` / `'abc'` → falls back to `1800`
   Write these tests BEFORE adding the function to `auth.ts`.

2. **`src/lib/email.test.ts` — `sendMagicLinkEmail`** (REQ-001). Mock the `resend`
   module with `vi.mock('resend', ...)`:
   - Happy path: calls `resend.emails.send` once with `to === email`, `from ===`
     the configured sender, and an `html` string containing the `url`.
   - Resend throws → `sendMagicLinkEmail` rejects with a generic error AND
     `console.error` was called (spy). Asserts no raw Resend error leaks.
   - Missing `RESEND_API_KEY` → `getResend()` throws a clear error (stub env via
     `vi.stubEnv`).

   Note: `auth.ts` imports `email.ts`, and `auth.ts` constructs the full Better
   Auth instance (which touches the DB adapter at import time). To keep
   `email.test.ts` isolated, test `email.ts` directly — do NOT import `auth.ts`
   from the email unit test.

### E2E tests (Playwright) — `tests/e2e/magic-link.spec.ts`

The full flow without reading a real inbox. The token interception strategy
(see ADR-003):

1. Navigate to `/login`, assert both the Google button and the email form render
   (REQ-005).
2. Fill the email field, submit. Assert the "check your email" confirmation appears
   (REQ-001).
3. **Intercept the token**: query the Turso `verification` table directly using the
   libSQL client (the same `getDb()` / `@libsql/client` the app uses), reading the
   most recent row whose `identifier` equals the test email; extract `value`
   (the token). Build the verify URL:
   `/api/auth/magic-link/verify?token=<value>&callbackURL=/courses`.
4. `page.goto(verifyUrl)`. Assert redirect to `/courses` and that a session cookie
   is set / protected content renders (REQ-002, REQ-007).
5. **Reuse test** (REQ-002 second-use scenario): visit the same verify URL again,
   assert it does NOT grant a new session (error/invalid).
6. **Account-linking assertion** (REQ-004): after verify, query the `user` table by
   email and assert exactly one row; for the "existing Google user" case, seed a
   `user` row with the email first, run the flow, assert no duplicate row and the
   session `userId` matches the seeded row.
7. **Expired-link UX** (REQ-003): hit the verify endpoint with a bogus/expired
   token, assert redirect to `/login?error=magic-link` and that the error banner +
   "request a new link" CTA render.

E2E tests run against the dev/preview server with real env (test Resend key may be
present but email delivery is never asserted — only the token row matters). Use a
unique per-run email (e.g. `magic+<timestamp>@example.com`) to avoid cross-test
contamination, and clean up `verification`/`user`/`session` rows for that email in
test teardown.

## ADR

### ADR-001: Resend over SendGrid / Nodemailer

**Decision:** Use Resend as the email transport.

**Context:** The `sendMagicLink` callback needs a transactional email provider.
Candidates: Resend, SendGrid, Nodemailer (raw SMTP).

**Rationale:**
- **Nodemailer/SMTP**: requires running/maintaining or contracting an SMTP server,
  manages no deliverability/DKIM tooling, and SMTP from serverless (Vercel)
  functions is unreliable (cold starts, connection pooling, often blocked ports).
  Rejected.
- **SendGrid**: capable, but heavier SDK, more setup friction, and its free tier and
  onboarding are more cumbersome for a small blog.
- **Resend**: minimal SDK (`resend.emails.send`), first-class serverless/Vercel
  story, free tier ~3k emails/month (sufficient for this blog's volume), simple
  domain verification (SPF/DKIM). Already named as the intended provider in the
  proposal.

**Consequences:** Bound to Resend's free-tier quota (a flagged risk) and to having a
verified sender domain for production. The transport is isolated in
`src/lib/email.ts`, so swapping providers later is a one-file change.

### ADR-002: Inline form in `login.astro` over a separate page

**Decision:** Add the magic-link email form inline on `/login`, alongside the Google
button, rather than creating a separate `/login/magic-link` route.

**Context:** REQ-005 requires both auth methods visible simultaneously with neither
hidden or degraded by browser environment.

**Rationale:**
- A single page lets the user pick either method without navigation — critical for
  WebView users who cannot use Google at all and must immediately see the working
  fallback.
- Avoids a redirect hop and a second page's layout/SEO/styling duplication.
- The confirmation and error states are simple DOM toggles on the same page; no
  routing needed.

**Consequences:** `login.astro` grows (form markup, a second script branch, styles).
Acceptable — it stays one self-contained page and follows the Scope Rule (login UI
is used by exactly one feature: the login page).

### ADR-003: Token interception strategy for E2E tests

**Decision:** In Playwright E2E, intercept the magic-link token by querying the
Turso `verification` table directly (via the libSQL client), NOT by reading a real
email inbox.

**Context:** The magic link arrives by email. Asserting on a real inbox (IMAP, a
catch-all mailbox, or a Resend webhook) is slow, flaky, and couples the test suite
to external delivery and quota.

**Rationale:**
- The token is persisted in `verification.value` before the email is even sent.
  Reading it from the DB is deterministic, fast, and fully under test control.
- Better Auth treats the token identically regardless of how the user obtained the
  URL, so a DB-sourced token exercises the exact same verify path (REQ-002).
- No dependency on Resend deliverability or a test mailbox; email sending can even
  be stubbed/allowed to fail without breaking the auth assertions.

**Alternatives considered:**
- Mailbox polling (mailosaur/mailpit): realistic but heavy, flaky, external dep.
- A test-only HTTP endpoint that returns the latest token: adds production attack
  surface unless gated behind an env flag; DB query keeps test concerns out of the
  app.

**Consequences:** E2E tests need libSQL client access with the same `TURSO_URL` /
`TURSO_TOKEN` the app uses (already available in the project). Tests must clean up
the rows they create. This is documented in the E2E spec setup.

## Migration Check

**Conclusion: NO new migration is required. The existing `verification` table is
sufficient.**

Better Auth's magic link plugin stores tokens in the standard `verification` table
using the core columns `identifier`, `value`, and `expiresAt` — the same table the
adapter already maps in `auth.ts` (`verification: schema.verification`).

Current Drizzle schema (`src/lib/schema.ts`, lines 184–191):

```ts
export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
```

This matches Better Auth's expected `verification` schema field-for-field
(`id`, `identifier`, `value`, `expiresAt`, optional `createdAt`/`updatedAt`). The
magic link plugin adds no extra columns and creates no new table — it reuses
`verification`. The `user`, `session`, and `account` tables are likewise unchanged.

No Drizzle migration, no `drizzle-kit` run, no Turso DDL needed for this change.

## Environment Variables

| Variable | Required | Default | Where read | Notes |
|----------|----------|---------|------------|-------|
| `RESEND_API_KEY` | Production: yes | none | `src/lib/email.ts` | Resend SDK auth. Missing key → caught, generic "could not send email" surfaced (REQ-001). Set in Vercel env, never committed. |
| `RESEND_FROM_EMAIL` | Production: yes | none | `src/lib/email.ts` | Verified sender on a Resend-verified domain (SPF/DKIM) for deliverability. |
| `MAGIC_LINK_EXPIRY_SECONDS` | No | `1800` | `src/lib/auth.ts` via `resolveMagicLinkExpiry` | Token lifetime in seconds. `0` = no expiry (mapped to ~100 years). Invalid/negative → falls back to 1800. |

Access pattern across all three follows the project convention already used in
`db.ts` and `auth.ts`: `import.meta.env.X ?? process.env.X`.
