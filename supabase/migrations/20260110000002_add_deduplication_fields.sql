-- Migration: Add deduplication fields to fathom_calls table
-- Purpose: Enable multi-source meeting deduplication across Fathom, Zoom, etc.
-- Author: Claude Code
-- Date: 2026-01-10

-- ============================================================================
-- ADD DEDUPLICATION COLUMNS TO FATHOM_CALLS
-- ============================================================================
-- These columns enable identifying and merging duplicate meetings from multiple
-- recording sources (Fathom, Zoom, etc.) based on meeting characteristics.

-- Add meeting fingerprint
-- A computed hash/fingerprint based on normalized title, time bucket, and participants
-- Used to identify potential duplicate meetings across sources
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS meeting_fingerprint TEXT;

-- Add source platform identifier
-- Indicates which platform the recording came from (fathom, zoom, etc.)
-- Defaults to 'fathom' for backwards compatibility with existing records
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS source_platform TEXT DEFAULT 'fathom';

-- Add primary record flag
-- When duplicates are found, one record is marked as primary (visible in UI)
-- Secondary records are kept for data completeness but hidden from main views
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;

-- Add merged_from array
-- Stores recording_ids of duplicate meetings that were merged into this primary record
-- Allows tracing back to original sources and their metadata
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS merged_from BIGINT[];

-- Add fuzzy match score
-- Stores the confidence score (0-100) of the duplicate detection algorithm
-- Higher scores indicate stronger match confidence
ALTER TABLE public.fathom_calls
ADD COLUMN IF NOT EXISTS fuzzy_match_score NUMERIC;

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Create index for efficient fingerprint lookups on primary records
-- Most queries will filter for is_primary = true when checking for duplicates

CREATE INDEX IF NOT EXISTS idx_meeting_fingerprint
ON public.fathom_calls(meeting_fingerprint)
WHERE is_primary = true;

-- Create index on source_platform for filtering by source
CREATE INDEX IF NOT EXISTS idx_fathom_calls_source_platform
ON public.fathom_calls(source_platform);

-- Create index on is_primary for filtering primary vs secondary records
CREATE INDEX IF NOT EXISTS idx_fathom_calls_is_primary
ON public.fathom_calls(is_primary)
WHERE is_primary = false;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to the new columns

COMMENT ON COLUMN public.fathom_calls.meeting_fingerprint IS
  'Computed fingerprint for deduplication: hash of normalized title, time bucket, participants';

COMMENT ON COLUMN public.fathom_calls.source_platform IS
  'Recording source platform identifier: fathom, zoom, etc. Defaults to fathom.';

COMMENT ON COLUMN public.fathom_calls.is_primary IS
  'Primary record flag for deduplication. Primary records show in UI, secondary are hidden.';

COMMENT ON COLUMN public.fathom_calls.merged_from IS
  'Array of recording_ids that were identified as duplicates and merged into this record.';

COMMENT ON COLUMN public.fathom_calls.fuzzy_match_score IS
  'Confidence score (0-100) from the duplicate detection algorithm.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
