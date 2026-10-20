-- Additive columns and an append-only audit table.
-- Existing response rows keep a null write key and the previous update path.

ALTER TABLE "users"
  ADD COLUMN "user_totp_secret" TEXT,
  ADD COLUMN "user_totp_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "responses"
  ADD COLUMN "response_write_key_hash" TEXT;

CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "actor_id" TEXT,
  "audit_action" TEXT NOT NULL,
  "target_entity" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_organization_id_created_at_idx"
  ON "audit_events"("organization_id", "created_at");

CREATE INDEX "audit_events_target_entity_target_id_idx"
  ON "audit_events"("target_entity", "target_id");
