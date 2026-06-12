# Tasks: magic-link

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |

Decision needed before apply: No

---

## Phase 1: Dependencies
- [ ] 1.1 Install `resend` npm package

## Phase 2: Email module
- [ ] 2.1 Create src/lib/email.ts with Resend client
- [ ] 2.2 Implement resolveMagicLinkExpiry(seconds: number | undefined): number
- [ ] 2.3 Implement sendMagicLinkEmail(to, url) using Resend

## Phase 3: Unit tests (TDD — write before implementation)
- [ ] 3.1 Create src/lib/auth.test.ts for resolveMagicLinkExpiry
- [ ] 3.2 Test resolveMagicLinkExpiry: default=1800, 0=3153600000 (~100yr), custom value, invalid/negative → 1800
- [ ] 3.3 Create src/lib/email.test.ts
- [ ] 3.4 Test sendMagicLinkEmail: mocks Resend, verifies correct to/subject/html
- [ ] 3.5 Test sendMagicLinkEmail: Resend throws → generic error + console.error spy, no raw error leak
- [ ] 3.6 Test getResend: missing RESEND_API_KEY → throws clear error (vi.stubEnv)

## Phase 4: Auth plugin
- [ ] 4.1 Add magicLink plugin to src/lib/auth.ts
- [ ] 4.2 Wire sendMagicLink callback to sendMagicLinkEmail
- [ ] 4.3 Configure expiresIn from MAGIC_LINK_EXPIRY_SECONDS env var via resolveMagicLinkExpiry

## Phase 5: Login page
- [ ] 5.1 Add email input form to src/pages/login.astro
- [ ] 5.2 Add fetch POST to /api/auth/sign-in/magic-link with email normalization (trim + toLowerCase)
- [ ] 5.3 Add confirmation state ("Revisá tu email")
- [ ] 5.4 Add error state (expired/invalid link) to /login?error=magic-link

## Phase 6: E2E tests
- [ ] 6.1 Create tests/e2e/magic-link.spec.ts
- [ ] 6.2 Test: both Google button and email form visible on /login (REQ-005)
- [ ] 6.3 Test: request link → confirmation shown → token in Turso verification table → navigate to verify URL → session active + redirect to /courses (REQ-001, REQ-002)
- [ ] 6.4 Test: reuse token → error/invalid (REQ-002 second-use scenario)
- [ ] 6.5 Test: account linking — seed existing user row, run flow, assert no duplicate row and session userId matches (REQ-004)
- [ ] 6.6 Test: expired/bogus token → redirect to /login?error=magic-link → error banner + CTA renders (REQ-003)
- [ ] 6.7 Add per-test cleanup of verification/user/session rows for test email

## Phase 7: Environment & CI
- [ ] 7.1 Document RESEND_API_KEY, RESEND_FROM_EMAIL, MAGIC_LINK_EXPIRY_SECONDS in CI secrets docs and Vercel env setup notes

## Phase 8: Verification
- [ ] 8.1 npm run build passes
- [ ] 8.2 npm run test:unit passes
- [ ] 8.3 Create verify-report.md
- [ ] 8.4 Archive the change
