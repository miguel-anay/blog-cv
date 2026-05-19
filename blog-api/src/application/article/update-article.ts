import { NotFoundError, ValidationError } from '../../domain/shared/errors.js';
import type { IArticleRepository } from '../../domain/article/article-repository.js';
import type { Article } from '../../domain/article/types.js';
import { UpdateArticleSchema } from './dto.js';
import { ZodError } from 'zod';

export class UpdateArticleUseCase {
  constructor(private readonly articleRepo: IArticleRepository) {}

  async execute(slug: string, raw: unknown): Promise<Article> {
    let input;
    try {
      input = UpdateArticleSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join('; '));
      }
      throw err;
    }

    const exists = await this.articleRepo.slugExists(slug);
    if (!exists) throw new NotFoundError(`Article not found: ${slug}`);

    const updated = await this.articleRepo.update(slug, {
      title: input.title,
      description: input.description ?? undefined,
      body: input.body as Article['body'] | undefined,
      coverUrl: input.cover_url ?? undefined,
      coverAlt: input.cover_alt ?? undefined,
      authorId: input.author_id ?? undefined,
      categoryIds: input.categories,
      publishedAt: input.published_at ?? undefined,
    });

    return updated!;
  }
}
