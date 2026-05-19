import { getDb } from './db/client.js';
import { DrizzleArticleRepository } from './article/drizzle-article-repository.js';
import { DrizzleCategoryRepository } from './category/drizzle-category-repository.js';
import { DrizzleCvRepository } from './cv/drizzle-cv-repository.js';
import { DrizzleSiteConfigRepository } from './site-config/drizzle-site-config-repository.js';
import { ResendNewsletter } from './newsletter/resend-newsletter.js';

export interface Container {
  articleRepo: DrizzleArticleRepository;
  categoryRepo: DrizzleCategoryRepository;
  cvRepo: DrizzleCvRepository;
  siteConfigRepo: DrizzleSiteConfigRepository;
  newsletterService: ResendNewsletter;
}

export function createContainer(): Container {
  const db = getDb();
  return {
    articleRepo: new DrizzleArticleRepository(db),
    categoryRepo: new DrizzleCategoryRepository(db),
    cvRepo: new DrizzleCvRepository(db),
    siteConfigRepo: new DrizzleSiteConfigRepository(db),
    newsletterService: new ResendNewsletter(),
  };
}
