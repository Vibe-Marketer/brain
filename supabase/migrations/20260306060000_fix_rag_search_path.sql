-- Fix RAG search functions: Include extensions schema for vector operators
-- The hybrid_search_transcripts_scoped function was failing with:
-- "operator does not exist: extensions.vector <=> extensions.vector"
-- because search_path was set to only 'public' but pgvector operators are in 'extensions'

-- Drop the old function first (must match exact signature)
DROP FUNCTION IF EXISTS public.hybrid_search_transcripts_scoped(text, vector, integer, double precision, double precision, integer, uuid, uuid, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[]) CASCADE;

-- Recreate with corrected search_path that includes extensions
CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts_scoped(
    query_text text, 
    query_embedding vector, 
    match_count integer, 
    full_text_weight double precision DEFAULT 1.0, 
    semantic_weight double precision DEFAULT 1.0, 
    rrf_k integer DEFAULT 60, 
    filter_user_id uuid DEFAULT NULL::uuid, 
    filter_organization_id uuid DEFAULT NULL::uuid, 
    filter_workspace_id uuid DEFAULT NULL::uuid, 
    filter_date_start timestamp with time zone DEFAULT NULL::timestamp with time zone, 
    filter_date_end timestamp with time zone DEFAULT NULL::timestamp with time zone, 
    filter_speakers text[] DEFAULT NULL::text[], 
    filter_categories text[] DEFAULT NULL::text[], 
    filter_recording_ids bigint[] DEFAULT NULL::bigint[], 
    filter_topics text[] DEFAULT NULL::text[], 
    filter_sentiment text DEFAULT NULL::text, 
    filter_intent_signals text[] DEFAULT NULL::text[], 
    filter_user_tags text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
    chunk_id uuid, 
    recording_id bigint, 
    chunk_text text, 
    chunk_index integer, 
    speaker_name text, 
    speaker_email text, 
    call_date timestamp with time zone, 
    call_title text, 
    call_category text, 
    topics text[], 
    sentiment text, 
    intent_signals text[], 
    user_tags text[], 
    entities jsonb, 
    source_platform text, 
    similarity_score double precision, 
    fts_rank double precision, 
    rrf_score double precision, 
    workspace_id uuid, 
    workspace_name text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  accessible_workspace_ids UUID[];
  scoped_recording_ids BIGINT[];
BEGIN
  -- Determine which workspaces the user can access
  IF filter_workspace_id IS NOT NULL THEN
    -- Specific vault requested - verify user has membership
    IF NOT EXISTS (
      SELECT 1 FROM workspace_memberships 
      WHERE user_id = filter_user_id 
      AND workspace_memberships.workspace_id = filter_workspace_id
    ) THEN
      -- User doesn't have access to this vault - return empty
      RETURN;
    END IF;
    accessible_workspace_ids := ARRAY[filter_workspace_id];
  ELSIF filter_organization_id IS NOT NULL THEN
    -- Bank-level search - get all workspaces user has membership in within this bank
    SELECT ARRAY_AGG(vm.workspace_id) INTO accessible_workspace_ids
    FROM workspace_memberships vm
    JOIN workspaces v ON v.id = vm.workspace_id
    WHERE vm.user_id = filter_user_id
    AND v.organization_id = filter_organization_id;
    
    -- If user has no vault memberships in this bank, return empty
    IF accessible_workspace_ids IS NULL OR array_length(accessible_workspace_ids, 1) IS NULL THEN
      RETURN;
    END IF;
  ELSE
    -- No bank/vault specified - fall back to unscoped search (pre-migration compatibility)
    -- Call hybrid_search_transcripts directly and return with NULL vault info
    RETURN QUERY
    SELECT 
      hs.chunk_id,
      hs.recording_id,
      hs.chunk_text,
      hs.chunk_index,
      hs.speaker_name,
      hs.speaker_email,
      hs.call_date,
      hs.call_title,
      hs.call_category,
      hs.topics,
      hs.sentiment,
      hs.intent_signals,
      hs.user_tags,
      hs.entities,
      hs.source_platform,
      hs.similarity_score,
      hs.fts_rank,
      hs.rrf_score,
      NULL::UUID AS workspace_id,
      NULL::TEXT AS workspace_name
    FROM hybrid_search_transcripts(
      query_text,
      query_embedding,
      match_count,
      full_text_weight::DOUBLE PRECISION,
      semantic_weight::DOUBLE PRECISION,
      rrf_k,
      filter_user_id,
      filter_date_start,
      filter_date_end,
      filter_speakers,
      filter_categories,
      filter_recording_ids,
      filter_topics,
      filter_sentiment,
      filter_intent_signals,
      filter_user_tags
    ) hs;
    RETURN;
  END IF;

  -- Get recording_ids that are in accessible workspaces via workspace_entries
  -- Bridge through legacy_recording_id since transcripts haven't been migrated yet
  SELECT ARRAY_AGG(DISTINCT r.legacy_recording_id)
  INTO scoped_recording_ids
  FROM workspace_entries ve
  JOIN recordings r ON r.id = ve.recording_id
  WHERE ve.workspace_id = ANY(accessible_workspace_ids)
  AND r.legacy_recording_id IS NOT NULL;

  -- If no recordings in accessible workspaces, return empty
  IF scoped_recording_ids IS NULL OR array_length(scoped_recording_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Intersect with user-provided recording_ids filter if present
  IF filter_recording_ids IS NOT NULL AND array_length(filter_recording_ids, 1) IS NOT NULL THEN
    SELECT ARRAY_AGG(rid)
    INTO scoped_recording_ids
    FROM unnest(scoped_recording_ids) AS rid
    WHERE rid = ANY(filter_recording_ids);
    
    IF scoped_recording_ids IS NULL OR array_length(scoped_recording_ids, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- Call the existing hybrid_search_transcripts with scoped recording_ids
  RETURN QUERY
  SELECT 
    hs.chunk_id,
    hs.recording_id,
    hs.chunk_text,
    hs.chunk_index,
    hs.speaker_name,
    hs.speaker_email,
    hs.call_date,
    hs.call_title,
    hs.call_category,
    hs.topics,
    hs.sentiment,
    hs.intent_signals,
    hs.user_tags,
    hs.entities,
    hs.source_platform,
    hs.similarity_score,
    hs.fts_rank,
    hs.rrf_score,
    -- Lookup vault info for result attribution
    -- Use first matching vault entry (recording may be in multiple accessible workspaces)
    (SELECT ve2.workspace_id 
     FROM workspace_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.workspace_id = ANY(accessible_workspace_ids)
     LIMIT 1
    ) AS workspace_id,
    (SELECT v2.name 
     FROM workspace_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     JOIN workspaces v2 ON v2.id = ve2.workspace_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.workspace_id = ANY(accessible_workspace_ids)
     LIMIT 1
    ) AS workspace_name
  FROM hybrid_search_transcripts(
    query_text,
    query_embedding,
    match_count,
    full_text_weight::DOUBLE PRECISION,
    semantic_weight::DOUBLE PRECISION,
    rrf_k,
    filter_user_id,
    filter_date_start,
    filter_date_end,
    filter_speakers,
    filter_categories,
    scoped_recording_ids,  -- Use vault-scoped recording IDs
    filter_topics,
    filter_sentiment,
    filter_intent_signals,
    filter_user_tags
  ) hs;
  
END;
$function$;

-- Also fix get_available_metadata if it has the same issue
-- Check and fix any other functions that might use vectors with public-only search_path
