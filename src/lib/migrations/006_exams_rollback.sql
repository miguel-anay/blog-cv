-- Rollback for 006_exams.sql
-- Run: turso db shell <DB_NAME> < src/lib/migrations/006_exams_rollback.sql

DROP TABLE IF EXISTS exam_answers;
DROP TABLE IF EXISTS exam_attempts;
DROP TABLE IF EXISTS exam_options;
DROP TABLE IF EXISTS exam_questions;
DROP TABLE IF EXISTS exams;
