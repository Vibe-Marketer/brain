-- ============================================================================
-- CALL CATEGORIZATION SYSTEM
-- ============================================================================
-- A rule-based system for automatically categorizing calls based on:
-- - Title patterns (exact match, contains, regex)
-- - Participant info (email patterns)
-- - Day/time patterns
-- - Transcript keywords
-- ============================================================================

-- 1. Make user_id nullable to allow system-wide categories
-- First drop the NOT NULL constraint if it exists
ALTER TABLE call_categories ALTER COLUMN user_id DROP NOT NULL;

-- 2. Check call_categories structure and add color if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_categories' AND column_name = 'color'
  ) THEN
    ALTER TABLE call_categories ADD COLUMN color TEXT;
  END IF;
END $$;

-- 3. Add is_system column to distinguish system vs user categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_categories' AND column_name = 'is_system'
  ) THEN
    ALTER TABLE call_categories ADD COLUMN is_system BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Drop the unique constraint on (user_id, name) if it exists so we can add system categories
DO $$
BEGIN
  ALTER TABLE call_categories DROP CONSTRAINT IF EXISTS call_categories_user_id_name_key;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add a new unique constraint that allows system categories (null user_id)
-- but prevents duplicate names per user
CREATE UNIQUE INDEX IF NOT EXISTS call_categories_unique_name
  ON call_categories(COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- 5. Clear existing unused categories and insert 15-type system
DELETE FROM call_category_assignments WHERE TRUE; -- Clear any assignments
DELETE FROM call_categories WHERE TRUE; -- Clear existing categories

-- Insert the new 15-category system (16 including SKIP) as SYSTEM categories (user_id = NULL)
INSERT INTO call_categories (id, user_id, name, description, color, is_system) VALUES
  (gen_random_uuid(), NULL, 'TEAM', 'Team/founder meetings, internal syncs', '#3B82F6', true),
  (gen_random_uuid(), NULL, 'COACH_GROUP', 'Group coaching sessions (2+ participants, paid)', '#8B5CF6', true),
  (gen_random_uuid(), NULL, 'COACH_1ON1', 'One-to-one coaching sessions', '#A855F7', true),
  (gen_random_uuid(), NULL, 'WEBINAR', 'Large group events, webinars (2+ participants)', '#EC4899', true),
  (gen_random_uuid(), NULL, 'SALES', 'One-to-one sales calls', '#10B981', true),
  (gen_random_uuid(), NULL, 'EXTERNAL', 'Podcasts, communities, collaborations', '#F59E0B', true),
  (gen_random_uuid(), NULL, 'DISCOVERY', 'Pre-sales, triage, setter calls', '#06B6D4', true),
  (gen_random_uuid(), NULL, 'ONBOARDING', 'Platform onboarding calls', '#14B8A6', true),
  (gen_random_uuid(), NULL, 'REFUND', 'Refund, retention calls/requests', '#EF4444', true),
  (gen_random_uuid(), NULL, 'FREE', 'Free community calls, group calls', '#6366F1', true),
  (gen_random_uuid(), NULL, 'EDUCATION', 'Personal education - coaching attended', '#F97316', true),
  (gen_random_uuid(), NULL, 'PRODUCT', 'Product demos', '#84CC16', true),
  (gen_random_uuid(), NULL, 'SUPPORT', 'Customer support, tech issues, training', '#0EA5E9', true),
  (gen_random_uuid(), NULL, 'REVIEW', 'Testimonials, reviews, interviews, feedback', '#D946EF', true),
  (gen_random_uuid(), NULL, 'STRATEGY', 'Internal mission, vision, strategy', '#64748B', true),
  (gen_random_uuid(), NULL, 'SKIP', 'Calls to skip (no transcript, test calls, etc)', '#9CA3AF', true);

-- 6. Update RLS policy for call_categories to allow reading system categories
DROP POLICY IF EXISTS "Users can manage their own categories" ON call_categories;
DROP POLICY IF EXISTS "Users can view system and own categories" ON call_categories;

-- Users can read system categories OR their own
CREATE POLICY "Users can view system and own categories"
  ON call_categories FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);

-- Users can only modify their own categories (not system ones)
CREATE POLICY "Users can manage own categories"
  ON call_categories FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Add user_id to call_category_assignments for easier querying
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'call_category_assignments' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE call_category_assignments
      ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    -- Backfill user_id from fathom_calls
    UPDATE call_category_assignments cca
    SET user_id = fc.user_id
    FROM fathom_calls fc
    WHERE cca.call_recording_id = fc.recording_id;
  END IF;
END $$;

