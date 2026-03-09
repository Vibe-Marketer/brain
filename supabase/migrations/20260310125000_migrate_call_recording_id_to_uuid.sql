-- Migration: Migrate call_recording_id BIGINT → recording_id UUID
-- Purpose:
--   call_tag_assignments, call_speakers, and transcript_tag_assignments
--   all reference recordings via a legacy BIGINT (Fathom recording ID).
--   The canonical recordings table uses UUID primary keys, so this BIGINT column
--   blocks tag/speaker support for non-Fathom recordings and requires awkward
--   joins through recordings.legacy_recording_id.
--
--   This migration:
--   1. Adds recording_id UUID FK to recordings(id) on each affected table
--   2. Backfills via recordings.legacy_recording_id → recordings.id mapping
--   3. Deletes orphaned rows (no matching canonical recording)
--   4. Drops call_recording_id BIGINT and all its constraints/indexes
--   5. Adds new indexes and unique constraints on the UUID column
--   6. Updates all DB-side callers:
--      - check_max_tags trigger function
--      - ensure_skip_tag trigger function
--      - RLS policies on all three tables
--      - global_search RPC (removes legacy_recording_id join workaround)
-- Issue: #125
-- Date: 2026-03-10

-- ============================================================================
-- 1. CALL_TAG_ASSIGNMENTS — add UUID column, backfill, drop BIGINT
-- ============================================================================

-- 1a. Add nullable recording_id UUID (will be made NOT NULL after backfill)
ALTER TABLE call_tag_assignments
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE;

-- 1b. Backfill: resolve UUID from the recordings.legacy_recording_id mapping
UPDATE call_tag_assignments cta
SET recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = cta.call_recording_id
  AND cta.recording_id IS NULL;

-- 1c. Delete orphaned rows that have no matching canonical recording
--     (Fathom calls not yet migrated, or already cleaned up)
DELETE FROM call_tag_assignments
WHERE recording_id IS NULL;

-- 1d. Drop dependent triggers before we can modify the table / drop old column
DROP TRIGGER IF EXISTS enforce_max_tags ON call_tag_assignments;

-- 1e. Drop old unique constraint that included call_recording_id
--     (constraint name may vary — guard with DO block for safety)
DO $$
BEGIN
  -- Legacy constraint names from original and renamed migrations
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_tag_assignments_call_recording_id_tag_id_key' AND conrelid = 'public.call_tag_assignments'::regclass) THEN
    ALTER TABLE call_tag_assignments DROP CONSTRAINT call_tag_assignments_call_recording_id_tag_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_tag_assignments_unique' AND conrelid = 'public.call_tag_assignments'::regclass) THEN
    ALTER TABLE call_tag_assignments DROP CONSTRAINT call_tag_assignments_unique;
  END IF;
END $$;

-- 1f. Drop old index on the BIGINT column (before column drop)
DROP INDEX IF EXISTS idx_call_tag_assignments_recording_id;

-- 1g. Make recording_id NOT NULL now that all rows are backfilled
ALTER TABLE call_tag_assignments
  ALTER COLUMN recording_id SET NOT NULL;

-- 1h. Drop the old BIGINT column (also drops its FK constraints)
ALTER TABLE call_tag_assignments
  DROP COLUMN IF EXISTS call_recording_id;

-- 1i. Add index on the new UUID column
CREATE INDEX IF NOT EXISTS idx_call_tag_assignments_recording_id
  ON call_tag_assignments(recording_id);

-- 1j. Add unique constraint: one tag type per recording per user
--     (replaces the old BIGINT unique constraint)
ALTER TABLE call_tag_assignments
  ADD CONSTRAINT call_tag_assignments_recording_id_tag_id_key
  UNIQUE (recording_id, tag_id);

-- 1k. Recreate max-tags trigger with new column name
CREATE OR REPLACE FUNCTION check_max_tags()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM call_tag_assignments
      WHERE recording_id = NEW.recording_id) >= 2 THEN
    RAISE EXCEPTION 'Maximum of 2 tags per call';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_tags
  BEFORE INSERT ON call_tag_assignments
  FOR EACH ROW EXECUTE FUNCTION check_max_tags();

