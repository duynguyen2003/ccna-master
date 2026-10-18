-- AlterTable
ALTER TABLE "users" ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "exam_results" ADD COLUMN     "attempt_id" UUID,
ADD COLUMN     "exam_snapshot" JSONB;



-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exam_id" INTEGER NOT NULL,
    "exam_snapshot" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);



-- CreateIndex
CREATE INDEX "exam_attempts_user_id_exam_id_submitted_at_idx" ON "exam_attempts"("user_id", "exam_id", "submitted_at");



-- CreateIndex
CREATE UNIQUE INDEX "exam_results_attempt_id_key" ON "exam_results"("attempt_id");

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;





