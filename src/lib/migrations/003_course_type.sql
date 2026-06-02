-- Add type discriminator to courses table
-- Run: turso db shell <DB_NAME> < src/lib/migrations/003_course_type.sql

-- Forward migration
ALTER TABLE courses ADD COLUMN type TEXT NOT NULL DEFAULT 'course';

-- Rollback: ALTER TABLE courses DROP COLUMN type;
