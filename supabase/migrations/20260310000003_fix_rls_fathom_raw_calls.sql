-- Migration: Fix RLS policies on call_tag_assignments, call_speakers,
--            transcript_tag_assignments, fathom_raw_transcripts
-- Purpose: Replace fathom_raw_calls ownership checks with recordings table joins.
--          The old policies only allowed access for Fathom-sourced recordings,
--          locking out YouTube, Zoom, and uploaded recordings entirely.
--          Fix: ownership is now checked via recordings.legacy_recording_id for
--          BIGINT call_recording_id columns (UUID migration tracked separately).
-- Issue: #123
-- Date: 2026-03-10
--
-- REPLAY GUARD (replay-only — prod already past this version):
-- On a fresh replay these tables do not yet have a `recording_id` column —
-- it is added by 20260310125000_migrate_call_recording_id_to_uuid.sql, which
-- also drops and recreates the policies on all three tables. So on replay the
-- policy bodies below cannot compile (42703). Each section is wrapped in a DO
-- block that skips policy creation when the column is absent; the later UUID
-- migration establishes the correct end-state policies either way.

-- ============================================================================
-- 1. call_tag_assignments
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own call category assignments" ON call_tag_assignments;
DROP POLICY IF EXISTS "Users can manage own call category assignments" ON call_tag_assignments;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_tag_assignments'
      AND column_name = 'recording_id'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can read own call category assignments"
        ON call_tag_assignments FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY "Users can manage own call category assignments"
        ON call_tag_assignments FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;

-- ============================================================================
-- 2. call_speakers
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own call speakers" ON call_speakers;
DROP POLICY IF EXISTS "Users can manage own call speakers" ON call_speakers;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'call_speakers'
      AND column_name = 'recording_id'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can read own call speakers"
        ON call_speakers FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_speakers.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY "Users can manage own call speakers"
        ON call_speakers FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_speakers.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = call_speakers.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;

-- ============================================================================
-- 3. transcript_tag_assignments
-- ============================================================================

DROP POLICY IF EXISTS "Users can read tag assignments for own calls" ON transcript_tag_assignments;
DROP POLICY IF EXISTS "Users can manage tag assignments for own calls" ON transcript_tag_assignments;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transcript_tag_assignments'
      AND column_name = 'recording_id'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can read tag assignments for own calls"
        ON transcript_tag_assignments FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
    EXECUTE $pol$
      CREATE POLICY "Users can manage tag assignments for own calls"
        ON transcript_tag_assignments FOR ALL
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM recordings r
            WHERE r.id = transcript_tag_assignments.recording_id
              AND r.owner_user_id = auth.uid()
          )
        )
    $pol$;
  END IF;
END $$;

-- ============================================================================
-- 4. fathom_raw_transcripts
-- ============================================================================
-- The "Users can read own fathom transcripts" and "Users can update own fathom
-- transcripts" policies used a fathom_raw_calls join for ownership. Two correct
-- user_id-based policies already exist:
--   "Users can view their transcripts"  (SELECT, user_id = auth.uid())
--   "Users can update their transcripts" (UPDATE, user_id = auth.uid())
-- Drop the stale fathom_raw_calls-based duplicates.

DROP POLICY IF EXISTS "Users can read own fathom transcripts" ON fathom_raw_transcripts;
DROP POLICY IF EXISTS "Users can update own fathom transcripts" ON fathom_raw_transcripts;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
