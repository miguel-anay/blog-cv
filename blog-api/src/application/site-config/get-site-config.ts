import type { ISiteConfigRepository } from '../../domain/site-config/site-config-repository.js';
import type { SiteConfig } from '../../domain/site-config/types.js';

export class GetSiteConfigUseCase {
  constructor(private readonly siteConfigRepo: ISiteConfigRepository) {}

  async execute(): Promise<SiteConfig | null> {
    return this.siteConfigRepo.get();
  }
}
