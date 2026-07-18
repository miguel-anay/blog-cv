import { sqliteTable, integer, text, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
  certificado: text('certificado'),
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
  type: text('type').notNull().default('course'),
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
  sessionNumber: integer('session_number'),
});

// ── Exams module ─────────────────────────────────────────────────────────────

export const exams = sqliteTable('exams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').unique().notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  coverUrl: text('cover_url'),
  level: text('level').notNull().default('beginner'),
  timeLimitSeconds: integer('time_limit_seconds').notNull().default(5400),
  passScorePercent: integer('pass_score_percent').notNull().default(70),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))"),
});

export const examQuestions = sqliteTable('exam_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  examId: integer('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  prompt: text('prompt').notNull(),
  explanation: text('explanation'),
  allowMultiple: integer('allow_multiple', { mode: 'boolean' }).notNull().default(false),
});

export const examOptions = sqliteTable('exam_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  questionId: integer('question_id').notNull().references(() => examQuestions.id, { onDelete: 'cascade' }),
  order: integer('order').notNull().default(0),
  text: text('text').notNull(),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
});

export const examAttempts = sqliteTable('exam_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  examId: integer('exam_id').notNull().references(() => exams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  timeLimitSeconds: integer('time_limit_seconds').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  pausedAt: integer('paused_at', { mode: 'timestamp' }),
  pausedSeconds: integer('paused_seconds').notNull().default(0),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  autoSubmitted: integer('auto_submitted', { mode: 'boolean' }).notNull().default(false),
  score: integer('score'),
  correctCount: integer('correct_count'),
  totalQuestions: integer('total_questions'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const examAnswers = sqliteTable(
  'exam_answers',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    attemptId: integer('attempt_id').notNull().references(() => examAttempts.id, { onDelete: 'cascade' }),
    questionId: integer('question_id').notNull().references(() => examQuestions.id, { onDelete: 'cascade' }),
    selectedOptionId: integer('selected_option_id').references(() => examOptions.id),
    flaggedForReview: integer('flagged_for_review', { mode: 'boolean' }).notNull().default(false),
    answeredAt: integer('answered_at', { mode: 'timestamp' }),
  },
  (t) => ({
    attemptQuestionIdx: uniqueIndex('exam_answers_attempt_question_idx').on(t.attemptId, t.questionId),
  }),
);

// ── Better Auth tables ───────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});
