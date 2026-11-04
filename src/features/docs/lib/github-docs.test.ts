import { describe, it, expect } from 'vitest';
import { docSlug, docTitle, rewriteDocHtml, extractToc, extractTitle, docPathsFromTree, buildTree } from './github-docs';

describe('docPathsFromTree', () => {
  it('keeps markdown blobs under docs/, relative to docs/, including subfolders', () => {
    const tree = [
      { type: 'blob', path: 'README.md' },
      { type: 'blob', path: 'docs/SETUP.md' },
      { type: 'blob', path: 'docs/guides/intro.md' },
      { type: 'blob', path: 'docs/demo.gif' },
      { type: 'tree', path: 'docs/guides' },
    ];
    expect(docPathsFromTree(tree)).toEqual(['guides/intro.md', 'SETUP.md']);
  });

  it('hides files and folders starting with _ or .', () => {
    const tree = [
      { type: 'blob', path: 'docs/_draft.md' },
      { type: 'blob', path: 'docs/_internal/notes.md' },
      { type: 'blob', path: 'docs/.github/x.md' },
      { type: 'blob', path: 'docs/ok.md' },
    ];
    expect(docPathsFromTree(tree)).toEqual(['ok.md']);
  });
});

describe('buildTree', () => {
  it('emits folder rows before their files, with depth and last-sibling flags', () => {
    expect(buildTree(['guides/a.md', 'guides/b.md', 'SETUP.md'])).toEqual([
      { kind: 'dir', name: 'guides/', depth: 0, last: false },
      { kind: 'file', name: 'a.md', path: 'guides/a.md', depth: 1, last: false },
      { kind: 'file', name: 'b.md', path: 'guides/b.md', depth: 1, last: true },
      { kind: 'file', name: 'SETUP.md', path: 'SETUP.md', depth: 0, last: true },
    ]);
  });
});

const ctx = { owner: 'miguel-anay', repo: 'career-ops', branch: 'main', path: 'docs/SETUP.md', docFiles: ['SETUP.md', 'ARCHITECTURE.md'] };

describe('docSlug / docTitle', () => {
  it('turns a markdown filename into a lowercase url slug', () => {
    expect(docSlug('SETUP.md')).toBe('setup');
    expect(docSlug('local-parser-cookbook.md')).toBe('local-parser-cookbook');
  });

  it('turns a markdown filename into a readable title', () => {
    expect(docTitle('local-parser-cookbook.md')).toBe('Local parser cookbook');
    expect(docTitle('SETUP.md')).toBe('Setup');
  });

  it('keeps the folder in the slug and uses only the file name for the title', () => {
    expect(docSlug('guides/Getting-Started.md')).toBe('guides/getting-started');
    expect(docTitle('guides/getting-started.md')).toBe('Getting started');
  });
});

describe('rewriteDocHtml', () => {
  it('strips the GitHub user-content- prefix so heading anchors work', () => {
    const out = rewriteDocHtml('<a id="user-content-prerequisites" href="#prerequisites"></a>', ctx);
    expect(out).toContain('id="prerequisites"');
  });

  it('rewrites links to sibling docs into site routes', () => {
    expect(rewriteDocHtml('<a href="ARCHITECTURE.md#flow">x</a>', ctx)).toContain('href="/docs/career-ops/architecture#flow"');
    expect(rewriteDocHtml('<a href="./ARCHITECTURE.md">x</a>', ctx)).toContain('href="/docs/career-ops/architecture"');
  });

  it('resolves links between docs in subfolders', () => {
    const nested = { ...ctx, path: 'docs/guides/intro.md', docFiles: ['SETUP.md', 'guides/intro.md'] };
    expect(rewriteDocHtml('<a href="../SETUP.md">x</a>', nested)).toContain('href="/docs/career-ops/setup"');
    expect(rewriteDocHtml('<a href="../../README.md">x</a>', nested)).toContain('href="/docs/career-ops"');
  });

  it('rewrites README links into docs/ to site routes', () => {
    const readme = { ...ctx, path: 'README.md' };
    expect(rewriteDocHtml('<a href="docs/SETUP.md">x</a>', readme)).toContain('href="/docs/career-ops/setup"');
  });

  it('points other relative links at the file on GitHub', () => {
    const readme = { ...ctx, path: 'README.md' };
    expect(rewriteDocHtml('<a href="LICENSE">x</a>', readme)).toContain('href="https://github.com/miguel-anay/career-ops/blob/main/LICENSE"');
  });

  it('points relative images at raw.githubusercontent.com', () => {
    expect(rewriteDocHtml('<img src="demo.gif">', ctx)).toContain('src="https://raw.githubusercontent.com/miguel-anay/career-ops/main/docs/demo.gif"');
  });

  it('leaves absolute, anchor and mail links untouched', () => {
    const html = '<a href="https://x.dev">a</a><a href="#top">b</a><a href="mailto:a@b.c">c</a><img src="https://camo.githubusercontent.com/i">';
    expect(rewriteDocHtml(html, ctx)).toBe(html);
  });
});

describe('extractTitle', () => {
  it('returns the text of the first h1, with tags and entities decoded', () => {
    const html = '<div class="markdown-heading"><h1 class="heading-element">METODO — el <code>flujo</code> &amp; más</h1><a id="x"></a></div><h1>Second</h1>';
    expect(extractTitle(html)).toBe('METODO — el flujo & más');
  });

  it('returns null when there is no h1', () => {
    expect(extractTitle('<h2>Only h2</h2>')).toBeNull();
  });
});

describe('extractToc', () => {
  it('lists h2 and h3 headings with their anchor ids, skipping h1', () => {
    const html =
      '<h1 class="heading-element">Setup</h1><a id="setup" class="anchor"></a>' +
      '<h2 class="heading-element">Prerequisites</h2><a id="prerequisites" class="anchor"></a>' +
      '<h3 class="heading-element">Node <code>22</code></h3><a id="node-22" class="anchor"></a>';
    expect(extractToc(html)).toEqual([
      { depth: 2, text: 'Prerequisites', id: 'prerequisites' },
      { depth: 3, text: 'Node 22', id: 'node-22' },
    ]);
  });
});
