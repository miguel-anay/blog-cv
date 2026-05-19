import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { errorHandler } from './middleware/error.js';
import type { Container } from '../../infrastructure/container.js';
import { articleRoutes } from './routes/articles.js';
import { categoryRoutes } from './routes/categories.js';
import { cvRoutes } from './routes/cv.js';
import { configRoutes } from './routes/config.js';
import { newsletterRoutes } from './routes/newsletter.js';

export function createApp(container: Container) {
  const app = new Hono();

  app.use(logger());
  app.use(
    cors({
      origin: [process.env.PUBLIC_SITE_URL ?? '', 'http://localhost:4321'].filter(Boolean),
    }),
  );
  app.use(bodyLimit({ maxSize: 1 * 1024 * 1024 }));

  app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

  app.route('/articles', articleRoutes(container));
  app.route('/categories', categoryRoutes(container));
  app.route('/cv', cvRoutes(container));
  app.route('/config', configRoutes(container));
  app.route('/newsletter', newsletterRoutes(container));

  app.onError(errorHandler);
  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404),
  );

  return app;
}
