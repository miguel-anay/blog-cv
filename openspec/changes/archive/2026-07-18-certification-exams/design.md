# Design: Certification Exams Module

## Technical Approach

Greenfield feature, no hexagonal layering. Mirror the existing **flat `src/features/courses/` pattern** (`components/` + `lib/`) — the domain/application/infrastructure architecture in `blog-api/` is a separate, non-runtime service and is ignored entirely.

Server is the single source of truth for time and scoring:

- **Timer**: `remaining = timeLimitSeconds - elapsed`, where `elapsed` excludes paused time. The client recomputes locally every second for smoothness but resyncs against `GET status` (~20s) so drift and cross-tab submits self-correct.
- **Scoring**: computed server-side at submit from `exam_options.isCorrect`, which is NEVER sent to the client during an attempt. No correct/incorrect feedback is exposed before submit.
- **Attempts**: unlimited retries; a fresh `createAttempt` reuses an in-progress attempt for the same `(examId, userId)` if one exists. History retained.
- **Submit**: only from the Quiz Summary overlay or automatic on timeout. No toolbar submit button.
- **Ownership**: every API handler validates `context.locals.user.id === attempt.userId` (403 otherwise). Middleware only proves a session exists, not attempt ownership.

Follows existing project conventions: Drizzle `sqliteTable`, hand-written SQL migrations applied via `turso db shell` (no drizzle-kit), `getDb()` + try/catch data-access style, scoped `<style>` in `.astro`, existing CSS custom-property tokens (no new design vars), static top-level `<script>` imports (NOT `define:vars`).

## Implementation Status (pre-SDD partial work — MUST reconcile in tasks)

Implementation started outside SDD before formalization. Verified working-tree state:

| Artifact | Status | Notes for `sdd-tasks` |
|----------|--------|-----------------------|
| `src/lib/schema.ts` — 5 exam tables | **DONE** | `── Exams module ──` section present (L145+): `exams`, `examQuestions`, `examOptions`, `examAttempts`, `examAnswers` with the composite unique index. Verify against Data Model below; do not re-create. |
| `src/lib/api-types.ts` — result types | **DONE** | `ExamSummary`, `ExamDetail (=ExamSummary)`, `AttemptQuestion`, `ExamAttempt`, `ExamAttemptSummary`, `ExamResultQuestion`, `ExamResult` present. Verify field shapes; do not re-create. |
| `src/lib/migrations/006_exams.sql` + `_rollback.sql` | **DONE** | Both present. Verify table/index parity with schema; do not re-create. |
| `src/lib/exam-api.ts` | **DONE** | All 13 functions present (`getExams`, `getExamBySlug`, `getAttemptHistory`, `getInProgressAttempt`, `createAttempt`, `getAttemptById`, `getExamQuestionsForAttempt`, `getAttemptStatus`, `pauseAttempt`, `resumeAttempt`, `saveAnswer`, `submitAttempt`, `getAttemptResult`). Verify behavior against API Surface; do not re-create. |
| `src/features/exams/lib/timer.ts` + `timer.test.ts` | **DONE** | Verify tests cover the cases in Testing section. |
| `src/features/exams/lib/scoring.ts` + `scoring.test.ts` | **DONE** | Verify tests cover the cases in Testing section. |
| `src/middleware.ts` — gating | **DONE** | `protectedApiPrefixes = ['/api/exams']` and `protectedPagePrefixes = ['/courses', '/exams']` present. Verify 401-JSON vs redirect branches. |
| `src/features/exams/components/*.astro` | **TODO** | None exist yet. All 6 components new work. |
| `src/features/exams/lib/attempt-controller.ts` | **TODO** | Not present. Highest-risk piece. |
| `src/layouts/QuizShell.astro` | **TODO** | Not present. |
| `src/pages/exams/**` | **TODO** | Directory absent. All 4 pages new work. |
| `src/pages/api/exams/**` | **TODO** | Directory absent. All 6 API routes new work. |
| `tests/e2e/exam-flow.spec.ts` | **TODO** | Not present. |

Rule for tasks: treat DONE rows as **verify-and-reconcile** (assert parity with this design, patch drift), not as fresh authorship. Treat TODO rows as new work.

## Data Model

