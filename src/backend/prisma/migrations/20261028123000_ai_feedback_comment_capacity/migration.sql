-- Match FeedbackRequest's existing 1000-code-point contract; no data rewrite.
ALTER TABLE "ai_feedback" ALTER COLUMN "optional_comment" TYPE VARCHAR(1000);
