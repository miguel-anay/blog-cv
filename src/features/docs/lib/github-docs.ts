// Fetches docs straight from GitHub repos: README.md is the intro page and
// every docs/*.md file is a page. GitHub renders the markdown to sanitized
// HTML (Accept: application/vnd.github.html), so no markdown pipeline here.

export interface DocContext {
  owner: string;
  repo: string;
  branch: string;
  /** Repo-relative path of the file being rendered, e.g. "docs/SETUP.md". */
  path: string;
  /** File names inside docs/ that have a site route. */
  docFiles: string[];
}

export interface TocItem {
  depth: 2 | 3;
  text: string;
  id: string;
}

// ponytail: "HEAD" resolves to the default branch on github.com and raw URLs, saves an API call.
export const DEFAULT_BRANCH = 'HEAD';

export const docSlug = (file: string) => file.replace(/\.md$/i, '').toLowerCase();

export const docTitle = (file: string) => {
  const words = docSlug(file.split('/').pop() ?? file).replace(/[-_]+/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// ── docs/ tree ────────────────────────────────────────────────

const isHiddenSegment = (segment: string) => segment.startsWith('_') || segment.startsWith('.');

/** Markdown files under docs/ (relative to docs/), hidden files/folders removed, sorted. */
export function docPathsFromTree(tree: Array<{ type: string; path: string }>): string[] {
  return tree
    .filter((n) => n.type === 'blob' && n.path.startsWith('docs/') && /\.md$/i.test(n.path))
    .map((n) => n.path.slice('docs/'.length))
    .filter((p) => !p.split('/').some(isHiddenSegment))
    .sort((a, b) => a.localeCompare(b));
}

export interface TreeRow {
  kind: 'dir' | 'file';
  name: string;
  /** Docs-relative path, files only. */
  path?: string;
  depth: number;
  /** Last sibling at its depth: drawn with └── instead of ├──. */
  last: boolean;
}

/** Flatten sorted docs paths into sidebar rows, opening a folder row before its files. */
export function buildTree(paths: string[]): TreeRow[] {
  const rows: TreeRow[] = [];
  let open: string[] = [];
  for (const path of paths) {
    const parts = path.split('/');
    const dirs = parts.slice(0, -1);
    let i = 0;
    while (i < open.length && open[i] === dirs[i]) i++;
    open = open.slice(0, i);
    for (; i < dirs.length; i++) {
      rows.push({ kind: 'dir', name: `${dirs[i]}/`, depth: i, last: false });
      open.push(dirs[i]);
    }
    rows.push({ kind: 'file', name: parts[parts.length - 1], path, depth: dirs.length, last: false });
  }
  // ponytail: O(n²) scan, fine for docs folders with tens of files.
  rows.forEach((row, i) => {
    const next = rows.slice(i + 1).find((n) => n.depth <= row.depth);
    row.last = !next || next.depth < row.depth;
  });
  return rows;
}

const isExternal = (url: string) => /^([a-z][a-z0-9+.-]*:|#|\/)/i.test(url);

/** Resolve a relative URL against the file's directory. Returns repo path + hash. */
const resolveRelative = (url: string, fromPath: string) => {
  const resolved = new URL(url, `https://repo.local/${fromPath}`);
  return { path: decodeURIComponent(resolved.pathname.slice(1)), hash: resolved.hash };
};

export function rewriteDocHtml(html: string, ctx: DocContext): string {
  const { owner, repo, branch, path, docFiles } = ctx;

  return html
    .replace(/id="user-content-/g, 'id="')
    .replace(/href="([^"]+)"/g, (match, href: string) => {
      if (isExternal(href)) return match;
      const target = resolveRelative(href, path);
      if (target.path === 'README.md') return `href="/docs/${repo}${target.hash}"`;
      const file = target.path.startsWith('docs/') ? target.path.slice('docs/'.length) : '';
      if (docFiles.includes(file)) return `href="/docs/${repo}/${docSlug(file)}${target.hash}"`;
      return `href="https://github.com/${owner}/${repo}/blob/${branch}/${target.path}${target.hash}"`;
    })
    .replace(/src="([^"]+)"/g, (match, src: string) => {
      if (isExternal(src)) return match;
      return `src="https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${resolveRelative(src, path).path}"`;
    });
}

const decodeEntities = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Text of the first h1 (the document's own title), or null. */
export function extractTitle(html: string): string | null {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim() : null;
}

/** h2/h3 headings of GitHub-rendered HTML (run after rewriteDocHtml so ids are clean). */
export function extractToc(html: string): TocItem[] {
  const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>\s*<a id="([^"]+)"/g;
  return [...html.matchAll(re)].map(([, depth, inner, id]) => ({
    depth: Number(depth) as 2 | 3,
    text: decodeEntities(inner.replace(/<[^>]+>/g, '')).trim(),
    id,
  }));
}

// ── GitHub API ────────────────────────────────────────────────

const token = () => import.meta.env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

/** GET https://api.github.com/repos/<owner>/<repo>/<endpoint>; null on 404. */
async function gh(owner: string, repo: string, endpoint: string, accept = 'application/vnd.github+json'): Promise<Response | null> {
  const headers: Record<string, string> = { Accept: accept, 'User-Agent': 'blog-cv-docs' };
  const t = token();
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/${endpoint}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${owner}/${repo}/${endpoint}`);
  return res;
}

/** Docs-relative markdown paths of the repo (one API call for the whole tree). */
export async function listDocFiles(owner: string, repo: string): Promise<string[]> {
  const res = await gh(owner, repo, `git/trees/${DEFAULT_BRANCH}?recursive=1`);
  if (!res) return [];
  const { tree } = (await res.json()) as { tree?: Array<{ type: string; path: string }> };
  return docPathsFromTree(tree ?? []);
}

/** GitHub-rendered HTML of a repo file, rewritten for this site. Null when missing. */
export async function getDocHtml(ctx: DocContext): Promise<string | null> {
  const res = await gh(ctx.owner, ctx.repo, `contents/${ctx.path}`, 'application/vnd.github.html');
  return res ? rewriteDocHtml(await res.text(), ctx) : null;
}

/** Date of the last commit touching the file; null when unknown. */
export async function getLastModified(owner: string, repo: string, path: string): Promise<Date | null> {
  const res = await gh(owner, repo, `commits?path=${encodeURIComponent(path)}&per_page=1`);
  const commits = res ? ((await res.json()) as Array<{ commit?: { committer?: { date?: string } } }>) : [];
  const date = commits[0]?.commit?.committer?.date;
  return date ? new Date(date) : null;
}
