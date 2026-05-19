import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { GetArticlesUseCase } from '../../../application/article/get-articles.js';
import { GetArticleBySlugUseCase } from '../../../application/article/get-article-by-slug.js';
import { CreateArticleUseCase } from '../../../application/article/create-article.js';
import { UpdateArticleUseCase } from '../../../application/article/update-article.js';
import { DeleteArticleUseCase } from '../../../application/article/delete-article.js';
import { authMiddleware } from '../middleware/auth.js';

export function articleRoutes(container: Container) {
  const app = new Hono();

  // GET /articles?page=1&pageSize=10&category=slug
  app.get('/', async (c) => {
    const uc = new GetArticlesUseCase(container.articleRepo);
    const result = await uc.execute(c.req.query());
    return c.json(result);
  });

  // GET /articles/:slug
  app.get('/:slug', async (c) => {
    const uc = new GetArticleBySlugUseCase(container.articleRepo);
    const article = await uc.execute(c.req.param('slug'));
    return c.json(article);
  });

  // POST /articles (protected)
  app.post('/', authMiddleware, async (c) => {
    const uc = new CreateArticleUseCase(container.articleRepo);
    const body = await c.req.json();
    const article = await uc.execute(body);
    return c.json(article, 201);
  });

  // PATCH /articles/:slug (protected)
  app.patch('/:slug', authMiddleware, async (c) => {
    const uc = new UpdateArticleUseCase(container.articleRepo);
    const body = await c.req.json();
    const article = await uc.execute(c.req.param('slug'), body);
    return c.json(article);
  });

  // DELETE /articles/:slug (protected)
  app.delete('/:slug', authMiddleware, async (c) => {
    const uc = new DeleteArticleUseCase(container.articleRepo);
    await uc.execute(c.req.param('slug'));
    return c.body(null, 204);
  });

  return app;
}
