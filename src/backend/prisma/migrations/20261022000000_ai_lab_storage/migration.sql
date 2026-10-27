-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'DELETED', 'OUTCOME_UNKNOWN');

-- CreateEnum
CREATE TYPE "AiResponseMode" AS ENUM ('NONE', 'LLM', 'DETERMINISTIC');

-- CreateEnum
CREATE TYPE "AiIntent" AS ENUM ('NEXT_STEP', 'DIAGNOSE', 'EXPLAIN_CONCEPT', 'LAB_REVIEW');

-- CreateEnum
CREATE TYPE "AiSourceProvenance" AS ENUM ('LIVE_SNAPSHOT', 'FEEDBACK_SNAPSHOT', 'LEGACY_FEEDBACK', 'CAPTURED_AT_ATTEMPT_START', 'CAPTURED_AT_AI_REQUEST');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiProviderCallState" AS ENUM ('PLANNED', 'DISPATCHED', 'RECEIVED', 'KNOWN_FAILURE', 'OUTCOME_UNKNOWN');

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('PENDING', 'FINAL', 'UNRESOLVED', 'ESTIMATED');

-- CreateEnum
CREATE TYPE "AiQuotaScope" AS ENUM ('USER_MINUTE', 'USER_DAY', 'GLOBAL_DAY', 'GLOBAL_MONTH');

-- CreateEnum
CREATE TYPE "AiReservationStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED', 'UNRESOLVED');

-- AlterTable
ALTER TABLE "lab_attempts" ADD COLUMN     "feedback_provenance" "AiSourceProvenance",
ADD COLUMN     "feedback_recorded_at" TIMESTAMPTZ(3),
ADD COLUMN     "feedback_revision" INTEGER,
ADD COLUMN     "public_metadata" JSONB,
ADD COLUMN     "public_metadata_captured_at" TIMESTAMPTZ(3),
ADD COLUMN     "public_metadata_provenance" "AiSourceProvenance",
ADD COLUMN     "safe_feedback_snapshot" JSONB;

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "user_id" INTEGER,
    "attempt_id" UUID,
    "owner_key" VARCHAR(160) NOT NULL,
    "epoch" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "purge_after" TIMESTAMPTZ(3),

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "user_id" INTEGER,
    "attempt_id" UUID,
    "conversation_id" UUID,
    "owner_key" VARCHAR(160) NOT NULL,
    "conversation_epoch" INTEGER NOT NULL,
    "recovery_epoch" VARCHAR(80) NOT NULL,
    "client_request_id" UUID NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "status" "AiRequestStatus" NOT NULL DEFAULT 'QUEUED',
    "response_mode" "AiResponseMode" NOT NULL DEFAULT 'NONE',
    "intent" "AiIntent" NOT NULL,
    "requested_hint_level" INTEGER,
    "effective_hint_level" INTEGER NOT NULL DEFAULT 1,
    "source_revision" INTEGER,
    "source_provenance" "AiSourceProvenance" NOT NULL,
    "snapshot" JSONB,
    "context_hash" CHAR(64) NOT NULL,
    "versions" JSONB NOT NULL,
    "session_version_at_admission" INTEGER NOT NULL,
    "max_cost_micros" BIGINT NOT NULL,
    "deadline_at" TIMESTAMPTZ(3) NOT NULL,
    "lease_owner" VARCHAR(160),
    "lease_version" INTEGER NOT NULL DEFAULT 0,
    "lease_expires_at" TIMESTAMPTZ(3),
    "heartbeat_at" TIMESTAMPTZ(3),
    "error_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "purged_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "epoch" INTEGER NOT NULL,
    "request_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT,
    "structured_answer" JSONB,
    "source_revision" INTEGER,
    "evidence_refs" JSONB,
    "evidence_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_provider_calls" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "step_index" INTEGER NOT NULL DEFAULT 0,
    "context_hash" CHAR(64) NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "price_version" VARCHAR(80) NOT NULL,
    "state" "AiProviderCallState" NOT NULL DEFAULT 'PLANNED',
    "lease_version" INTEGER NOT NULL,
    "provider_request_id" VARCHAR(200),
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "reasoning_tokens" INTEGER,
    "max_cost_micros" BIGINT NOT NULL,
    "cost_micros" BIGINT,
    "usage_status" "AiUsageStatus" NOT NULL DEFAULT 'PENDING',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "receipt_hash" CHAR(64),
    "receipt_payload" JSONB,
    "receipt_expires_at" TIMESTAMPTZ(3),
    "suppression_reason" VARCHAR(80),
    "finish_reason" VARCHAR(80),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_provider_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_quota_buckets" (
    "id" UUID NOT NULL,
    "scope_type" "AiQuotaScope" NOT NULL,
    "scope_key" VARCHAR(200) NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "window_end" TIMESTAMPTZ(3) NOT NULL,
    "limit_units" INTEGER NOT NULL DEFAULT 0,
    "used_units" INTEGER NOT NULL DEFAULT 0,
    "reserved_units" INTEGER NOT NULL DEFAULT 0,
    "limit_micros" BIGINT NOT NULL DEFAULT 0,
    "spent_micros" BIGINT NOT NULL DEFAULT 0,
    "reserved_micros" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ai_quota_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reservations" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "bucket_id" UUID NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "cost_micros" BIGINT NOT NULL,
    "status" "AiReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "settlement_key" VARCHAR(200),
    "settled_units" INTEGER,
    "settled_cost_micros" BIGINT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settled_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_adjustments" (
    "id" UUID NOT NULL,
    "provider_call_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(200) NOT NULL,
    "delta_micros" BIGINT NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runtime_policies" (
    "environment" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "admission_enabled" BOOLEAN NOT NULL DEFAULT false,
    "dispatch_enabled" BOOLEAN NOT NULL DEFAULT false,
    "eligibility_rules" JSONB NOT NULL DEFAULT '{}',
    "limits" JSONB NOT NULL DEFAULT '{}',
    "provider_config_id" VARCHAR(80),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "ai_runtime_policies_pkey" PRIMARY KEY ("environment")
);

