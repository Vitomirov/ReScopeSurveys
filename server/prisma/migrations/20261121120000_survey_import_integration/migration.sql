-- Survey import integration keys and import audit
CREATE TABLE "organization_integration_keys" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "integration_key_name" TEXT NOT NULL,
    "integration_key_prefix" TEXT NOT NULL,
    "integration_key_hash" TEXT NOT NULL,
    "integration_key_scopes" JSONB NOT NULL DEFAULT '["survey.import"]',
    "integration_key_created_by_id" TEXT,
    "integration_key_revoked_at" TIMESTAMP(3),
    "integration_key_last_used_at" TIMESTAMP(3),
    "integration_key_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_integration_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_integration_keys_integration_key_hash_key" ON "organization_integration_keys"("integration_key_hash");
CREATE INDEX "organization_integration_keys_organization_id_idx" ON "organization_integration_keys"("organization_id");
CREATE INDEX "organization_integration_keys_integration_key_prefix_idx" ON "organization_integration_keys"("integration_key_prefix");

ALTER TABLE "organization_integration_keys" ADD CONSTRAINT "organization_integration_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "survey_imports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "survey_id" TEXT,
    "survey_import_source" TEXT NOT NULL,
    "survey_import_status" TEXT NOT NULL,
    "survey_import_external_id" TEXT,
    "survey_import_error_report" JSONB,
    "survey_import_created_by_id" TEXT,
    "survey_import_created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "survey_imports_organization_id_survey_import_external_id_key" ON "survey_imports"("organization_id", "survey_import_external_id");
CREATE INDEX "survey_imports_organization_id_survey_import_created_at_idx" ON "survey_imports"("organization_id", "survey_import_created_at" DESC);

ALTER TABLE "survey_imports" ADD CONSTRAINT "survey_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "survey_imports" ADD CONSTRAINT "survey_imports_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
