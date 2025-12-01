-- Migration: Change fathom_calls primary key to composite (recording_id, user_id)
-- Purpose: Enable multi-user team support - same call can exist for multiple users
--
-- This allows:
-- - Team leaders' calls to sync to both their account AND team members' accounts
-- - Multiple users with the same host_email to each have their own copy of calls
--
-- IMPORTANT: This is a breaking change that must be done while data is minimal

-- ============================================================================
-- STEP 1: Drop all foreign key constraints that reference fathom_calls
-- ============================================================================

-- Drop FK from fathom_transcripts
ALTER TABLE public.fathom_transcripts
  DROP CONSTRAINT IF EXISTS fathom_transcripts_recording_id_fkey;

-- Drop FK from transcript_chunks
ALTER TABLE public.transcript_chunks
  DROP CONSTRAINT IF EXISTS transcript_chunks_recording_id_fkey;

-- Drop FK from call_tag_assignments (was call_category_assignments)
ALTER TABLE public.call_tag_assignments
  DROP CONSTRAINT IF EXISTS call_tag_assignments_call_recording_id_fkey;

-- Also try the old name in case migration order is different
ALTER TABLE public.call_tag_assignments
  DROP CONSTRAINT IF EXISTS call_category_assignments_call_recording_id_fkey;

-- Drop FK from call_speakers
ALTER TABLE public.call_speakers
  DROP CONSTRAINT IF EXISTS call_speakers_call_recording_id_fkey;

-- Drop FK from transcript_tag_assignments (if it exists)
ALTER TABLE IF EXISTS public.transcript_tag_assignments
  DROP CONSTRAINT IF EXISTS transcript_tag_assignments_call_recording_id_fkey;

-- Drop FK from folder_assignments (if it exists from parallel migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'folder_assignments' AND table_schema = 'public') THEN
    ALTER TABLE public.folder_assignments
      DROP CONSTRAINT IF EXISTS folder_assignments_call_recording_id_fkey;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop the existing primary key
-- ============================================================================

ALTER TABLE public.fathom_calls
  DROP CONSTRAINT IF EXISTS fathom_calls_pkey;

-- ============================================================================
-- STEP 3: Ensure user_id is NOT NULL (required for composite PK)
-- ============================================================================

-- For any existing rows with NULL user_id, we need to handle them
-- Delete NULL user_id rows as they shouldn't exist in a properly functioning system
DELETE FROM public.fathom_calls WHERE user_id IS NULL;

-- Now make user_id NOT NULL
ALTER TABLE public.fathom_calls
  ALTER COLUMN user_id SET NOT NULL;

-- ============================================================================
-- STEP 4: Add the new composite primary key
-- ============================================================================

ALTER TABLE public.fathom_calls
  ADD CONSTRAINT fathom_calls_pkey PRIMARY KEY (recording_id, user_id);

-- ============================================================================
-- STEP 5: Add user_id to fathom_transcripts and create composite FK
-- ============================================================================

-- fathom_transcripts - add user_id column
ALTER TABLE public.fathom_transcripts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing transcripts to get user_id from their parent call
UPDATE public.fathom_transcripts ft
SET user_id = fc.user_id
FROM public.fathom_calls fc
WHERE ft.recording_id = fc.recording_id
  AND ft.user_id IS NULL;

-- Delete orphaned transcripts (no matching call)
DELETE FROM public.fathom_transcripts WHERE user_id IS NULL;

-- Make user_id NOT NULL for fathom_transcripts
ALTER TABLE public.fathom_transcripts
  ALTER COLUMN user_id SET NOT NULL;

