-- Exams module migration
-- Run: turso db shell <DB_NAME> < src/lib/migrations/006_exams.sql

CREATE TABLE IF NOT EXISTS exams (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug                  TEXT    UNIQUE NOT NULL,
  title                 TEXT    NOT NULL,
  description           TEXT    NOT NULL,
  cover_url             TEXT,
  level                 TEXT    NOT NULL DEFAULT 'beginner',
  time_limit_seconds    INTEGER NOT NULL DEFAULT 5400,
  pass_score_percent    INTEGER NOT NULL DEFAULT 70,
  published_at          TEXT,
  created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  "order"         INTEGER NOT NULL DEFAULT 0,
  prompt          TEXT    NOT NULL,
  explanation     TEXT,
  allow_multiple  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_options (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id  INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  "order"      INTEGER NOT NULL DEFAULT 0,
  text         TEXT    NOT NULL,
  is_correct   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id              INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id              TEXT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  time_limit_seconds   INTEGER NOT NULL,
  started_at           INTEGER NOT NULL,
  paused_at            INTEGER,
  paused_seconds       INTEGER NOT NULL DEFAULT 0,
  submitted_at         INTEGER,
  auto_submitted       INTEGER NOT NULL DEFAULT 0,
  score                INTEGER,
  correct_count        INTEGER,
  total_questions      INTEGER,
  created_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_answers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  attempt_id           INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id          INTEGER NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  selected_option_id   INTEGER REFERENCES exam_options(id),
  flagged_for_review   INTEGER NOT NULL DEFAULT 0,
  answered_at          INTEGER
);

CREATE INDEX IF NOT EXISTS exam_questions_exam_idx ON exam_questions(exam_id);
CREATE INDEX IF NOT EXISTS exam_options_question_idx ON exam_options(question_id);
CREATE INDEX IF NOT EXISTS exam_attempts_user_exam_idx ON exam_attempts(user_id, exam_id);
CREATE UNIQUE INDEX IF NOT EXISTS exam_answers_attempt_question_idx ON exam_answers(attempt_id, question_id);
