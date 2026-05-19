import { ConflictError, ValidationError } from '../../domain/shared/errors.js';
import type { IArticleRepository } from '../../domain/article/article-repository.js';
import type { Article } from '../../domain/article/types.js';
import { CreateArticleSchema } from './dto.js';
import { ZodError } from 'zod';

export class CreateArticleUseCase {
  constructor(private readonly articleRepo: IArticleRepository) {}

  async execute(raw: unknown): Promise<Article> {
    let input;
    try {
      input = CreateArticleSchema.parse(raw);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join('; '));
      }
      throw err;
    }

    const exists = await this.articleRepo.slugExists(input.slug);
    if (exists) throw new ConflictError(`Article with slug '${input.slug}' already exists`);

    return this.articleRepo.create({
      slug: input.slug,
      title: input.title,
      description: input.description,
      body: input.body as Article['body'],
      coverUrl: input.cover_url ?? null,
      coverAlt: input.cover_alt ?? null,
      authorId: input.author_id ?? null,
      categoryIds: input.categories,
      publishedAt: input.published_at ?? null,
    });
  }
}