-- Add composite FK to fathom_calls
ALTER TABLE public.fathom_transcripts
  ADD CONSTRAINT fathom_transcripts_recording_user_fkey
  FOREIGN KEY (recording_id, user_id)
  REFERENCES public.fathom_calls(recording_id, user_id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 6: Update transcript_chunks with composite FK
-- ============================================================================

-- transcript_chunks already has user_id column, just need to update FK
ALTER TABLE public.transcript_chunks
  ADD CONSTRAINT transcript_chunks_recording_user_fkey
  FOREIGN KEY (recording_id, user_id)
  REFERENCES public.fathom_calls(recording_id, user_id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 7: Update call_tag_assignments with user_id and composite FK
-- ============================================================================

-- Add user_id column
ALTER TABLE public.call_tag_assignments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing assignments to get user_id from their parent call
UPDATE public.call_tag_assignments cta
SET user_id = fc.user_id
FROM public.fathom_calls fc
WHERE cta.call_recording_id = fc.recording_id
  AND cta.user_id IS NULL;

-- Delete orphaned assignments (no matching call)
DELETE FROM public.call_tag_assignments WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE public.call_tag_assignments
  ALTER COLUMN user_id SET NOT NULL;

-- Drop old unique constraint and add new one with user_id
ALTER TABLE public.call_tag_assignments
  DROP CONSTRAINT IF EXISTS call_tag_assignments_call_recording_id_tag_id_key;

ALTER TABLE public.call_tag_assignments
  DROP CONSTRAINT IF EXISTS call_category_assignments_call_recording_id_category_id_key;

ALTER TABLE public.call_tag_assignments
  ADD CONSTRAINT call_tag_assignments_unique
  UNIQUE (call_recording_id, tag_id, user_id);

-- Add composite FK
ALTER TABLE public.call_tag_assignments
  ADD CONSTRAINT call_tag_assignments_recording_user_fkey
  FOREIGN KEY (call_recording_id, user_id)
  REFERENCES public.fathom_calls(recording_id, user_id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 8: Update call_speakers with user_id and composite FK
-- ============================================================================

-- Add user_id column
ALTER TABLE public.call_speakers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing speaker assignments to get user_id from their parent call
UPDATE public.call_speakers cs
SET user_id = fc.user_id
FROM public.fathom_calls fc
WHERE cs.call_recording_id = fc.recording_id
  AND cs.user_id IS NULL;

-- Delete orphaned speaker assignments (no matching call)
DELETE FROM public.call_speakers WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE public.call_speakers
  ALTER COLUMN user_id SET NOT NULL;

-- Drop old unique constraint and add new one with user_id
ALTER TABLE public.call_speakers
  DROP CONSTRAINT IF EXISTS call_speakers_call_recording_id_speaker_id_key;

ALTER TABLE public.call_speakers
  ADD CONSTRAINT call_speakers_unique
  UNIQUE (call_recording_id, speaker_id, user_id);

-- Add composite FK
ALTER TABLE public.call_speakers
  ADD CONSTRAINT call_speakers_recording_user_fkey
  FOREIGN KEY (call_recording_id, user_id)
  REFERENCES public.fathom_calls(recording_id, user_id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 9: Create helpful indexes
-- ============================================================================

-- Index for looking up calls by recording_id (useful for webhook processing)
CREATE INDEX IF NOT EXISTS idx_fathom_calls_recording_id
  ON public.fathom_calls(recording_id);

-- Index for looking up transcripts by recording_id + user_id
CREATE INDEX IF NOT EXISTS idx_fathom_transcripts_recording_user
  ON public.fathom_transcripts(recording_id, user_id);

-- ============================================================================
-- STEP 10: Update RLS policies to account for user_id in child tables
-- ============================================================================

-- fathom_transcripts policies - update to use local user_id
DROP POLICY IF EXISTS "Users can view their transcripts" ON public.fathom_transcripts;
CREATE POLICY "Users can view their transcripts"
  ON public.fathom_transcripts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their transcripts" ON public.fathom_transcripts;
CREATE POLICY "Users can insert their transcripts"
  ON public.fathom_transcripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their transcripts" ON public.fathom_transcripts;
CREATE POLICY "Users can update their transcripts"
  ON public.fathom_transcripts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their transcripts" ON public.fathom_transcripts;
CREATE POLICY "Users can delete their transcripts"
  ON public.fathom_transcripts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 11: Update trigger functions that reference the old schema
-- ============================================================================

-- Update ensure_skip_tag function to work with composite key
CREATE OR REPLACE FUNCTION ensure_skip_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  skip_tag_id UUID;
BEGIN
  -- Get SKIP tag (system tag)
  SELECT id INTO skip_tag_id
  FROM call_tags
  WHERE name = 'SKIP' AND is_system = true;

  IF skip_tag_id IS NULL THEN
    RETURN NEW;  -- No SKIP tag exists, skip this logic
  END IF;

  -- Auto-assign to SKIP if transcript is null or too short
  IF NEW.full_transcript IS NULL OR LENGTH(NEW.full_transcript) < 500 THEN
    INSERT INTO call_tag_assignments (call_recording_id, tag_id, user_id, auto_assigned)
    VALUES (NEW.recording_id, skip_tag_id, NEW.user_id, true)
    ON CONFLICT (call_recording_id, tag_id, user_id) DO NOTHING;
  ELSE
    -- Remove from SKIP if transcript is now adequate
    DELETE FROM call_tag_assignments
    WHERE call_recording_id = NEW.recording_id
    AND user_id = NEW.user_id
    AND tag_id = skip_tag_id
    AND auto_assigned = true;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- STEP 12: Update transcript_tag_assignments if it exists
-- ============================================================================

-- Add user_id column if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transcript_tag_assignments' AND table_schema = 'public') THEN
    -- Add user_id column
    ALTER TABLE public.transcript_tag_assignments
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Update existing assignments to get user_id from their parent call
    UPDATE public.transcript_tag_assignments tta
    SET user_id = fc.user_id
    FROM public.fathom_calls fc
    WHERE tta.call_recording_id = fc.recording_id
      AND tta.user_id IS NULL;

    -- Delete orphaned assignments (no matching call)
    DELETE FROM public.transcript_tag_assignments WHERE user_id IS NULL;

    -- Make user_id NOT NULL if there's data
    IF EXISTS (SELECT 1 FROM public.transcript_tag_assignments LIMIT 1) THEN
      ALTER TABLE public.transcript_tag_assignments
        ALTER COLUMN user_id SET NOT NULL;
    END IF;

    -- Add composite FK
    ALTER TABLE public.transcript_tag_assignments
      ADD CONSTRAINT transcript_tag_assignments_recording_user_fkey
      FOREIGN KEY (call_recording_id, user_id)
      REFERENCES public.fathom_calls(recording_id, user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- STEP 13: Add comments for documentation
-- ============================================================================

COMMENT ON CONSTRAINT fathom_calls_pkey ON public.fathom_calls IS
  'Composite primary key allows same recording to exist for multiple users (team support)';

COMMENT ON COLUMN public.fathom_transcripts.user_id IS
  'User who owns this transcript copy - enables multi-user team support';

COMMENT ON COLUMN public.call_tag_assignments.user_id IS
  'User who owns this tag assignment - enables multi-user team support';

COMMENT ON COLUMN public.call_speakers.user_id IS
  'User who owns this speaker assignment - enables multi-user team support';

-- ============================================================================
-- Done! The schema now supports multi-user team sync
-- ============================================================================
