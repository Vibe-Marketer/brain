-- Migration: Add jsonb_merge_source_metadata RPC
-- Purpose: Atomic JSONB merge on recordings.source_metadata to avoid
--          read-modify-write race conditions during bulk routing operations.
-- Author: Claude
-- Date: 2026-03-08

-- ============================================================================
-- FUNCTION: jsonb_merge_source_metadata
-- ============================================================================
-- Atomically merges a JSONB payload into a recording's source_metadata using
-- the || (concatenation) operator. This is a single UPDATE — no SELECT needed,
-- eliminating the lost-update problem when concurrent processes modify the
-- same recording's metadata.

CREATE OR REPLACE FUNCTION jsonb_merge_source_metadata(
  p_recording_id UUID,
  p_merge_data JSONB
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE recordings
  SET source_metadata = COALESCE(source_metadata, '{}'::jsonb) || p_merge_data
  WHERE id = p_recording_id;
$$;

-- Grant execute to authenticated users (edge functions use service role)
GRANT EXECUTE ON FUNCTION jsonb_merge_source_metadata(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION jsonb_merge_source_metadata(UUID, JSONB) TO service_role;

COMMENT ON FUNCTION jsonb_merge_source_metadata IS
  'Atomically merges JSONB data into recordings.source_metadata using || operator. '
  'Used by apply-routing-rules to stamp routing traces without race conditions.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
