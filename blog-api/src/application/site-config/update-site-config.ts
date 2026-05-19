import { z, ZodError } from 'zod';
import { ValidationError } from '../../domain/shared/errors.js';
import type { ISiteConfigRepository, UpdateSiteConfigInput } from '../../domain/site-config/site-config-repository.js';
import type { SiteConfig } from '../../domain/site-config/types.js';

const UpdateSiteConfigSchema = z
  .object({
    siteTitle: z.string().min(1).optional(),
    siteDescription: z.string().optional(),
    aboutMarkdown: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    rol: z.string().optional().nullable(),
    linkedin: z.string().url().optional().nullable(),
    github: z.string().url().optional().nullable(),
    twitter: z.string().optional().nullable(),
    ogImage: z.string().url().optional().nullable(),
  })
  .partial();

export class UpdateSiteConfigUseCase {
  constructor(private readonly siteConfigRepo: ISiteConfigRepository) {}

  async execute(raw: unknown): Promise<SiteConfig | null> {
    let input: UpdateSiteConfigInput;
    try {
      input = UpdateSiteConfigSchema.parse(raw) as UpdateSiteConfigInput;
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ValidationError(err.errors.map((e) => e.message).join('; '));
      }
      throw err;
    }
    return this.siteConfigRepo.update(input);
  }
}
