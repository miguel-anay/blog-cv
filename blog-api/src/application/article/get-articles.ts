import type { IArticleRepository } from '../../domain/article/article-repository.js';
import type { Article } from '../../domain/article/types.js';
import { GetArticlesQuerySchema } from './dto.js';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface GetArticlesResult {
  data: Article[];
  meta: PaginationMeta;
}

export class GetArticlesUseCase {
  constructor(private readonly articleRepo: IArticleRepository) {}

  async execute(rawQuery: unknown): Promise<GetArticlesResult> {
    const query = GetArticlesQuerySchema.parse(rawQuery);
    const { data, total } = await this.articleRepo.findAll({
      page: query.page,
      pageSize: query.pageSize,
      category: query.category,
    });

    const pageCount = Math.ceil(total / query.pageSize);
    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        pageCount,
        total,
      },
    };
  }
}
