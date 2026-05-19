import { NotFoundError } from '../../domain/shared/errors.js';
import type { IArticleRepository } from '../../domain/article/article-repository.js';

export class DeleteArticleUseCase {
  constructor(private readonly articleRepo: IArticleRepository) {}

  async execute(slug: string): Promise<void> {
    const deleted = await this.articleRepo.deleteBySlug(slug);
    if (!deleted) throw new NotFoundError(`Article '${slug}' not found`);
  }
}
