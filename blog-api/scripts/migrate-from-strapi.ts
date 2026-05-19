/**
 * migrate-from-strapi.ts
 * Fetches data from Strapi and inserts into Turso via Drizzle.
 * Set DRY_RUN=false to actually write.
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';
import * as schema from '../src/infrastructure/db/schema.js';
import { ReadMin } from '../src/domain/article/read-min.js';
import type { ArticleBlock } from '../src/domain/article/types.js';

const STRAPI_URL = process.env.STRAPI_URL ?? 'http://localhost:1337';
const STRAPI_TOKEN = process.env.STRAPI_TOKEN ?? '';
const DRY_RUN = (process.env.DRY_RUN ?? 'true') !== 'false';

// ── Strapi fetch helper ───────────────────────────────────────────────────────
async function strapiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${STRAPI_URL}${path}`, {
    headers: STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {},
  });
  if (!res.ok) throw new Error(`Strapi fetch failed: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function makeAbsolute(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${STRAPI_URL}${url}`;
}

// ── DynamicZone block transformer ─────────────────────────────────────────────
function transformBlock(block: Record<string, unknown>): ArticleBlock | null {
  const component = block.__component as string | undefined;

  switch (component) {
    case 'shared.rich-text': {
      // Spread Lexical nodes array
      const body = block.body as ArticleBlock[] | undefined;
      if (!body || !Array.isArray(body)) return null;
      // Return first block or create a paragraph wrapper
      return body[0] ?? null;
    }
    case 'shared.code': {
      return {
        type: 'code',
        language: (block.language as string) || undefined,
        children: [{ type: 'text', text: (block.code as string) ?? '' }],
      };
    }
    case 'shared.media': {
      const file = block.file as Record<string, unknown> | undefined;
      return {
        type: 'image',
        url: makeAbsolute((file?.url as string) ?? ''),
        alt: (file?.alternativeText as string) || undefined,
        caption: (file?.caption as string) || undefined,
      };
    }
    case 'shared.slider': {
      const files = block.files as Array<Record<string, unknown>> | undefined;
      if (!files || files.length === 0) return null;
      // Return the first image only (multiple images not in ArticleBlock union)
      return {
        type: 'image',
        url: makeAbsolute((files[0]?.url as string) ?? ''),
        alt: (files[0]?.alternativeText as string) || undefined,
      };
    }
    case 'shared.quote': {
      return {
        type: 'quote',
        children: [{ type: 'text', text: (block.body as string) ?? '' }],
      };
    }
    default: {
      console.warn(`[migrate] Unknown block component: ${component ?? 'undefined'} — skipping`);
      return null;
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[migrate] DRY_RUN=${DRY_RUN}`);
  console.log(`[migrate] STRAPI_URL=${STRAPI_URL}`);

  // Fetch data in parallel
  const [articlesRes, categoriesRes, authorsRes] = await Promise.all([
    strapiGet<{ data: unknown[] }>('/api/articles?populate=*&pagination[pageSize]=100'),
    strapiGet<{ data: unknown[] }>('/api/categories'),
    strapiGet<{ data: unknown[] }>('/api/authors?populate=avatar'),
  ]);

  const strapiAuthors = authorsRes.data as Array<Record<string, unknown>>;
  const strapiCategories = categoriesRes.data as Array<Record<string, unknown>>;
  const strapiArticles = articlesRes.data as Array<Record<string, unknown>>;

  console.log('\n── Summary ──────────────────────────────────────────────────────');
  console.log(`  Authors    : ${strapiAuthors.length}`);
  console.log(`  Categories : ${strapiCategories.length}`);
  console.log(`  Articles   : ${strapiArticles.length}`);
  console.log('─────────────────────────────────────────────────────────────────\n');

  if (DRY_RUN) {
    console.log('[migrate] DRY_RUN=true — no data written. Set DRY_RUN=false to insert.');
    process.exit(0);
  }

  // Connect to Turso
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_TOKEN,
  });
  const db = drizzle(client, { schema });

  // Insert authors
  for (const a of strapiAuthors) {
    const attrs = (a.attributes as Record<string, unknown>) ?? a;
    const avatar = attrs.avatar as Record<string, unknown> | undefined;
    await db
      .insert(schema.authors)
      .values({
        name: (attrs.name as string) ?? 'Unknown',
        email: (attrs.email as string) ?? `author-${a.id}@migration.local`,
        avatarUrl: avatar ? makeAbsolute((avatar.url as string) ?? '') : null,
      })
      .onConflictDoNothing();
  }
  console.log(`[migrate] Inserted ${strapiAuthors.length} authors`);

  // Insert categories
  const catSlugToId: Record<string, number> = {};
  for (const cat of strapiCategories) {
    const attrs = (cat.attributes as Record<string, unknown>) ?? cat;
    await db
      .insert(schema.categories)
      .values({
        slug: (attrs.slug as string) ?? String(cat.id),
        name: (attrs.name as string) ?? 'Unnamed',
        description: (attrs.description as string) || null,
      })
      .onConflictDoNothing();

    // Reload to get ID
    const rows = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(sql`slug = ${attrs.slug}`);
    if (rows[0]) catSlugToId[attrs.slug as string] = rows[0].id;
  }
  console.log(`[migrate] Inserted ${strapiCategories.length} categories`);

  // Insert articles
  for (const article of strapiArticles) {
    const attrs = (article.attributes as Record<string, unknown>) ?? article;
    const blocks = ((attrs.blocks as unknown[]) ?? []) as Array<Record<string, unknown>>;
    const body: ArticleBlock[] = blocks
      .map(transformBlock)
      .filter((b): b is ArticleBlock => b !== null);

    const readMin = ReadMin.fromBlocks(body);
    const cover = attrs.cover as Record<string, unknown> | undefined;
    const coverData = cover?.data as Record<string, unknown> | undefined;
    const coverAttrs = coverData?.attributes as Record<string, unknown> | undefined;

    await db
      .insert(schema.articles)
      .values({
        slug: (attrs.slug as string) ?? String(article.id),
        title: (attrs.title as string) ?? 'Untitled',
        description: (attrs.description as string) ?? '',
        body: JSON.stringify(body) as unknown as (typeof schema.articles.$inferInsert)['body'],
        coverUrl: coverAttrs ? makeAbsolute((coverAttrs.url as string) ?? '') : null,
        coverAlt: (coverAttrs?.alternativeText as string) || null,
        authorId: null,
        readMin,
        publishedAt: (attrs.publishedAt as string) || null,
      })
      .onConflictDoNothing();

    // Link categories
    const articleSlug = (attrs.slug as string) ?? String(article.id);
    const articleRows = await db
      .select({ id: schema.articles.id })
      .from(schema.articles)
      .where(sql`slug = ${articleSlug}`);

    if (articleRows[0]) {
      const articleId = articleRows[0].id;
      const articleCats = attrs.categories as { data: Array<Record<string, unknown>> } | undefined;
      for (const cat of articleCats?.data ?? []) {
        const catAttrs = (cat.attributes as Record<string, unknown>) ?? cat;
        const catId = catSlugToId[catAttrs.slug as string];
        if (catId) {
          await db
            .insert(schema.articleCategories)
            .values({ articleId, categoryId: catId })
            .onConflictDoNothing();
        }
      }
    }
  }
  console.log(`[migrate] Inserted ${strapiArticles.length} articles`);
  console.log('[migrate] Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
