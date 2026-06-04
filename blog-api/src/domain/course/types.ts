export type ResourceType = 'github' | 'video' | 'link';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';

export interface CourseResource {
  id: number;
  sectionId: number;
  order: number;
  type: ResourceType;
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
  level: CourseLevel;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sections?: CourseSection[];
  sectionCount?: number;
}