-- CreateTable
CREATE TABLE "ai_execution_slots" (
    "environment" VARCHAR(40) NOT NULL,
    "slot_number" INTEGER NOT NULL,
    "request_id" UUID,
    "call_id" UUID,
    "lease_version" INTEGER NOT NULL DEFAULT 0,
    "acquired_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),

    CONSTRAINT "ai_execution_slots_pkey" PRIMARY KEY ("environment","slot_number")
);

-- CreateTable
CREATE TABLE "ai_feedback" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" INTEGER NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "reason_code" VARCHAR(80),
    "optional_comment" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ai_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_event_outbox" (
    "event_id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exported_at" TIMESTAMPTZ(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_event_outbox_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_deleted_at_purge_after_idx" ON "ai_conversations"("deleted_at", "purge_after");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_user_id_attempt_id_key" ON "ai_conversations"("user_id", "attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_id_user_id_attempt_id_key" ON "ai_conversations"("id", "user_id", "attempt_id");

-- CreateIndex
CREATE INDEX "ai_requests_status_created_at_idx" ON "ai_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_user_id_created_at_idx" ON "ai_requests"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_conversation_id_conversation_epoch_created_at_idx" ON "ai_requests"("conversation_id", "conversation_epoch", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_status_lease_expires_at_idx" ON "ai_requests"("status", "lease_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_user_id_client_request_id_key" ON "ai_requests"("user_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_owner_key_client_request_id_key" ON "ai_requests"("owner_key", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_id_conversation_id_conversation_epoch_key" ON "ai_requests"("id", "conversation_id", "conversation_epoch");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_id_context_hash_key" ON "ai_requests"("id", "context_hash");

-- CreateIndex
CREATE UNIQUE INDEX "ai_requests_one_active_user" ON "ai_requests"("user_id") WHERE (status = ANY (ARRAY['QUEUED'::"AiRequestStatus", 'RUNNING'::"AiRequestStatus"]));

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_epoch_created_at_id_idx" ON "ai_messages"("conversation_id", "epoch", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_request_id_role_key" ON "ai_messages"("request_id", "role");

-- CreateIndex
CREATE INDEX "ai_provider_calls_usage_status_created_at_idx" ON "ai_provider_calls"("usage_status", "created_at");

-- CreateIndex
CREATE INDEX "ai_provider_calls_receipt_expires_at_idx" ON "ai_provider_calls"("receipt_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_calls_request_id_step_index_key" ON "ai_provider_calls"("request_id", "step_index");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_calls_id_request_id_key" ON "ai_provider_calls"("id", "request_id");

-- CreateIndex
CREATE INDEX "ai_quota_buckets_window_end_idx" ON "ai_quota_buckets"("window_end");

-- CreateIndex
CREATE UNIQUE INDEX "ai_quota_buckets_scope_type_scope_key_window_start_key" ON "ai_quota_buckets"("scope_type", "scope_key", "window_start");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reservations_settlement_key_key" ON "ai_reservations"("settlement_key");

-- CreateIndex
CREATE INDEX "ai_reservations_status_created_at_idx" ON "ai_reservations"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_reservations_request_id_bucket_id_key" ON "ai_reservations"("request_id", "bucket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_adjustments_idempotency_key_key" ON "ai_usage_adjustments"("idempotency_key");

-- CreateIndex
CREATE INDEX "ai_usage_adjustments_provider_call_id_created_at_idx" ON "ai_usage_adjustments"("provider_call_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_execution_slots_request_id_key" ON "ai_execution_slots"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_execution_slots_call_id_key" ON "ai_execution_slots"("call_id");

-- CreateIndex
CREATE INDEX "ai_execution_slots_expires_at_idx" ON "ai_execution_slots"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_feedback_message_id_user_id_key" ON "ai_feedback"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "ai_event_outbox_pending_idx" ON "ai_event_outbox"("next_attempt_at", "event_id") WHERE (exported_at IS NULL);

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lab_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "lab_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversation_id_user_id_attempt_id_fkey" FOREIGN KEY ("conversation_id", "user_id", "attempt_id") REFERENCES "ai_conversations"("id", "user_id", "attempt_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_request_id_conversation_id_epoch_fkey" FOREIGN KEY ("request_id", "conversation_id", "epoch") REFERENCES "ai_requests"("id", "conversation_id", "conversation_epoch") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_provider_calls" ADD CONSTRAINT "ai_provider_calls_request_id_context_hash_fkey" FOREIGN KEY ("request_id", "context_hash") REFERENCES "ai_requests"("id", "context_hash") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_reservations" ADD CONSTRAINT "ai_reservations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reservations" ADD CONSTRAINT "ai_reservations_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "ai_quota_buckets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage_adjustments" ADD CONSTRAINT "ai_usage_adjustments_provider_call_id_fkey" FOREIGN KEY ("provider_call_id") REFERENCES "ai_provider_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runtime_policies" ADD CONSTRAINT "ai_runtime_policies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_slots" ADD CONSTRAINT "ai_execution_slots_environment_fkey" FOREIGN KEY ("environment") REFERENCES "ai_runtime_policies"("environment") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_slots" ADD CONSTRAINT "ai_execution_slots_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_execution_slots" ADD CONSTRAINT "ai_execution_slots_call_id_request_id_fkey" FOREIGN KEY ("call_id", "request_id") REFERENCES "ai_provider_calls"("id", "request_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "ai_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedback" ADD CONSTRAINT "ai_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma models represent fields/relations/indexes; these checks are SQL-owned.
-- All old lab-attempt rows retain NULL metadata. No provenance backfill.
ALTER TABLE "lab_attempts"
  ADD CONSTRAINT "lab_attempts_ai_metadata_check" CHECK (
    (public_metadata IS NULL OR jsonb_typeof(public_metadata) = 'object') AND
    (safe_feedback_snapshot IS NULL OR jsonb_typeof(safe_feedback_snapshot) = 'object') AND
    (feedback_revision IS NULL OR (feedback_revision >= 0 AND feedback_recorded_at IS NOT NULL)) AND
    (public_metadata_provenance IS NULL OR public_metadata_provenance IN ('CAPTURED_AT_ATTEMPT_START', 'CAPTURED_AT_AI_REQUEST')) AND
    (feedback_provenance IS NULL OR feedback_provenance IN ('FEEDBACK_SNAPSHOT', 'LEGACY_FEEDBACK'))
  );

ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_epoch_check" CHECK (epoch >= 0),
  ADD CONSTRAINT "ai_conversations_identity_check" CHECK (
    length(owner_key) > 0 AND num_nonnulls(user_id, attempt_id) IN (0, 2) AND
    (deleted_at IS NOT NULL OR (user_id IS NOT NULL AND attempt_id IS NOT NULL))
  );

ALTER TABLE "ai_requests"
  ADD CONSTRAINT "ai_requests_counters_check" CHECK (
    conversation_epoch >= 0 AND lease_version >= 0 AND session_version_at_admission >= 0 AND
    max_cost_micros >= 0 AND (source_revision IS NULL OR source_revision >= 0) AND
    effective_hint_level BETWEEN 1 AND 3 AND (requested_hint_level IS NULL OR requested_hint_level BETWEEN 1 AND 3)
  ),
  ADD CONSTRAINT "ai_requests_hashes_check" CHECK (
    payload_hash ~ '^[0-9a-f]{64}$' AND context_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT "ai_requests_identity_check" CHECK (
    length(owner_key) > 0 AND length(recovery_epoch) > 0 AND
    num_nonnulls(user_id, attempt_id, conversation_id) IN (0, 3) AND
    (status NOT IN ('QUEUED', 'RUNNING') OR
      (user_id IS NOT NULL AND attempt_id IS NOT NULL AND conversation_id IS NOT NULL AND snapshot IS NOT NULL))
  ),
  ADD CONSTRAINT "ai_requests_json_check" CHECK (
    jsonb_typeof(versions) = 'object' AND (snapshot IS NULL OR jsonb_typeof(snapshot) = 'object')
  ),
  ADD CONSTRAINT "ai_requests_source_check" CHECK (
    (source_provenance IN ('LIVE_SNAPSHOT', 'FEEDBACK_SNAPSHOT') AND source_revision IS NOT NULL) OR
    (source_provenance = 'LEGACY_FEEDBACK' AND source_revision IS NULL AND intent = 'LAB_REVIEW' AND response_mode <> 'LLM')
  ),
  ADD CONSTRAINT "ai_requests_result_check" CHECK (
    (status = 'COMPLETED' AND response_mode IN ('LLM', 'DETERMINISTIC')) OR
    (status = 'OUTCOME_UNKNOWN' AND response_mode IN ('NONE', 'DETERMINISTIC')) OR
    (status NOT IN ('COMPLETED', 'OUTCOME_UNKNOWN') AND response_mode = 'NONE')
  ),
  ADD CONSTRAINT "ai_requests_times_check" CHECK (
    deadline_at > created_at AND
    (status IN ('QUEUED', 'RUNNING') OR finished_at IS NOT NULL)
  );

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_content_check" CHECK (
    epoch >= 0 AND (source_revision IS NULL OR source_revision >= 0) AND
    (content IS NULL OR char_length(content) BETWEEN 1 AND 6000) AND
    ((role = 'USER' AND content IS NOT NULL AND structured_answer IS NULL) OR
     (role = 'ASSISTANT' AND structured_answer IS NOT NULL AND jsonb_typeof(structured_answer) = 'object'))
  );

ALTER TABLE "ai_provider_calls"
  ADD CONSTRAINT "ai_provider_calls_r1_check" CHECK (step_index = 0 AND lease_version >= 1 AND currency = 'USD'),
  ADD CONSTRAINT "ai_provider_calls_cost_check" CHECK (
    max_cost_micros >= 0 AND (cost_micros IS NULL OR cost_micros >= 0) AND
    (input_tokens IS NULL OR input_tokens >= 0) AND
    (output_tokens IS NULL OR output_tokens >= 0) AND
    (reasoning_tokens IS NULL OR reasoning_tokens >= 0)
  ),
  ADD CONSTRAINT "ai_provider_calls_usage_check" CHECK (
    (usage_status <> 'FINAL' OR num_nonnulls(input_tokens, output_tokens, reasoning_tokens, cost_micros) = 4) AND
    (usage_status <> 'ESTIMATED' OR cost_micros IS NOT NULL)
  ),
  ADD CONSTRAINT "ai_provider_calls_receipt_check" CHECK (
    context_hash ~ '^[0-9a-f]{64}$' AND
    (receipt_hash IS NULL OR receipt_hash ~ '^[0-9a-f]{64}$') AND
    (receipt_payload IS NULL OR
      (jsonb_typeof(receipt_payload) = 'object' AND receipt_hash IS NOT NULL AND receipt_expires_at IS NOT NULL)) AND
    (state NOT IN ('DISPATCHED', 'OUTCOME_UNKNOWN', 'RECEIVED') OR dispatched_at IS NOT NULL) AND
    (state <> 'RECEIVED' OR (receipt_hash IS NOT NULL AND received_at IS NOT NULL))
  );

ALTER TABLE "ai_quota_buckets"
  ADD CONSTRAINT "ai_quota_buckets_limits_check" CHECK (
    limit_units >= 0 AND used_units >= 0 AND reserved_units >= 0 AND
    limit_micros >= 0 AND spent_micros >= 0 AND reserved_micros >= 0 AND
    used_units::bigint + reserved_units::bigint <= limit_units::bigint AND
    spent_micros <= limit_micros - reserved_micros AND window_end > window_start AND length(scope_key) > 0
  );

ALTER TABLE "ai_reservations"
  ADD CONSTRAINT "ai_reservations_cost_check" CHECK (
    units >= 0 AND cost_micros >= 0 AND
    (settled_units IS NULL OR settled_units >= 0) AND
    (settled_cost_micros IS NULL OR settled_cost_micros >= 0)
  ),
  ADD CONSTRAINT "ai_reservations_settlement_check" CHECK (
    (status IN ('SETTLED', 'RELEASED') AND num_nonnulls(settlement_key, settled_at, settled_units, settled_cost_micros) = 4) OR
    (status IN ('RESERVED', 'UNRESOLVED') AND num_nonnulls(settlement_key, settled_at, settled_units, settled_cost_micros) = 0)
  );

ALTER TABLE "ai_runtime_policies"
  ADD CONSTRAINT "ai_runtime_policies_config_check" CHECK (
    length(environment) > 0 AND version >= 1 AND jsonb_typeof(eligibility_rules) = 'object' AND
    jsonb_typeof(limits) = 'object' AND (NOT dispatch_enabled OR length(provider_config_id) > 0 AND provider_config_id IS NOT NULL)
  );

ALTER TABLE "ai_execution_slots"
  ADD CONSTRAINT "ai_execution_slots_lease_check" CHECK (
    slot_number >= 0 AND lease_version >= 0 AND
    (num_nonnulls(request_id, call_id, acquired_at, expires_at) = 0 OR
      (num_nonnulls(request_id, call_id, acquired_at, expires_at) = 4 AND lease_version >= 1 AND expires_at > acquired_at))
  );

ALTER TABLE "ai_event_outbox"
  ADD CONSTRAINT "ai_event_outbox_payload_check" CHECK (
    length(type) > 0 AND version >= 1 AND retry_count >= 0 AND jsonb_typeof(payload) = 'object'
  );
