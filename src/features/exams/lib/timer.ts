// Pure timer math for exam attempts — no DB, no I/O.
// Used both server-side (exam-api.ts, status route) and client-side (attempt-controller.ts).

export interface RemainingSecondsInput {
  /** Snapshot of the exam's time limit taken when the attempt was created. */
  timeLimitSeconds: number;
  /** When the attempt started, in epoch ms. */
  startedAtMs: number;
  /** When the attempt was paused, in epoch ms — null/undefined if not currently paused. */
  pausedAtMs?: number | null;
  /** Total seconds spent paused so far (accumulated across previous pause/resume cycles). */
  pausedSeconds: number;
  /** "Now", in epoch ms. Passed explicitly so callers control the clock (testability + server authority). */
  nowMs: number;
}

/**
 * remaining = timeLimitSeconds - elapsed, where elapsed excludes paused time.
 * - not paused: elapsed = now - startedAt - pausedSeconds
 * - paused: elapsed is frozen at pausedAt - startedAt - pausedSeconds
 * Clamped to >= 0.
 */
export function computeRemainingSeconds({
  timeLimitSeconds,
  startedAtMs,
  pausedAtMs,
  pausedSeconds,
  nowMs,
}: RemainingSecondsInput): number {
  const referenceMs = pausedAtMs != null ? pausedAtMs : nowMs;
  const elapsedMs = referenceMs - startedAtMs - pausedSeconds * 1000;
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const remaining = timeLimitSeconds - elapsedSeconds;
  return Math.max(0, remaining);
}

/** Formats a non-negative number of seconds as HH:MM:SS. Negative input clamps to 0. */
export function formatHms(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
