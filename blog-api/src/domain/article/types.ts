// ── Leaf nodes ──────────────────────────────────────────────────────────────
export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export interface ListItemNode {
  type: 'list-item';
  children: TextNode[];
}

// ── Block union ─────────────────────────────────────────────────────────────
export type ArticleBlock =
  | { type: 'paragraph'; children: TextNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: TextNode[] }
  | { type: 'list'; format: 'ordered' | 'unordered'; children: ListItemNode[] }
  | { type: 'code'; language?: string; children: TextNode[] }
  | { type: 'quote'; children: TextNode[] }
  | { type: 'image'; url: string; alt?: string; caption?: string };

// ── Aggregates ──────────────────────────────────────────────────────────────
export interface Author {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Category {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
}

export interface Article {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  body: ArticleBlock[];
  coverUrl?: string | null;
  coverAlt?: string | null;
  author?: Author | null;
  categories?: Category[];
  readMin: number;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
