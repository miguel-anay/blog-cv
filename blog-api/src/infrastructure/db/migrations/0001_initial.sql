-- Migration: 0001_initial
-- Creates all tables in FK-safe order

CREATE TABLE IF NOT EXISTS authors (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL UNIQUE,
  avatar_url TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL,
  description  TEXT    NOT NULL,
  body         TEXT    NOT NULL,
  cover_url    TEXT,
  cover_alt    TEXT,
  author_id    INTEGER REFERENCES authors(id),
  read_min     INTEGER NOT NULL DEFAULT 1,
  published_at TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS article_categories (
  article_id  INTEGER NOT NULL REFERENCES articles(id),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  PRIMARY KEY (article_id, category_id)
);

CREATE TABLE IF NOT EXISTS site_config (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  site_title       TEXT    NOT NULL,
  site_description TEXT    NOT NULL,
  about_markdown   TEXT    NOT NULL DEFAULT '',
  email            TEXT    NOT NULL DEFAULT '',
  rol              TEXT    NOT NULL DEFAULT '',
  linkedin         TEXT    NOT NULL DEFAULT '',
  github           TEXT    NOT NULL DEFAULT '',
  twitter          TEXT    NOT NULL DEFAULT '',
  og_image         TEXT
);

CREATE TABLE IF NOT EXISTS cv_personal (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                  TEXT    NOT NULL,
  sitio                   TEXT,
  descripcion             TEXT,
  empresas_destacadas     TEXT,
  tecnologias_destacadas  TEXT,
  linkedin                TEXT,
  anio                    INTEGER
);

CREATE TABLE IF NOT EXISTS cv_proyectos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orden       INTEGER NOT NULL DEFAULT 0,
  titulo      TEXT    NOT NULL,
  empresa     TEXT,
  descripcion TEXT,
  url         TEXT,
  imagen      TEXT,
  tecnologias TEXT
);

CREATE TABLE IF NOT EXISTS cv_experiencia (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orden       INTEGER NOT NULL DEFAULT 0,
  periodo     TEXT,
  cargo       TEXT    NOT NULL,
  empresa     TEXT    NOT NULL,
  certificado TEXT,
  logo        TEXT,
  tecnologias TEXT,
  proyectos   TEXT
);

CREATE TABLE IF NOT EXISTS cv_educacion (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orden       INTEGER NOT NULL DEFAULT 0,
  institucion TEXT    NOT NULL,
  titulo      TEXT    NOT NULL,
  estado      TEXT,
  anio_inicio INTEGER,
  anio_fin    INTEGER
);

CREATE TABLE IF NOT EXISTS cv_cursos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orden       INTEGER NOT NULL DEFAULT 0,
  categoria   TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  institucion TEXT,
  fecha       TEXT,
  certificado TEXT,
  externo     INTEGER NOT NULL DEFAULT 0
);
