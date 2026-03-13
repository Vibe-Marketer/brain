-- get_workspace_recordings: paginated workspace call list, sorted by recording date DESC.
--
-- Replaces the previous two-step client approach (workspace_entries ID fetch + .in() on recordings)
-- which broke for workspaces with >~200 recordings due to PostgREST URL length limits.
--
-- Also replaces the embedded-join approach (.order with referencedTable) which only sorted
-- nested rows within each parent row, not the parent workspace_entries rows themselves,
-- causing the oldest calls to always appear first.
--
-- Uses SECURITY INVOKER so RLS on workspace_entries and recordings applies normally.
-- The caller must be an authenticated user with valid workspace membership per RLS.
--
-- Parameters:
--   p_workspace_id  — workspace to query
--   p_limit         — page size
--   p_offset        — pagination offset
--   p_search        — optional ILIKE search across title + summary
--   p_date_from     — optional lower bound on recordings.created_at
--   p_date_to       — optional upper bound on recordings.created_at
--   p_sources       — optional array of source_app values to include

CREATE OR REPLACE FUNCTION get_workspace_recordings(
  p_workspace_id  uuid,
  p_limit         integer,
  p_offset        integer,
  p_search        text      DEFAULT NULL,
  p_date_from     timestamptz DEFAULT NULL,
  p_date_to       timestamptz DEFAULT NULL,
  p_sources       text[]    DEFAULT NULL
)
RETURNS TABLE (
  entry_id              uuid,
  entry_folder_id       uuid,
  id                    uuid,
  legacy_recording_id   bigint,
  organization_id       uuid,
  owner_user_id         uuid,
  title                 text,
  summary               text,
  global_tags           text[],
  source_app            text,
  source_metadata       jsonb,
  duration              integer,
  recording_start_time  timestamptz,
  recording_end_time    timestamptz,
  created_at            timestamptz,
  synced_at             timestamptz,
  total_count           bigint
)
LANGUAGE sql
-- SECURITY INVOKER (default): RLS on workspace_entries + recordings applies to caller
STABLE
AS $$
  SELECT
    we.id              AS entry_id,
    we.folder_id       AS entry_folder_id,
    r.id,
    r.legacy_recording_id,
    r.organization_id,
    r.owner_user_id,
    r.title,
    r.summary,
    r.global_tags,
    r.source_app,
    r.source_metadata,
    r.duration,
    r.recording_start_time,
    r.recording_end_time,
    r.created_at,
    r.synced_at,
    COUNT(*) OVER()    AS total_count
  FROM workspace_entries we
  INNER JOIN recordings r ON r.id = we.recording_id
  WHERE we.workspace_id = p_workspace_id
    AND (p_search   IS NULL OR r.title   ILIKE '%' || p_search || '%'
                             OR r.summary ILIKE '%' || p_search || '%')
    AND (p_date_from IS NULL OR r.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR r.created_at <= p_date_to)
    AND (p_sources   IS NULL OR r.source_app = ANY(p_sources))
  ORDER BY r.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- Grant execute to authenticated users (RLS still applies via SECURITY INVOKER)
GRANT EXECUTE ON FUNCTION get_workspace_recordings(uuid, integer, integer, text, timestamptz, timestamptz, text[])
  TO authenticated;