Five tables in `src/lib/schema.ts` (`── Exams module ──` section, mirroring `── Courses module ──`). Options live in a **relational table (`exam_options`), not JSON**, so `isCorrect` can be excluded from the attempt payload and scoring can run as a query — same precedent as `course_sections` / `course_resources`.

```
exams
  id, slug (unique), title, description, coverUrl,
  level            TEXT    default 'beginner'
  timeLimitSeconds INTEGER default 5400        -- 90 min
  passScorePercent INTEGER default 70
  publishedAt, createdAt, updatedAt

exam_questions
  id, examId (FK exams.id, cascade), order,
  prompt      TEXT
  explanation TEXT                              -- shown only post-submit
  allowMultiple BOOLEAN default false           -- reserved, unused in UI v1

exam_options
  id, questionId (FK exam_questions.id, cascade), order,
  text,
  isCorrect BOOLEAN default false               -- NEVER sent during attempt

exam_attempts
  id, examId (FK exams.id, cascade),
  userId TEXT (FK user.id, cascade)             -- text: Better Auth user.id is string
  timeLimitSeconds                              -- snapshot at attempt creation
  startedAt     TIMESTAMP
  pausedAt      TIMESTAMP NULL
  pausedSeconds INTEGER default 0
  submittedAt   TIMESTAMP NULL
  autoSubmitted BOOLEAN default false
  score, correctCount, totalQuestions           -- NULL until submit
  createdAt

exam_answers
  id, attemptId (FK exam_attempts.id, cascade),
  questionId (FK exam_questions.id, cascade),
  selectedOptionId (FK exam_options.id, NULL),
  flaggedForReview BOOLEAN default false,
  answeredAt TIMESTAMP NULL
  UNIQUE (attemptId, questionId)                -- one row per question per attempt; upsert
```

`userId` is `TEXT` because Better Auth `user.id` is a string — consistent with existing `session.userId` / `account.userId` FKs.

**Indexes** (in `006_exams.sql`): `exam_questions_exam_idx`, `exam_options_question_idx`, `exam_attempts_user_exam_idx`, and unique `exam_answers_attempt_question_idx`.

### Server-authoritative time math

```
if not paused:  elapsed = now - startedAt - pausedSeconds
if paused:      elapsed = pausedAt - startedAt - pausedSeconds   -- frozen
remaining = clamp(timeLimitSeconds - elapsed, >= 0)

on resume: pausedSeconds += now - pausedAt; pausedAt = null
```

## Architecture Decisions

### Decision: Options as a relational table, not JSON

- Choice: `exam_options` as its own table with FK to `exam_questions`.
- Alternatives: store options as a JSON array column on `exam_questions`.
- Rationale: `isCorrect` must be excludable from the attempt payload (anti-cheat) and scoring must be a server-side query. JSON would force loading correctness into the app layer and hand-filtering per request. Mirrors the existing `course_sections` / `course_resources` relational precedent.

### Decision: `src/lib/exam-api.ts` as a new module, not additions to `api.ts`

- Choice: new file `exam-api.ts`.
- Alternatives: extend `src/lib/api.ts`.
- Rationale: `api.ts` is read-only today. Exams introduce the module's first real write flow (attempts, answers, submit). A dedicated file keeps concerns separated while reusing the same `getDb()` + try/catch style.

### Decision: Pure DB-free timer/scoring modules

- Choice: `src/features/exams/lib/timer.ts` and `scoring.ts` are pure; `exam-api.ts` is the DB glue that delegates math to them.
- Alternatives: inline the math inside `exam-api.ts`.
- Rationale: pure functions are unit-testable without a DB and reusable client-side (the timer runs both on the server for authority and in the browser for smooth ticking). `attempt-controller.ts` imports the same `computeRemainingSeconds` the server uses.

### Decision: Raw-SQL migration, no drizzle-kit

- Choice: hand-written `006_exams.sql` + `006_exams_rollback.sql`, applied via `turso db shell`.
- Alternatives: drizzle-kit generated migrations.
- Rationale: matches the established convention (`004_better_auth.sql` style; rollback follows `003_course_type_rollback.sql`). `CREATE TABLE IF NOT EXISTS` forward, `DROP TABLE IF EXISTS` reverse-dependency-order rollback. Header carries the manual apply command.

