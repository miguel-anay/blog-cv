// Client-side controller for the attempt-taking page
// (src/pages/exams/[slug]/attempt/[attemptId].astro).
//
// Plain TS, no DB imports — statically imported via a top-level `<script>` tag
// in the page (NEVER `define:vars`, which disables Vite bundling/imports —
// see src/pages/login.astro for the mistake this project already made once).
//
// The server is always the source of truth for time and correctness (REQ-003).
// This controller:
//   - ticks the timer locally every 1s (frozen while paused) and resyncs
//     against GET status every ~20s to correct drift and detect the attempt
//     being finalized/paused/resumed elsewhere (REQ-003, REQ-004).
//   - always routes navigation (Back / Save & Next / navigator / summary
//     jump) through `saveCurrentAnswerIfPresent()` first, so an answer
//     persists regardless of how the user leaves a question (REQ-005).
//   - toggles "flagged for review" immediately in the UI and persists it even
//     without a selected answer (REQ-005).
//   - disables inputs proactively on pause, re-enables on resume (REQ-004) —
//     the server also rejects writes while paused (`saveAnswer` returns
//     `{ paused: true }`), but the client must not rely on that alone for UX.
//   - opens the Quiz Summary overlay from already-tracked local state (no
//     fetch) and performs the only two submission triggers allowed by
//     REQ-006: manual confirm from the summary, or local-timeout-triggered
//     resync (the server auto-finalizes on the next contact after expiry).

import { computeRemainingSeconds, formatHms } from './timer';

interface AttemptStatusResponse {
  remainingSeconds: number;
  paused: boolean;
  submitted: boolean;
  expired: boolean;
}

interface AnswersResponse {
  ok: boolean;
  expired: boolean;
  paused?: boolean;
}

interface ResumeResponse {
  ok: boolean;
  remainingSeconds?: number;
  paused?: boolean;
  submitted?: boolean;
  expired?: boolean;
}

const RESYNC_INTERVAL_MS = 20_000;
const TICK_INTERVAL_MS = 1_000;

