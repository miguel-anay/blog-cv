import { defineCollection, z } from 'astro:content';
import { getArticles } from './lib/api.js';

// Blog collection backed by the lambda-api
const blog = defineCollection({
  loader: async () => {
    try {
      const res = await getArticles({ page: 1, pageSize: 100 });
      if (res.data.length === 0) {
        console.warn('[content.config] No articles returned from API. Collection will be empty.');
        return [];
      }
      return res.data.map((article) => ({
        id: article.slug,
        title: article.title ?? 'Sin título',
        description: article.description ?? '',
        pubDate: new Date(article.publishedAt ?? Date.now()),
        updatedDate: (() => { const d = new Date(article.updatedAt); return isNaN(d.getTime()) ? undefined : d; })(),
        heroImage: article.coverUrl ?? undefined,
        author: article.author
          ? {
              name: article.author.name,
              email: article.author.email,
              avatar: article.author.avatarUrl ?? undefined,
            }
          : undefined,
        categories: article.categories?.map((cat) => ({
          name: cat.name,
          slug: cat.slug,
          description: cat.description ?? undefined,
        })) ?? [],
        body: article.body,
        readMin: article.readMin,
      }));
    } catch (error) {
      console.error('[content.config] Error loading articles from API:', error);
      return [];
    }
  },
  schema: z.object({
    title: z.string(),
    description: z.string().nullable().optional().default(''),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    heroImage: z.string().optional(),
    author: z
      .object({
        name: z.string(),
        email: z.string(),
        avatar: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
    categories: z
      .array(
        z.object({
          name: z.string(),
          slug: z.string(),
          description: z.string().optional().nullable(),
        }),
      )
      .optional()
      .default([]),
    body: z.array(z.any()).optional(),
    readMin: z.number().optional().default(1),
  }),
});

export const collections = { blog };
