import { describe, it, expect } from 'vitest';
import { computeRemainingSeconds, formatHms } from './timer';

describe('computeRemainingSeconds', () => {
  it('counts down normally when not paused', () => {
    const startedAtMs = 0;
    const nowMs = 10 * 60 * 1000; // 10 minutes elapsed
    const remaining = computeRemainingSeconds({
      timeLimitSeconds: 5400,
      startedAtMs,
      pausedAtMs: null,
      pausedSeconds: 0,
      nowMs,
    });
    expect(remaining).toBe(5400 - 10 * 60);
  });

  it('freezes elapsed time while paused, ignoring nowMs', () => {
    const startedAtMs = 0;
    const pausedAtMs = 5 * 60 * 1000; // paused after 5 minutes
    const nowMs = 60 * 60 * 1000; // "now" is way later, should be ignored
    const remaining = computeRemainingSeconds({
      timeLimitSeconds: 5400,
      startedAtMs,
      pausedAtMs,
      pausedSeconds: 0,
      nowMs,
    });
    expect(remaining).toBe(5400 - 5 * 60);
  });

  it('accounts for accumulated pausedSeconds after resuming', () => {
    const startedAtMs = 0;
    const pausedSeconds = 2 * 60; // 2 minutes previously spent paused
    const nowMs = 12 * 60 * 1000; // 12 minutes of wall-clock time since start
    const remaining = computeRemainingSeconds({
      timeLimitSeconds: 5400,
      startedAtMs,
      pausedAtMs: null,
      pausedSeconds,
      nowMs,
    });
    // effective elapsed = 12min wall clock - 2min paused = 10min
    expect(remaining).toBe(5400 - 10 * 60);
  });

  it('clamps to 0 when the time limit has already been exceeded', () => {
    const startedAtMs = 0;
    const nowMs = 6000 * 1000; // way past the 5400s limit
    const remaining = computeRemainingSeconds({
      timeLimitSeconds: 5400,
      startedAtMs,
      pausedAtMs: null,
      pausedSeconds: 0,
      nowMs,
    });
    expect(remaining).toBe(0);
  });

  it('never returns a negative number', () => {
    const remaining = computeRemainingSeconds({
      timeLimitSeconds: 100,
      startedAtMs: 0,
      pausedAtMs: null,
      pausedSeconds: 0,
      nowMs: 1_000_000,
    });
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});

describe('formatHms', () => {
  it('formats 0 seconds as 00:00:00', () => {
    expect(formatHms(0)).toBe('00:00:00');
  });

  it('formats 3599 seconds as 00:59:59', () => {
    expect(formatHms(3599)).toBe('00:59:59');
  });

  it('formats 5400 seconds (the default 90-minute limit) as 01:30:00', () => {
    expect(formatHms(5400)).toBe('01:30:00');
  });

  it('clamps negative input to 00:00:00', () => {
    expect(formatHms(-5)).toBe('00:00:00');
  });

  it('truncates fractional seconds', () => {
    expect(formatHms(61.9)).toBe('00:01:01');
  });
});
