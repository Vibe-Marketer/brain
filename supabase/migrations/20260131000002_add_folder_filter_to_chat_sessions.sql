-- Migration: Add folder filter to chat sessions
-- Purpose: Enable folder-level chat filtering - users can scope chat to specific folders
-- Author: Claude
-- Date: 2026-01-31

-- ============================================================================
-- ADD COLUMN: filter_folder_ids to chat_sessions
-- ============================================================================
-- Allows users to filter chat searches to calls within specific folders

ALTER TABLE public.chat_sessions
ADD COLUMN IF NOT EXISTS filter_folder_ids UUID[];

-- ============================================================================
-- INDEX: GIN index for array containment queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_chat_sessions_folder_filter
ON public.chat_sessions USING GIN (filter_folder_ids);

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON COLUMN public.chat_sessions.filter_folder_ids IS
  'Array of folder UUIDs to filter search scope. When set, chat only searches calls within these folders.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
