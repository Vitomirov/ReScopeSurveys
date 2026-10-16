-- Product access is independent of admin/editor. Existing accounts keep the builder.
ALTER TABLE "users"
  ADD COLUMN "user_can_use_builder" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "user_can_use_panel" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "auth_tokens"
  ADD COLUMN "invite_can_use_builder" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "invite_can_use_panel" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "panel_oauth_codes" (
  "id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "code_challenge" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "panel_oauth_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "panel_oauth_codes_code_hash_key" ON "panel_oauth_codes"("code_hash");
CREATE INDEX "panel_oauth_codes_expires_at_idx" ON "panel_oauth_codes"("expires_at");
