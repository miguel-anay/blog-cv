import type { ICourseRepository } from '../../domain/course/course-repository.js';
import type { Course } from '../../domain/course/types.js';

export class GetCoursesUseCase {
  constructor(private readonly courseRepo: ICourseRepository) {}

  async execute(): Promise<{ data: Course[]; total: number }> {
    return this.courseRepo.findAll();
  }
}
