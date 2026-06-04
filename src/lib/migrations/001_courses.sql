-- Courses module migration
-- Run this in Turso CLI: turso db shell <DB_NAME> < src/lib/migrations/001_courses.sql

CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    UNIQUE NOT NULL,
  title       TEXT    NOT NULL,
  description TEXT    NOT NULL,
  cover_url   TEXT,
  level       TEXT    NOT NULL DEFAULT 'beginner',
  published_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS course_sections (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  "order"   INTEGER NOT NULL DEFAULT 0,
  title     TEXT    NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS course_resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id  INTEGER NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE,
  "order"     INTEGER NOT NULL DEFAULT 0,
  type        TEXT    NOT NULL CHECK(type IN ('github', 'video', 'link')),
  title       TEXT    NOT NULL,
  url         TEXT    NOT NULL,
  description TEXT
);

-- Sample data (remove if not needed)
INSERT INTO courses (slug, title, description, level, published_at) VALUES
  ('astro-desde-cero', 'Astro desde cero', 'Aprendé a construir sitios estáticos y SSR con Astro v5, integraciones y despliegue en Vercel.', 'beginner', datetime('now'));

INSERT INTO course_sections (course_id, "order", title, description) VALUES
  (1, 1, 'Introducción', 'Conceptos base y setup del entorno.'),
  (1, 2, 'Componentes y layouts', 'Cómo estructurar tu proyecto con componentes Astro.');

INSERT INTO course_resources (section_id, "order", type, title, url, description) VALUES
  (1, 1, 'video', '¿Qué es Astro?', 'https://www.youtube.com/watch?v=gxBkghlglTg', 'Introducción oficial al framework'),
  (1, 2, 'github', 'Repo del curso', 'https://github.com/withastro/astro', 'Código fuente de Astro'),
  (2, 1, 'video', 'Componentes en Astro', 'https://www.youtube.com/watch?v=NniT0vKyn-E', NULL),
  (2, 2, 'link', 'Documentación oficial', 'https://docs.astro.build', NULL);
