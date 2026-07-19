# Proposal: Certification Exams Module

## Intent

Add a login-gated "certification exams" feature modeled on AWS practice-exam UIs: numbered question navigator, server-authoritative countdown timer (default 5400s / 1h30m), one radio-option question at a time, Flag/Pause/Back/Save&Next/Quiz Summary controls, and a post-submit results screen. Gives the site a self-assessment surface reusing the existing auth + SSR stack.

## Scope

### In Scope
- 5 Drizzle tables (`exams`, `exam_questions`, `exam_options`, `exam_attempts`, `exam_answers`) in `src/lib/schema.ts`; options as a relational table (not JSON) to hide `isCorrect` during attempts.
- Hand-written SQL migration `006_exams.sql` + rollback (raw-SQL convention, no drizzle-kit).
- `src/lib/exam-api.ts` data-access (first write flow in the module) + pure DB-free `timer.ts` / `scoring.ts`.
- SSR pages under `src/pages/exams/` (listing, detail/start, attempt, results) + write API routes under `src/pages/api/exams/attempts/...` (create, autosave, pause/resume, submit).
- Components in `src/features/exams/components/` + minimal-chrome `src/layouts/QuizShell.astro`.
- Vanilla-TS `attempt-controller.ts` via static `<script>` import (NOT `define:vars`).
- `src/middleware.ts` gating: `/exams` pages redirect to login, `/api/exams` returns 401 JSON.
- Unit tests (timer, scoring) + light Playwright smoke tests.

### Out of Scope
- Admin/authoring UI (seed exams via direct SQL, like courses).
- Multi-select questions (`allowMultiple` column reserved, unused in v1).
- In-attempt feedback (correct/incorrect shown only post-submit).
- Authenticated E2E flow (needs test-user/session infra absent for courses too) — fast-follow.

## Capabilities

### New Capabilities
- `certification-exams`: browse exams, take timed attempts with pause/resume, autosave answers, submit, view scored results.

### Modified Capabilities
- None (middleware gating extends existing behavior without changing course requirements).

## Approach

Mirror the flat `src/features/courses/` pattern (components + lib, no hexagonal layering). Timer/scoring are pure and server-authoritative; `remaining = timeLimit - (now - startedAt - pausedSeconds)`, frozen while paused. Unlimited retries, attempt history retained. Submit occurs from Quiz Summary or on timeout — no toolbar submit button. Every API handler validates `locals.user.id === attempt.userId`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/schema.ts`, `api-types.ts` | Modified | 5 tables + result types |
| `src/lib/migrations/006_exams*.sql` | New | Migration + rollback |
| `src/lib/exam-api.ts`, `src/features/exams/` | New | Data access, components, controller |
| `src/pages/exams/`, `src/pages/api/exams/` | New | SSR pages + write routes |
| `src/layouts/QuizShell.astro`, `src/middleware.ts` | New/Modified | Layout + gating |

## Current State (Partial Work In Progress)

Implementation started outside SDD before being stopped. Present in the working tree: `schema.ts`, `api-types.ts`, `middleware.ts` (modified), `exam-api.ts`, `006_exams.sql` (+rollback), `src/features/exams/` (partial). Downstream `sdd-tasks` MUST reconcile against this partial state, not assume a clean slate.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Client timer drift / cross-tab submit | Med | ~20s resync against `GET status`; server is source of truth |
| Cheating via client (isCorrect leak) | Med | `isCorrect` excluded from attempt payload; scoring server-side |
| Partial pre-SDD code diverges from plan | Med | tasks phase reconciles working tree before adding work |
| `define:vars` static-import trap | Low | static top-level `<script>` import only |

## Rollback Plan

Run `006_exams_rollback.sql` (DROP tables reverse order); revert `middleware.ts` gating diff; delete new `src/features/exams/`, `src/pages/exams/`, `src/pages/api/exams/`, `exam-api.ts`, `QuizShell.astro`. No shared code altered.

## Dependencies

Existing Better Auth (`user.id` string FK), Turso/libSQL, `getDb()` pattern. Manual migration apply: `turso db shell <DB> < src/lib/migrations/006_exams.sql`.

## Success Criteria

- [ ] `npm run test:unit` passes (timer, scoring).
- [ ] `npm run validate` (typecheck + build) green.
- [ ] Unauthed `/exams` redirects to login; authed user can start, answer, flag, pause/resume, submit, and see a correct score.
- [ ] No correct/incorrect feedback exposed before submit.
