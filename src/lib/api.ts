import { eq, inArray, count, desc } from 'drizzle-orm';
import { getDb } from './db';
import {
  articles,
  authors,
  categories,
  articleCategories,
  siteConfig,
  cvPersonal,
  cvProyectos,
  cvExperiencia,
  cvEducacion,
  cvCursos,
  courses,
  courseSections,
  courseResources,
} from './schema';
import type { Article, ArticleListResponse, Category, SiteConfig, Course, CourseResource } from './api-types';
import type { CvData } from './cv-types';

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export interface GetArticlesOptions {
  page?: number;
  pageSize?: number;
  category?: string;
}

const EMPTY_LIST: ArticleListResponse = {
  data: [],
  meta: { page: 1, pageSize: 10, pageCount: 0, total: 0 },
};

// ── Articles ───────────────────────────────────────────────────────────────

export async function getArticles(opts: GetArticlesOptions = {}): Promise<ArticleListResponse> {
  try {
    const db = getDb();
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    // Optional: collect article IDs that belong to the requested category
    let filterIds: number[] | null = null;
    if (opts.category) {
      const rows = await db
        .select({ articleId: articleCategories.articleId })
        .from(articleCategories)
        .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
        .where(eq(categories.slug, opts.category));
      filterIds = rows.map((r) => r.articleId);
      if (filterIds.length === 0) return EMPTY_LIST;
    }

    const where = filterIds ? inArray(articles.id, filterIds) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(articles).where(where);

    const rows = await db
      .select({ article: articles, author: authors })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(pageSize)
      .offset(offset);

    if (rows.length === 0) return EMPTY_LIST;

    const ids = rows.map((r) => r.article.id);
    const catRows = await db
      .select({ articleId: articleCategories.articleId, category: categories })
      .from(articleCategories)
      .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
      .where(inArray(articleCategories.articleId, ids));

    const catsByArticle = new Map<number, Category[]>();
    for (const { articleId, category } of catRows) {
      if (!catsByArticle.has(articleId)) catsByArticle.set(articleId, []);
      catsByArticle.get(articleId)!.push(category);
    }

    const pageCount = Math.ceil(total / pageSize);

    return {
      data: rows.map(({ article, author }) => ({
        ...article,
        body: parseJson(article.body, []),
        author: author ?? null,
        categories: catsByArticle.get(article.id) ?? [],
      })) as Article[],
      meta: { page, pageSize, pageCount, total },
    };
  } catch (err) {
    console.error('getArticles failed:', err);
    return EMPTY_LIST;
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const db = getDb();

    const [row] = await db
      .select({ article: articles, author: authors })
      .from(articles)
      .leftJoin(authors, eq(articles.authorId, authors.id))
      .where(eq(articles.slug, slug))
      .limit(1);

    if (!row) return null;

    const catRows = await db
      .select({ category: categories })
      .from(articleCategories)
      .innerJoin(categories, eq(articleCategories.categoryId, categories.id))
      .where(eq(articleCategories.articleId, row.article.id));

    return {
      ...row.article,
      body: parseJson(row.article.body, []),
      author: row.author ?? null,
      categories: catRows.map((r) => r.category),
    } as Article;
  } catch (err) {
    console.error('getArticleBySlug failed:', err);
    return null;
  }
}

// ── Categories ─────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
  try {
    return await getDb().select().from(categories);
  } catch (err) {
    console.error('getCategories failed:', err);
    return [];
  }
}

export async function getCategoryCounts(): Promise<Record<string, number>> {
  try {
    const rows = await getDb()
      .select({ slug: categories.slug, total: count(articleCategories.articleId) })
      .from(categories)
      .leftJoin(articleCategories, eq(categories.id, articleCategories.categoryId))
      .groupBy(categories.id);
    return Object.fromEntries(rows.map((r) => [r.slug, r.total]));
  } catch (err) {
    console.error('getCategoryCounts failed:', err);
    return {};
  }
}

// ── CV ─────────────────────────────────────────────────────────────────────

