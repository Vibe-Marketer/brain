-- Migration: Global search RPC across calls, participants, tags, and folders
-- Purpose: Implements global_search() for cross-entity search in the UI search bar.
--          Returns results grouped by entity type (call, participant, tag, folder)
--          with relevance scores for ranking within each group.
-- Closes: #110
-- Date: 2026-03-09

-- ============================================================================
-- FUNCTION: global_search
-- ============================================================================
-- Searches across calls (by title), participants (contacts), tags, and folders.
-- All results are scoped to recordings the user can access (owned or shared).
--
-- Parameters:
--   query_text            — Free-text search term (empty = filter-only mode)
--   filter_user_id        — Authenticated user ID (required)
--   filter_workspace_id   — Restrict to a single workspace (optional)
--   filter_date_start     — Lower bound on recording_start_time (optional)
--   filter_date_end       — Upper bound on recording_start_time (optional)
--   filter_source_apps    — Array of source apps: 'fathom','zoom','youtube','upload' (optional)
--   filter_tag_ids        — Only return calls that have at least one of these tags (optional)
--   filter_folder_ids     — Only return calls that are in at least one of these folders (optional)
--   match_count           — Max results per entity type for calls; others use match_count/4
--
-- NOTE (scalability): accessible_recording_ids is materialised into a PL/pgSQL array.
-- This is efficient for current data volumes. If per-user recording counts grow into
-- the tens of thousands, replace with a CTE or temp-table approach to allow Postgres
-- to use index-based joins instead of array containment scans.

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
  -- ILIKE-safe version of query_text: backslash, %, and _ are escaped
  -- so user input cannot manipulate LIKE pattern matching.
  query_escaped            TEXT;
BEGIN
  -- Validate required parameter
  IF filter_user_id IS NULL THEN
    RAISE EXCEPTION 'filter_user_id is required';
  END IF;

  has_query := query_text IS NOT NULL AND trim(query_text) != '';
  sub_limit := GREATEST(5, match_count / 4);

  -- Build ILIKE-safe escaped query (escape order matters: backslash first)
  IF has_query THEN
    query_escaped := replace(replace(replace(trim(query_text), E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  ELSE
    query_escaped := '';
  END IF;

  -- ============================================================================
  -- STEP 1: Determine accessible recording UUIDs
  -- ============================================================================
  IF filter_workspace_id IS NOT NULL THEN
    -- Workspace-scoped: user must be a member of the specified workspace
    IF NOT EXISTS (
      SELECT 1 FROM workspace_memberships
      WHERE workspace_id = filter_workspace_id AND user_id = filter_user_id
    ) THEN
      RETURN; -- Not a member → return empty
    END IF;

    SELECT ARRAY_AGG(DISTINCT we.recording_id)
    INTO accessible_recording_ids
    FROM workspace_entries we
    WHERE we.workspace_id = filter_workspace_id;
  ELSE
    -- Org-wide: all recordings the user owns OR can see via any workspace membership
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

  -- If user has no accessible recordings, nothing to search
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
        -- No query: rank by recency (newer = higher score, capped at 0.5)
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
    -- Date filters
    AND (filter_date_start IS NULL OR COALESCE(r.recording_start_time, r.created_at) >= filter_date_start)
    AND (filter_date_end   IS NULL OR COALESCE(r.recording_start_time, r.created_at) <= filter_date_end)
    -- Source app filter
    AND (filter_source_apps IS NULL OR r.source_app = ANY(filter_source_apps))
    -- Tag filter: when active, only include recordings with a matching tag.
    -- Recordings without legacy_recording_id cannot have tags → excluded when filter is active.
    AND (
      filter_tag_ids IS NULL
      OR (
        r.legacy_recording_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM call_tag_assignments cta
          WHERE cta.call_recording_id = r.legacy_recording_id
            AND cta.tag_id = ANY(filter_tag_ids)
        )
      )
    )
    -- Folder filter: when active, only include recordings with a matching folder assignment.
    -- Recordings without legacy_recording_id cannot be in folders → excluded when filter is active.
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
    -- Text filter: title must match query (or no query)
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
    -- Text filter (ILIKE metacharacters escaped)
    AND (
      NOT has_query
      OR c.name  ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR c.email ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(c.name, '') || ' ' || COALESCE(c.email, ''))
           @@ plainto_tsquery('english', query_text)
    )
    -- Only show participants who appear in at least one accessible recording
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
    -- User's own non-system tags only (system tags like SKIP are excluded from search results)
    ct.user_id = filter_user_id
    AND ct.is_system = false
    -- Text filter (ILIKE metacharacters escaped)
    AND (
      NOT has_query
      OR ct.name ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(ct.name, '') || ' ' || COALESCE(ct.description, ''))
           @@ plainto_tsquery('english', query_text)
    )
    -- Only show tags applied to at least one accessible recording
    AND EXISTS (
      SELECT 1
      FROM call_tag_assignments cta
      JOIN recordings r2 ON r2.legacy_recording_id = cta.call_recording_id
      WHERE cta.tag_id = ct.id
        AND r2.id = ANY(accessible_recording_ids)
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
    -- Workspace filter: if workspace specified, only show folders in that workspace
    AND (filter_workspace_id IS NULL OR f.workspace_id = filter_workspace_id)
    -- Text filter (ILIKE metacharacters escaped)
    AND (
      NOT has_query
      OR f.name ILIKE '%' || query_escaped || '%' ESCAPE E'\\'
      OR to_tsvector('english', COALESCE(f.name, ''))
           @@ plainto_tsquery('english', query_text)
    )
    -- Only show folders that contain at least one accessible recording
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

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT EXECUTE ON FUNCTION global_search(
  text, uuid, uuid, timestamptz, timestamptz, text[], uuid[], uuid[], int
) TO authenticated;

GRANT EXECUTE ON FUNCTION global_search(
  text, uuid, uuid, timestamptz, timestamptz, text[], uuid[], uuid[], int
) TO service_role;

-- ============================================================================
-- COMMENT
-- ============================================================================
COMMENT ON FUNCTION global_search IS
  'Cross-entity search across calls (by title), participants (contacts), tags, and folders.
   Returns entity_type, entity_id, title, subtitle, metadata, and relevance_score.
   Scoped to recordings the user owns or can see via workspace membership.
   Supports optional filters: workspace, date range, source app, tag IDs, folder IDs.
   ILIKE queries escape % and _ metacharacters to prevent pattern-manipulation.
   Implements issue #110: Global search across all entities.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
