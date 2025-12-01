-- ============================================================================
-- PHASE 1: RENAME CATEGORIES TO TAGS
-- ============================================================================
-- This migration renames the category system to tags for clarity.
-- Tags = What type of call it is (controls AI behavior)
-- Folders = Where to find it (pure organization) - added in Phase 2
-- ============================================================================

-- 1. Rename the main tables
ALTER TABLE call_categories RENAME TO call_tags;
ALTER TABLE call_category_assignments RENAME TO call_tag_assignments;
ALTER TABLE categorization_rules RENAME TO tag_rules;

-- 2. Rename the foreign key column in tag_rules (category_id -> tag_id)
ALTER TABLE tag_rules RENAME COLUMN category_id TO tag_id;

-- 3. Rename the foreign key column in tag_assignments (category_id -> tag_id)
ALTER TABLE call_tag_assignments RENAME COLUMN category_id TO tag_id;

-- 4. Update the check constraint in tag_assignments for max tags
DROP TRIGGER IF EXISTS enforce_max_categories ON call_tag_assignments;
DROP FUNCTION IF EXISTS check_max_categories();

CREATE OR REPLACE FUNCTION check_max_tags()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM call_tag_assignments
      WHERE call_recording_id = NEW.call_recording_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 tags per call';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_tags
  BEFORE INSERT ON call_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION check_max_tags();

-- 5. Rename the ensure_skip_category function to ensure_skip_tag
DROP TRIGGER IF EXISTS auto_categorize_skip_on_insert ON fathom_calls;
DROP TRIGGER IF EXISTS auto_categorize_skip_on_update ON fathom_calls;
DROP FUNCTION IF EXISTS ensure_skip_category();

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
    ON CONFLICT DO NOTHING;
  ELSE
    -- Remove from SKIP if transcript is now adequate
    DELETE FROM call_tag_assignments
    WHERE call_recording_id = NEW.recording_id
    AND tag_id = skip_tag_id
    AND auto_assigned = true;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_tag_skip_on_insert
AFTER INSERT ON fathom_calls
FOR EACH ROW
EXECUTE FUNCTION ensure_skip_tag();

CREATE TRIGGER auto_tag_skip_on_update
AFTER UPDATE ON fathom_calls
FOR EACH ROW
WHEN (OLD.full_transcript IS DISTINCT FROM NEW.full_transcript)
EXECUTE FUNCTION ensure_skip_tag();

-- 6. Rename apply_categorization_rules to apply_tag_rules
DROP FUNCTION IF EXISTS apply_categorization_rules(BIGINT, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION apply_tag_rules(
  p_recording_id BIGINT,
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  matched_rule_id UUID,
  matched_rule_name TEXT,
  tag_name TEXT,
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
  FOR v_rule IN
    SELECT r.*, ct.name as tag_name
    FROM tag_rules r
    JOIN call_tags ct ON r.tag_id = ct.id
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
      match_reason := v_match_reason;
      RETURN NEXT;

      IF NOT p_dry_run THEN
        INSERT INTO call_tag_assignments (call_recording_id, tag_id, user_id)
        VALUES (p_recording_id, v_rule.tag_id, p_user_id)
        ON CONFLICT DO NOTHING;

        UPDATE tag_rules
        SET times_applied = times_applied + 1, last_applied_at = NOW()
        WHERE id = v_rule.id;
      END IF;

      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- 7. Rename apply_rules_to_uncategorized to apply_tag_rules_to_untagged
DROP FUNCTION IF EXISTS apply_rules_to_uncategorized(UUID, BOOLEAN, INT);

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
      match_reason := v_match.match_reason;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

-- 8. Update the recurring_call_titles view
DROP VIEW IF EXISTS recurring_call_titles;

CREATE OR REPLACE VIEW recurring_call_titles AS
SELECT
  fc.user_id,
  fc.title,
  COUNT(*) as occurrence_count,
  MAX(fc.created_at) as last_occurrence,
  MIN(fc.created_at) as first_occurrence,
  ARRAY_AGG(DISTINCT ct.name) FILTER (WHERE ct.name IS NOT NULL) as current_tags
FROM fathom_calls fc
LEFT JOIN call_tag_assignments cta ON fc.recording_id = cta.call_recording_id
LEFT JOIN call_tags ct ON cta.tag_id = ct.id
GROUP BY fc.user_id, fc.title;

-- 9. Update RLS policies (drop old ones referencing categories)
DROP POLICY IF EXISTS "Users can manage their own categories" ON call_tags;
DROP POLICY IF EXISTS "Users can view system and own categories" ON call_tags;
DROP POLICY IF EXISTS "Users can manage own categories" ON call_tags;

-- Create new policies with correct names
CREATE POLICY "Users can view system and own tags"
  ON call_tags FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can manage own tags"
  ON call_tags FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 10. Update RLS for tag_rules (was categorization_rules)
DROP POLICY IF EXISTS "Users can manage own rules" ON tag_rules;

CREATE POLICY "Users can manage own tag rules"
  ON tag_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 11. Update index names for clarity
ALTER INDEX IF EXISTS idx_call_categories_user_id RENAME TO idx_call_tags_user_id;
ALTER INDEX IF EXISTS idx_categorization_rules_active RENAME TO idx_tag_rules_active;

-- 12. Update comments
COMMENT ON TABLE call_tags IS 'System-defined and user tags for classifying calls (controls AI behavior)';
COMMENT ON TABLE call_tag_assignments IS 'Many-to-many mapping between calls and tags (max 2 per call: primary + secondary)';
COMMENT ON TABLE tag_rules IS 'User-defined rules for automatically tagging calls';
COMMENT ON FUNCTION apply_tag_rules IS 'Apply tag rules to a single call';
COMMENT ON FUNCTION apply_tag_rules_to_untagged IS 'Apply tag rules to all untagged calls for a user';
COMMENT ON FUNCTION ensure_skip_tag IS 'Auto-tag calls with no/short transcripts to SKIP';

-- 13. Add is_primary column to tag_assignments for primary/secondary distinction
ALTER TABLE call_tag_assignments ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;

-- Update existing assignments to all be primary
UPDATE call_tag_assignments SET is_primary = true WHERE is_primary IS NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables renamed:
--   call_categories -> call_tags
--   call_category_assignments -> call_tag_assignments
--   categorization_rules -> tag_rules
--
-- Columns renamed:
--   category_id -> tag_id (in tag_rules and call_tag_assignments)
--
-- Functions renamed:
--   ensure_skip_category -> ensure_skip_tag
--   apply_categorization_rules -> apply_tag_rules
--   apply_rules_to_uncategorized -> apply_tag_rules_to_untagged
--
-- New column added:
--   call_tag_assignments.is_primary (for primary/secondary tag support)
-- ============================================================================
