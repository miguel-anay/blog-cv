import { z } from 'zod';

const ResourceSchema = z.object({
  type: z.enum(['github', 'video', 'link']),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional().nullable(),
});

const SectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  resources: z.array(ResourceSchema).default([]),
});

export const CreateCourseSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  cover_url: z.string().url().optional().nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  published_at: z.string().datetime().optional().nullable(),
  sections: z.array(SectionSchema).default([]),
});

export const UpdateCourseSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  cover_url: z.string().url().optional().nullable(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  published_at: z.string().datetime().optional().nullable(),
});
