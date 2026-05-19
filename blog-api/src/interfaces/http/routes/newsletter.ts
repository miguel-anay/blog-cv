import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { SubscribeNewsletterUseCase } from '../../../application/newsletter/subscribe-newsletter.js';

export function newsletterRoutes(container: Container) {
  const app = new Hono();

  // POST /newsletter/subscribe
  app.post('/subscribe', async (c) => {
    const uc = new SubscribeNewsletterUseCase(container.newsletterService);
    const body = await c.req.json<{ email?: unknown }>();
    await uc.execute(body.email);
    return c.json({ ok: true, message: 'Subscribed successfully' });
  });

  return app;
}
