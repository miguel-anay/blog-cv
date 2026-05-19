import { NotFoundError } from '../../domain/shared/errors.js';
import type { IArticleRepository } from '../../domain/article/article-repository.js';
import type { Article } from '../../domain/article/types.js';

export class GetArticleBySlugUseCase {
  constructor(private readonly articleRepo: IArticleRepository) {}

  async execute(slug: string): Promise<Article> {
    const article = await this.articleRepo.findBySlug(slug);
    if (!article) throw new NotFoundError(`Article not found: ${slug}`);
    return article;
  }
}
