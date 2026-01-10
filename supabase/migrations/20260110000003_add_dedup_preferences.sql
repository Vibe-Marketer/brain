-- Add deduplication preference columns to user_settings table
-- This migration enables users to configure how duplicate meetings from multiple sources are handled
-- See SPEC-multi-source-deduplication.md for full specification

-- Add deduplication preference columns
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS dedup_priority_mode TEXT DEFAULT 'first_synced',
ADD COLUMN IF NOT EXISTS dedup_platform_order TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.user_settings.dedup_priority_mode IS 'How to determine primary source when duplicates detected: first_synced, most_recent, platform_hierarchy, longest_transcript';
COMMENT ON COLUMN public.user_settings.dedup_platform_order IS 'Ordered array of platform names for platform_hierarchy mode (e.g., {fathom, google_meet, zoom})';

-- Add constraint to validate dedup_priority_mode values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_settings_dedup_priority_mode_check'
    ) THEN
        ALTER TABLE public.user_settings
        ADD CONSTRAINT user_settings_dedup_priority_mode_check
        CHECK (dedup_priority_mode IN ('first_synced', 'most_recent', 'platform_hierarchy', 'longest_transcript'));
    END IF;
END $$;