### Decision: All N questions server-rendered up front, shown/hidden via JS

- Choice: SSR every question into the DOM once; navigate by toggling `hidden`.
- Alternatives: fetch one question at a time via API.
- Rationale: no per-question network round-trips, works with the SSR stack, keeps the controller simple. Trade-off: a page refresh resets the "current question" index to 1 (server-saved answers are NOT lost, only navigation position) — deliberate simplicity choice.

### Decision: `attempt-controller.ts` via static `<script>` import, never `define:vars`

- Choice: one `src/features/exams/lib/attempt-controller.ts` loaded by a static top-level `<script>` import; initial state passed via `data-*` attributes.
- Alternatives: inline `<script define:vars={...}>`.
- Rationale: `define:vars` scripts bypass Vite bundling and cannot use static imports — this trap was already hit in `login.astro`. Static import lets the controller reuse `timer.ts`.

### Decision: Minimal-chrome `QuizShell.astro`, not `BlogPost.astro`

- Choice: new layout without Header/Footer for the attempt and results screens.
- Rationale: an exam-taking surface should be distraction-free; reusing `BlogPost.astro` would inject site navigation into a timed test.

### Decision: `/api/exams` returns 401 JSON, `/exams` redirects to login

- Choice: split middleware prefixes — API prefix answers `401 JSON`, page prefix redirects to `/login?redirect=...`.
- Rationale: an HTML redirect is meaningless to a `fetch()` call. Pages get the normal login flow; API calls get a machine-readable 401.

## Data Flow

```
/exams (getExams)
   -> grid of ExamCard  --click-->  /exams/{slug}

/exams/{slug} (getExamBySlug, getAttemptHistory)
   -> detail + history
   -> "Start exam" = <form POST /api/exams/attempts> (examId hidden, no JS)
        -> createAttempt (reuse in-progress if any) -> 302 redirect

/exams/{slug}/attempt/{attemptId} (SSR)
   getAttemptById (ownership; 404/redirect if not owner)
   if submittedAt != null -> redirect to results
   getExamQuestionsForAttempt (NO isCorrect; hydrates saved answers)
   -> QuizShell + QuestionNavigator + N QuestionCards + AttemptToolbar + TimerDisplay
        attempt-controller.ts drives:
          - local 1s tick (computeRemainingSeconds) + ~20s GET status resync
          - navigation (saveCurrentAnswerIfPresent before switching)
          - flag toggle -> POST answers
          - pause/resume -> POST pause|resume (disable/enable radios+buttons)
          - Quiz Summary overlay -> POST submit -> redirect to results
          - timeout -> POST submit -> redirect

/exams/{slug}/attempt/{attemptId}/results (SSR)
   getAttemptResult (read-only, NO auto-submit)
   if submittedAt == null -> redirect back to attempt (keep GET side-effect-free)
   -> QuizShell + static ExamSummaryPanel (score, per-question correctness, explanations)
```

## API Surface

### Data access — `src/lib/exam-api.ts`

`getDb()` + try/catch style. All attempt-scoped reads/writes take `userId` and are owner-scoped.

| Function | Purpose |
|----------|---------|
| `getExams()` | List published exams (with question count) → `ExamSummary[]` |
| `getExamBySlug(slug)` | Exam detail → `ExamDetail \| null` |
| `getAttemptHistory(examId, userId)` | Prior attempts → `ExamAttemptSummary[]` |
| `getInProgressAttempt(examId, userId)` | Open attempt if any → `ExamAttempt \| null` |
| `createAttempt(examId, userId)` | Create, or reuse in-progress → `ExamAttempt \| null` |
| `getAttemptById(attemptId, userId)` | Owner-scoped fetch → `ExamAttempt \| null` |
| `getExamQuestionsForAttempt(examId)` | Questions + options WITHOUT `isCorrect`, hydrated with saved answers → `AttemptQuestion[]` |
| `getAttemptStatus(attemptId, userId, nowMs?)` | `{ remainingSeconds, paused, submitted, expired }` |
| `pauseAttempt(attemptId, userId)` | Set `pausedAt` → boolean |
| `resumeAttempt(attemptId, userId)` | Accumulate `pausedSeconds`, clear `pausedAt` → boolean |
| `saveAnswer(...)` | Upsert answer + flag; if time expired, auto-finalize → `{ expired: true }` |
| `submitAttempt(attemptId, userId, {auto?})` | Score + persist result |
| `getAttemptResult(attemptId, userId)` | Read-only result, NO auto-submit → `ExamResult \| null` |

