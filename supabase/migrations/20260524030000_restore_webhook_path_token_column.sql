-- Migration: Restore missing import_sources.webhook_path_token column
-- Purpose:   The 2026-05-23 migration `add_generic_source_auth_fields`
--            (20260523130000) was recorded as applied in
--            supabase_migrations.schema_migrations, but only TWO of its
--            three new columns actually exist in production:
--
--              api_key                 ✓ present
--              webhook_signing_secret  ✓ present
--              webhook_path_token      ✗ MISSING
--
--            Frontend code in `src/services/import-sources.service.ts`
--            references webhook_path_token in its SELECT, causing
--            `getImportSources()` to fail with:
--
--              {"code":"42703","message":"column
--                import_sources.webhook_path_token does not exist"}
--
--            Cascading consequence:
--              - useImportSources() throws and returns empty
--              - ImportOverviewDashboard renders 0 rows
--              - deriveSourceStatus returns "setup-needed" for EVERY source
--              - Every connected platform (Fathom, Fireflies, Zoom, Plaud)
--                falsely shows "Setup needed" on the Import page even
--                though Settings → Integrations correctly shows "Connected"
--
--            How a partial apply happened is unknown — the parent
--            migration uses one atomic ALTER TABLE with three ADD COLUMN
--            IF NOT EXISTS clauses, which should be all-or-none. Possible
--            causes: supabase-cli statement-splitting bug at the time,
--            manual DROP COLUMN that wasn't recorded, or a partial rollback
--            during an earlier deploy.
--
--            This migration is idempotent — it uses ADD COLUMN IF NOT
--            EXISTS so re-application on databases that already have the
--            column (e.g. fresh dev environments seeded from the parent
--            migration) is a no-op.
--
-- Date:      2026-05-23

BEGIN;

ALTER TABLE import_sources
  ADD COLUMN IF NOT EXISTS webhook_path_token TEXT;

COMMENT ON COLUMN import_sources.webhook_path_token IS
'Opaque URL token used to route incoming source webhooks to a specific import_sources row before signature verification.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_webhook_path_token_unique
  ON import_sources (webhook_path_token)
  WHERE webhook_path_token IS NOT NULL;

COMMIT;
