-- Migration: Add paste-source columns to recordings
-- Purpose: Phase 24 — user-paste flow for Fathom share-link transcripts.
--          Adds share_token (parsed from Fathom share URLs) and transcript_segments
--          (structured speaker+timestamp turns) to enable dedup + structured rendering.
-- Date: 2026-05-07
-- Plan: Phase 24 Plan 01 (24-fathom-share-link-save)
--
-- Notes for downstream agents:
--   - The recordings table column for workspace scoping is `organization_id`,
--     NOT `bank_id`. The plan spec referred to bank_id but the migration in
--     20260301000001_rename_vaults_to_workspaces.sql renamed bank_id -> organization_id.
--   - We add `share_token` as a NEW column (per plan), but pasted recordings ALSO
--     populate `source_call_id = share_token` so the existing global dedup constraint
--     (organization_id, source_app, source_call_id) handles dedup automatically.
--   - This migration adds an EXTRA partial unique index on (organization_id, share_token)
--     for defense-in-depth and to make share_token-keyed lookups fast.

-- ============================================================================
-- COLUMN ADDITIONS
-- ============================================================================

ALTER TABLE recordings
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS transcript_segments JSONB;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Partial unique index: enforce one paste per (organization, share_token) pair.
-- WHERE share_token IS NOT NULL ensures non-paste recordings (which leave
-- share_token NULL) don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_recordings_org_share_token
  ON recordings(organization_id, share_token)
  WHERE share_token IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN recordings.share_token IS
  'Phase 24: parsed token from a Fathom share URL (e.g. https://fathom.video/share/<token>). Used as dedup key with organization_id for paste-source recordings (source_app=''fathom-paste''). NULL for all other source apps.';

COMMENT ON COLUMN recordings.transcript_segments IS
  'Phase 24: structured speaker+timestamp turns parsed from a pasted Fathom transcript. JSONB array of { start_ms, speaker, text }. NULL when the pasted text was unparseable (parse_status=''raw'' in source_metadata).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
