import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { ISiteConfigRepository, UpdateSiteConfigInput } from '../../domain/site-config/site-config-repository.js';
import type { SiteConfig } from '../../domain/site-config/types.js';
import * as schema from '../db/schema.js';

type Db = LibSQLDatabase<typeof schema>;

function mapRow(row: typeof schema.siteConfig.$inferSelect): SiteConfig {
  return {
    id: row.id,
    siteTitle: row.siteTitle,
    siteDescription: row.siteDescription,
    aboutMarkdown: row.aboutMarkdown,
    email: row.email,
    rol: row.rol,
    linkedin: row.linkedin,
    github: row.github,
    twitter: row.twitter,
    ogImage: row.ogImage,
  };
}

export class DrizzleSiteConfigRepository implements ISiteConfigRepository {
  constructor(private readonly db: Db) {}

  async get(): Promise<SiteConfig | null> {
    const rows = await this.db
      .select()
      .from(schema.siteConfig)
      .where(eq(schema.siteConfig.id, 1))
      .limit(1);
    return rows[0] ? mapRow(rows[0]) : null;
  }

  async update(input: UpdateSiteConfigInput): Promise<SiteConfig | null> {
    const updateData: Partial<typeof schema.siteConfig.$inferInsert> = {};

    if (input.siteTitle !== undefined) updateData.siteTitle = input.siteTitle;
    if (input.siteDescription !== undefined) updateData.siteDescription = input.siteDescription;
    if (input.aboutMarkdown !== undefined) updateData.aboutMarkdown = input.aboutMarkdown ?? '';
    if (input.email !== undefined) updateData.email = input.email ?? '';
    if (input.rol !== undefined) updateData.rol = input.rol ?? '';
    if (input.linkedin !== undefined) updateData.linkedin = input.linkedin ?? '';
    if (input.github !== undefined) updateData.github = input.github ?? '';
    if (input.twitter !== undefined) updateData.twitter = input.twitter ?? '';
    if (input.ogImage !== undefined) updateData.ogImage = input.ogImage ?? null;

    if (Object.keys(updateData).length > 0) {
      await this.db
        .update(schema.siteConfig)
        .set(updateData)
        .where(eq(schema.siteConfig.id, 1));
    }

    return this.get();
  }
}