-- ============================================================================
-- 2. CALL_TAG_ASSIGNMENTS — update RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can manage own tag assignments" ON call_tag_assignments;
DROP POLICY IF EXISTS "Users can read own tag assignments" ON call_tag_assignments;
DROP POLICY IF EXISTS "Users can insert own tag assignments" ON call_tag_assignments;
DROP POLICY IF EXISTS "Users can delete own tag assignments" ON call_tag_assignments;
-- Legacy policies that joined via fathom_calls / fathom_raw_calls
DROP POLICY IF EXISTS "Users can view their own tag assignments" ON call_tag_assignments;
DROP POLICY IF EXISTS "Users can manage their own tag assignments" ON call_tag_assignments;

-- Read: user must be an org member of the recording's organization
CREATE POLICY "Users can read own tag assignments"
  ON call_tag_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.id = call_tag_assignments.recording_id
        AND is_organization_member(r.organization_id, auth.uid())
    )
  );

-- Write (all): user must own the recording
CREATE POLICY "Users can manage own tag assignments"
  ON call_tag_assignments FOR ALL
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
  );

-- ============================================================================
-- 3. CALL_SPEAKERS — add UUID column, backfill, drop BIGINT
-- ============================================================================

-- 3a. Add nullable recording_id UUID
ALTER TABLE call_speakers
  ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE;

-- 3b. Backfill from recordings.legacy_recording_id
UPDATE call_speakers cs
SET recording_id = r.id
FROM recordings r
WHERE r.legacy_recording_id = cs.call_recording_id
  AND cs.recording_id IS NULL;

-- 3c. Delete orphaned rows
DELETE FROM call_speakers
WHERE recording_id IS NULL;

-- 3d. Drop old unique constraint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_speakers_unique' AND conrelid = 'public.call_speakers'::regclass) THEN
    ALTER TABLE call_speakers DROP CONSTRAINT call_speakers_unique;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_speakers_call_recording_id_speaker_id_key' AND conrelid = 'public.call_speakers'::regclass) THEN
    ALTER TABLE call_speakers DROP CONSTRAINT call_speakers_call_recording_id_speaker_id_key;
  END IF;
END $$;

-- 3e. Drop old composite FK to fathom_calls
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'call_speakers_recording_user_fkey' AND conrelid = 'public.call_speakers'::regclass) THEN
    ALTER TABLE call_speakers DROP CONSTRAINT call_speakers_recording_user_fkey;
  END IF;
END $$;

-- 3f. Drop old index on BIGINT column
DROP INDEX IF EXISTS idx_call_speakers_recording_id;

-- 3g. Make recording_id NOT NULL
ALTER TABLE call_speakers
  ALTER COLUMN recording_id SET NOT NULL;

-- 3h. Drop old BIGINT column
ALTER TABLE call_speakers
  DROP COLUMN IF EXISTS call_recording_id;

-- 3i. Add index on UUID column
CREATE INDEX IF NOT EXISTS idx_call_speakers_recording_id
  ON call_speakers(recording_id);

-- 3j. Add unique constraint: one speaker per recording
ALTER TABLE call_speakers
  ADD CONSTRAINT call_speakers_recording_id_speaker_id_key
  UNIQUE (recording_id, speaker_id);

-- ============================================================================
-- 4. CALL_SPEAKERS — update RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own call speakers" ON call_speakers;
DROP POLICY IF EXISTS "Users can manage own call speakers" ON call_speakers;

CREATE POLICY "Users can read own call speakers"
  ON call_speakers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.id = call_speakers.recording_id
        AND is_organization_member(r.organization_id, auth.uid())
    )
  );

CREATE POLICY "Users can manage own call speakers"
  ON call_speakers FOR ALL
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
  );

