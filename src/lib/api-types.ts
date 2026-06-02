// API types matching lambda-api contracts
// Re-exports CvData from existing cv-types.ts

export type { CvData } from './cv-types';

// ── Block types ────────────────────────────────────────────────────────────
export interface TextNode {
  type: 'text';
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface ListItemNode {
  type: 'list-item';
  children: TextNode[];
}

export type ArticleBlock =
  | { type: 'paragraph'; children: TextNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: TextNode[] }
  | { type: 'list'; format: 'ordered' | 'unordered'; children: ListItemNode[] }
  | { type: 'code'; language?: string; children: TextNode[] }
  | { type: 'quote'; children: TextNode[] }
  | { type: 'image'; url: string; alt?: string; caption?: string };

// ── Author & Category ──────────────────────────────────────────────────────
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

// ── Article ────────────────────────────────────────────────────────────────
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

// ── List response ──────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
}

export interface ArticleListResponse {
  data: Article[];
  meta: PaginationMeta;
}

// ── Courses ────────────────────────────────────────────────────────────────
export interface CourseResource {
  id: number;
  sectionId: number;
  order: number;
  type: 'github' | 'video' | 'link';
  title: string;
  url: string;
  description?: string | null;
}

export interface CourseSection {
  id: number;
  courseId: number;
  order: number;
  title: string;
  description?: string | null;
  content?: string | null;
  resources: CourseResource[];
}

export interface Course {
  id: number;
  slug: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  level: string;
  type: 'course' | 'diplomado';
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: CourseSection[];
  sectionCount?: number;
}

// ── Site Config ────────────────────────────────────────────────────────────
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
