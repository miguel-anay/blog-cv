# Tasks: Certification Exams Module

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1150-1250 (all new files; no deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes | Est. lines |
|------|------|-----------|-------|-----------|
| 1 | 6 exam components (leaf, no wiring) | PR 1 | Base: main/tracker; self-contained, mirrors CourseCard family | ~380 |
| 2 | QuizShell layout + listing/detail pages | PR 2 | Base: PR 1 branch; uses ExamCard | ~170 |
| 3 | 6 attempt API routes | PR 3 | Base: PR 2 branch (or independent of UI, ordered after for review flow); uses existing exam-api.ts | ~150 |
| 4 | attempt-controller.ts + attempt-taking page | PR 4 | Base: PR 3 branch; highest-risk, most coupled logic — kept as one reviewable unit | ~350 |
| 5 | Results page + E2E test + validate | PR 5 | Base: PR 4 branch; lowest risk, closes the loop | ~110 |

## Phase 0: Pre-SDD Foundation (verified complete against spec/design — no action)

- [x] 0.1 `src/lib/schema.ts` — 5 exam tables match Data Model exactly (types, FKs, unique index) — REQ-002/003/005/006/007
- [x] 0.2 `src/lib/api-types.ts` — all 7 exam types present and shaped per API Surface
- [x] 0.3 `src/lib/migrations/006_exams.sql` + `_rollback.sql` — table/index parity with schema confirmed
- [x] 0.4 `src/lib/exam-api.ts` — all 13 functions present, owner-scoped, match API Surface — REQ-001..008
- [x] 0.5 `timer.ts` + `timer.test.ts` — `computeRemainingSeconds`/`formatHms` + all listed test cases present — REQ-003
- [x] 0.6 `scoring.ts` + `scoring.test.ts` — `scoreAttempt` + all listed test cases present — REQ-007
- [x] 0.7 `src/middleware.ts` — `/exams` + `/api/exams` gating (401 JSON vs redirect) present — REQ-001

No discrepancies found; all DONE rows confirmed by direct file inspection, not just the design doc's claim.

## Phase 1: Components (leaf, no dependencies) — PR 1

- [ ] 1.1 `src/features/exams/components/ExamCard.astro` — mirror `CourseCard.astro` — REQ-001
- [ ] 1.2 `QuestionNavigator.astro` — numbered grid, `data-question-index/answered/flagged` — REQ-005
- [ ] 1.3 `QuestionCard.astro` — one per question, `hidden`-toggled — REQ-005/007
- [ ] 1.4 `AttemptToolbar.astro` — Flag/Pause/Back/Save&Next/Quiz Summary — REQ-004/006
- [ ] 1.5 `TimerDisplay.astro` — progress bar + HH:MM:SS, static `timer.ts` import — REQ-003
- [ ] 1.6 `ExamSummaryPanel.astro` — dual-use overlay (attempt) / static (results) — REQ-006/007

## Phase 2: Layout & Browsing Pages — PR 2

- [ ] 2.1 `src/layouts/QuizShell.astro` — minimal chrome, no Header/Footer
- [ ] 2.2 `src/pages/exams/index.astro` — mirror `courses/index.astro`, grid of `ExamCard` — REQ-001
- [ ] 2.3 `src/pages/exams/[slug].astro` — detail + `getAttemptHistory` + POST-form "Start exam" (hidden `examId`) — REQ-001/002/008

## Phase 3: Attempt API Routes — PR 3

- [ ] 3.1 `src/pages/api/exams/attempts/index.ts` POST — `createAttempt`, 302 redirect — REQ-002/008
- [ ] 3.2 `attempts/[id]/status.ts` GET — `getAttemptStatus` — REQ-003/008
- [ ] 3.3 `attempts/[id]/answers.ts` POST — `saveAnswer` upsert — REQ-005/008
- [ ] 3.4 `attempts/[id]/pause.ts` POST — `pauseAttempt` — REQ-004/008
- [ ] 3.5 `attempts/[id]/resume.ts` POST — `resumeAttempt`, returns fresh remaining — REQ-004/008
- [ ] 3.6 `attempts/[id]/submit.ts` POST — `submitAttempt`, `{ redirect }` — REQ-006/008

Every route: assert `locals.user.id === attempt.userId`, else 403 (no attempt data leaked).

## Phase 4: Attempt-Taking (highest risk, last) — PR 4

- [ ] 4.1 `src/features/exams/lib/attempt-controller.ts` — 1s tick + ~20s status resync, save-before-navigate, flag toggle, pause/resume input disable, Quiz Summary overlay, timeout auto-submit — REQ-003/004/005/006
- [ ] 4.2 `src/pages/exams/[slug]/attempt/[attemptId].astro` — SSR ownership check (404/redirect), redirect to results if submitted, `getExamQuestionsForAttempt` (no `isCorrect`), wire all Phase 1 components + controller `<script>` via `data-*` — REQ-002..008

## Phase 5: Results, E2E, Verification — PR 5

- [ ] 5.1 `src/pages/exams/[slug]/attempt/[attemptId]/results.astro` — ownership check, redirect if `submittedAt == null` (no auto-submit on GET), static `ExamSummaryPanel` — REQ-007/008
- [ ] 5.2 `tests/e2e/exam-flow.spec.ts` — mirror `courses-card-flow.spec.ts`: `/exams` redirects to login, no horizontal overflow, `/exams/nonexistent-slug` -> 404
- [ ] 5.3 Run `npm run validate` (typecheck + build) as final checkpoint; re-run after each phase per design's rollout note