-- ============================================================================
-- 5. TRANSCRIPT_TAG_ASSIGNMENTS — add UUID column, backfill, drop BIGINT (if exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_name = 'transcript_tag_assignments'
               AND table_schema = 'public') THEN

    -- 5a. Add nullable recording_id UUID
    ALTER TABLE transcript_tag_assignments
      ADD COLUMN IF NOT EXISTS recording_id UUID REFERENCES recordings(id) ON DELETE CASCADE;

    -- 5b. Backfill from recordings.legacy_recording_id
    UPDATE transcript_tag_assignments tta
    SET recording_id = r.id
    FROM recordings r
    WHERE r.legacy_recording_id = tta.call_recording_id
      AND tta.recording_id IS NULL;

    -- 5c. Delete orphaned rows
    DELETE FROM transcript_tag_assignments WHERE recording_id IS NULL;

    -- 5d. Drop old unique constraint if present
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transcript_tag_assignments_recording_user_fkey'
               AND conrelid = 'public.transcript_tag_assignments'::regclass) THEN
      ALTER TABLE transcript_tag_assignments DROP CONSTRAINT transcript_tag_assignments_recording_user_fkey;
    END IF;

    -- 5e. Make recording_id NOT NULL
    ALTER TABLE transcript_tag_assignments
      ALTER COLUMN recording_id SET NOT NULL;

    -- 5f. Drop old BIGINT column
    ALTER TABLE transcript_tag_assignments
      DROP COLUMN IF EXISTS call_recording_id;

    -- 5g. Add index on UUID column
    CREATE INDEX IF NOT EXISTS idx_transcript_tag_assignments_recording_id
      ON transcript_tag_assignments(recording_id);

  END IF;
END $$;

-- ============================================================================
-- 6. Update ensure_skip_tag — resolve UUID from fathom_raw_calls.recording_id
-- ============================================================================
-- This trigger fires on fathom_raw_calls INSERT/UPDATE. After the migration,
-- call_tag_assignments uses recording_id UUID, so we look up the canonical UUID.

CREATE OR REPLACE FUNCTION ensure_skip_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  skip_tag_id UUID;
  v_recording_uuid UUID;
BEGIN
  -- Resolve canonical recording UUID from the legacy BIGINT recording_id
  SELECT id INTO v_recording_uuid
  FROM recordings
  WHERE legacy_recording_id = NEW.recording_id;

  IF v_recording_uuid IS NULL THEN
    -- No canonical recording yet (not yet migrated) — skip
    RETURN NEW;
  END IF;

  -- Get SKIP tag (system tag)
  SELECT id INTO skip_tag_id
  FROM call_tags
  WHERE name = 'SKIP' AND is_system = true;

  IF skip_tag_id IS NULL THEN
    RETURN NEW;  -- No SKIP tag exists
  END IF;

  -- Auto-assign to SKIP if transcript is null or too short
  IF NEW.full_transcript IS NULL OR LENGTH(NEW.full_transcript) < 500 THEN
    INSERT INTO call_tag_assignments (recording_id, tag_id, user_id, auto_assigned)
    VALUES (v_recording_uuid, skip_tag_id, NEW.user_id, true)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Remove from SKIP if transcript is now adequate
    DELETE FROM call_tag_assignments
    WHERE recording_id = v_recording_uuid
      AND tag_id = skip_tag_id
      AND auto_assigned = true;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 7. Update apply_tag_rules — accept UUID, insert with UUID column
