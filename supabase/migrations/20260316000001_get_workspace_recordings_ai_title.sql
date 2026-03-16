-- Extend get_workspace_recordings to include ai_generated_title from fathom_raw_calls.
--
-- ai_generated_title is stored in fathom_raw_calls (Fathom-sourced calls only).
-- The RPC now LEFT JOINs fathom_raw_calls on (recording_id = legacy_recording_id
-- AND user_id = owner_user_id) so the UI can display it as the call subtitle
-- without overwriting recordings.title (the original call name).

-- DROP first: cannot change return type with CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_workspace_recordings(uuid, integer, integer, text, timestamptz, timestamptz, text[]);

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
  ai_generated_title    text,
  total_count           bigint
)
LANGUAGE sql
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
    frc.ai_generated_title,
    COUNT(*) OVER()    AS total_count
  FROM workspace_entries we
  INNER JOIN recordings r ON r.id = we.recording_id
  LEFT JOIN fathom_raw_calls frc
    ON frc.recording_id = r.legacy_recording_id
   AND frc.user_id      = r.owner_user_id
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

-- Re-grant execute (function was replaced, grants don't auto-carry)
GRANT EXECUTE ON FUNCTION get_workspace_recordings(uuid, integer, integer, text, timestamptz, timestamptz, text[])
  TO authenticated;
