-- CRITICAL SECURITY FIX: Views bypassing Row Level Security
--
-- Problem: Views created on renamed tables (fathom_calls, fathom_transcripts,
-- recurring_call_titles) ran as the view OWNER (postgres), not the calling user.
-- Since relforcerowsecurity was false, RLS was completely bypassed — every
-- authenticated user could see ALL users' data through these views.
--
-- Root cause: When fathom_calls was renamed to fathom_raw_calls, a compatibility
-- view "fathom_calls" was created without security_invoker=true. PostgreSQL views
-- default to SECURITY DEFINER (owner's permissions), bypassing RLS.
--
-- Fix:
--   1. FORCE ROW LEVEL SECURITY on all sensitive tables (enforces RLS even for table owner)
--   2. Recreate all views with security_invoker=true (runs as caller, respects RLS)
--   3. Drop blanket RLS policies that grant ALL roles USING(true) on raw tables
--      (created during table rename migration without proper role restriction)
--   4. Recreate service role policies with proper TO service_role restriction
--
-- Applied directly to production: 2026-03-05 (hotfix)
-- Date: 2026-03-05

-- ============================================================================
-- 1. FORCE ROW LEVEL SECURITY on all sensitive tables
-- ============================================================================
ALTER TABLE fathom_raw_calls FORCE ROW LEVEL SECURITY;
ALTER TABLE fathom_raw_transcripts FORCE ROW LEVEL SECURITY;
ALTER TABLE recordings FORCE ROW LEVEL SECURITY;
ALTER TABLE workspace_entries FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. Recreate fathom_calls view with security_invoker
-- ============================================================================
CREATE OR REPLACE VIEW fathom_calls
WITH (security_invoker = true)
AS
SELECT
  recording_id,
  user_id,
  title,
  created_at,
  recording_start_time,
  recording_end_time,
  url,
  share_url,
  recorded_by_name,
  recorded_by_email,
  calendar_invitees,
  full_transcript,
  summary,
  title_edited_by_user,
  summary_edited_by_user,
  ai_generated_title,
  ai_title_generated_at,
  auto_tags,
  auto_tags_generated_at,
  synced_at,
  meeting_fingerprint,
  source_platform,
  is_primary,
  merged_from,
  fuzzy_match_score,
  google_calendar_event_id,
  google_drive_file_id,
  transcript_source,
  sentiment_cache,
  metadata
FROM fathom_raw_calls;

-- ============================================================================
-- 3. Recreate fathom_transcripts view with security_invoker
-- ============================================================================
CREATE OR REPLACE VIEW fathom_transcripts
WITH (security_invoker = true)
AS
SELECT
  id,
  recording_id,
  speaker_name,
  speaker_email,
  text,
  "timestamp",
  edited_text,
  edited_speaker_name,
  edited_speaker_email,
  is_deleted,
  edited_at,
  edited_by,
  created_at,
  user_id
FROM fathom_raw_transcripts;

-- ============================================================================
-- 4. Recreate recurring_call_titles view with security_invoker
-- ============================================================================
CREATE OR REPLACE VIEW recurring_call_titles
WITH (security_invoker = true)
AS
SELECT fc.user_id,
  fc.title,
  count(*) AS occurrence_count,
  max(fc.created_at) AS last_occurrence,
  min(fc.created_at) AS first_occurrence,
  array_agg(DISTINCT ct.name) FILTER (WHERE (ct.name IS NOT NULL)) AS current_tags
FROM ((fathom_raw_calls fc
  LEFT JOIN call_tag_assignments cta ON ((fc.recording_id = cta.call_recording_id)))
  LEFT JOIN call_tags ct ON ((cta.tag_id = ct.id)))
GROUP BY fc.user_id, fc.title;

-- ============================================================================
-- 5. Fix blanket RLS policies on raw tables
-- ============================================================================
-- The rename migration (20260303000005) created "Service role can manage
-- fathom_raw_*" policies with TO PUBLIC (all roles) + USING(true), granting
-- every authenticated user access to every row. Drop and recreate with
-- proper TO service_role restriction.

DROP POLICY IF EXISTS "Service role can manage fathom_raw_calls" ON fathom_raw_calls;
DROP POLICY IF EXISTS "Service role can manage fathom_raw_transcripts" ON fathom_raw_transcripts;

-- Recreate with proper role restriction (service_role only)
-- Note: fathom_raw_calls already has "Service role can manage fathom_calls"
-- scoped to service_role from the original table, so we only need to fix
-- fathom_raw_transcripts.
CREATE POLICY "Service role can manage fathom_raw_transcripts"
  ON fathom_raw_transcripts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
