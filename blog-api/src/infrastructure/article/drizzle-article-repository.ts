import { eq, desc, sql, inArray } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { IArticleRepository, FindAllOptions, FindAllResult, CreateArticleInput, UpdateArticleInput } from '../../domain/article/article-repository.js';
import type { Article } from '../../domain/article/types.js';
import { ReadMin } from '../../domain/article/read-min.js';
import * as schema from '../db/schema.js';
import { mapArticle } from './mappers.js';

type Db = LibSQLDatabase<typeof schema>;

export class DrizzleArticleRepository implements IArticleRepository {
  constructor(private readonly db: Db) {}

  async findAll(opts: FindAllOptions): Promise<FindAllResult> {
    const { page, pageSize, categorySlug } = { ...opts, categorySlug: opts.category };
    const offset = (page - 1) * pageSize;

    let baseQuery = this.db
      .select({ id: schema.articles.id })
      .from(schema.articles);

    if (categorySlug) {
      baseQuery = baseQuery
        .innerJoin(schema.articleCategories, eq(schema.articleCategories.articleId, schema.articles.id))
        .innerJoin(schema.categories, eq(schema.categories.id, schema.articleCategories.categoryId))
        .where(eq(schema.categories.slug, categorySlug)) as typeof baseQuery;
    }

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.articles)
        .orderBy(desc(schema.articles.publishedAt))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles),
    ]);

    let filtered = rows;
    if (categorySlug) {
      const ids = (
        await this.db
          .select({ id: schema.articles.id })
          .from(schema.articles)
          .innerJoin(schema.articleCategories, eq(schema.articleCategories.articleId, schema.articles.id))
          .innerJoin(schema.categories, eq(schema.categories.id, schema.articleCategories.categoryId))
          .where(eq(schema.categories.slug, categorySlug))
      ).map((r) => r.id);

      filtered = rows.filter((r) => ids.includes(r.id));

      const allFiltered = await this.db
        .select()
        .from(schema.articles)
        .innerJoin(schema.articleCategories, eq(schema.articleCategories.articleId, schema.articles.id))
        .innerJoin(schema.categories, eq(schema.categories.id, schema.articleCategories.categoryId))
        .where(eq(schema.categories.slug, categorySlug))
        .orderBy(desc(schema.articles.publishedAt))
        .limit(pageSize)
        .offset(offset);

      const total = allFiltered.length;
      const articles = await Promise.all(
        allFiltered.map(async (r) => {
          const cats = await this.getCategoriesForArticle(r.articles.id);
          const author = r.articles.authorId
            ? await this.getAuthor(r.articles.authorId)
            : null;
          return mapArticle(
            { ...r.articles, coverUrl: r.articles.coverUrl ?? null, coverAlt: r.articles.coverAlt ?? null },
            author,
            cats,
          );
        }),
      );

      const fullCount = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.articles)
        .innerJoin(schema.articleCategories, eq(schema.articleCategories.articleId, schema.articles.id))
        .innerJoin(schema.categories, eq(schema.categories.id, schema.articleCategories.categoryId))
        .where(eq(schema.categories.slug, categorySlug));

      const totalCount = Number(fullCount[0]?.count ?? 0);
      return { data: articles, total: totalCount };
    }

    const total = Number(countRows[0]?.count ?? 0);
    const articles = await Promise.all(
      rows.map(async (row) => {
        const cats = await this.getCategoriesForArticle(row.id);
        const author = row.authorId ? await this.getAuthor(row.authorId) : null;
        return mapArticle({ ...row, coverUrl: row.coverUrl ?? null, coverAlt: row.coverAlt ?? null }, author, cats);
      }),
    );

    return { data: articles, total };
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const rows = await this.db
      .select()
      .from(schema.articles)
      .where(eq(schema.articles.slug, slug))
      .limit(1);

    if (!rows[0]) return null;
    const row = rows[0];
    const cats = await this.getCategoriesForArticle(row.id);
    const author = row.authorId ? await this.getAuthor(row.authorId) : null;
    return mapArticle({ ...row, coverUrl: row.coverUrl ?? null, coverAlt: row.coverAlt ?? null }, author, cats);
  }

  async slugExists(slug: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: schema.articles.id })
      .from(schema.articles)
      .where(eq(schema.articles.slug, slug))
      .limit(1);
    return rows.length > 0;
  }

  async create(input: CreateArticleInput): Promise<Article> {
    const readMin = ReadMin.fromBlocks(input.body);
    const bodyJson = JSON.stringify(input.body);

    await this.db.transaction(async (tx) => {
      await tx.insert(schema.articles).values({
        slug: input.slug,
        title: input.title,
        description: input.description ?? '',
        body: bodyJson as unknown as typeof schema.articles.$inferInsert['body'],
        coverUrl: input.coverUrl ?? null,
        coverAlt: input.coverAlt ?? null,
        authorId: input.authorId ?? null,
        readMin,
        publishedAt: input.publishedAt ?? null,
      });

      if (input.categoryIds && input.categoryIds.length > 0) {
        const articleRows = await tx
          .select({ id: schema.articles.id })
          .from(schema.articles)
          .where(eq(schema.articles.slug, input.slug))
          .limit(1);
        const articleId = articleRows[0]!.id;

        await tx.insert(schema.articleCategories).values(
          input.categoryIds.map((cid) => ({ articleId, categoryId: cid })),
        );
      }
    });

    const created = await this.findBySlug(input.slug);
    return created!;
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    const existing = await this.findBySlug(slug);
    if (!existing) return false;

    await this.db.transaction(async (tx) => {
      await tx.delete(schema.articleCategories).where(eq(schema.articleCategories.articleId, existing.id));
      await tx.delete(schema.articles).where(eq(schema.articles.slug, slug));
    });

    return true;
  }

  async update(slug: string, patch: UpdateArticleInput): Promise<Article | null> {
    const existing = await this.findBySlug(slug);
    if (!existing) return null;

    const readMin = patch.body ? ReadMin.fromBlocks(patch.body) : existing.readMin;
    const updateData: Partial<typeof schema.articles.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description ?? '';
    if (patch.body !== undefined) {
      updateData.body = JSON.stringify(patch.body) as unknown as typeof schema.articles.$inferInsert['body'];
      updateData.readMin = readMin;
    }
    if (patch.coverUrl !== undefined) updateData.coverUrl = patch.coverUrl ?? null;
    if (patch.coverAlt !== undefined) updateData.coverAlt = patch.coverAlt ?? null;
    if (patch.authorId !== undefined) updateData.authorId = patch.authorId ?? null;
    if (patch.publishedAt !== undefined) updateData.publishedAt = patch.publishedAt ?? null;

    await this.db.transaction(async (tx) => {
      await tx.update(schema.articles).set(updateData).where(eq(schema.articles.slug, slug));

      if (patch.categoryIds !== undefined) {
        await tx
          .delete(schema.articleCategories)
          .where(eq(schema.articleCategories.articleId, existing.id));

        if (patch.categoryIds.length > 0) {
          await tx.insert(schema.articleCategories).values(
            patch.categoryIds.map((cid) => ({ articleId: existing.id, categoryId: cid })),
          );
        }
      }
    });

    return this.findBySlug(slug);
  }

  private async getCategoriesForArticle(articleId: number) {
    const rows = await this.db
      .select({ id: schema.categories.id, slug: schema.categories.slug, name: schema.categories.name, description: schema.categories.description })
      .from(schema.categories)
      .innerJoin(schema.articleCategories, eq(schema.articleCategories.categoryId, schema.categories.id))
      .where(eq(schema.articleCategories.articleId, articleId));
    return rows;
  }

  private async getAuthor(authorId: number) {
    const rows = await this.db
      .select()
      .from(schema.authors)
      .where(eq(schema.authors.id, authorId))
      .limit(1);
    return rows[0] ?? null;
  }
}