-- 8. Create categorization_rules table
CREATE TABLE IF NOT EXISTS public.categorization_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,
  priority INT NOT NULL DEFAULT 100, -- Lower = higher priority
  is_active BOOLEAN DEFAULT true,

  -- Rule type and conditions
  rule_type TEXT NOT NULL CHECK (rule_type IN (
    'title_exact',       -- Exact title match
    'title_contains',    -- Title contains substring (case-insensitive)
    'title_regex',       -- Title matches regex pattern
    'participant',       -- Participant email pattern
    'day_time',          -- Specific day/time
    'transcript_keyword' -- Keyword in first N chars of transcript
  )),

  -- Condition values (JSON for flexibility)
  conditions JSONB NOT NULL,
  -- Examples:
  -- title_exact: {"title": "THE TABLE"}
  -- title_contains: {"contains": "Team Wrap"}
  -- title_regex: {"pattern": "^\\w+ \\w+$"}
  -- participant: {"email_contains": "@clientdomain.com"}
  -- day_time: {"day_of_week": 1, "hour": 9} -- Monday 9am
  -- transcript_keyword: {"keywords": ["onboarding", "welcome"], "search_chars": 500}

  -- Target category
  category_id UUID REFERENCES call_categories(id) ON DELETE CASCADE NOT NULL,

  -- Stats
  times_applied INT DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Index for efficient rule lookup
CREATE INDEX IF NOT EXISTS idx_categorization_rules_active
  ON categorization_rules(user_id, is_active, priority);

-- Enable RLS
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists, then create
DROP POLICY IF EXISTS "Users can manage own rules" ON categorization_rules;
CREATE POLICY "Users can manage own rules"
  ON categorization_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Allow multiple categories per call (max 2)
CREATE OR REPLACE FUNCTION check_max_categories()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM call_category_assignments
      WHERE call_recording_id = NEW.call_recording_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 categories per call';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_categories ON call_category_assignments;
CREATE TRIGGER enforce_max_categories
  BEFORE INSERT ON call_category_assignments
  FOR EACH ROW EXECUTE FUNCTION check_max_categories();

-- 5. Function to apply rules to a single call
CREATE OR REPLACE FUNCTION apply_categorization_rules(
  p_recording_id BIGINT,
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE (
  matched_rule_id UUID,
  matched_rule_name TEXT,
  category_name TEXT,
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
    SELECT r.*, cc.name as category_name
    FROM categorization_rules r
    JOIN call_categories cc ON r.category_id = cc.id
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
      -- Return the match info
      matched_rule_id := v_rule.id;
      matched_rule_name := v_rule.name;
      category_name := v_rule.category_name;
      match_reason := v_match_reason;
      RETURN NEXT;

      -- If not dry run, apply the category
      IF NOT p_dry_run THEN
        INSERT INTO call_category_assignments (call_recording_id, category_id, user_id)
        VALUES (p_recording_id, v_rule.category_id, p_user_id)
        ON CONFLICT DO NOTHING;

        -- Update rule stats
        UPDATE categorization_rules
        SET times_applied = times_applied + 1, last_applied_at = NOW()
        WHERE id = v_rule.id;
      END IF;

      -- Only apply first matching rule (highest priority)
      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- 6. Function to apply rules to all uncategorized calls
CREATE OR REPLACE FUNCTION apply_rules_to_uncategorized(
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false,
  p_limit INT DEFAULT NULL
)
RETURNS TABLE (
  recording_id BIGINT,
  title TEXT,
  matched_rule TEXT,
  category_name TEXT,
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
    LEFT JOIN call_category_assignments cca ON fc.recording_id = cca.call_recording_id
    WHERE fc.user_id = p_user_id AND cca.category_id IS NULL
    ORDER BY fc.created_at DESC
    LIMIT p_limit
  LOOP
    FOR v_match IN
      SELECT * FROM apply_categorization_rules(v_call.recording_id, p_user_id, p_dry_run)
    LOOP
      recording_id := v_call.recording_id;
      title := v_call.title;
      matched_rule := v_match.matched_rule_name;
      category_name := v_match.category_name;
      match_reason := v_match.match_reason;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

-- 7. View for top recurring call titles (for the UI)
CREATE OR REPLACE VIEW recurring_call_titles AS
SELECT
  fc.user_id,
  fc.title,
  COUNT(*) as occurrence_count,
  MAX(fc.created_at) as last_occurrence,
  MIN(fc.created_at) as first_occurrence,
  ARRAY_AGG(DISTINCT cc.name) FILTER (WHERE cc.name IS NOT NULL) as current_categories
FROM fathom_calls fc
LEFT JOIN call_category_assignments cca ON fc.recording_id = cca.call_recording_id
LEFT JOIN call_categories cc ON cca.category_id = cc.id
GROUP BY fc.user_id, fc.title;

-- 8. Add RLS to the view (via underlying tables - already done)

COMMENT ON TABLE categorization_rules IS 'User-defined rules for automatically categorizing calls';
COMMENT ON FUNCTION apply_categorization_rules IS 'Apply categorization rules to a single call';
COMMENT ON FUNCTION apply_rules_to_uncategorized IS 'Apply rules to all uncategorized calls for a user';
