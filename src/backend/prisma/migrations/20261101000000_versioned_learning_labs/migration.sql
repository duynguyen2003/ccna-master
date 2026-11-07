ALTER TYPE "LabAttemptStatus" ADD VALUE IF NOT EXISTS 'MASTERED';
ALTER TABLE "labs"
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lab_key" VARCHAR(80),
  ADD COLUMN "lab_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "content_source" VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "content_hash" VARCHAR(64),
  ADD COLUMN "duration_minutes" INTEGER,
  ADD COLUMN "topics" JSONB,
  ADD COLUMN "guide_format" VARCHAR(20) NOT NULL DEFAULT 'html';
CREATE UNIQUE INDEX "labs_lab_key_lab_version_key" ON "labs"("lab_key", "lab_version");
ALTER TABLE "lab_attempts" ADD COLUMN "best_score" INTEGER,
  ADD COLUMN "first_passed_at" TIMESTAMP(3), ADD COLUMN "mastered_at" TIMESTAMP(3);
ALTER TABLE "lab_commands" ADD COLUMN "events" JSONB;
