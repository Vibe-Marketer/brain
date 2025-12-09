-- Migration: Extend tag_rules to support folder assignments
-- Purpose: Allow automation rules to assign both tags AND/OR folders to calls
-- Author: Claude Code
-- Date: 2025-12-09

-- ============================================================================
-- SCHEMA CHANGES: Add folder_id to tag_rules
-- ============================================================================

-- 1. Add folder_id column to existing tag_rules table (nullable FK to folders)
ALTER TABLE tag_rules
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 2. Make tag_id nullable (rules can now assign folder only, tag only, or both)
ALTER TABLE tag_rules
ALTER COLUMN tag_id DROP NOT NULL;

-- 3. Add constraint: at least one target must be set (tag_id OR folder_id)
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tag_rules_at_least_one_target'
  ) THEN
    ALTER TABLE tag_rules
    ADD CONSTRAINT tag_rules_at_least_one_target
    CHECK (tag_id IS NOT NULL OR folder_id IS NOT NULL);
  END IF;
END $$;

-- 4. Add index for folder_id lookups
CREATE INDEX IF NOT EXISTS idx_tag_rules_folder_id
  ON tag_rules(folder_id) WHERE folder_id IS NOT NULL;

-- ============================================================================
-- DROP EXISTING FUNCTIONS (required to change return signature)
-- ============================================================================
DROP FUNCTION IF EXISTS apply_tag_rules(BIGINT, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS apply_tag_rules_to_untagged(UUID, BOOLEAN, INT);

-- ============================================================================
-- UPDATE apply_tag_rules FUNCTION
-- ============================================================================
-- Now handles both tag assignments AND folder assignments

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
  -- Get call details
  SELECT
    fc.recording_id,
    fc.title,
    fc.created_at,
    EXTRACT(DOW FROM fc.created_at) as day_of_week,
    EXTRACT(HOUR FROM fc.created_at) as hour,
    LEFT(fc.full_transcript, 1000) as transcript_preview
  INTO v_call
  FROM fathom_calls fc
  WHERE fc.recording_id = p_recording_id AND fc.user_id = p_user_id;

  IF v_call IS NULL THEN
    RETURN;
  END IF;

  -- Check each active rule in priority order
  -- JOIN both tags AND folders (LEFT JOIN since both can be NULL)
  FOR v_rule IN
    SELECT r.*,
           ct.name as tag_name,
           f.name as folder_name
    FROM tag_rules r
    LEFT JOIN call_tags ct ON r.tag_id = ct.id
    LEFT JOIN folders f ON r.folder_id = f.id
    WHERE r.user_id = p_user_id AND r.is_active = true
    ORDER BY r.priority ASC
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
        -- Apply tag if tag_id is set
        IF v_rule.tag_id IS NOT NULL THEN
          INSERT INTO call_tag_assignments (call_recording_id, tag_id, user_id)
          VALUES (p_recording_id, v_rule.tag_id, p_user_id)
          ON CONFLICT DO NOTHING;
        END IF;

        -- Apply folder if folder_id is set
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
-- UPDATE apply_tag_rules_to_untagged FUNCTION
-- ============================================================================
-- Now returns folder information alongside tag information

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
    SELECT fc.recording_id, fc.title
    FROM fathom_calls fc
    LEFT JOIN call_tag_assignments cta ON fc.recording_id = cta.call_recording_id
    WHERE fc.user_id = p_user_id AND cta.tag_id IS NULL
    ORDER BY fc.created_at DESC
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
-- UPDATE COMMENTS
-- ============================================================================
COMMENT ON TABLE tag_rules IS 'User-defined automation rules for assigning tags and/or folders to calls';
COMMENT ON COLUMN tag_rules.folder_id IS 'Optional folder to assign when rule matches (can be set alongside or instead of tag_id)';
COMMENT ON FUNCTION apply_tag_rules IS 'Apply tag/folder rules to a single call - assigns both tags and folders based on matching rules';
COMMENT ON FUNCTION apply_tag_rules_to_untagged IS 'Apply tag/folder rules to all untagged calls for a user';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Changes made:
--   1. Added folder_id column to tag_rules (nullable FK to folders)
--   2. Made tag_id nullable (rules can now be folder-only)
--   3. Added CHECK constraint requiring at least one target (tag_id OR folder_id)
--   4. Updated apply_tag_rules() to also insert into folder_assignments
--   5. Updated apply_tag_rules_to_untagged() to return folder information
--
-- A single rule can now:
--   - Assign a tag only (folder_id = NULL)
--   - Assign a folder only (tag_id = NULL)
--   - Assign BOTH a tag and folder (both set)
-- ============================================================================
