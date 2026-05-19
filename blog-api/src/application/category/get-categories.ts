import type { ICategoryRepository } from '../../domain/article/category-repository.js';
import type { Category } from '../../domain/article/types.js';

export class GetCategoriesUseCase {
  constructor(private readonly categoryRepo: ICategoryRepository) {}

  async execute(): Promise<Category[]> {
    return this.categoryRepo.findAll();
  }
}
