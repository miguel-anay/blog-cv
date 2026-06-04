import { ZodError } from 'zod';
import type { ICourseRepository } from '../../domain/course/course-repository.js';
import type { Course } from '../../domain/course/types.js';
import { ConflictError, ValidationError } from '../../domain/shared/errors.js';
import { CreateCourseSchema } from './dto.js';

export class CreateCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(raw: unknown): Promise<Course> {
    let input;
    try {
      input = CreateCourseSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join('; '));
      }
      throw err;
    }

    const exists = await this.courseRepo.slugExists(input.slug);
    if (exists) throw new ConflictError(`Course with slug '${input.slug}' already exists`);

    return this.courseRepo.create({
      slug: input.slug,
      title: input.title,
      description: input.description,
      coverUrl: input.cover_url ?? null,
      level: input.level,
      publishedAt: input.published_at ?? null,
      sections: input.sections,
    });
  }
}
