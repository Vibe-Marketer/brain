-- Migration: Fix 6 DB functions still referencing legacy fathom_calls view
-- Issue #124
--
-- These functions queried the fathom_calls view, which maps to fathom_raw_calls.
-- This means tag rules, metadata discovery, shared-call lookup, and embedding
-- discovery only worked for Fathom recordings. Non-Fathom recordings (Zoom,
-- file uploads, YouTube, etc.) were silently excluded.
--
-- Fix: Rewrite functions 1–6 to query the recordings table using:
--   fathom_calls.recording_id  → recordings.legacy_recording_id
--   fathom_calls.user_id       → recordings.owner_user_id
--   fathom_calls.auto_tags     → recordings.global_tags
--
-- NOT changed: get_migration_progress, migrate_batch_fathom_calls,
-- migrate_fathom_call_to_recording — these specifically operate on legacy data.

-- Drop functions with changed signatures before recreating
DROP FUNCTION IF EXISTS apply_tag_rules(BIGINT, UUID, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS apply_tag_rules_to_untagged(UUID, BOOLEAN, INT) CASCADE;
DROP FUNCTION IF EXISTS public.get_available_metadata(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_calls_shared_with_me_v2(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_calls_shared_with_me() CASCADE;
DROP FUNCTION IF EXISTS public.get_unindexed_recording_ids(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.backfill_transcript_segments(INTEGER) CASCADE;

-- ============================================================================
-- 1. apply_tag_rules
-- Queries recording details to evaluate rule conditions.
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_tag_rules(
  p_recording_id BIGINT,
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  matched_rule_id UUID,
  matched_rule_name TEXT,
  tag_name TEXT,
  folder_name TEXT,
  match_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call RECORD;
  v_rule RECORD;
  v_matched BOOLEAN;
  v_match_reason TEXT;
BEGIN
  -- Get call details from recordings table
  SELECT
    r.legacy_recording_id AS recording_id,
    r.title,
    r.created_at,
    EXTRACT(DOW FROM r.created_at) AS day_of_week,
    EXTRACT(HOUR FROM r.created_at) AS hour,
    LEFT(r.full_transcript, 1000) AS transcript_preview
  INTO v_call
  FROM recordings r
  WHERE r.legacy_recording_id = p_recording_id
    AND r.owner_user_id = p_user_id;

  IF v_call IS NULL THEN
    RETURN;
  END IF;

  -- Check each active rule in priority order
  FOR v_rule IN
    SELECT tr.*,
           ct.name AS tag_name,
           f.name AS folder_name
    FROM tag_rules tr
    LEFT JOIN call_tags ct ON tr.tag_id = ct.id
    LEFT JOIN folders f ON tr.folder_id = f.id
    WHERE tr.user_id = p_user_id AND tr.is_active = true
    ORDER BY tr.priority ASC
  LOOP
    v_matched := false;
    v_match_reason := NULL;

    CASE v_rule.rule_type
      WHEN 'title_exact' THEN
        IF LOWER(v_call.title) = LOWER(v_rule.conditions->>'title') THEN
          v_matched := true;
          v_match_reason := 'Title exactly matches: ' || (v_rule.conditions->>'title');
        END IF;

      WHEN 'title_contains' THEN
        IF LOWER(v_call.title) LIKE '%' || LOWER(v_rule.conditions->>'contains') || '%' THEN
          v_matched := true;
          v_match_reason := 'Title contains: ' || (v_rule.conditions->>'contains');
        END IF;

      WHEN 'title_regex' THEN
        IF v_call.title ~ (v_rule.conditions->>'pattern') THEN
          v_matched := true;
          v_match_reason := 'Title matches pattern: ' || (v_rule.conditions->>'pattern');
        END IF;

      WHEN 'day_time' THEN
        IF v_call.day_of_week = (v_rule.conditions->>'day_of_week')::int
           AND v_call.hour = (v_rule.conditions->>'hour')::int THEN
          v_matched := true;
          v_match_reason := 'Day/time matches';
        END IF;

      WHEN 'transcript_keyword' THEN
        DECLARE
          v_keywords TEXT[];
          v_keyword TEXT;
        BEGIN
          v_keywords := ARRAY(SELECT jsonb_array_elements_text(v_rule.conditions->'keywords'));
          FOREACH v_keyword IN ARRAY v_keywords
          LOOP
            IF LOWER(v_call.transcript_preview) LIKE '%' || LOWER(v_keyword) || '%' THEN
              v_matched := true;
              v_match_reason := 'Transcript contains: ' || v_keyword;
              EXIT;
            END IF;
          END LOOP;
        END;

    END CASE;

    IF v_matched THEN
      matched_rule_id := v_rule.id;
      matched_rule_name := v_rule.name;
      tag_name := v_rule.tag_name;
      folder_name := v_rule.folder_name;
      match_reason := v_match_reason;
      RETURN NEXT;

      IF NOT p_dry_run THEN
        IF v_rule.tag_id IS NOT NULL THEN
          INSERT INTO call_tag_assignments (call_recording_id, tag_id, user_id)
          VALUES (p_recording_id, v_rule.tag_id, p_user_id)
          ON CONFLICT DO NOTHING;
        END IF;

        IF v_rule.folder_id IS NOT NULL THEN
          INSERT INTO folder_assignments (folder_id, call_recording_id, user_id)
          VALUES (v_rule.folder_id, p_recording_id, p_user_id)
          ON CONFLICT DO NOTHING;
        END IF;

        UPDATE tag_rules
        SET times_applied = times_applied + 1, last_applied_at = NOW()
        WHERE id = v_rule.id;
      END IF;

      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- 2. apply_tag_rules_to_untagged
-- Iterates all untagged recordings for a user and applies rules.
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_tag_rules_to_untagged(
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false,
  p_limit INT DEFAULT NULL
)
RETURNS TABLE (
  recording_id BIGINT,
  title TEXT,
  matched_rule TEXT,
  tag_name TEXT,
  folder_name TEXT,
  match_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call RECORD;
  v_match RECORD;
BEGIN
  FOR v_call IN
    SELECT r.legacy_recording_id AS recording_id, r.title
    FROM recordings r
    LEFT JOIN call_tag_assignments cta ON r.legacy_recording_id = cta.call_recording_id
    WHERE r.owner_user_id = p_user_id AND cta.tag_id IS NULL
    ORDER BY r.created_at DESC
    LIMIT p_limit
  LOOP
    FOR v_match IN
      SELECT * FROM apply_tag_rules(v_call.recording_id, p_user_id, p_dry_run)
    LOOP
      recording_id := v_call.recording_id;
      title := v_call.title;
      matched_rule := v_match.matched_rule_name;
      tag_name := v_match.tag_name;
      folder_name := v_match.folder_name;
      match_reason := v_match.match_reason;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

-- ============================================================================
-- 3. get_available_metadata — tags case
-- Was querying fathom_calls.auto_tags; now queries recordings.global_tags.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_available_metadata(
  p_user_id UUID,
  p_metadata_type TEXT
)
RETURNS TABLE (value TEXT, count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_metadata_type
    WHEN 'speakers' THEN
      RETURN QUERY
      SELECT
        s.name AS value,
        COUNT(DISTINCT cs.call_recording_id)::BIGINT AS count
      FROM speakers s
      JOIN call_speakers cs ON cs.speaker_id = s.id
      WHERE s.user_id = p_user_id
        AND s.name IS NOT NULL
        AND s.name != ''
      GROUP BY s.name
      ORDER BY count DESC, value ASC
      LIMIT 100;

    WHEN 'categories' THEN
      RETURN QUERY
      SELECT
        cc.name AS value,
        COUNT(DISTINCT cca.call_recording_id)::BIGINT AS count
      FROM call_categories cc
      LEFT JOIN call_category_assignments cca ON cca.category_id = cc.id
      WHERE cc.user_id = p_user_id
        AND cc.name IS NOT NULL
        AND cc.name != ''
      GROUP BY cc.name
      ORDER BY count DESC, value ASC
      LIMIT 100;

    WHEN 'tags' THEN
      -- Query recordings.global_tags instead of fathom_calls.auto_tags
      RETURN QUERY
      SELECT
        unnest(r.global_tags) AS value,
        1::BIGINT AS count
      FROM recordings r
      WHERE r.owner_user_id = p_user_id
        AND r.global_tags IS NOT NULL
        AND array_length(r.global_tags, 1) > 0
      GROUP BY value
      ORDER BY value ASC
      LIMIT 100;

    WHEN 'topics' THEN
      RETURN QUERY
      SELECT
        tt.tag_text AS value,
        COUNT(*)::BIGINT AS count
      FROM transcript_tags tt
      WHERE tt.user_id = p_user_id
        AND tt.tag_text IS NOT NULL
        AND tt.tag_text != ''
      GROUP BY tt.tag_text
      ORDER BY count DESC, value ASC
      LIMIT 100;

    ELSE
      RETURN;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_metadata(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 4. get_calls_shared_with_me_v2
-- Was joining fathom_calls; now joins recordings via legacy_recording_id.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me_v2(
  p_include_expired BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  recording_id BIGINT,
  call_name TEXT,
  recording_start_time TIMESTAMPTZ,
  duration TEXT,
  owner_user_id UUID,
  source_type TEXT,
  source_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT
    r.legacy_recording_id AS recording_id,
    r.title AS call_name,
    r.recording_start_time,
    NULL::TEXT AS duration,
    l.user_id AS owner_user_id,
    'share_link'::TEXT AS source_type,
    'Direct Link'::TEXT AS source_label
  FROM public.call_share_links l
  INNER JOIN public.recordings r
    ON r.legacy_recording_id = l.call_recording_id
   AND r.owner_user_id = l.user_id
  WHERE l.status = 'active'
    AND l.recipient_email IS NOT NULL
    AND lower(l.recipient_email) = lower((auth.jwt() ->> 'email'))
    AND (
      p_include_expired
      OR l.expires_at IS NULL
      OR l.expires_at > NOW()
    )
  ORDER BY r.recording_start_time DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me_v2(BOOLEAN) TO authenticated;

-- Keep legacy alias in sync
CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me()
RETURNS TABLE (
  recording_id BIGINT,
  call_name TEXT,
  recording_start_time TIMESTAMPTZ,
  duration TEXT,
  owner_user_id UUID,
  source_type TEXT,
  source_label TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.get_calls_shared_with_me_v2(FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.get_calls_shared_with_me() TO authenticated;

-- ============================================================================
-- 5. get_unindexed_recording_ids
-- Was querying fathom_calls; now queries recordings.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_unindexed_recording_ids(p_user_id UUID)
RETURNS TABLE(recording_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT r.legacy_recording_id::TEXT AS recording_id
  FROM recordings r
  WHERE r.owner_user_id = p_user_id
    AND r.full_transcript IS NOT NULL
    AND r.legacy_recording_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM transcript_chunks tc
      WHERE tc.recording_id = r.legacy_recording_id
        AND tc.user_id = p_user_id
    );
END;
$$;

-- ============================================================================
-- 6. backfill_transcript_segments
-- Was querying fathom_calls; now queries recordings.
-- legacy_recording_id is passed to parse_transcript_to_segments() which
-- expects the BIGINT recording_id used by fathom_transcripts.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.backfill_transcript_segments(p_batch_size INTEGER DEFAULT 100)
RETURNS TABLE(processed INTEGER, segments_created INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  total_processed INTEGER := 0;
  total_segments INTEGER := 0;
  segments_for_recording INTEGER;
BEGIN
  -- Find recordings that have full_transcript but no parsed segments
  FOR rec IN
    SELECT r.legacy_recording_id AS recording_id, r.full_transcript
    FROM recordings r
    WHERE r.full_transcript IS NOT NULL
      AND LENGTH(r.full_transcript) > 100
      AND r.legacy_recording_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM fathom_transcripts ft
        WHERE ft.recording_id = r.legacy_recording_id
          AND ft.is_deleted = false
      )
    LIMIT p_batch_size
  LOOP
    segments_for_recording := parse_transcript_to_segments(rec.recording_id, rec.full_transcript);

    IF segments_for_recording > 0 THEN
      total_segments := total_segments + segments_for_recording;
      total_processed := total_processed + 1;
      RAISE NOTICE 'Parsed recording % - created % segments', rec.recording_id, segments_for_recording;
    END IF;
  END LOOP;

  processed := total_processed;
  segments_created := total_segments;
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Functions NOT changed (intentional — they operate on legacy data):
--   get_migration_progress, migrate_batch_fathom_calls, migrate_fathom_call_to_recording
-- ============================================================================
