-- Migration: Rename recordings.legacy_recording_id to fathom_provider_id
-- Purpose: Make the Fathom numeric provider key explicit while preserving the
--          existing UUID canonical recording model and BIGINT Fathom bridge.
-- Date: 2026-06-10

BEGIN;

ALTER TABLE public.recordings
  RENAME COLUMN legacy_recording_id TO fathom_provider_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'recordings_organization_id_legacy_recording_id_key'
      AND conrelid = 'public.recordings'::regclass
  ) THEN
    ALTER TABLE public.recordings
      RENAME CONSTRAINT recordings_organization_id_legacy_recording_id_key
      TO recordings_organization_id_fathom_provider_id_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_recordings_legacy_recording_id'
  ) THEN
    ALTER INDEX public.idx_recordings_legacy_recording_id
      RENAME TO idx_recordings_fathom_provider_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apply_tag_rules(p_recording_id bigint, p_user_id uuid, p_dry_run boolean DEFAULT false)
 RETURNS TABLE(matched_rule_id uuid, matched_rule_name text, tag_name text, folder_name text, match_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_call RECORD;
  v_rule RECORD;
  v_matched BOOLEAN;
  v_match_reason TEXT;
BEGIN
  SELECT
    r.fathom_provider_id AS recording_id,
    r.title,
    r.created_at,
    EXTRACT(DOW FROM r.created_at) AS day_of_week,
    EXTRACT(HOUR FROM r.created_at) AS hour,
    LEFT(r.full_transcript, 1000) AS transcript_preview
  INTO v_call
  FROM recordings r
  WHERE r.fathom_provider_id = p_recording_id
    AND r.owner_user_id = p_user_id;

  IF v_call IS NULL THEN
    RETURN;
  END IF;

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
$function$;

CREATE OR REPLACE FUNCTION public.apply_tag_rules_to_untagged(p_user_id uuid, p_dry_run boolean DEFAULT false, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(recording_id bigint, title text, matched_rule text, tag_name text, folder_name text, match_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_call RECORD;
  v_match RECORD;
BEGIN
  FOR v_call IN
    SELECT r.fathom_provider_id AS recording_id, r.title
    FROM recordings r
    LEFT JOIN call_tag_assignments cta ON r.fathom_provider_id = cta.call_recording_id
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
$function$;

CREATE OR REPLACE FUNCTION public.backfill_transcript_segments(p_batch_size integer DEFAULT 100)
 RETURNS TABLE(processed integer, segments_created integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  total_processed INTEGER := 0;
  total_segments INTEGER := 0;
  segments_for_recording INTEGER;
BEGIN
  FOR rec IN
    SELECT r.fathom_provider_id AS recording_id, r.full_transcript
    FROM recordings r
    WHERE r.full_transcript IS NOT NULL
      AND LENGTH(r.full_transcript) > 100
      AND r.fathom_provider_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM fathom_transcripts ft
        WHERE ft.recording_id = r.fathom_provider_id
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_recording(p_recording_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_user_id UUID;
  v_deleted_workspace_entries INT;
  v_deleted_folder_assignments INT;
  v_deleted_tag_assignments INT;
BEGIN
  SELECT owner_user_id INTO v_owner_user_id
  FROM recordings
  WHERE id = p_recording_id;

  IF v_owner_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Recording not found');
  END IF;

  IF v_owner_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Not authorized — you do not own this recording');
  END IF;

  DELETE FROM workspace_entries
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_workspace_entries = ROW_COUNT;

  DELETE FROM folder_assignments fa
  USING recordings r
  WHERE r.id = p_recording_id
    AND fa.call_recording_id = r.fathom_provider_id
    AND r.fathom_provider_id IS NOT NULL;
  GET DIAGNOSTICS v_deleted_folder_assignments = ROW_COUNT;

  DELETE FROM call_tag_assignments
  WHERE recording_id = p_recording_id;
  GET DIAGNOSTICS v_deleted_tag_assignments = ROW_COUNT;

  DELETE FROM recordings WHERE id = p_recording_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_recording_id', p_recording_id,
    'cleaned_up', jsonb_build_object(
      'workspace_entries', v_deleted_workspace_entries,
      'folder_assignments', v_deleted_folder_assignments,
      'tag_assignments', v_deleted_tag_assignments
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_skip_tag()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  skip_tag_id UUID;
  v_recording_uuid UUID;
BEGIN
  SELECT id INTO v_recording_uuid
  FROM recordings
  WHERE fathom_provider_id = NEW.recording_id;

  IF v_recording_uuid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO skip_tag_id
  FROM call_tags
  WHERE name = 'SKIP' AND is_system = true;

  IF skip_tag_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.full_transcript IS NULL OR LENGTH(NEW.full_transcript) < 500 THEN
    INSERT INTO call_tag_assignments (recording_id, tag_id, user_id, auto_assigned)
    VALUES (v_recording_uuid, skip_tag_id, NEW.user_id, true)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM call_tag_assignments
    WHERE recording_id = v_recording_uuid
      AND tag_id = skip_tag_id
      AND auto_assigned = true;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_calls_shared_with_me_v2(p_include_expired boolean DEFAULT false)
 RETURNS TABLE(recording_id bigint, call_name text, recording_start_time timestamp with time zone, duration text, owner_user_id uuid, source_type text, source_label text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT
    r.fathom_provider_id AS recording_id,
    r.title AS call_name,
    r.recording_start_time,
    NULL::TEXT AS duration,
    l.user_id AS owner_user_id,
    'share_link'::TEXT AS source_type,
    'Direct Link'::TEXT AS source_label
  FROM public.call_share_links l
  INNER JOIN public.recordings r
    ON r.fathom_provider_id = l.call_recording_id
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
$function$;

CREATE OR REPLACE FUNCTION public.get_migration_progress()
 RETURNS TABLE(total_fathom_calls bigint, migrated_recordings bigint, remaining bigint, percent_complete numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH stats AS (
    SELECT
      (SELECT COUNT(*) FROM fathom_calls) AS total,
      (SELECT COUNT(*) FROM recordings WHERE fathom_provider_id IS NOT NULL) AS migrated
  )
  SELECT
    total,
    migrated,
    total - migrated AS remaining,
    CASE WHEN total > 0
      THEN ROUND((migrated::NUMERIC / total::NUMERIC) * 100, 2)
      ELSE 100
    END AS percent_complete
  FROM stats;
$function$;

CREATE OR REPLACE FUNCTION public.get_unindexed_recording_ids(p_user_id uuid)
 RETURNS TABLE(recording_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT r.fathom_provider_id::TEXT AS recording_id
  FROM recordings r
  WHERE r.owner_user_id = p_user_id
    AND r.full_transcript IS NOT NULL
    AND r.fathom_provider_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM transcript_chunks tc
      WHERE tc.recording_id = r.fathom_provider_id
        AND tc.user_id = p_user_id
    );
END;
$function$;

DROP FUNCTION IF EXISTS public.get_workspace_recordings(
  uuid,
  integer,
  integer,
  text,
  timestamp with time zone,
  timestamp with time zone,
  text[]
);

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
    frc.ai_generated_title,
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
    AND (
      filter_tag_ids IS NULL
      OR (
        r.fathom_provider_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM call_tag_assignments cta
          WHERE cta.call_recording_id = r.fathom_provider_id
            AND cta.tag_id = ANY(filter_tag_ids)
        )
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
    AND EXISTS (
      SELECT 1
      FROM call_tag_assignments cta
      JOIN recordings r2 ON r2.fathom_provider_id = cta.call_recording_id
      WHERE cta.tag_id = ct.id
        AND r2.id = ANY(accessible_recording_ids)
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

CREATE OR REPLACE FUNCTION public.migrate_batch_fathom_calls(p_batch_size integer DEFAULT 100)
 RETURNS TABLE(migrated_count integer, error_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_migrated INTEGER := 0;
  v_errors INTEGER := 0;
  v_call RECORD;
BEGIN
  FOR v_call IN
    SELECT fc.recording_id, fc.user_id
    FROM fathom_calls fc
    WHERE NOT EXISTS (
      SELECT 1 FROM recordings r
      WHERE r.fathom_provider_id = fc.recording_id
    )
    LIMIT p_batch_size
  LOOP
    BEGIN
      PERFORM migrate_fathom_call_to_recording(v_call.recording_id, v_call.user_id);
      v_migrated := v_migrated + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE WARNING 'Migration failed for recording_id=%, user_id=%: %',
        v_call.recording_id, v_call.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT v_migrated, v_errors;
END;
$function$;

CREATE OR REPLACE FUNCTION public.migrate_fathom_call_to_recording(p_recording_id bigint, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_organization_id UUID;
  v_workspace_id UUID;
  v_new_recording_id UUID;
  v_call RECORD;
BEGIN
  SELECT b.id INTO v_organization_id
  FROM organizations b
  JOIN organization_memberships bm ON bm.organization_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  IF v_organization_id IS NULL THEN
    INSERT INTO organizations (name, type)
    VALUES ('Main', 'personal')
    RETURNING id INTO v_organization_id;

    INSERT INTO organization_memberships (organization_id, user_id, role)
    VALUES (v_organization_id, p_user_id, 'organization_owner');
  END IF;

  SELECT v.id INTO v_workspace_id
  FROM workspaces v
  JOIN workspace_memberships vm ON vm.workspace_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.organization_id = v_organization_id
    AND v.workspace_type = 'personal'
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO workspaces (organization_id, name, workspace_type)
    VALUES (v_organization_id, 'My Calls', 'personal')
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_memberships (workspace_id, user_id, role)
    VALUES (v_workspace_id, p_user_id, 'workspace_owner');
  END IF;

  SELECT id INTO v_new_recording_id
  FROM recordings
  WHERE fathom_provider_id = p_recording_id AND organization_id = v_organization_id;

  IF v_new_recording_id IS NOT NULL THEN
    RETURN v_new_recording_id;
  END IF;

  SELECT * INTO v_call
  FROM fathom_calls
  WHERE recording_id = p_recording_id AND user_id = p_user_id;

  IF v_call IS NULL THEN
    RAISE EXCEPTION 'Call not found: recording_id=%, user_id=%', p_recording_id, p_user_id;
  END IF;

  INSERT INTO recordings (
    fathom_provider_id, organization_id, owner_user_id, title, audio_url, video_url,
    full_transcript, summary, global_tags, source_app, source_metadata, duration,
    recording_start_time, recording_end_time, created_at, synced_at
  ) VALUES (
    v_call.recording_id, v_organization_id, p_user_id,
    COALESCE(NULLIF(TRIM(v_call.title), ''), 'Untitled Call'),
    v_call.url, v_call.share_url, v_call.full_transcript, v_call.summary,
    COALESCE(v_call.auto_tags, '{}'), COALESCE(v_call.source_platform, 'fathom'),
    jsonb_build_object(
      'external_id', v_call.recording_id::TEXT,
      'recorded_by_name', v_call.recorded_by_name,
      'recorded_by_email', v_call.recorded_by_email,
      'calendar_invitees', v_call.calendar_invitees,
      'meeting_fingerprint', v_call.meeting_fingerprint,
      'google_calendar_event_id', v_call.google_calendar_event_id,
      'google_drive_file_id', v_call.google_drive_file_id,
      'sentiment_cache', v_call.sentiment_cache,
      'original_metadata', v_call.metadata
    ),
    COALESCE(EXTRACT(EPOCH FROM (v_call.recording_end_time - v_call.recording_start_time))::INTEGER, 0),
    v_call.recording_start_time, v_call.recording_end_time, v_call.created_at, v_call.synced_at
  )
  RETURNING id INTO v_new_recording_id;

  INSERT INTO workspace_entries (workspace_id, recording_id, local_tags, created_at)
  VALUES (v_workspace_id, v_new_recording_id, '{}', v_call.created_at);

  RETURN v_new_recording_id;
END;
$function$;

COMMIT;