export function initAttemptController(): void {
  const rootQuery = document.querySelector<HTMLElement>('[data-attempt-root]');
  const timerQuery = document.querySelector<HTMLElement>('[data-timer]');
  const toolbarQuery = document.querySelector<HTMLElement>('[data-attempt-toolbar]');
  const navigatorQuery = document.querySelector<HTMLElement>('[data-question-navigator]');
  const summaryOverlayQuery = document.querySelector<HTMLElement>('[data-exam-summary-overlay]');
  const questionCards = Array.from(document.querySelectorAll<HTMLElement>('[data-question-card]'));

  // Not on an attempt page, or the DOM this controller depends on is missing —
  // bail out silently rather than throwing (defensive, mirrors other feature
  // scripts in this repo like CourseNav.astro).
  if (
    !rootQuery ||
    !timerQuery ||
    !toolbarQuery ||
    !navigatorQuery ||
    !summaryOverlayQuery ||
    questionCards.length === 0
  ) {
    return;
  }

  // Rebind as non-null locals — TS's control-flow narrowing above doesn't
  // persist into the closures defined below, so the guarded originals would
  // still type as `HTMLElement | null` inside every nested function.
  const root: HTMLElement = rootQuery;
  const timerEl: HTMLElement = timerQuery;
  const toolbar: HTMLElement = toolbarQuery;
  const navigatorEl: HTMLElement = navigatorQuery;
  const summaryOverlay: HTMLElement = summaryOverlayQuery;

  const attemptId = Number(timerEl.dataset.attemptId);
  const examSlug = root.dataset.examSlug ?? '';
  const resultsUrl = `/exams/${examSlug}/attempt/${attemptId}/results`;
  const totalQuestions = questionCards.length;

  const timerText = timerEl.querySelector<HTMLElement>('[data-timer-text]');
  const timerBarFill = timerEl.querySelector<HTMLElement>('[data-timer-bar-fill]');
  const timeLimitSeconds = Number(timerEl.dataset.timeLimitSeconds);
  const startedAtMs = Number(timerEl.dataset.startedAtMs);
  const initialPausedSeconds = Number(timerEl.dataset.pausedSeconds || '0');
  const initialPausedAtMs = timerEl.dataset.pausedAtMs ? Number(timerEl.dataset.pausedAtMs) : null;

  let paused = timerEl.dataset.paused === 'true';
  let disabled = paused;

  // Local ticking is anchor-based: `anchorRemaining` is the authoritative
  // remaining-seconds value as of `anchorMs`, refreshed on every resync/
  // pause/resume round trip. Between anchors we just subtract elapsed local
  // time — this avoids needing to reconstruct server-side pausedSeconds
  // client-side (the resume response doesn't return it, only the fresh
  // remainingSeconds — see src/pages/api/exams/attempts/[id]/resume.ts).
  let anchorMs = Date.now();
  let anchorRemaining = computeRemainingSeconds({
    timeLimitSeconds,
    startedAtMs,
    pausedAtMs: initialPausedAtMs,
    pausedSeconds: initialPausedSeconds,
    nowMs: anchorMs,
  });

  let currentIndex = Number(root.dataset.initialQuestionIndex) || 1;
  const answeredState = new Map<number, boolean>();
  const flaggedState = new Map<number, boolean>();
  navigatorEl.querySelectorAll<HTMLButtonElement>('[data-question-index]').forEach((btn) => {
    const idx = Number(btn.dataset.questionIndex);
    answeredState.set(idx, btn.dataset.answered === 'true');
    flaggedState.set(idx, btn.dataset.flagged === 'true');
  });

  let tickIntervalId: number | undefined;
  let resyncIntervalId: number | undefined;

  // ── Timer ──────────────────────────────────────────────────────────────

  function currentRemaining(): number {
    if (paused) return anchorRemaining;
    const elapsedLocalSeconds = Math.floor((Date.now() - anchorMs) / 1000);
    return Math.max(0, anchorRemaining - elapsedLocalSeconds);
  }

  function renderTimer(remaining: number): void {
    if (timerText) timerText.textContent = formatHms(remaining);
    if (timerBarFill && timeLimitSeconds > 0) {
      const progressPercent = Math.min(100, Math.max(0, ((timeLimitSeconds - remaining) / timeLimitSeconds) * 100));
      timerBarFill.style.width = `${progressPercent}%`;
    }
  }

  function tick(): void {
    if (paused) return;
    const remaining = currentRemaining();
    renderTimer(remaining);
    if (remaining <= 0) {
      // Local estimate only — the server is authoritative. Contacting it now
      // triggers its lazy auto-finalize (getAttemptStatus finalizes when
      // remaining <= 0 and not paused) and confirms via redirect (REQ-003/006).
      stopIntervals();
      void resyncUntilFinalized();
    }
  }

  async function resync(): Promise<void> {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/status`);
      if (!res.ok) return;
      const data: AttemptStatusResponse = await res.json();

      if (data.submitted || data.expired) {
        finalizeAndRedirect();
        return;
      }

      anchorMs = Date.now();
      anchorRemaining = data.remainingSeconds;
      renderTimer(currentRemaining());

      if (data.paused !== paused) {
        // Cross-tab pause/resume detected — reflect it locally. Resync
        // polling itself keeps running either way (see startResyncPolling
        // being independent of the tick interval) so a later remote resume
        // is still picked up while this tab shows "paused".
        applyPaused(data.paused);
        if (data.paused) stopTick();
        else startTick();
      }
    } catch {
      // Network hiccup — keep the local estimate; the next resync retries.
    }
  }

  // Keeps polling GET status until the server confirms the attempt is
  // finalized. A single one-shot request here would otherwise leave the page
  // frozen at 00:00:00 forever if that one fetch happened to fail.
  async function resyncUntilFinalized(): Promise<void> {
    const maxAttempts = 20; // ~1 minute at 3s between retries
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await fetch(`/api/exams/attempts/${attemptId}/status`);
        if (res.ok) {
          const data: AttemptStatusResponse = await res.json();
          if (data.submitted || data.expired) {
            finalizeAndRedirect();
            return;
          }

          anchorMs = Date.now();
          anchorRemaining = data.remainingSeconds;
          renderTimer(currentRemaining());

          if (data.paused) {
            // Paused right at expiry — the server won't auto-finalize while
            // paused. Reflect that and keep resync polling for a later
            // resume/expiry instead of retrying this loop.
            applyPaused(true);
            startResyncPolling();
            return;
          }
          if (data.remainingSeconds > 0) {
            // Clock drift resolved itself (server had more time than our
            // local estimate) — resume normal polling instead of looping.
            startIntervals();
            return;
          }
        }
      } catch {
        // Network hiccup — retry after the backoff below.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 3000));
    }
    // Exhausted retries — surface a visible error instead of a silently
    // frozen page; the user's answers up to this point are already saved.
    window.alert('No se pudo confirmar el envío del examen. Revisá tu conexión y recargá la página.');
  }

  function stopTick(): void {
    if (tickIntervalId !== undefined) window.clearInterval(tickIntervalId);
    tickIntervalId = undefined;
  }

  function startTick(): void {
    if (tickIntervalId === undefined) tickIntervalId = window.setInterval(tick, TICK_INTERVAL_MS);
  }

  function startResyncPolling(): void {
    if (resyncIntervalId === undefined) {
      resyncIntervalId = window.setInterval(() => void resync(), RESYNC_INTERVAL_MS);
    }
  }

  function stopIntervals(): void {
    stopTick();
    if (resyncIntervalId !== undefined) window.clearInterval(resyncIntervalId);
    resyncIntervalId = undefined;
  }

  function startIntervals(): void {
    startTick();
    startResyncPolling();
  }

  function finalizeAndRedirect(): void {
    stopIntervals();
    window.location.href = resultsUrl;
  }

  // ── Pause / resume ────────────────────────────────────────────────────

  function setInputsDisabled(isDisabled: boolean): void {
    for (const card of questionCards) {
      card.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
        input.disabled = isDisabled;
      });
    }
    toolbar.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((btn) => {
      // The pause/resume toggle itself must stay usable, otherwise a paused
      // attempt could never be resumed from the UI.
      if (btn.dataset.action === 'pause') return;
      btn.disabled = isDisabled;
    });
    navigatorEl.querySelectorAll<HTMLButtonElement>('[data-question-index]').forEach((btn) => {
      btn.disabled = isDisabled;
    });
    // "Close" stays usable so a user paused mid-review isn't trapped behind
    // the overlay; jumping to a question and submitting are real actions
    // that must wait for resume, same as the rest of the toolbar/navigator.
    summaryOverlay.querySelectorAll<HTMLButtonElement>('[data-question-index], [data-action="submit-exam"]').forEach((btn) => {
      btn.disabled = isDisabled;
    });
  }

  function applyPaused(isPaused: boolean): void {
    paused = isPaused;
    disabled = isPaused;
    timerEl.dataset.paused = String(isPaused);
    setInputsDisabled(isPaused);

    const pauseBtn = toolbar.querySelector<HTMLButtonElement>('[data-action="pause"]');
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', String(isPaused));
      pauseBtn.innerHTML = isPaused
        ? '<span class="attempt-toolbar__icon" aria-hidden="true">&#9654;</span>Reanudar'
        : '<span class="attempt-toolbar__icon" aria-hidden="true">&#10074;&#10074;</span>Pausar';
    }
  }

  async function handlePause(): Promise<void> {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/pause`, { method: 'POST' });
      const data: { ok: boolean } = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) return; // no-op: already paused/submitted server-side
      anchorRemaining = currentRemaining();
      anchorMs = Date.now();
      applyPaused(true);
      // Only stop the 1s local tick — resync polling keeps running so a
      // remote resume (another tab/device) is still detected while paused.
      stopTick();
    } catch {
      // Best-effort — leave state as-is, user can retry.
    }
  }

  async function handleResume(): Promise<void> {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/resume`, { method: 'POST' });
      const data: ResumeResponse = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        // The server said no-op, which can mean "wasn't paused" — e.g. this
        // attempt was already resumed from another tab. Resync now instead
        // of leaving this tab stuck showing a paused UI that Reanudar can't
        // fix.
        await resync();
        return;
      }

      anchorMs = Date.now();
      anchorRemaining = data.remainingSeconds ?? anchorRemaining;
      applyPaused(false);
      renderTimer(currentRemaining());

      if (data.submitted || data.expired) {
        finalizeAndRedirect();
        return;
      }
      startTick();
    } catch {
      // Best-effort — leave state as-is, user can retry.
    }
  }

  // ── Navigation & answers ──────────────────────────────────────────────

  function getQuestionCard(index: number): HTMLElement | undefined {
    return questionCards.find((card) => Number(card.dataset.questionIndex) === index);
  }

  function getSelectedOptionId(card: HTMLElement): number | null {
    const checked = card.querySelector<HTMLInputElement>('input[type="radio"]:checked');
    return checked ? Number(checked.dataset.optionId) : null;
  }

  function updateNavState(index: number, answered: boolean, flagged: boolean): void {
    answeredState.set(index, answered);
    flaggedState.set(index, flagged);

    const navBtn = navigatorEl.querySelector<HTMLButtonElement>(`[data-question-index="${index}"]`);
    if (navBtn) {
      navBtn.dataset.answered = String(answered);
      navBtn.dataset.flagged = String(flagged);
    }
    const summaryBtn = summaryOverlay.querySelector<HTMLButtonElement>(`[data-question-index="${index}"]`);
    if (summaryBtn) {
      summaryBtn.dataset.answered = String(answered);
      summaryBtn.dataset.flagged = String(flagged);
    }
  }

  function updateFlagButton(): void {
    const flagBtn = toolbar.querySelector<HTMLButtonElement>('[data-action="flag"]');
    if (!flagBtn) return;
    flagBtn.setAttribute('aria-pressed', String(flaggedState.get(currentIndex) ?? false));
  }

  function updateNavigatorCurrent(): void {
    navigatorEl.querySelectorAll<HTMLButtonElement>('[data-question-index]').forEach((btn) => {
      btn.classList.toggle('is-current', Number(btn.dataset.questionIndex) === currentIndex);
    });
  }

  function showQuestion(index: number): void {
    for (const card of questionCards) {
      card.hidden = Number(card.dataset.questionIndex) !== index;
    }
    currentIndex = index;
    updateNavigatorCurrent();
    updateFlagButton();
  }

  // Returns whether the write was actually persisted server-side. Callers
  // must not mark a question "answered" in the navigator on a false result —
  // otherwise a network blip or a paused-attempt rejection would silently
  // show credit for an answer that was never saved.
  async function postAnswer(questionId: number, selectedOptionId: number | null, flaggedForReview: boolean): Promise<boolean> {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, selectedOptionId, flaggedForReview }),
      });
      const data: AnswersResponse = await res.json().catch(() => ({ ok: false, expired: false }));

      if (data.expired) {
        finalizeAndRedirect();
        return false;
      }
      if (data.paused) {
        // The server rejected the write because the attempt is paused (e.g.
        // paused from another tab between our last resync and this save) —
        // treat it the same as "inputs are disabled", don't silently drop it.
        applyPaused(true);
        stopTick();
        return false;
      }
      return data.ok;
    } catch {
      // Network failure — best-effort autosave; the next navigation/flag
      // toggle implicitly retries, but this attempt's UI state must not
      // claim it was saved.
      return false;
    }
  }

  // Always saves — including a null selection — so a flag toggled without an
  // answer still persists on navigation (REQ-005). Only reflects "answered"
  // in the navigator once the server has actually confirmed the write.
  async function saveCurrentAnswerIfPresent(): Promise<void> {
    if (disabled) return;
    const card = getQuestionCard(currentIndex);
    if (!card) return;

    const questionId = Number(card.dataset.questionId);
    const selectedOptionId = getSelectedOptionId(card);
    const flagged = flaggedState.get(currentIndex) ?? false;

    const saved = await postAnswer(questionId, selectedOptionId, flagged);
    if (saved) updateNavState(currentIndex, selectedOptionId != null, flagged);
  }

  // ── Quiz Summary & submission ─────────────────────────────────────────

  function openSummary(): void {
    summaryOverlay.hidden = false;
  }

  function closeSummary(): void {
    summaryOverlay.hidden = true;
  }

  async function submitAttemptRequest(): Promise<'redirected' | 'paused' | 'error'> {
    try {
      const res = await fetch(`/api/exams/attempts/${attemptId}/submit`, { method: 'POST' });
      if (res.status === 409) return 'paused';

      const data: { redirect?: string } = await res.json().catch(() => ({}));
      if (data.redirect) {
        stopIntervals();
        window.location.href = data.redirect;
        return 'redirected';
      }
      return 'error';
    } catch {
      return 'error';
    }
  }

  async function handleSubmit(): Promise<void> {
    const confirmed = window.confirm('¿Enviar el examen? No vas a poder modificar tus respuestas después.');
    if (!confirmed) return;

    await saveCurrentAnswerIfPresent();
    const result = await submitAttemptRequest();
    if (result !== 'paused') {
      if (result === 'error') window.alert('No se pudo enviar el examen. Intentá nuevamente.');
      return;
    }

    // Judgment call (documented in apply-progress): the attempt was paused —
    // most likely from another tab — between opening the summary and
    // confirming. Resume automatically and retry once rather than forcing
    // the user to notice and click "Reanudar" themselves; if that also
    // fails, surface a plain error instead of retrying indefinitely.
    await handleResume();
    const retryResult = await submitAttemptRequest();
    if (retryResult === 'error' || retryResult === 'paused') {
      window.alert('No se pudo enviar el examen. Intentá nuevamente.');
    }
  }

  // ── Event wiring ───────────────────────────────────────────────────────

  toolbar.addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'pause') {
      void (paused ? handleResume() : handlePause());
      return;
    }
    if (disabled) return;

    if (action === 'flag') {
      const newFlag = !(flaggedState.get(currentIndex) ?? false);
      const card = getQuestionCard(currentIndex);
      if (!card) return;
      const questionId = Number(card.dataset.questionId);
      const selectedOptionId = getSelectedOptionId(card);
      // Only reflect the flag toggle once the server confirms the write —
      // an optimistic update here could show a flag that was never saved.
      void postAnswer(questionId, selectedOptionId, newFlag).then((saved) => {
        if (saved) {
          updateNavState(currentIndex, selectedOptionId != null, newFlag);
          updateFlagButton();
        }
      });
      return;
    }
    if (action === 'back') {
      void saveCurrentAnswerIfPresent().then(() => showQuestion(Math.max(1, currentIndex - 1)));
      return;
    }
    if (action === 'save-next') {
      void saveCurrentAnswerIfPresent().then(() => showQuestion(Math.min(totalQuestions, currentIndex + 1)));
      return;
    }
    if (action === 'quiz-summary') {
      openSummary();
    }
  });

  navigatorEl.addEventListener('click', (event) => {
    if (disabled) return;
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-question-index]');
    if (!btn) return;
    const target = Number(btn.dataset.questionIndex);
    void saveCurrentAnswerIfPresent().then(() => showQuestion(target));
  });

  summaryOverlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    const closeBtn = target.closest<HTMLButtonElement>('[data-action="close-summary"]');
    if (closeBtn) {
      closeSummary();
      return;
    }

    if (disabled) return;

    const jumpBtn = target.closest<HTMLButtonElement>('[data-question-index]');
    if (jumpBtn) {
      const targetIndex = Number(jumpBtn.dataset.questionIndex);
      void saveCurrentAnswerIfPresent().then(() => {
        showQuestion(targetIndex);
        closeSummary();
      });
      return;
    }

    const submitBtn = target.closest<HTMLButtonElement>('[data-action="submit-exam"]');
    if (submitBtn) {
      void handleSubmit();
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────

  showQuestion(currentIndex);
  renderTimer(currentRemaining());
  // Resync polling always runs (even while paused) so a remote pause/resume
  // is detected regardless of this tab's state on load.
  startResyncPolling();
  if (paused) {
    applyPaused(true);
  } else {
    startTick();
  }
}
