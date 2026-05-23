-- Migration: Composio integration id storage
-- Purpose: Persist the Composio `connected_account_id` per `import_sources` row
--   so the `composio-trigger-webhook` ingress can match incoming Composio
--   deliveries to the CallVault user that owns the source. Storage strategy
--   is a column-with-index in the existing `connection_metadata` JSONB
--   (avoids a new column + lets the connector framework evolve), plus an
--   explicit denormalized column on the canonical row for B-tree speed.
-- Author: AI-assisted (Phase B — Composio adoption, ADR-006)
-- Date: 2026-05-23

BEGIN;

ALTER TABLE import_sources
  ADD COLUMN IF NOT EXISTS composio_connected_account_id TEXT;

COMMENT ON COLUMN import_sources.composio_connected_account_id IS
  'Composio (composio.dev) connected_account_id for sources routed through the Composio adapter (Gong, Dialpad, Webex, MS Teams, Google Meet, etc.). NULL for native sources. See ADR-006.';

-- Fast lookup from the trigger-webhook function which receives the id and
-- needs to resolve back to a (user_id, source_app) row in one query.
CREATE UNIQUE INDEX IF NOT EXISTS idx_import_sources_composio_account_id_unique
  ON import_sources (composio_connected_account_id)
  WHERE composio_connected_account_id IS NOT NULL;

COMMIT;
