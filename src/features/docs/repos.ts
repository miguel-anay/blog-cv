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
    repo: 'duck-kit',
    title: 'duck',
    description: 'Claude Code plugin that packages a workflow: one branch per task, a single gate to the remote, and a ticket that follows the work (Jira or GitHub Projects).',
    stack: 'claude-code · node · git',
  },
];

export const findDocRepo = (repo: string | undefined) => DOC_REPOS.find((r) => r.repo === repo);
