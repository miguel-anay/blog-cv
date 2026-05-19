import { asc, eq, isNotNull, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { ICategoryRepository } from '../../domain/article/category-repository.js';
import type { Category } from '../../domain/article/types.js';
import * as schema from '../db/schema.js';

type Db = LibSQLDatabase<typeof schema>;

export class DrizzleCategoryRepository implements ICategoryRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.db
      .select()
      .from(schema.categories)
      .orderBy(asc(schema.categories.name));

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      description: r.description,
    }));
  }

  async countsBySlug(): Promise<Record<string, number>> {
    // Count published articles per category
    const rows = await this.db
      .select({
        slug: schema.categories.slug,
        count: sql<number>`count(${schema.articles.id})`,
      })
      .from(schema.categories)
      .leftJoin(
        schema.articleCategories,
        eq(schema.articleCategories.categoryId, schema.categories.id),
      )
      .leftJoin(schema.articles, eq(schema.articles.id, schema.articleCategories.articleId))
      .where(isNotNull(schema.articles.publishedAt))
      .groupBy(schema.categories.slug);

    const counts: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const count = Number(row.count);
      counts[row.slug] = count;
      total += count;
    }
    counts['todos'] = total;
    return counts;
  }
}