-- ============================================================================
-- Drop the old BIGINT signature first (required since signature changes).
DROP FUNCTION IF EXISTS apply_tag_rules(BIGINT, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION apply_tag_rules(
  p_recording_id UUID,
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
  -- Get call details from canonical recordings table
  SELECT
    r.id AS recording_id,
    r.title,
    r.created_at,
    EXTRACT(DOW FROM r.created_at) AS day_of_week,
    EXTRACT(HOUR FROM r.created_at) AS hour,
    LEFT(r.full_transcript, 1000) AS transcript_preview
  INTO v_call
  FROM recordings r
  WHERE r.id = p_recording_id
    AND r.owner_user_id = p_user_id;

  IF v_call IS NULL THEN
    RETURN;
  END IF;

  -- Check each active rule in priority order
  FOR v_rule IN
    SELECT r.*, ct.name AS tag_name
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
        INSERT INTO call_tag_assignments (recording_id, tag_id, user_id)
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

COMMENT ON FUNCTION apply_tag_rules(UUID, UUID, BOOLEAN) IS
  'Apply tag rules to a single recording (UUID). Replaces the legacy BIGINT version.';

-- ============================================================================
-- 8. Update apply_tag_rules_to_untagged — use UUID, query recordings table
-- ============================================================================

DROP FUNCTION IF EXISTS apply_tag_rules_to_untagged(UUID, BOOLEAN, INT);

CREATE OR REPLACE FUNCTION apply_tag_rules_to_untagged(
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT false,
  p_limit INT DEFAULT NULL
)
RETURNS TABLE (
  recording_id UUID,
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
    SELECT r.id AS recording_id, r.title
    FROM recordings r
    LEFT JOIN call_tag_assignments cta ON r.id = cta.recording_id
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
      match_reason := v_match.match_reason;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION apply_tag_rules_to_untagged(UUID, BOOLEAN, INT) IS
  'Apply tag rules to all untagged recordings for a user. Uses canonical recordings table.';

-- ============================================================================
-- 9. Update recurring_call_titles view to join via UUID
-- ============================================================================

DROP VIEW IF EXISTS recurring_call_titles;

CREATE OR REPLACE VIEW recurring_call_titles AS
SELECT
  r.owner_user_id AS user_id,
  r.title,
  COUNT(*) AS occurrence_count,
  MAX(r.created_at) AS last_occurrence,
  MIN(r.created_at) AS first_occurrence,
  ARRAY_AGG(DISTINCT ct.name) FILTER (WHERE ct.name IS NOT NULL) AS current_tags
FROM recordings r
LEFT JOIN call_tag_assignments cta ON r.id = cta.recording_id
LEFT JOIN call_tags ct ON cta.tag_id = ct.id
GROUP BY r.owner_user_id, r.title;

-- ============================================================================
-- 10. Update global_search — remove legacy_recording_id join workaround
-- ============================================================================
-- The old implementation skipped UUID recordings for tag/folder filters because
-- it joined via recordings.legacy_recording_id. Now we join directly on UUID.

DROP FUNCTION IF EXISTS global_search(
  text, uuid, uuid, timestamptz, timestamptz, text[], uuid[], uuid[], int
);

CREATE OR REPLACE FUNCTION global_search(
  query_text          TEXT,
  filter_user_id      UUID,
  filter_workspace_id UUID        DEFAULT NULL,
  filter_date_start   TIMESTAMPTZ DEFAULT NULL,
  filter_date_end     TIMESTAMPTZ DEFAULT NULL,
  filter_source_apps  TEXT[]      DEFAULT NULL,
  filter_tag_ids      UUID[]      DEFAULT NULL,
  filter_folder_ids   UUID[]      DEFAULT NULL,
  match_count         INT         DEFAULT 20
)
RETURNS TABLE (
  entity_type     TEXT,
  entity_id       TEXT,
  title           TEXT,
  subtitle        TEXT,
  metadata        JSONB,
  relevance_score FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accessible_recording_ids UUID[];
  sub_limit                INT;
  has_query                BOOLEAN;
  query_escaped            TEXT;
BEGIN
  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'filter_user_id is required';
  END IF;

  has_query := query_text IS NOT NULL AND trim(query_text) != '';
  sub_limit := GREATEST(5, match_count / 4);

  IF has_query THEN
    query_escaped := replace(replace(replace(trim(query_text), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  ELSE
    query_escaped := '';
  END IF;

  -- ============================================================================
  -- STEP 1: Determine accessible recording UUIDs
  -- ============================================================================
  IF filter_workspace_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = filter_workspace_id AND user_id = filter_user_id
    ) THEN
      RETURN;
    END IF;

    SELECT ARRAY_AGG(DISTINCT we.recording_id)
    INTO accessible_recording_ids
    FROM workspace_entries we
    WHERE we.workspace_id = filter_workspace_id;
  ELSE
    SELECT ARRAY_AGG(DISTINCT sub.rid)
    INTO accessible_recording_ids
    FROM (
      SELECT r.id AS rid
      FROM recordings r
      WHERE r.owner_user_id = filter_user_id
      UNION
      SELECT we.recording_id AS rid
      FROM workspace_entries we
      JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
      WHERE wm.user_id = filter_user_id
    ) sub;
  END IF;

  IF accessible_recording_ids IS NULL
     OR array_length(accessible_recording_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- ============================================================================
  -- STEP 2: CALLS — search recordings by title
  -- ============================================================================
  RETURN QUERY
  SELECT
    'call'::TEXT                              AS entity_type,
    r.id::TEXT                                AS entity_id,
    r.title                                   AS title,
    COALESCE(r.source_app, 'unknown')         AS subtitle,
    jsonb_build_object(
      'source_app',           r.source_app,
      'recording_start_time', r.recording_start_time,
      'created_at',           r.created_at,
      'duration',             r.duration,
      'legacy_recording_id',  r.legacy_recording_id,
      'workspace_id',         filter_workspace_id
    )                                         AS metadata,
    CASE
      WHEN NOT has_query THEN
        GREATEST(0.0, 0.5 - EXTRACT(EPOCH FROM (NOW() - COALESCE(r.recording_start_time, r.created_at))) / 86400.0 / 365.0)::FLOAT
      ELSE
        ts_rank(
          to_tsvector('english', COALESCE(r.title, '')),
          plainto_tsquery('english', query_text)
        )::FLOAT
    END                                       AS relevance_score
  FROM recordings r
  WHERE
    r.id = ANY(accessible_recording_ids)
    AND (filter_date_start IS NULL OR COALESCE(r.recording_start_time, r.created_at) >= filter_date_start)
    AND (filter_date_end   IS NULL OR COALESCE(r.recording_start_time, r.created_at) <= filter_date_end)
    AND (filter_source_apps IS NULL OR r.source_app = ANY(filter_source_apps))
    -- Tag filter: direct UUID join — works for all source platforms, not just Fathom
    AND (
      filter_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM call_tag_assignments cta
        WHERE cta.recording_id = r.id
          AND cta.tag_id = ANY(filter_tag_ids)
      )
    )
    -- Folder filter: still via legacy BIGINT (folder_assignments not yet migrated)
    AND (
      filter_folder_ids IS NULL
      OR (
        r.legacy_recording_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM folder_assignments fa
          WHERE fa.call_recording_id = r.legacy_recording_id
            AND fa.folder_id = ANY(filter_folder_ids)
        )
      )
    )
    AND (
      NOT has_query
      OR r.title ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(r.title, ''))
           @@ plainto_tsquery('english', query_text)
    )
  ORDER BY relevance_score DESC
  LIMIT match_count;

  -- ============================================================================
  -- STEP 3: PARTICIPANTS — search contacts by name/email
  -- ============================================================================
  RETURN QUERY
  SELECT
    'participant'::TEXT                           AS entity_type,
    c.id::TEXT                                    AS entity_id,
    COALESCE(c.name, c.email)                     AS title,
    c.email                                       AS subtitle,
    jsonb_build_object(
      'email',        c.email,
      'contact_type', c.contact_type,
      'last_seen_at', c.last_seen_at
    )                                             AS metadata,
    CASE
      WHEN NOT has_query THEN 0.4::FLOAT
      ELSE (
        ts_rank(
          to_tsvector('english',
            COALESCE(c.name, '') || ' ' || COALESCE(c.email, '')
          ),
          plainto_tsquery('english', query_text)
        )::FLOAT * 0.9
      )
    END                                           AS relevance_score
  FROM contacts c
  WHERE
    c.user_id = filter_user_id
    AND (
      NOT has_query
      OR c.name  ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR c.email ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(c.name, '') || ' ' || COALESCE(c.email, ''))
           @@ plainto_tsquery('english', query_text)
    )
    AND EXISTS (
      SELECT 1
      FROM contact_call_appearances cca
      JOIN recordings r2 ON r2.legacy_recording_id = cca.recording_id
      WHERE cca.contact_id = c.id
        AND r2.id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

  -- ============================================================================
  -- STEP 4: TAGS — search call_tags by name
  -- ============================================================================
  RETURN QUERY
  SELECT
    'tag'::TEXT                     AS entity_type,
    ct.id::TEXT                     AS entity_id,
    ct.name                         AS title,
    COALESCE(ct.description, 'Tag') AS subtitle,
    jsonb_build_object(
      'color',     ct.color,
      'icon',      ct.icon,
      'is_system', ct.is_system
    )                               AS metadata,
    CASE
      WHEN NOT has_query THEN 0.3::FLOAT
      ELSE (
        ts_rank(
          to_tsvector('english',
            COALESCE(ct.name, '') || ' ' || COALESCE(ct.description, '')
          ),
          plainto_tsquery('english', query_text)
        )::FLOAT * 0.7
      )
    END                             AS relevance_score
  FROM call_tags ct
  WHERE
    ct.user_id = filter_user_id
    AND ct.is_system = false
    AND (
      NOT has_query
      OR ct.name ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(ct.name, '') || ' ' || COALESCE(ct.description, ''))
           @@ plainto_tsquery('english', query_text)
    )
    -- Direct UUID join — no longer needs legacy_recording_id workaround
    AND EXISTS (
      SELECT 1
      FROM call_tag_assignments cta
      WHERE cta.tag_id = ct.id
        AND cta.recording_id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

  -- ============================================================================
  -- STEP 5: FOLDERS — search folders by name
  -- ============================================================================
  RETURN QUERY
  SELECT
    'folder'::TEXT                              AS entity_type,
    f.id::TEXT                                  AS entity_id,
    f.name                                      AS title,
    COALESCE(w.name, 'Folder')                  AS subtitle,
    jsonb_build_object(
      'workspace_id',    f.workspace_id,
      'organization_id', f.organization_id,
      'parent_id',       f.parent_id
    )                                           AS metadata,
    CASE
      WHEN NOT has_query THEN 0.3::FLOAT
      ELSE (
        ts_rank(
          to_tsvector('english', COALESCE(f.name, '')),
          plainto_tsquery('english', query_text)
        )::FLOAT * 0.6
      )
    END                                         AS relevance_score
  FROM folders f
  LEFT JOIN workspaces w ON w.id = f.workspace_id
  WHERE
    f.user_id = filter_user_id
    AND (f.is_archived IS NULL OR f.is_archived = FALSE)
    AND (filter_workspace_id IS NULL OR f.workspace_id = filter_workspace_id)
    AND (
      NOT has_query
      OR f.name ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(f.name, ''))
           @@ plainto_tsquery('english', query_text)
    )
    AND EXISTS (
      SELECT 1
      FROM folder_assignments fa
      JOIN recordings r2 ON r2.legacy_recording_id = fa.call_recording_id
      WHERE fa.folder_id = f.id
        AND r2.id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

END;
$$;

-- Re-grant access
GRANT EXECUTE ON FUNCTION global_search(
  text, uuid, uuid, timestamptz, timestamptz, text[], uuid[], uuid[], int
) TO authenticated;

GRANT EXECUTE ON FUNCTION global_search(
  text, uuid, uuid, timestamptz, timestamptz, text[], uuid[], uuid[], int
) TO service_role;

COMMENT ON FUNCTION global_search IS
  'Cross-entity search across calls (by title), participants (contacts), tags, and folders.
   Tags now joined directly via call_tag_assignments.recording_id (UUID), supporting all
   source platforms, not just Fathom. Implements issue #125 fix.';

-- ============================================================================
-- NOTIFY PostgREST to reload schema
-- ============================================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN call_tag_assignments.recording_id IS
  'UUID FK to recordings(id). Replaced legacy call_recording_id BIGINT (issue #125).';

COMMENT ON COLUMN call_speakers.recording_id IS
  'UUID FK to recordings(id). Replaced legacy call_recording_id BIGINT (issue #125).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