export async function getCv(): Promise<CvData | null> {
  try {
    const db = getDb();

    const [personal, proyectos, experiencia, educacion, cursos] = await Promise.all([
      db.select().from(cvPersonal).limit(1),
      db.select().from(cvProyectos).orderBy(cvProyectos.orden),
      db.select().from(cvExperiencia).orderBy(cvExperiencia.orden),
      db.select().from(cvEducacion).orderBy(cvEducacion.orden),
      db.select().from(cvCursos).orderBy(cvCursos.orden),
    ]);

    if (!personal[0]) return null;

    const p = personal[0];
    return {
      personal: {
        ...p,
        sitio: p.sitio ?? '',
        descripcion: p.descripcion ?? '',
        empresasDestacadas: parseJson(p.empresasDestacadas, []),
        tecnologiasDestacadas: p.tecnologiasDestacadas ?? '',
        linkedin: p.linkedin ?? '',
        anio: String(p.anio ?? ''),
      },
      proyectos: proyectos.map((r) => ({
        ...r,
        empresa: r.empresa ?? '',
        descripcion: r.descripcion ?? '',
        url: r.url ?? '',
        imagen: r.imagen ?? '',
        tecnologias: parseJson(r.tecnologias, []),
      })),
      experiencia: experiencia.map((r) => ({
        ...r,
        periodo: r.periodo ?? '',
        logo: r.logo ?? '',
        tecnologias: parseJson(r.tecnologias, []),
        proyectos: parseJson(r.proyectos, []),
      })),
      educacion: educacion.map((r) => ({
        ...r,
        estado: r.estado ?? '',
      })),
      cursos: cursos.map((r) => ({
        ...r,
        institucion: r.institucion ?? '',
        fecha: r.fecha ?? '',
        externo: r.externo === 1,
      })),
    };
  } catch (err) {
    console.error('getCv failed:', err);
    return null;
  }
}

// ── Site Config ────────────────────────────────────────────────────────────

export async function getSiteConfig(): Promise<SiteConfig | null> {
  try {
    const [row] = await getDb().select().from(siteConfig).limit(1);
    return row ?? null;
  } catch (err) {
    console.error('getSiteConfig failed:', err);
    return null;
  }
}

// ── Courses ────────────────────────────────────────────────────────────────

export async function getCourses(): Promise<Course[]> {
  try {
    const db = getDb();
    const rows = await db.select().from(courses).orderBy(desc(courses.publishedAt));
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    const countRows = await db
      .select({ courseId: courseSections.courseId, total: count() })
      .from(courseSections)
      .where(inArray(courseSections.courseId, ids))
      .groupBy(courseSections.courseId);

    const countMap = new Map(countRows.map((c) => [c.courseId, c.total]));
    return rows.map((c) => ({ ...c, sectionCount: countMap.get(c.id) ?? 0 })) as Course[];
  } catch (err) {
    console.error('getCourses failed:', err);
    return [];
  }
}

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  try {
    const db = getDb();

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, slug))
      .limit(1);

    if (!course) return null;

    const sections = await db
      .select()
      .from(courseSections)
      .where(eq(courseSections.courseId, course.id))
      .orderBy(courseSections.order);

    if (sections.length === 0) return { ...course, sections: [] } as Course;

    const sectionIds = sections.map((s) => s.id);
    const resources = await db
      .select()
      .from(courseResources)
      .where(inArray(courseResources.sectionId, sectionIds))
      .orderBy(courseResources.order);

    const bySection = new Map<number, typeof resources>();
    for (const r of resources) {
      if (!bySection.has(r.sectionId)) bySection.set(r.sectionId, []);
      bySection.get(r.sectionId)!.push(r);
    }

    return {
      ...course,
      sections: sections.map((s) => ({
        ...s,
        resources: (bySection.get(s.id) ?? []) as CourseResource[],
      })),
    } as Course;
  } catch (err) {
    console.error('getCourseBySlug failed:', err);
    return null;
  }
}

// ── Newsletter ─────────────────────────────────────────────────────────────

export async function subscribeNewsletter(
  email: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const audienceId = process.env.RESEND_AUDIENCE_ID;

    if (!apiKey || !audienceId) return { ok: false, error: 'Newsletter not configured' };

    const res = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: (body as { message?: string }).message ?? 'Subscription failed' };
    }

    return { ok: true, message: 'Subscribed successfully' };
  } catch (err) {
    console.error('subscribeNewsletter failed:', err);
    return { ok: false, error: 'Could not subscribe. Please try again.' };
  }
}
