import type { ICategoryRepository } from '../../domain/article/category-repository.js';

export class GetCategoryCountsUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(): Promise<Record<string, number>> {
    return this.categoryRepo.countsBySlug();
  }
}
