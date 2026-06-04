import { eq, desc, inArray, sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type {
  ICourseRepository,
  CreateCourseInput,
  UpdateCourseInput,
} from '../../domain/course/course-repository.js';
import type { Course, CourseSection, CourseResource, CourseLevel } from '../../domain/course/types.js';
import * as schema from '../db/schema.js';

type Db = LibSQLDatabase<typeof schema>;

export class DrizzleCourseRepository implements ICourseRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<{ data: Course[]; total: number }> {
    const rows = await this.db
      .select()
      .from(schema.courses)
      .orderBy(desc(schema.courses.publishedAt));

    if (rows.length === 0) return { data: [], total: 0 };

    const ids = rows.map((r) => r.id);
    const countRows = await this.db
      .select({ courseId: schema.courseSections.courseId, total: sql<number>`count(*)` })
      .from(schema.courseSections)
      .where(inArray(schema.courseSections.courseId, ids))
      .groupBy(schema.courseSections.courseId);

    const countMap = new Map(countRows.map((c) => [c.courseId, Number(c.total)]));

    const data = rows.map((r) => this.mapCourse(r, countMap.get(r.id) ?? 0));
    return { data, total: data.length };
  }

  async findBySlug(slug: string): Promise<Course | null> {
    const [row] = await this.db
      .select()
      .from(schema.courses)
      .where(eq(schema.courses.slug, slug))
      .limit(1);

    if (!row) return null;

    const sections = await this.db
      .select()
      .from(schema.courseSections)
      .where(eq(schema.courseSections.courseId, row.id))
      .orderBy(schema.courseSections.order);

    const hydratedSections: CourseSection[] = await Promise.all(
      sections.map(async (s) => {
        const resources = await this.db
          .select()
          .from(schema.courseResources)
          .where(eq(schema.courseResources.sectionId, s.id))
          .orderBy(schema.courseResources.order);

        return {
          id: s.id,
          courseId: s.courseId,
          order: s.order,
          title: s.title,
          description: s.description ?? null,
          content: s.content ?? null,
          resources: resources.map((r) => this.mapResource(r)),
        };
      }),
    );

    return { ...this.mapCourse(row), sections: hydratedSections };
  }

  async slugExists(slug: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.courses.id })
      .from(schema.courses)
      .where(eq(schema.courses.slug, slug))
      .limit(1);
    return !!row;
  }

  async create(input: CreateCourseInput): Promise<Course> {
    await this.db.transaction(async (tx) => {
      await tx.insert(schema.courses).values({
        slug: input.slug,
        title: input.title,
        description: input.description,
        coverUrl: input.coverUrl ?? null,
        level: input.level,
        publishedAt: input.publishedAt ?? null,
      });

      if (input.sections && input.sections.length > 0) {
        const [created] = await tx
          .select({ id: schema.courses.id })
          .from(schema.courses)
          .where(eq(schema.courses.slug, input.slug))
          .limit(1);

        for (let i = 0; i < input.sections.length; i++) {
          const s = input.sections[i];
          await tx.insert(schema.courseSections).values({
            courseId: created.id,
            order: i + 1,
            title: s.title,
            description: s.description ?? null,
            content: s.content ?? null,
          });

          if (s.resources && s.resources.length > 0) {
            const [section] = await tx
              .select({ id: schema.courseSections.id })
              .from(schema.courseSections)
              .where(eq(schema.courseSections.courseId, created.id))
              .orderBy(desc(schema.courseSections.id))
              .limit(1);

            for (let j = 0; j < s.resources.length; j++) {
              const r = s.resources[j];
              await tx.insert(schema.courseResources).values({
                sectionId: section.id,
                order: j + 1,
                type: r.type,
                title: r.title,
                url: r.url,
                description: r.description ?? null,
              });
            }
          }
        }
      }
    });

    return (await this.findBySlug(input.slug))!;
  }

  async update(slug: string, patch: UpdateCourseInput): Promise<Course | null> {
    const existing = await this.findBySlug(slug);
    if (!existing) return null;

    const updateData: Partial<typeof schema.courses.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) updateData.description = patch.description;
    if (patch.coverUrl !== undefined) updateData.coverUrl = patch.coverUrl ?? null;
    if (patch.level !== undefined) updateData.level = patch.level;
    if (patch.publishedAt !== undefined) updateData.publishedAt = patch.publishedAt ?? null;

    await this.db.update(schema.courses).set(updateData).where(eq(schema.courses.slug, slug));
    return this.findBySlug(slug);
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.courses.id })
      .from(schema.courses)
      .where(eq(schema.courses.slug, slug))
      .limit(1);

    if (!row) return false;
    await this.db.delete(schema.courses).where(eq(schema.courses.id, row.id));
    return true;
  }

  private mapCourse(row: typeof schema.courses.$inferSelect, sectionCount = 0): Course {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      coverUrl: row.coverUrl ?? null,
      level: row.level as CourseLevel,
      publishedAt: row.publishedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sectionCount,
    };
  }

  private mapResource(row: typeof schema.courseResources.$inferSelect): CourseResource {
    return {
      id: row.id,
      sectionId: row.sectionId,
      order: row.order,
      type: row.type as CourseResource['type'],
      title: row.title,
      url: row.url,
      description: row.description ?? null,
    };
  }
}
