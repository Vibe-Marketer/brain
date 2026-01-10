-- Migration: Add deduplication preference fields to user_settings
-- Purpose: Store user preferences for multi-source deduplication behavior
-- Author: Claude Code
-- Date: 2026-01-10

-- ============================================================================
-- ADD DEDUPLICATION PREFERENCE COLUMNS TO USER_SETTINGS
-- ============================================================================
-- These columns allow users to configure how duplicate meetings from multiple
-- sources (Fathom, Zoom, etc.) are resolved and which source takes priority.

-- Add deduplication priority mode
-- Determines how primary records are selected when duplicates are detected
-- Options: 'first_synced', 'most_recent', 'platform_hierarchy', 'longest_transcript'
-- Defaults to 'first_synced' - the first synced record becomes primary
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS dedup_priority_mode TEXT DEFAULT 'first_synced';

-- Add platform priority order
-- An array of platform identifiers in priority order (first = highest priority)
-- Only used when dedup_priority_mode = 'platform_hierarchy'
-- Example: ['zoom', 'fathom'] means Zoom recordings take priority over Fathom
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS dedup_platform_order TEXT[] DEFAULT '{}';

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================
-- Add check constraint to ensure dedup_priority_mode is a valid value
-- Use DO block for idempotency since ADD CONSTRAINT IF NOT EXISTS is not available

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_dedup_priority_mode_valid'
    AND conrelid = 'public.user_settings'::regclass
  ) THEN
    ALTER TABLE public.user_settings
    ADD CONSTRAINT chk_dedup_priority_mode_valid
    CHECK (dedup_priority_mode IS NULL OR dedup_priority_mode IN (
      'first_synced',
      'most_recent',
      'platform_hierarchy',
      'longest_transcript'
    ));
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to the new columns

COMMENT ON COLUMN public.user_settings.dedup_priority_mode IS
  'Deduplication strategy: first_synced, most_recent, platform_hierarchy, or longest_transcript';

COMMENT ON COLUMN public.user_settings.dedup_platform_order IS
  'Platform priority order for platform_hierarchy mode. Array of platform names in descending priority.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