### HTTP routes — `src/pages/api/exams/...`

`export const POST/GET: APIRoute` pattern (like `src/pages/api/auth/[...all].ts`). Each handler asserts `locals.user.id === attempt.userId` → 403 otherwise.

| Route | Method | Behavior |
|-------|--------|----------|
| `attempts/index.ts` | POST | Create/resume attempt → 302 redirect to attempt page |
| `attempts/[id]/status.ts` | GET | `{ remainingSeconds, paused, submitted, expired }` (periodic resync) |
| `attempts/[id]/answers.ts` | POST | Upsert `{ selectedOptionId, flaggedForReview }` |
| `attempts/[id]/pause.ts` | POST | Pause |
| `attempts/[id]/resume.ts` | POST | Resume → returns fresh `remainingSeconds` |
| `attempts/[id]/submit.ts` | POST | Finalize → `{ redirect }` to results |

### Result types — `src/lib/api-types.ts`

`ExamSummary`, `ExamDetail (= ExamSummary)`, `AttemptQuestion`, `ExamAttempt`, `ExamAttemptSummary`, `ExamResultQuestion`, `ExamResult`.

## Component Architecture

Components in `src/features/exams/components/` (all `.astro`, scoped `<style>`, existing tokens).

| Component | Props | Role |
|-----------|-------|------|
| `ExamCard.astro` | `{ title, description, slug, level, questionCount, timeLimitSeconds, index? }` | Mirror of `CourseCard.astro`; links to `/exams/{slug}` |
| `QuestionNavigator.astro` | `{ totalQuestions, initialStates: [{ index, answered, flagged }] }` | Numbered grid; buttons carry `data-question-index/answered/flagged`; "current" is client-only state |
| `QuestionCard.astro` | `{ questionId, index, prompt, options: [{ id, text }], selectedOptionId, total }` | One per question, `hidden` toggled by JS |
| `AttemptToolbar.astro` | `{ totalQuestions }` | Flag / Pause / Back / Save & Next / Quiz Summary (page level) |
| `TimerDisplay.astro` | `{ timeLimitSeconds, startedAtMs, pausedSeconds, pausedAtMs, attemptId }` | Progress bar + `HH:MM:SS`; statically imports `timer.ts` |
| `ExamSummaryPanel.astro` | attempt: overlay state of all questions + final submit button; results: static `{ score, correctCount, totalQuestions, passScorePercent, questions: [...] }` | Dual-use: in-attempt overlay and post-submit results |

Layout: `src/layouts/QuizShell.astro` — minimal chrome (no Header/Footer) for attempt + results.

## Client-Side State Management

All logic in `src/features/exams/lib/attempt-controller.ts` (pure TS, no DB imports), loaded via a static top-level `<script>` import. Initial state seeded from `data-*` attributes rendered server-side.

- **Timer**: `setInterval(1000ms)` recomputes locally with `computeRemainingSeconds` (frozen while paused). `setInterval(~20s)` resyncs against `GET status` (corrects drift, detects submit from another tab → redirect to results). On reaching 0: stop intervals, `POST submit` → redirect.
- **Navigation**: navigator clicks, Back, and Save & Next all route through `saveCurrentAnswerIfPresent()` before switching the visible question — so an answer persists regardless of navigation path, not only via Save & Next. Advancing blank is allowed.
- **Flag for Review**: toggles local state immediately, updates the navigator circle, `POST answers` with `{ selectedOptionId, flaggedForReview }` (persists flag even without an answer).
- **Pause**: `POST pause`, stop the interval, **disable radios and buttons** (not just freeze the clock). **Resume**: `POST resume`, re-enable, restart interval from the fresh `remainingSeconds` in the response.
- **Quiz Summary**: client-only overlay reusing navigator state (no fetch), per-question jump-links; the final "Submit exam" button lives inside, with confirmation.
- **Refresh trade-off**: a page refresh resets "current question" to 1. Server-saved answers are NOT lost — only navigation position.

