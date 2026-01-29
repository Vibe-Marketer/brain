-- Migration: Add active_team_id to user_settings for team context persistence
-- Purpose: Allow users to persist their active team selection across sessions
-- Author: Claude Code
-- Date: 2026-01-29

-- ============================================================================
-- COLUMN: active_team_id
-- ============================================================================
-- Tracks which team (or personal workspace) is currently active for the user
-- NULL means personal workspace (no team filter - user's own data)
-- UUID means team workspace (team-shared data visible)

ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS active_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEX
-- ============================================================================
-- Add index for quick lookups of users with active team context

CREATE INDEX IF NOT EXISTS idx_user_settings_active_team_id 
ON public.user_settings(active_team_id) 
WHERE active_team_id IS NOT NULL;

-- ============================================================================
-- COMMENT
-- ============================================================================

COMMENT ON COLUMN public.user_settings.active_team_id IS 
'Currently active team context. NULL means personal workspace (no team filter).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
