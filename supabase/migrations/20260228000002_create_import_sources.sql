-- Migration: Create import_sources table
-- Purpose: Tracks per-user, per-source connection state for Import Hub UI.
--   Stores is_active toggle, account_email (OAuth sources), last_sync_at, and error_message.
--   Also adds skipped_count to sync_jobs for dedup summary reporting.
--   Also adds get_import_counts() RPC for single-query call counts per source.
-- Note: File named 000002 because 000001 is taken by workspace_redesign_schema.sql (Phase 16).
-- Date: 2026-02-28

-- ============================================================================
-- import_sources TABLE
-- ============================================================================
-- Import sources: tracks per-user connection status for each import source.
-- One row per (user, source_app) — UNIQUE constraint enforces this.

CREATE TABLE IF NOT EXISTS import_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_app TEXT NOT NULL,  -- 'fathom', 'zoom', 'youtube', 'file-upload'
  is_active BOOLEAN NOT NULL DEFAULT true,
  account_email TEXT,        -- connected account email (OAuth sources)
  last_sync_at TIMESTAMPTZ,
  error_message TEXT,        -- last error if any
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_app)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup: all sources for a user
CREATE INDEX idx_import_sources_user_id ON import_sources(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE import_sources ENABLE ROW LEVEL SECURITY;

-- Users can only see their own import sources
CREATE POLICY "Users can view their own import sources"
  ON import_sources FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert rows for themselves
CREATE POLICY "Users can insert their own import sources"
  ON import_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own import sources
CREATE POLICY "Users can update their own import sources"
  ON import_sources FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own import sources
CREATE POLICY "Users can delete their own import sources"
  ON import_sources FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- sync_jobs: add skipped_count for dedup summary reporting
-- ============================================================================
-- Records how many duplicates were silently skipped in a given sync run.
-- Displayed in sync completion toast: "Fathom sync complete — 8 new, 3 skipped"

ALTER TABLE sync_jobs ADD COLUMN IF NOT EXISTS skipped_count INTEGER DEFAULT 0;

-- ============================================================================
-- get_import_counts() RPC
-- ============================================================================
-- Returns call count per source_app for a given user.
-- Single aggregate query covers all source cards — avoids N+1 per card.
-- Stale time in React Query can be generous (5 min) as counts are decorative.

CREATE OR REPLACE FUNCTION get_import_counts(p_user_id UUID)
RETURNS TABLE(source_app TEXT, call_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT r.source_app, COUNT(*) as call_count
  FROM recordings r
  WHERE r.owner_user_id = p_user_id
  GROUP BY r.source_app;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE import_sources IS 'Per-user, per-source connection state for Import Hub UI. One row per (user_id, source_app).';
COMMENT ON COLUMN import_sources.source_app IS 'Source platform identifier: fathom, zoom, youtube, file-upload';
COMMENT ON COLUMN import_sources.is_active IS 'Whether the source is actively syncing. Can be toggled by user without disconnecting.';
COMMENT ON COLUMN import_sources.account_email IS 'Email of the connected account for OAuth sources (Fathom, Zoom, YouTube).';
COMMENT ON COLUMN import_sources.last_sync_at IS 'Timestamp of the most recent successful sync. Displayed in the source card.';
COMMENT ON COLUMN import_sources.error_message IS 'Last error message if any, e.g. expired token. Displayed as error badge in source card.';
COMMENT ON COLUMN sync_jobs.skipped_count IS 'Number of records skipped as duplicates in this sync run. Used in completion toast.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
