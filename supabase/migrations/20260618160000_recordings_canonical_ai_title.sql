-- Migration: Canonical AI title storage on recordings (cross-org-copy fix)
-- Ticket: ceeaaf33 — "AI title generation says 'None of the selected calls have
--          a Fathom recording ID'" for a Fathom call that was copied between orgs.
--
-- ROOT CAUSE
-- ----------
-- AI title generation is bound end-to-end to the Fathom BIGINT key:
--   1. Frontend filters selected calls to those whose recording_id is a positive
--      integer (fathom_provider_id). Cross-org copies have fathom_provider_id = NULL
--      (copy_recording_to_org never copies it), so recording_id is the UUID → rejected.
--   2. The generate-ai-titles edge function reads the transcript from, and writes the
--      title back to, fathom_raw_calls — keyed by the Fathom BIGINT recording_id. A
--      cross-org copy has no fathom_raw_calls row.
--   3. get_workspace_recordings surfaces ai_generated_title only via LEFT JOIN to
--      fathom_raw_calls on fathom_provider_id — always NULL for a copy.
--
-- A cross-org copy is a brand-new canonical UUID recording that DOES carry its
-- full_transcript/title/summary on the recordings row, but is intentionally
-- Fathom-orphaned (no fathom_provider_id / source_call_id, by design — see
-- copy_recording_to_org). So the only correct fix is to let AI titles live on the
-- canonical recordings row itself, keyed by UUID, independent of Fathom.
--
-- THIS MIGRATION (additive, forward-only)
-- ---------------------------------------
--   * Adds recordings.ai_generated_title + ai_title_generated_at (canonical store
--     for UUID-keyed recordings: cross-org copies, Zoom, manual, etc.).
--   * Updates get_workspace_recordings to surface the canonical title first, falling
--     back to the legacy fathom_raw_calls value so Fathom-sourced behaviour is
--     unchanged.
--
-- The companion edge-function + frontend changes add the UUID processing path that
-- writes recordings.ai_generated_title.

-- ============================================================================
-- 1. ADD CANONICAL AI-TITLE COLUMNS TO recordings
-- ============================================================================
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS ai_generated_title TEXT;

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS ai_title_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.recordings.ai_generated_title IS
  'AI-generated subtitle for this recording, keyed by the canonical UUID. '
  'Populated by generate-ai-titles for UUID-keyed recordings that have no Fathom '
  'numeric ID (cross-org copies, Zoom, manual uploads). Fathom-sourced recordings '
  'continue to store their AI title in fathom_raw_calls; get_workspace_recordings '
  'COALESCEs this column first, then the fathom_raw_calls value.';

COMMENT ON COLUMN public.recordings.ai_title_generated_at IS
  'Timestamp the canonical ai_generated_title was last written.';

-- ============================================================================
-- 2. SURFACE THE CANONICAL TITLE IN get_workspace_recordings
-- ============================================================================
-- Same signature and return shape as 20260610121000 — only the ai_generated_title
-- expression changes (COALESCE canonical column first, then legacy fathom_raw_calls).
-- CREATE OR REPLACE is safe because neither the argument list nor the OUT columns change.
CREATE OR REPLACE FUNCTION public.get_workspace_recordings(
  p_workspace_id uuid,
  p_limit integer,
  p_offset integer,
  p_search text DEFAULT NULL::text,
  p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_sources text[] DEFAULT NULL::text[]
)
 RETURNS TABLE(
  entry_id uuid,
  entry_folder_id uuid,
  id uuid,
  fathom_provider_id bigint,
  organization_id uuid,
  owner_user_id uuid,
  title text,
  summary text,
  global_tags text[],
  source_app text,
  source_metadata jsonb,
  duration integer,
  recording_start_time timestamp with time zone,
  recording_end_time timestamp with time zone,
  created_at timestamp with time zone,
  synced_at timestamp with time zone,
  ai_generated_title text,
  total_count bigint
 )
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    we.id              AS entry_id,
    we.folder_id       AS entry_folder_id,
    r.id,
    r.fathom_provider_id,
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
    COALESCE(r.ai_generated_title, frc.ai_generated_title) AS ai_generated_title,
    COUNT(*) OVER()    AS total_count
  FROM workspace_entries we
  INNER JOIN recordings r ON r.id = we.recording_id
  LEFT JOIN fathom_raw_calls frc
    ON frc.recording_id = r.fathom_provider_id
   AND frc.user_id      = r.owner_user_id
  WHERE we.workspace_id = p_workspace_id
    AND (p_search   IS NULL OR r.title   ILIKE '%' || p_search || '%'
                             OR r.summary ILIKE '%' || p_search || '%')
    AND (p_date_from IS NULL OR r.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR r.created_at <= p_date_to)
    AND (p_sources   IS NULL OR r.source_app = ANY(p_sources))
  ORDER BY COALESCE(r.recording_start_time, r.created_at) DESC NULLS LAST
  LIMIT  p_limit
  OFFSET p_offset;
$function$;

GRANT EXECUTE ON FUNCTION public.get_workspace_recordings(uuid, integer, integer, text, timestamptz, timestamptz, text[])
  TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
