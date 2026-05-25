-- Remove Composio scaffold schema artifacts.
--
-- Composio is intentionally not part of the current connector runtime. Keep
-- historical migrations intact, but remove unused columns from live schemas.

BEGIN;

DROP INDEX IF EXISTS idx_import_sources_composio_account_id_unique;

ALTER TABLE IF EXISTS import_sources
  DROP COLUMN IF EXISTS composio_connected_account_id;

ALTER TABLE IF EXISTS connections
  DROP COLUMN IF EXISTS composio_connection_id;

ALTER TABLE IF EXISTS tenants
  DROP COLUMN IF EXISTS composio_entity_id;

COMMIT;
