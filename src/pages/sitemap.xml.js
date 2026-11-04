import { DOC_REPOS } from '../features/docs/repos';
import { docSlug, listDocFiles } from '../features/docs/lib/github-docs';

// Docs URLs: /docs, each repo intro and every docs/ page. A GitHub failure drops only that repo.
async function docsPages() {
  const perRepo = await Promise.all(
    DOC_REPOS.map(async (r) => {
      try {
        const files = await listDocFiles(r.owner, r.repo);
        return [`docs/${r.repo}`, ...files.map((f) => `docs/${r.repo}/${docSlug(f)}`)];
      } catch (error) {
        console.error(`[sitemap] docs listing failed for ${r.repo}:`, error);
        return [`docs/${r.repo}`];
      }
    }),
  );
  return ['docs', ...perRepo.flat()];
}

export async function GET(context) {
  const site = context.site;

  const staticPages = [
    '',
    'about',
    'blog',
    'blog/categories',
    ...(await docsPages()),
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map((page) => `  <url>
    <loc>${site}${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
