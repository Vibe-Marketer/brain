-- Migration: Change sync_jobs ID arrays from INTEGER[] to TEXT[]
-- Purpose: Zoom recording IDs are UUIDs (strings), not integers like Fathom.
--          TEXT[] supports both integer IDs (Fathom) and UUID strings (Zoom).

ALTER TABLE public.sync_jobs
  ALTER COLUMN recording_ids TYPE TEXT[] USING recording_ids::TEXT[],
  ALTER COLUMN synced_ids TYPE TEXT[] USING synced_ids::TEXT[],
  ALTER COLUMN failed_ids TYPE TEXT[] USING failed_ids::TEXT[];

COMMENT ON COLUMN public.sync_jobs.recording_ids IS 'Array of recording IDs to sync (integers for Fathom, UUIDs for Zoom)';
COMMENT ON COLUMN public.sync_jobs.synced_ids IS 'Array of successfully synced recording IDs';
COMMENT ON COLUMN public.sync_jobs.failed_ids IS 'Array of failed recording IDs';
