import { sqliteTable, integer, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const authors = sqliteTable('authors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  avatarUrl: text('avatar_url'),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
});

export const articles = sqliteTable('articles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  body: text('body').notNull(),
  coverUrl: text('cover_url'),
  coverAlt: text('cover_alt'),
  authorId: integer('author_id').references(() => authors.id),
  readMin: integer('read_min').notNull().default(1),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const articleCategories = sqliteTable(
  'article_categories',
  {
    articleId: integer('article_id').notNull().references(() => articles.id),
    categoryId: integer('category_id').notNull().references(() => categories.id),
  },
  (t) => ({ pk: primaryKey({ columns: [t.articleId, t.categoryId] }) }),
);

export const siteConfig = sqliteTable('site_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  siteTitle: text('site_title').notNull(),
  siteDescription: text('site_description').notNull(),
  aboutMarkdown: text('about_markdown').notNull().default(''),
  email: text('email').notNull().default(''),
  rol: text('rol').notNull().default(''),
  linkedin: text('linkedin').notNull().default(''),
  github: text('github').notNull().default(''),
  twitter: text('twitter').notNull().default(''),
  ogImage: text('og_image'),
});

export const cvPersonal = sqliteTable('cv_personal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  sitio: text('sitio'),
  descripcion: text('descripcion'),
  empresasDestacadas: text('empresas_destacadas'),
  tecnologiasDestacadas: text('tecnologias_destacadas'),
  linkedin: text('linkedin'),
  anio: integer('anio'),
});

export const cvProyectos = sqliteTable('cv_proyectos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull().default(0),
  titulo: text('titulo').notNull(),
  empresa: text('empresa'),
  descripcion: text('descripcion'),
  url: text('url'),
  imagen: text('imagen'),
  tecnologias: text('tecnologias'),
});

export const cvExperiencia = sqliteTable('cv_experiencia', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull().default(0),
  periodo: text('periodo'),
  cargo: text('cargo').notNull(),
  empresa: text('empresa').notNull(),
  certificado: text('certificado'),
  logo: text('logo'),
  tecnologias: text('tecnologias'),
  proyectos: text('proyectos'),
});

export const cvEducacion = sqliteTable('cv_educacion', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull().default(0),
  institucion: text('institucion').notNull(),
  titulo: text('titulo').notNull(),
  estado: text('estado'),
  anioInicio: integer('anio_inicio'),
  anioFin: integer('anio_fin'),
});

export const cvCursos = sqliteTable('cv_cursos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orden: integer('orden').notNull().default(0),
  categoria: text('categoria').notNull(),
  nombre: text('nombre').notNull(),
  institucion: text('institucion'),
  fecha: text('fecha'),
  certificado: text('certificado'),
  externo: integer('externo').notNull().default(0),
});

// ── Courses module ──────────────────────────────────────────────────────────

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  coverUrl: text('cover_url'),
  level: text('level').notNull().default('beginner'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const courseSections = sqliteTable('course_sections', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courseId: integer('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content'),
});

export const courseResources = sqliteTable('course_resources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sectionId: integer('section_id').notNull().references(() => courseSections.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  type: text('type').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
});
