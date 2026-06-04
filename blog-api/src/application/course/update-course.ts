import { ZodError } from 'zod';
import type { ICourseRepository } from '../../domain/course/course-repository.js';
import type { Course } from '../../domain/course/types.js';
import { NotFoundError, ValidationError } from '../../domain/shared/errors.js';
import { UpdateCourseSchema } from './dto.js';

export class UpdateCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(slug: string, raw: unknown): Promise<Course> {
    let input;
    try {
      input = UpdateCourseSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join('; '));
      }
      throw err;
    }

    const course = await this.courseRepo.update(slug, {
      title: input.title,
      description: input.description,
      coverUrl: input.cover_url ?? undefined,
      level: input.level,
      publishedAt: input.published_at ?? undefined,
    });

    if (!course) throw new NotFoundError(`Course '${slug}' not found`);
    return course;
  }
}
