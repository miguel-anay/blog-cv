import type { Course, CourseLevel, ResourceType } from './types.js';

export interface CreateResourceInput {
  type: ResourceType;
  title: string;
  url: string;
  description?: string | null;
}

export interface CreateSectionInput {
  title: string;
  description?: string | null;
  content?: string | null;
  resources?: CreateResourceInput[];
}

export interface CreateCourseInput {
  slug: string;
  title: string;
  description: string;
  coverUrl?: string | null;
  level: CourseLevel;
  publishedAt?: string | null;
  sections?: CreateSectionInput[];
}

export interface UpdateCourseInput {
  title?: string;
  description?: string;
  coverUrl?: string | null;
  level?: CourseLevel;
  publishedAt?: string | null;
}

export interface ICourseRepository {
  findAll(): Promise<{ data: Course[]; total: number }>;
  findBySlug(slug: string): Promise<Course | null>;
  slugExists(slug: string): Promise<boolean>;
  create(input: CreateCourseInput): Promise<Course>;
  update(slug: string, input: UpdateCourseInput): Promise<Course | null>;
  deleteBySlug(slug: string): Promise<boolean>;
}
