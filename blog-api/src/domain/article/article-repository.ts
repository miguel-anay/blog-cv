import type { Article } from './types.js';

export interface FindAllOptions {
  page: number;
  pageSize: number;
  category?: string;
}

export interface FindAllResult {
  data: Article[];
  total: number;
}

export interface CreateArticleInput {
  slug: string;
  title: string;
  description?: string | null;
  body: Article['body'];
  coverUrl?: string | null;
  coverAlt?: string | null;
  authorId?: number | null;
  publishedAt?: string | null;
  categoryIds?: number[];
}

export interface UpdateArticleInput {
  title?: string;
  description?: string | null;
  body?: Article['body'];
  coverUrl?: string | null;
  coverAlt?: string | null;
  authorId?: number | null;
  publishedAt?: string | null;
  categoryIds?: number[];
}

export interface IArticleRepository {
  findAll(opts: FindAllOptions): Promise<FindAllResult>;
  findBySlug(slug: string): Promise<Article | null>;
  create(input: CreateArticleInput): Promise<Article>;
  update(slug: string, input: UpdateArticleInput): Promise<Article | null>;
  deleteBySlug(slug: string): Promise<boolean>;
  slugExists(slug: string): Promise<boolean>;
}
