import { z } from 'zod';
import type { Article } from '../../domain/article/types.js';
import type { PaginationMeta } from './get-articles.js';

// ── ArticleBlock Zod schema (matches domain types) ────────────────────────────
const TextNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  code: z.boolean().optional(),
});

const ListItemNodeSchema = z.object({
  type: z.literal('list-item'),
  children: z.array(TextNodeSchema),
});

const ArticleBlockSchema = z.union([
  z.object({ type: z.literal('paragraph'), children: z.array(TextNodeSchema) }),
  z.object({ type: z.literal('heading'), level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]), children: z.array(TextNodeSchema) }),
  z.object({ type: z.literal('list'), format: z.enum(['ordered', 'unordered']), children: z.array(ListItemNodeSchema) }),
  z.object({ type: z.literal('code'), language: z.string().optional(), children: z.array(TextNodeSchema) }),
  z.object({ type: z.literal('quote'), children: z.array(TextNodeSchema) }),
  z.object({ type: z.literal('image'), url: z.string(), alt: z.string().optional(), caption: z.string().optional() }),
]);

// ── Query schema ──────────────────────────────────────────────────────────────
export const GetArticlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  category: z.string().optional(),
});

// ── Mutation schemas ──────────────────────────────────────────────────────────
export const CreateArticleSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  body: z.array(ArticleBlockSchema),
  cover_url: z.string().url().optional().nullable(),
  cover_alt: z.string().optional().nullable(),
  author_id: z.number().int().optional().nullable(),
  categories: z.array(z.number().int()).default([]),
  published_at: z.string().datetime().optional().nullable(),
});

export const UpdateArticleSchema = CreateArticleSchema.omit({ slug: true }).partial();

// ── DTO types ─────────────────────────────────────────────────────────────────
export type ArticleDto = Article;

export interface ArticlesListDto {
  data: ArticleDto[];
  meta: PaginationMeta;
}
