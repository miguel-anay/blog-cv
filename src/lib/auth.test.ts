import { describe, it, expect, vi } from 'vitest';

// Stub imports that auth.ts pulls in at module level (DB, Better Auth internals)
// by mocking the heavy modules so we can import the pure helper without side effects.
vi.mock('./db', () => ({ getDb: () => ({}) }));
vi.mock('better-auth', () => ({
  betterAuth: () => ({ $Infer: { Session: {} }, api: { getSession: async () => null }, handler: async () => new Response() }),
}));
vi.mock('better-auth/adapters/drizzle', () => ({ drizzleAdapter: () => ({}) }));
vi.mock('better-auth/plugins', () => ({ magicLink: () => ({}) }));
vi.mock('./email', () => ({
  sendMagicLinkEmail: async () => {},
}));
vi.mock('./schema', () => ({
  user: {},
  session: {},
  account: {},
  verification: {},
}));

import { resolveMagicLinkExpiry } from './auth';

describe('resolveMagicLinkExpiry', () => {
  it('returns 1800 when raw is undefined (default, no env var)', () => {
    expect(resolveMagicLinkExpiry(undefined)).toBe(1800);
  });

  it('returns 1800 when raw is empty string', () => {
    expect(resolveMagicLinkExpiry('')).toBe(1800);
  });

  it('returns custom value when raw is a valid positive integer string', () => {
    expect(resolveMagicLinkExpiry('3600')).toBe(3600);
  });

  it('returns a very large value (~100 years) when raw is "0" (no expiry)', () => {
    const noExpiry = 60 * 60 * 24 * 365 * 100;
    const result = resolveMagicLinkExpiry('0');
    expect(result).toBe(noExpiry);
    expect(result).toBeGreaterThan(1800);
  });

  it('returns 1800 when raw is a negative number string', () => {
    expect(resolveMagicLinkExpiry('-5')).toBe(1800);
  });

  it('returns 1800 when raw is non-numeric (NaN)', () => {
    expect(resolveMagicLinkExpiry('abc')).toBe(1800);
  });
});
