-- Migration: Add auto-naming settings to user_settings
-- Purpose: Enable per-user toggle for AI auto-naming on import, on by default
-- Date: 2026-03-10

-- ============================================================================
-- ADD auto_naming_enabled COLUMN TO user_settings
-- ============================================================================
-- ON by default: every imported call automatically runs generate-ai-titles.
-- When disabled, calls keep their original title from the source.

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS auto_naming_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.user_settings.auto_naming_enabled IS
  'When true (default), every imported call is auto-titled by AI on import. Uses 1 AI action per call.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
