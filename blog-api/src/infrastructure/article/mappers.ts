import type { Article, Author, Category, ArticleBlock } from '../../domain/article/types.js';

type DbArticleRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string | ArticleBlock[];
  coverUrl: string | null;
  coverAlt: string | null;
  readMin: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbAuthorRow = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
} | null;

type DbCategoryRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
};

export function mapAuthor(row: DbAuthorRow): Author | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
  };
}

export function mapCategory(row: DbCategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
  };
}

export function mapArticle(
  row: DbArticleRow,
  author: DbAuthorRow = null,
  cats: DbCategoryRow[] = [],
): Article {
  const body: ArticleBlock[] =
    typeof row.body === 'string' ? JSON.parse(row.body) : row.body;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    body,
    coverUrl: row.coverUrl,
    coverAlt: row.coverAlt,
    author: mapAuthor(author),
    categories: cats.map(mapCategory),
    readMin: row.readMin,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
