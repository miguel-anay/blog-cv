import type { ICourseRepository } from '../../domain/course/course-repository.js';
import { NotFoundError } from '../../domain/shared/errors.js';

export class DeleteCourseUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(slug: string): Promise<void> {
    const deleted = await this.courseRepo.deleteBySlug(slug);
    if (!deleted) throw new NotFoundError(`Course '${slug}' not found`);
  }
}
