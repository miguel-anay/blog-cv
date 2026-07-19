# certification-exams Specification

## Purpose

Defines behavior for the certification exams module: gated browsing, timed attempts with server-authoritative pause/resume, autosaved answers with flag persistence, submission gating, and post-submit scoring visibility. The server is always the source of truth for time and correctness; the client is never authoritative.

## Requirements

### Requirement: REQ-001 — Exam Listing & Detail Visibility

`/exams`, `/exams/[slug]`, and all `/api/exams/*` routes MUST require an active session.

#### Scenario: Unauthenticated page access redirects
- GIVEN no active session
- WHEN `/exams` or `/exams/[slug]` is requested
- THEN the response MUST redirect to `/login`

#### Scenario: Unauthenticated API access returns 401
- GIVEN no active session
- WHEN any `/api/exams/*` route is requested
- THEN the response MUST be HTTP 401 JSON

### Requirement: REQ-002 — Attempt Creation & Resumption

Starting an exam MUST create a new attempt unless an unsubmitted attempt already exists for that user+exam, in which case it MUST resume that attempt. Retries MUST be unlimited after submission; history MUST be retained.

#### Scenario: Resuming an in-progress attempt
- GIVEN a user has an unsubmitted attempt for exam X
- WHEN they start exam X again
- THEN no new attempt MUST be created and the response MUST redirect to the existing attempt

#### Scenario: Unlimited retries after submission
- GIVEN a user has a submitted attempt for exam X
- WHEN they start exam X again
- THEN a new attempt MUST be created and prior attempts MUST remain in history

### Requirement: REQ-003 — Timer & Pause Authority (Server Wins)

Remaining time MUST be computed server-side as `timeLimitSeconds - elapsed`, excluding paused duration. The client MUST treat its local countdown as provisional and resync periodically against the server.

#### Scenario: Client drift is corrected by server
- GIVEN the client's local countdown diverges from server-computed remaining time
- WHEN the client resyncs against the status endpoint
- THEN it MUST adopt the server's value as authoritative

#### Scenario: Expiry is enforced server-side regardless of client state
- GIVEN server-computed remaining time has reached 0
- WHEN the client sends any subsequent request for that attempt
- THEN the server MUST treat the attempt as expired and auto-finalize it

### Requirement: REQ-004 — Pause Disables Input

While an attempt is paused, answer and navigation inputs MUST be disabled and the timer MUST NOT advance.

#### Scenario: Pausing disables inputs and freezes the timer
- GIVEN an in-progress attempt
- WHEN the user pauses
- THEN inputs MUST become disabled and the timer MUST stop advancing

#### Scenario: Resuming re-enables inputs
- GIVEN a paused attempt
- WHEN the user resumes
- THEN inputs MUST re-enable and the timer MUST continue from the server's remaining time

### Requirement: REQ-005 — Answer Autosave & Flag Persistence

An answer MUST persist whenever the user navigates away from a question by any control, not only an explicit save action. A "flagged for review" state MUST persist even without a selected answer.

#### Scenario: Answer saved on any navigation
- GIVEN a selected option on the current question
- WHEN the user navigates away via any control
- THEN the selection MUST be persisted for that question

#### Scenario: Flag persists without an answer
- GIVEN no option selected on the current question
- WHEN the user flags it and navigates away
- THEN the flagged state MUST persist independent of whether the question has an answer

### Requirement: REQ-006 — Submission Triggers

An attempt MUST be submitted only from the Quiz Summary panel or automatically when server-computed time reaches 0. No other action MUST submit it.

#### Scenario: Manual submit from Quiz Summary
- GIVEN the user confirms submission from Quiz Summary
- WHEN the action is confirmed
- THEN the attempt MUST be marked submitted with `autoSubmitted = false`

#### Scenario: Auto-submit on timeout
- GIVEN server-computed remaining time reaches 0
- WHEN the client next contacts the server
- THEN the attempt MUST be submitted with `autoSubmitted = true`

### Requirement: REQ-007 — Scoring & Results Visibility

Option correctness MUST NOT be exposed before submission. After submission, results MUST show score, correct count, total questions, and per-question correctness with explanation.

#### Scenario: No correctness leak during attempt
- GIVEN an in-progress attempt
- WHEN question/option data is served to the client
- THEN the response MUST NOT include `isCorrect` or any correctness signal

#### Scenario: Results page before submission redirects
- GIVEN an attempt with no `submittedAt`
- WHEN its results page is requested
- THEN the response MUST redirect to the attempt page instead of rendering results

### Requirement: REQ-008 — Ownership Enforcement (Page & API)

Every page and API route operating on an attempt MUST verify `locals.user.id === attempt.userId`. Session presence alone (middleware) MUST NOT be treated as sufficient.

#### Scenario: Non-owner is blocked at page level
- GIVEN a session belonging to a different user
- WHEN that user requests another user's attempt page
- THEN the response MUST NOT render attempt data and MUST redirect or 404

#### Scenario: Non-owner is blocked at API level
- GIVEN a session belonging to a different user
- WHEN that user calls any `/api/exams/attempts/[id]/*` route for another user's attempt
- THEN the response MUST be HTTP 403 and MUST NOT include attempt data
