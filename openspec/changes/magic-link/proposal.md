# Proposal: magic-link

## Problem

WebView browsers embedded inside native apps — Instagram, WhatsApp, TikTok, Facebook Messenger — block Google OAuth with the error `403: disallowed_useragent`. Google deliberately rejects sign-in attempts coming from embedded WebViews to prevent credential phishing.

Because a large share of the blog's traffic arrives via links shared on social media (Instagram bio, WhatsApp messages, TikTok), those users land in an in-app WebView. When they try to log in to access protected content (e.g. `/courses/*`), the only available method is Google OAuth, which fails. The result is a hard dead end: the user cannot authenticate at all and abandons the session.

There is currently no fallback authentication path. Google OAuth is the single sign-in option in `src/lib/auth.ts` and `src/pages/login.astro`.

## Proposed Solution

Add the **Better Auth magic link plugin** — a passwordless, email-based login flow that works in every browser, including embedded WebViews where OAuth is blocked.

The flow:

1. On the login page, the user enters their email and requests a magic link.
2. Better Auth generates a single-use, time-limited token and triggers a `sendMagicLink` callback.
3. The callback sends the email through **Resend** (free tier, up to ~3k emails/month).
4. The user clicks the link; Better Auth verifies the token and creates an authenticated session.

Magic link **complements** Google OAuth rather than replacing it. The login page shows both options so the user can choose whichever works in their environment. If a user who previously signed in with Google requests a magic link for the same email, Better Auth links the magic link to the **existing user** (account linking) rather than creating a duplicate.

Configuration:
- Link expiration defaults to **30 minutes**, configurable via `MAGIC_LINK_EXPIRY_SECONDS`. A value of `0` means no expiration.
- Resend API key supplied via `RESEND_API_KEY` env var; sender address via `RESEND_FROM_EMAIL` (or equivalent).

## Scope

### In scope

- Install and configure the Better Auth `magicLink` plugin in `src/lib/auth.ts`.
- Integrate the Resend SDK as the email transport for the `sendMagicLink` callback.
- Add a magic-link request form (email input + submit) to `src/pages/login.astro`, alongside the existing Google button.
- Add UI feedback states: "check your email" confirmation, and error handling for invalid/expired links.
- Account linking so a magic-link login for an email already registered via Google resolves to the same user.
- Configurable expiration via `MAGIC_LINK_EXPIRY_SECONDS` (default 1800s, `0` = no expiry).
- Environment variables for Resend (`RESEND_API_KEY`, sender address) documented in env config.
- Verify the existing `verification` table supports magic-link tokens; add a migration only if Better Auth requires schema changes.

### Out of scope

- Password-based (email + password) authentication.
- Other social providers beyond the existing Google OAuth.
- Custom branded HTML email templates beyond a minimal functional template (can be a follow-up).
- Rate limiting / abuse protection beyond Better Auth defaults (noted as a risk; hardening is a follow-up).
- Migrating away from Google OAuth — it remains a first-class option.
- Email domain verification setup in Resend (operational/DNS task, tracked separately but required for production sending).

## Capabilities

After this change, a user will be able to:

- Log in by entering their email and clicking a magic link, with no password and no Google account required.
- Authenticate successfully from inside Instagram, WhatsApp, and TikTok WebViews where Google OAuth returns `403 disallowed_useragent`.
- Choose between Google OAuth and magic link on the same login page.
- Access protected routes (`/courses/*`) after a magic-link session is established, identical to an OAuth session.
- Reuse a single account: requesting a magic link for an email already linked to Google logs into the same user, not a duplicate.

## Affected Areas

- `src/lib/auth.ts` — add `magicLink` plugin with `sendMagicLink` callback and expiry config; wire account linking.
- `src/pages/login.astro` — add email input + magic-link request form and confirmation/error UI alongside the Google button.
- `src/pages/api/auth/[...all].ts` — no change expected (catch-all already routes Better Auth endpoints), to be confirmed.
- Email transport — new module for the Resend client (e.g. `src/lib/email.ts` or inline in `auth.ts`).
- Environment configuration — add `RESEND_API_KEY`, sender address, `MAGIC_LINK_EXPIRY_SECONDS`.
- `package.json` — add `resend` dependency.
- Drizzle schema / migrations — only if Better Auth magic link requires changes to the existing `verification` table.
- `src/middleware.ts` — no change expected (guards by session, agnostic to auth method), to be confirmed.

## Dependencies

- **Better Auth magic link plugin** — built into `better-auth` (`better-auth/plugins`), already at `^1.6.14`. No new auth package needed.
- **Resend SDK** — new dependency (`resend`), used inside the `sendMagicLink` callback.
- **Resend account + API key** — free tier (~3k emails/month) and a verified sender domain/address for production delivery.

## Risks

- **Account linking edge cases**: matching by email can create duplicate users or fail to link if email casing/normalization differs, or if Better Auth's linking behavior for magic link vs. social differs from expectation. Must verify Better Auth resolves the same `user` row for a Google-registered email.
- **Email deliverability**: magic links may land in spam or be delayed, blocking login. Requires a verified Resend sender domain (SPF/DKIM) for reliable delivery; the default Resend onboarding domain is not suitable for production.
- **Resend free tier limits**: ~3k emails/month and daily caps. A traffic spike or abuse could exhaust the quota and silently break login for all users.
- **No rate limiting**: without throttling, the magic-link endpoint can be abused to spam an inbox or burn the email quota.
- **Token expiry UX**: a 30-minute window plus email latency can leave users with expired links; needs clear "request a new link" error handling.
- **Secret management**: `RESEND_API_KEY` must be configured in Vercel env (not committed). Missing/invalid key fails the send silently unless handled.

## Success Criteria

- A user can request a magic link from `/login`, receive the email, click it, and land in an authenticated session.
- A user inside an Instagram/WhatsApp/TikTok WebView can complete the magic-link flow end-to-end (no `403 disallowed_useragent`).
- Requesting a magic link for an email already registered via Google logs into the **same** user account (no duplicate user row created).
- Magic links expire after `MAGIC_LINK_EXPIRY_SECONDS` (default 30 min); expired/invalid links show a clear error and a way to request a new one.
- Google OAuth continues to work unchanged for users in compatible browsers.
- Protected routes (`/courses/*`) are accessible after a magic-link session, identical to an OAuth session.
- `npm run build` and existing E2E/auth flows pass with the plugin enabled.
