import type { SiteConfig } from './types.js';

export type UpdateSiteConfigInput = Partial<Omit<SiteConfig, 'id'>>;

export interface ISiteConfigRepository {
  get(): Promise<SiteConfig | null>;
  update(input: UpdateSiteConfigInput): Promise<SiteConfig | null>;
}
