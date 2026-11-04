import type { APIRoute } from 'astro';
import { DOC_REPOS } from '../../features/docs/repos';
import { DEFAULT_BRANCH, docSlug, docTitle, extractToc, getDocHtml, listDocFiles } from '../../features/docs/lib/github-docs';

// Search index for every documented page: title, h2/h3 headings and url.
// ponytail: fetches every page on a cache miss; CDN caches it for an hour. Prebuild it if repos grow to hundreds of pages.
export const GET: APIRoute = async () => {
  const perRepo = await Promise.all(
    DOC_REPOS.map(async (r) => {
      try {
        const docFiles = await listDocFiles(r.owner, r.repo);
        const pages = [
          { title: `${r.title} — Introduction`, path: 'README.md', url: `/docs/${r.repo}` },
          ...docFiles.map((f) => ({ title: docTitle(f), path: `docs/${f}`, url: `/docs/${r.repo}/${docSlug(f)}` })),
        ];
        return await Promise.all(
          pages.map(async (p) => {
            const html = await getDocHtml({ owner: r.owner, repo: r.repo, branch: DEFAULT_BRANCH, path: p.path, docFiles });
            return { repo: r.repo, title: p.title, url: p.url, headings: html ? extractToc(html).map((t) => t.text) : [] };
          }),
        );
      } catch (error) {
        console.error(`[docs] search index failed for ${r.repo}:`, error);
        return [];
      }
    }),
  );

  return new Response(JSON.stringify(perRepo.flat()), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
};
