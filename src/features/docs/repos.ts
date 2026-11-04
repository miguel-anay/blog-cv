// Allowlist of documented repositories. Only these are fetched from GitHub,
// so /docs/<repo> can never be used to proxy arbitrary repos.
// Docs source: README.md (intro) + docs/*.md (one page per file).

export interface DocRepo {
  owner: string;
  repo: string;
  title: string;
  description: string;
  /** Short stack label shown on the index card. */
  stack: string;
}

export const DOC_REPOS: DocRepo[] = [
  {
    owner: 'miguel-anay',
    repo: 'career-ops',
    title: 'career-ops',
    description: 'AI-powered job search system built on Claude Code: skill modes, Go dashboard, PDF generation and batch processing.',
    stack: 'claude-code · go · node',
  },
];

export const findDocRepo = (repo: string | undefined) => DOC_REPOS.find((r) => r.repo === repo);