## Auth & Security

- **Middleware gating** (`src/middleware.ts`): `protectedPagePrefixes = ['/courses', '/exams']` → redirect to `/login?redirect=...` when no session; `protectedApiPrefixes = ['/api/exams']` → `401 JSON` when no session.
- **Ownership at the handler**: middleware only proves a session exists. Every attempt-scoped API route AND SSR page re-checks `context.locals.user.id === attempt.userId` (403 / 404 respectively). `getAttemptById` / `getAttemptResult` are owner-scoped in the query itself.
- **Anti-cheat**: `exam_options.isCorrect` and `exam_questions.explanation` are excluded from `getExamQuestionsForAttempt`; scoring runs server-side at submit. No correct/incorrect signal reaches the client before submit.
- **Timer integrity**: client cannot extend time — server recomputes `remaining` from `startedAt`/`pausedSeconds` on every `status`/`saveAnswer`/`submit`; expired saves auto-finalize server-side.
- **GET side-effect-free**: results GET never auto-submits; if not yet submitted it redirects to the attempt.

## Alternatives Considered & Rejected

| Area | Rejected alternative | Why rejected |
|------|----------------------|--------------|
| Options storage | JSON array on `exam_questions` | Can't cleanly hide `isCorrect` or score via query; breaks relational precedent |
| Data access | Extend `api.ts` | `api.ts` is read-only; exams add the first write flow — warrants its own module |
| Question loading | Fetch one question per API call | Extra round-trips; SSR-all + toggle is simpler and offline-resilient within the attempt |
| Client script | `<script define:vars>` | Bypasses Vite bundling, no static imports — trap already hit in `login.astro` |
| Migrations | drizzle-kit generated | Project convention is hand-written raw SQL applied via `turso db shell` |
| Timer authority | Client-owned countdown | Cheatable; server must be the time authority, client only renders |
| Layout | Reuse `BlogPost.astro` | Injects site chrome into a timed exam; minimal `QuizShell` is distraction-free |
| Submit UX | Dedicated toolbar Submit button | Product decision: submit lives in Quiz Summary or fires on timeout |

## Testing

- **Unit (vitest, co-located)** — already present, verify coverage:
  - `timer.test.ts`: normal countdown, frozen while paused, resume accounts for `pausedSeconds`, already-expired clamps to 0, `formatHms` edges (0, 3599, 5400).
  - `scoring.test.ts`: all-correct / all-incorrect / mixed, unanswered counted separately, flag doesn't affect score, 0-question exam doesn't divide by zero.
- **E2E (Playwright, `tests/e2e/exam-flow.spec.ts`)** — light, matching `courses-card-flow.spec.ts`:
  - `/exams` loads (via redirect to login, like the current `/courses` test).
  - `/exams` has no horizontal overflow.
  - `/exams/nonexistent-slug` → 404.
  - Authenticated full flow deferred (needs test-user + injected session cookie, infra absent for courses too) — fast-follow, non-blocking.

## Migration / Rollout

- Forward: `turso db shell <DB_NAME> < src/lib/migrations/006_exams.sql` (`CREATE TABLE IF NOT EXISTS` × 5 + indexes).
- Rollback: `006_exams_rollback.sql` (`DROP TABLE IF EXISTS` reverse-dependency order) + revert middleware diff + delete new `src/features/exams/`, `src/pages/exams/`, `src/pages/api/exams/`, `exam-api.ts`, `QuizShell.astro`.
- Seed data via direct SQL (no admin UI, like courses).
- Validate `npm run validate` (typecheck + build) after each implementation checkpoint.

## Open Questions

- [ ] Confirm the co-located `timer.test.ts` / `scoring.test.ts` already cover every case listed in Testing; add missing cases rather than rewriting.
- [ ] Confirm trailing-slash convention for exam links (`/exams/{slug}/`) matches Astro `trailingSlash` config, consistent with courses.
- [ ] Confirm `exam-api.ts`'s existing `saveAnswer` expired-auto-finalize returns the `{ expired: true }` shape the controller expects.
