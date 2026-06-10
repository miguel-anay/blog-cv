import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// sendMock is module-level so the factory closure can reference it
const sendMock = vi.fn();

// Mock resend module — Resend must be a class-style constructor
vi.mock('resend', () => {
  return {
    Resend: class MockResend {
      emails = { send: sendMock };
    },
  };
});

describe('sendMagicLinkEmail', () => {
  beforeEach(() => {
    sendMock.mockReset();
    sendMock.mockResolvedValue({ data: { id: 'test-id' }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('calls Resend with correct to, subject, and html containing the url', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com');

    const { sendMagicLinkEmail } = await import('./email');

    await sendMagicLinkEmail({ email: 'user@example.com', url: 'https://example.com/magic?token=abc' });

    expect(sendMock).toHaveBeenCalledOnce();
    const callArgs = sendMock.mock.calls[0][0];
    expect(callArgs.to).toBe('user@example.com');
    expect(callArgs.from).toBe('noreply@example.com');
    expect(callArgs.subject).toBeTruthy();
    expect(callArgs.html).toContain('https://example.com/magic?token=abc');
  });

  it('throws a generic error and logs server-side when Resend throws', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com');
    sendMock.mockRejectedValue(new Error('Resend internal error with sensitive data'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { sendMagicLinkEmail } = await import('./email');

    await expect(
      sendMagicLinkEmail({ email: 'user@example.com', url: 'https://example.com/magic?token=abc' })
    ).rejects.toThrow('Failed to send magic link email');

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('throws a clear error when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    const { sendMagicLinkEmail } = await import('./email');

    await expect(
      sendMagicLinkEmail({ email: 'user@example.com', url: 'https://example.com/magic?token=abc' })
    ).rejects.toThrow('RESEND_API_KEY is not set');
  });
});
