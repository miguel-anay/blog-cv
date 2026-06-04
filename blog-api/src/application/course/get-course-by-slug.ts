import type { ICourseRepository } from '../../domain/course/course-repository.js';
import type { Course } from '../../domain/course/types.js';
import { NotFoundError } from '../../domain/shared/errors.js';

export class GetCourseBySlugUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(slug: string): Promise<Course> {
    const course = await this.courseRepo.findBySlug(slug);
    if (!course) throw new NotFoundError(`Course '${slug}' not found`);
    return course;
  }
}
