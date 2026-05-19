import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { GetCvUseCase } from '../../../application/cv/get-cv.js';

export function cvRoutes(container: Container) {
  const app = new Hono();

  // GET /cv
  app.get('/', async (c) => {
    const uc = new GetCvUseCase(container.cvRepo);
    const cv = await uc.execute();
    return c.json(cv);
  });

  return app;
}
