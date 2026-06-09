-- Add session_number to course_resources to group resources into sessions
-- Run: turso db shell <DB_NAME> < src/lib/migrations/005_session_number.sql

ALTER TABLE course_resources ADD COLUMN session_number INTEGER;
