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
  sessionNumber?: number | null;
}

export interface CourseSession {
  number: number;
  title: string;
  video?: CourseResource;
  materials: CourseResource[];
  anchorId: string;
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

// ── Exams ──────────────────────────────────────────────────────────────────

export interface ExamSummary {
  id: number;
  slug: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  level: string;
  timeLimitSeconds: number;
  passScorePercent: number;
  publishedAt?: string | null;
  questionCount: number;
}

export interface ExamOption {
  id: number;
  order: number;
  text: string;
}

/** Same shape as the listing — kept as its own name because the detail page is a distinct call site. */
export type ExamDetail = ExamSummary;

/** A single question rendered for an in-progress attempt — never carries isCorrect. */
export interface AttemptQuestion {
  id: number;
  order: number;
  prompt: string;
  allowMultiple: boolean;
  options: ExamOption[];
  selectedOptionId?: number | null;
  flaggedForReview: boolean;
}

// Timestamp fields below are native Date objects (as returned by drizzle's
// `{ mode: 'timestamp' }` integer columns) rather than strings — exam-api.ts
// is called directly from Astro frontmatter (no JSON boundary), and callers
// like TimerDisplay need raw epoch ms (`.getTime()`) for client-side timer math.

export interface ExamAttempt {
  id: number;
  examId: number;
  userId: string;
  timeLimitSeconds: number;
  startedAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  score: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
  createdAt: Date;
}

export interface ExamAttemptSummary {
  id: number;
  startedAt: Date;
  submittedAt: Date | null;
  autoSubmitted: boolean;
  score: number | null;
  correctCount: number | null;
  totalQuestions: number | null;
}

export interface ExamResultQuestion {
  id: number;
  order: number;
  prompt: string;
  explanation?: string | null;
  options: Array<ExamOption & { isCorrect: boolean }>;
  selectedOptionId: number | null;
  isCorrect: boolean;
  flaggedForReview: boolean;
}

export interface ExamResult {
  attemptId: number;
  examId: number;
  examSlug: string;
  examTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  passScorePercent: number;
  passed: boolean;
  submittedAt: Date;
  autoSubmitted: boolean;
  questions: ExamResultQuestion[];
}

export interface AttemptStatus {
  remainingSeconds: number;
  paused: boolean;
  submitted: boolean;
  expired: boolean;
  redirectTo?: string;
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
