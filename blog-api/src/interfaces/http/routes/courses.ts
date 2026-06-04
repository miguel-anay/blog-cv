import { Hono } from 'hono';
import type { Container } from '../../../infrastructure/container.js';
import { GetCoursesUseCase } from '../../../application/course/get-courses.js';
import { GetCourseBySlugUseCase } from '../../../application/course/get-course-by-slug.js';
import { CreateCourseUseCase } from '../../../application/course/create-course.js';
import { UpdateCourseUseCase } from '../../../application/course/update-course.js';
import { DeleteCourseUseCase } from '../../../application/course/delete-course.js';
import { authMiddleware } from '../middleware/auth.js';

export function courseRoutes(container: Container) {
  const app = new Hono();

  // GET /courses
  app.get('/', async (c) => {
    const uc = new GetCoursesUseCase(container.courseRepo);
    const result = await uc.execute();
    return c.json(result);
  });

  // GET /courses/:slug
  app.get('/:slug', async (c) => {
    const uc = new GetCourseBySlugUseCase(container.courseRepo);
    const course = await uc.execute(c.req.param('slug'));
    return c.json(course);
  });

  // POST /courses (protected)
  app.post('/', authMiddleware, async (c) => {
    const uc = new CreateCourseUseCase(container.courseRepo);
    const body = await c.req.json();
    const course = await uc.execute(body);
    return c.json(course, 201);
  });

  // PATCH /courses/:slug (protected)
  app.patch('/:slug', authMiddleware, async (c) => {
    const uc = new UpdateCourseUseCase(container.courseRepo);
    const body = await c.req.json();
    const course = await uc.execute(c.req.param('slug'), body);
    return c.json(course);
  });

  // DELETE /courses/:slug (protected)
  app.delete('/:slug', authMiddleware, async (c) => {
    const uc = new DeleteCourseUseCase(container.courseRepo);
    await uc.execute(c.req.param('slug'));
    return c.body(null, 204);
  });

  return app;
}
