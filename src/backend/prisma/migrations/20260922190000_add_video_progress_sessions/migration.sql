-- Keep the existing aggregate video progress rows and add the timestamp used
-- to prevent an older heartbeat from overwriting a newer playback position.
ALTER TABLE "video_progress"
ADD COLUMN IF NOT EXISTS "last_position_at" TIMESTAMP(3);

-- Store one aggregate per browser playback session so duplicate or
-- out-of-order heartbeats do not inflate watched time.
CREATE TABLE IF NOT EXISTS "video_progress_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "session_id" UUID NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "last_sequence" INTEGER NOT NULL,
    "last_captured_at" TIMESTAMP(3) NOT NULL,
    "watched_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_progress_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "video_progress_sessions_user_id_lesson_id_session_id_key"
ON "video_progress_sessions"("user_id", "lesson_id", "session_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'video_progress_sessions_user_id_fkey'
          AND conrelid = 'video_progress_sessions'::regclass
    ) THEN
        ALTER TABLE "video_progress_sessions"
        ADD CONSTRAINT "video_progress_sessions_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'video_progress_sessions_lesson_id_fkey'
          AND conrelid = 'video_progress_sessions'::regclass
    ) THEN
        ALTER TABLE "video_progress_sessions"
        ADD CONSTRAINT "video_progress_sessions_lesson_id_fkey"
        FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
