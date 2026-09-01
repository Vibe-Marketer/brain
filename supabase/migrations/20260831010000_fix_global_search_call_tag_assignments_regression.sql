-- Migration: Fix global_search's call_tag_assignments references (regression)
-- Purpose: global_search() throws "column cta.call_recording_id does not exist"
--          (SQLSTATE 42703) on EVERY invocation today -- discovered while writing
--          Phase 30 Plan 03's EVT-03 byte-identical regression test, which is the
--          first automated test to actually call this RPC end-to-end.
--
-- ROOT CAUSE (traced via direct migration-file evidence, same rigor as
-- supabase/SCHEMA_TRUTH.md's F16 investigation)
-- ------------------------------------------------------------------------
-- 1. call_tag_assignments.call_recording_id (legacy BIGINT) was migrated to
--    call_tag_assignments.recording_id (canonical UUID) by
--    20260310125000_migrate_call_recording_id_to_uuid.sql (2026-03-10).
-- 2. That SAME migration correctly updated global_search()'s two
--    call_tag_assignments references to the new UUID join (comments in that
--    file: "Tag filter: direct UUID join — works for all source platforms,
--    not just Fathom" and "Direct UUID join — no longer needs
--    legacy_recording_id workaround").
-- 3. 20260610121000_rename_legacy_recording_id_to_fathom_provider_id.sql
--    (2026-06-10) redefined global_search() again, for the UNRELATED
--    recordings.legacy_recording_id -> recordings.fathom_provider_id rename.
--    Its author appears to have worked from a stale copy of the function body
--    (predating the 2026-03-10 fix) and, while correctly applying the
--    fathom_provider_id rename, accidentally REVERTED both
--    call_tag_assignments.recording_id references back to the nonexistent
--    call_tag_assignments.call_recording_id -- a silent regression, not a new
--    mistake. No migration since 2026-06-10 has touched global_search()
--    (confirmed by scanning every migration filename after that timestamp).
--
-- Confirmed live (src/types/supabase.ts, regenerated from prod this phase,
-- Plan 01): call_tag_assignments has `recording_id: string` (UUID FK to
-- recordings.id); it has NO call_recording_id column. folder_assignments is
-- untouched by this migration -- it still legitimately has call_recording_id
-- (BIGINT, FK to fathom_calls) and was deliberately NOT part of the 2026-03-10
-- UUID migration (that migration's own comment: "Folder filter: still via
-- legacy BIGINT (folder_assignments not yet migrated)").
--
-- THIS MIGRATION
-- --------------
-- Re-applies the exact 2026-03-10 fix on top of the current (2026-06-10)
-- function body: restores the direct call_tag_assignments.recording_id UUID
-- join in both the calls-step tag filter and the standalone tags-search step.
-- Everything else (fathom_provider_id metadata/participants/folder-filter
-- references, function signature, RETURNS TABLE shape) is byte-identical to
-- the live 2026-06-10 definition -- this is a pure correctness restoration,
-- not a behavior or shape change. Output signature unchanged (still
-- entity_type/entity_id/title/subtitle/metadata/relevance_score), so it does
-- not affect EVT-03's byte-identical proof for the OTHER three read paths.
--
-- Scope note: discovered and fixed during Phase 30 Plan 03 (schema
-- reconciliation / event model foundation), but is entirely unrelated to that
-- phase's events/recordings/call_participants additive schema work -- this is
-- a pre-existing, independent bug in a function Phase 30's own migration
-- never touches. Applied to TEST during Plan 03's verification session;
-- applied to PRODUCTION on 2026-08-31 as part of Plan 30-04's guarded apply,
-- with Andrew's explicit authorization (see 30-03-SUMMARY.md and
-- 30-04-SUMMARY.md for the full record).
-- Author: Claude (GSD Phase 30 Plan 03 executor)
-- Date: 2026-08-31
-- Amended: 2026-09-01 (code review WR-02 — corrected stale deployment-status comment)

CREATE OR REPLACE FUNCTION public.global_search(
  query_text text,
  filter_user_id uuid,
  filter_workspace_id uuid DEFAULT NULL::uuid,
  filter_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  filter_source_apps text[] DEFAULT NULL::text[],
  filter_tag_ids uuid[] DEFAULT NULL::uuid[],
  filter_folder_ids uuid[] DEFAULT NULL::uuid[],
  match_count integer DEFAULT 20
)
 RETURNS TABLE(entity_type text, entity_id text, title text, subtitle text, metadata jsonb, relevance_score double precision)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      'fathom_provider_id',   r.fathom_provider_id,
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
    -- Tag filter: direct UUID join — works for all source platforms, not just
    -- Fathom (restores the 2026-03-10 fix; call_tag_assignments has no
    -- call_recording_id column to gate on r.fathom_provider_id anymore).
    AND (
      filter_tag_ids IS NULL
      OR EXISTS (
        SELECT 1 FROM call_tag_assignments cta
        WHERE cta.recording_id = r.id
          AND cta.tag_id = ANY(filter_tag_ids)
      )
    )
    AND (
      filter_folder_ids IS NULL
      OR (
        r.fathom_provider_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM folder_assignments fa
          WHERE fa.call_recording_id = r.fathom_provider_id
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
      JOIN recordings r2 ON r2.fathom_provider_id = cca.recording_id
      WHERE cca.contact_id = c.id
        AND r2.id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

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
    -- Direct UUID join — no longer needs a recordings join at all (restores
    -- the 2026-03-10 fix).
    AND EXISTS (
      SELECT 1
      FROM call_tag_assignments cta
      WHERE cta.tag_id = ct.id
        AND cta.recording_id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

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
      JOIN recordings r2 ON r2.fathom_provider_id = fa.call_recording_id
      WHERE fa.folder_id = f.id
        AND r2.id = ANY(accessible_recording_ids)
    )
  ORDER BY relevance_score DESC
  LIMIT sub_limit;

END;
$function$;

COMMENT ON FUNCTION public.global_search IS
  'Cross-entity search across calls (by title), participants (contacts), tags, and folders.
   Returns entity_type, entity_id, title, subtitle, metadata, and relevance_score.
   Scoped to recordings the user owns or can see via workspace membership.
   Tag filter/search uses call_tag_assignments.recording_id (UUID) directly --
   restored 2026-08-31 after a 2026-06-10 migration accidentally reverted the
   2026-03-10 UUID-join fix back to the nonexistent call_recording_id column
   (see this migration''s header for the full trace). Folder filter/search
   still uses the legacy BIGINT call_recording_id on folder_assignments,
   which has not been migrated to UUID.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
