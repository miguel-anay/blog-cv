import { UpstreamError } from '../../domain/shared/errors.js';
import type { INewsletterService } from '../../domain/newsletter/newsletter-service.js';

export class ResendNewsletter implements INewsletterService {
  async subscribe(email: string): Promise<void> {
    const audienceId = process.env.RESEND_AUDIENCE_ID;
    if (!audienceId) throw new UpstreamError('RESEND_AUDIENCE_ID not configured');

    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      },
    );

    if (!res.ok) throw new UpstreamError(`Resend error: ${res.status}`);
  }
}
