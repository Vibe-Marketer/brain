-- Migration: Add sync_source_filter column to user_settings
-- Purpose: Store user preferences for which integration sources to show on the Sync page
-- Author: Claude Code
-- Date: 2026-01-29

-- ============================================================================
-- ADD SYNC SOURCE FILTER COLUMN TO USER_SETTINGS
-- ============================================================================
-- This column stores an array of platform strings that the user has enabled
-- for viewing on the Sync page. NULL means all connected platforms are enabled
-- (default behavior). When set, only meetings from platforms in this array
-- will be displayed.

-- Add sync_source_filter column
-- Stores array of platform strings like ['fathom', 'zoom', 'google_meet']
-- NULL = all connected platforms enabled (default)
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS sync_source_filter text[] DEFAULT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comment to the new column

COMMENT ON COLUMN public.user_settings.sync_source_filter IS
  'Array of enabled platform strings for Sync page filter. NULL means all connected platforms enabled.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
