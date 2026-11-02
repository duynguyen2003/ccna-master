-- Additive progress snapshots; no model output or historical result is modified.
ALTER TABLE "ai_requests"
  ADD COLUMN "stream_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "progress_phase" VARCHAR(40);
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_progress_phase_check"
  CHECK ("progress_phase" IS NULL OR "progress_phase" IN
    ('PREPARING_CONTEXT', 'ANALYZING', 'FINALIZING'));
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_stream_version_check"
  CHECK ("stream_version" >= 1);
