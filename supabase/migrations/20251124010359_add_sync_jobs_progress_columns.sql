-- Add progress tracking columns to sync_jobs table
-- This fixes the 500 error in sync-meetings Edge Function

-- Add new columns for tracking sync progress
ALTER TABLE public.sync_jobs
  ADD COLUMN IF NOT EXISTS recording_ids INTEGER[],
  ADD COLUMN IF NOT EXISTS progress_current INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS synced_ids INTEGER[],
  ADD COLUMN IF NOT EXISTS failed_ids INTEGER[];

-- Make type column optional with default value
ALTER TABLE public.sync_jobs
  ALTER COLUMN type SET DEFAULT 'sync',
  ALTER COLUMN type DROP NOT NULL;

-- Update any existing rows to have default type
UPDATE public.sync_jobs
SET type = 'sync'
WHERE type IS NULL;

COMMENT ON COLUMN public.sync_jobs.recording_ids IS 'Array of recording IDs to sync';
COMMENT ON COLUMN public.sync_jobs.progress_current IS 'Number of recordings processed';
COMMENT ON COLUMN public.sync_jobs.progress_total IS 'Total number of recordings to sync';
COMMENT ON COLUMN public.sync_jobs.synced_ids IS 'Array of successfully synced recording IDs';
COMMENT ON COLUMN public.sync_jobs.failed_ids IS 'Array of failed recording IDs';
