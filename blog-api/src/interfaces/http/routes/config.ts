import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { GetSiteConfigUseCase } from '../../../application/site-config/get-site-config.js';
import { UpdateSiteConfigUseCase } from '../../../application/site-config/update-site-config.js';
import { authMiddleware } from '../middleware/auth.js';

export function configRoutes(container: Container) {
  const app = new Hono();

  // GET /config
  app.get('/', async (c) => {
    const uc = new GetSiteConfigUseCase(container.siteConfigRepo);
    const config = await uc.execute();
    return c.json(config);
  });

  // PATCH /config (protected)
  app.patch('/', authMiddleware, async (c) => {
    const uc = new UpdateSiteConfigUseCase(container.siteConfigRepo);
    const body = await c.req.json();
    const updated = await uc.execute(body);
    return c.json(updated);
  });

  return app;
}
