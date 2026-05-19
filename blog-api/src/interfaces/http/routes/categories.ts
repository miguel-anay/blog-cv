import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { GetCategoriesUseCase } from '../../../application/category/get-categories.js';
import { GetCategoryCountsUseCase } from '../../../application/category/get-category-counts.js';

export function categoryRoutes(container: Container) {
  const app = new Hono();

  // GET /categories/counts — must be before /:id
  app.get('/counts', async (c) => {
    const uc = new GetCategoryCountsUseCase(container.categoryRepo);
    const counts = await uc.execute();
    return c.json(counts);
  });

  // GET /categories
  app.get('/', async (c) => {
    const uc = new GetCategoriesUseCase(container.categoryRepo);
    const categories = await uc.execute();
    return c.json(categories);
  });

  return app;
}
