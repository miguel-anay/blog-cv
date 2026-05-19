import { z, ZodError } from 'zod';
import { ValidationError, UpstreamError } from '../../domain/shared/errors.js';
import type { INewsletterService } from '../../domain/newsletter/newsletter-service.js';

const emailSchema = z.string().email();

export class SubscribeNewsletterUseCase {
  constructor(private readonly newsletterService: INewsletterService) {}

  async execute(email: unknown): Promise<void> {
    let validated: string;
    try {
      validated = emailSchema.parse(email);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError('Invalid email address');
      }
      throw err;
    }

    try {
      await this.newsletterService.subscribe(validated);
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      throw err;
    }
  }
}
