## Verification Report

**Change**: certification-exams
**Version**: N/A (spec has no version field)
**Mode**: Standard (no Strict TDD cached for blog-cv)
**Verified against**: `main` @ 0638bbc (all 5 PRs #17-#21 merged, GitHub issue #16 closed)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total (Engram artifact) | 21 (0.1-0.7, 1.1-1.6, 2.1-2.3, 3.1-3.6, 4.1-4.2, 5.1-5.3) |
| Tasks complete (Engram artifact) | 21/21, all marked [x] |
| Tasks complete (this repo's tasks.md file) | 7/21 — only Phase 0 is checked; Phases 1-5 (14 tasks) still show `[ ]` on disk |
| Tasks incomplete (verified against real code) | 0 — every unchecked file-based task item has a real, working file on `main` |

### Build & Tests Execution
**Build**: PASS
```
$ fnm use v20.20.2 && npm run validate
tsc --noEmit -> no errors
astro build -> Complete! (server build, vercel adapter, sitemap generated)
```

**Tests**: 25 passed / 0 failed (unit) — 12 passed / 0 failed (E2E, 4 Playwright projects x 3 tests)
```
$ npm run test:unit
Test Files  4 passed (4)
     Tests  25 passed (25)

$ npx playwright test tests/e2e/exam-flow.spec.ts
12 passed (18.6s)
```

**Coverage**: not configured (`test:unit:coverage` script exists but no run performed; not requested)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-001 | Unauthenticated page redirects to /login | `tests/e2e/exam-flow.spec.ts:27` | COMPLIANT |
| REQ-001 | Unauthenticated API returns 401 JSON | none found | UNTESTED (static: `src/middleware.ts:15-19` implements it correctly; easily testable without auth infra — gap, not a hard blocker) |
| REQ-002 | Resume in-progress attempt / unlimited retries | none found (deferred per design.md: "Authed flow deferred — no test-user infra") | UNTESTED (static: `createAttempt`/`getInProgressAttempt` in `exam-api.ts:105-157` implement it correctly) |
| REQ-003 | Server-authoritative remaining time, clamp, paused-freeze | `src/features/exams/lib/timer.test.ts` | COMPLIANT (pure-math core is unit-tested; full resync-over-HTTP scenario UNTESTED, same auth-infra gap) |
| REQ-004 | Pause disables inputs / freezes timer | none found | UNTESTED (static: `pauseAttempt`/`resumeAttempt` in `exam-api.ts:281-319`, `saveAnswer`'s paused-write guard at line 347, and `attempt-controller.ts`'s `setInputsDisabled` all correctly implement it) |
| REQ-005 | Autosave on any navigation / flag persists without answer | none found | UNTESTED (static: `attempt-controller.ts`'s `saveCurrentAnswerIfPresent` always POSTs including null selection, confirmed) |
| REQ-006 | Submit only from Quiz Summary or timeout | none found | UNTESTED (static: `submit.ts` only path besides `getAttemptStatus`'s lazy auto-finalize; no other route calls `submitAttempt`) |
| REQ-007 | No correctness leak pre-submit; results show full detail | `src/features/exams/lib/scoring.test.ts` | COMPLIANT (scoring math unit-tested; `getExamQuestionsForAttempt` confirmed to omit `isCorrect`/`explanation`; `getAttemptResult` confirmed to include them — static, no HTTP-level regression test) |
| REQ-008 | Ownership enforced at page (404) and API (403) level | none found | UNTESTED (static: `resolveOwnedAttemptId` in `_lib.ts` distinguishes 404 vs 403 correctly; every attempt page/route calls it or the page-level owner-scoped query) |

**Compliance summary**: 3/9 scenario-rows have a passing automated test (page-redirect gating + the two pure-logic cores). The remaining 6 are correctly implemented per direct source inspection but rely on an authenticated session that the design doc explicitly scoped out of E2E coverage ("Authed flow deferred — no test-user infra") before implementation began — a pre-existing, documented decision, not a regression discovered now.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-001 | Implemented | `middleware.ts` splits API (401 JSON) vs pages (redirect); `[slug].astro`/attempt/results pages re-check `locals.user` defensively |
| REQ-002 | Implemented | `createAttempt` reuses in-progress attempt via `getInProgressAttempt`; history retained via `getAttemptHistory` |
| REQ-003 | Implemented | `timer.ts`'s `computeRemainingSeconds` matches design's elapsed-math exactly; client anchors on resync per `attempt-controller.ts` |
| REQ-004 | Implemented | `pauseAttempt`/`resumeAttempt` freeze/unfreeze server clock; `saveAnswer` additionally rejects writes while paused (`{paused:true}`) — closes an anti-cheat gap that direct API calls could otherwise exploit |
| REQ-005 | Implemented | `answers.ts` always accepts null `selectedOptionId`; `saveCurrentAnswerIfPresent` posts on every navigation control |
| REQ-006 | Implemented | Only `submit.ts` (manual) and `getAttemptStatus`'s lazy finalize (timeout) call `submitAttempt` |
| REQ-007 | Implemented | `getExamQuestionsForAttempt` strips `isCorrect`/`explanation`; `results.astro` redirects if `submittedAt == null` without auto-submitting (side-effect-free GET) |
| REQ-008 | Implemented | Every `/api/exams/attempts/[id]/*` route uses `resolveOwnedAttemptId` (404 vs 403 split); attempt/results pages use owner-scoped `getAttemptById` |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Options relational, not JSON | Yes | `schema.ts` `exam_options` table, `isCorrect` never selected in attempt-path queries |
| Server-authoritative timer, `remaining = timeLimit - elapsed` excluding paused time | Yes | `timer.ts` matches design formula exactly, confirmed by `timer.test.ts` |
| Pure DB-free timer.ts/scoring.ts | Yes | Both files have zero DB imports |
| Raw SQL migration, no drizzle-kit | Yes | `006_exams.sql` + indexes match `schema.ts` field-for-field |
| All N questions SSR'd, `hidden`-toggled client-side | Yes | `[attemptId].astro` renders all `QuestionCard`s; controller toggles `.hidden` |
| Static `<script>` import, not `define:vars` | Yes | Confirmed in `[attemptId].astro`, matches the login.astro precedent the team already learned from |
| QuizShell minimal-chrome layout | Yes | No Header/Footer/MagneticCursor in `QuizShell.astro` |
| `/api/exams` -> 401 JSON; `/exams` -> redirect | Yes | `middleware.ts` splits by prefix list correctly |

### Issues Found

**CRITICAL**: None. Build, typecheck, all 25 unit tests, and all 12 E2E tests pass on `main`. All 4 previously-reported security fixes (paused-write guard in `saveAnswer`, 409-on-submit-while-paused in `submit.ts`, `isNotNull(exams.publishedAt)` filter in `getExams`, `.question-card[hidden]{display:none}` CSS override) are present and correct in the merged code — not lost in any squash-merge.

**WARNING**:
1. `openspec/changes/certification-exams/tasks.md` (file artifact) is stale — only Phase 0 rows are checked `[x]`; Phases 1-5 (14 task rows) still show `[ ]` even though the corresponding code is complete and merged, and the Engram tasks artifact correctly shows all 21 as `[x]`. This is a hybrid-store parity gap (apply wrote to Engram only, not the file). Should be synced before archive closes the change, so the on-disk artifact trail doesn't mislead a future reader.
2. No `apply-progress.md` or `state.yaml` file exists under `openspec/changes/certification-exams/` despite this project's hybrid artifact-store convention (other changes like `better-auth`, `lambda-api` have both). Same root cause as #1.
3. REQ-001's "unauthenticated API returns 401 JSON" scenario has no automated test, despite being testable without any auth/test-user infrastructure (unlike the other 6 untested scenarios, which genuinely need a seeded session). A quick fetch-based assertion against e.g. `/api/exams/attempts/1/status` with no cookies would close this gap cheaply.
4. REQ-002, REQ-004, REQ-005, REQ-006, REQ-008, and the resync half of REQ-003 have no automated coverage. This was an explicit, pre-implementation design decision ("Authed flow deferred — no test-user infra" in design.md's Testing section), consistently honored and documented through apply and again in the E2E test's own comments — not a silently-dropped requirement. Recommend a fast-follow to add seeded-session integration/E2E coverage before this module accumulates more surface area, since it's currently the only correctness signal after this verify pass is static-only.

**SUGGESTION**:
1. Header.astro's nav array has no `/exams` entry yet — confirmed genuinely out of scope for tasks.md's Phase 5 (not a missed task), but worth a fast-follow so the feature is discoverable from primary nav.
2. Consider a lightweight seeded-auth Playwright fixture (even a single hardcoded test user via direct DB insert + session cookie) to unlock the 6 UNTESTED scenarios above — the app architecture doesn't block this, it's purely a test-infra investment the design doc deferred.

### Verdict
**PASS WITH WARNINGS**
All code on `main` correctly and completely implements the certification-exams spec (REQ-001..008) and design decisions; build/typecheck/unit/E2E all green; all 4 previously-reported security fixes survived the merges intact. Warnings are two artifact-hygiene gaps (stale file-based tasks.md / missing openspec progress files under the hybrid store) and a documented, pre-scoped test-coverage gap for authenticated flows — none block correctness, but the artifact-hygiene items should be fixed before archive.
