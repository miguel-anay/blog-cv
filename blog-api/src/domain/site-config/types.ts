export interface SiteConfig {
  id: number;
  siteTitle: string;
  siteDescription: string;
  aboutMarkdown?: string | null;
  email?: string | null;
  rol?: string | null;
  linkedin?: string | null;
  github?: string | null;
  twitter?: string | null;
  ogImage?: string | null;
}
