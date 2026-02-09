-- Migration: Chat Vault-Scoped Search Function
-- Purpose: Extends hybrid_search_transcripts to respect bank/vault context
-- Phase: 10-chat-bank-vault-scoping
-- Date: 2026-02-09

-- =============================================================================
-- VAULT-SCOPED HYBRID SEARCH
-- =============================================================================
-- This function wraps hybrid_search_transcripts with vault membership filtering.
-- 
-- Scoping logic:
-- 1. If vault_id provided: Only return chunks from recordings in that vault (verify membership)
-- 2. If only bank_id provided: Return chunks from all vaults user has membership in (within that bank)
-- 3. If neither: Fall back to legacy unscoped search for pre-migration compatibility
-- 4. VaultMembership is the access primitive - BankMembership alone never exposes content

CREATE OR REPLACE FUNCTION hybrid_search_transcripts_scoped(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.0,
  rrf_k INT DEFAULT 60,
  filter_user_id UUID DEFAULT NULL,
  filter_bank_id UUID DEFAULT NULL,
  filter_vault_id UUID DEFAULT NULL,
  -- Original filters from hybrid_search_transcripts
  filter_date_start TIMESTAMPTZ DEFAULT NULL,
  filter_date_end TIMESTAMPTZ DEFAULT NULL,
  filter_speakers TEXT[] DEFAULT NULL,
  filter_categories TEXT[] DEFAULT NULL,
  filter_recording_ids BIGINT[] DEFAULT NULL,
  filter_topics TEXT[] DEFAULT NULL,
  filter_sentiment TEXT DEFAULT NULL,
  filter_intent_signals TEXT[] DEFAULT NULL,
  filter_user_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  recording_id BIGINT,
  chunk_text TEXT,
  chunk_index INTEGER,
  speaker_name TEXT,
  speaker_email TEXT,
  call_date TIMESTAMPTZ,
  call_title TEXT,
  call_category TEXT,
  topics TEXT[],
  sentiment TEXT,
  intent_signals TEXT[],
  user_tags TEXT[],
  entities JSONB,
  source_platform TEXT,
  similarity_score DOUBLE PRECISION,
  fts_rank DOUBLE PRECISION,
  rrf_score DOUBLE PRECISION,
  vault_id UUID,
  vault_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accessible_vault_ids UUID[];
  scoped_recording_ids BIGINT[];
BEGIN
  -- Determine which vaults the user can access
  IF filter_vault_id IS NOT NULL THEN
    -- Specific vault requested - verify user has membership
    IF NOT EXISTS (
      SELECT 1 FROM vault_memberships 
      WHERE user_id = filter_user_id 
      AND vault_memberships.vault_id = filter_vault_id
    ) THEN
      -- User doesn't have access to this vault - return empty
      RETURN;
    END IF;
    accessible_vault_ids := ARRAY[filter_vault_id];
  ELSIF filter_bank_id IS NOT NULL THEN
    -- Bank-level search - get all vaults user has membership in within this bank
    SELECT ARRAY_AGG(vm.vault_id) INTO accessible_vault_ids
    FROM vault_memberships vm
    JOIN vaults v ON v.id = vm.vault_id
    WHERE vm.user_id = filter_user_id
    AND v.bank_id = filter_bank_id;
    
    -- If user has no vault memberships in this bank, return empty
    IF accessible_vault_ids IS NULL OR array_length(accessible_vault_ids, 1) IS NULL THEN
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
      NULL::UUID AS vault_id,
      NULL::TEXT AS vault_name
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

  -- Get recording_ids that are in accessible vaults via vault_entries
  -- Bridge through legacy_recording_id since transcripts haven't been migrated yet
  SELECT ARRAY_AGG(DISTINCT r.legacy_recording_id)
  INTO scoped_recording_ids
  FROM vault_entries ve
  JOIN recordings r ON r.id = ve.recording_id
  WHERE ve.vault_id = ANY(accessible_vault_ids)
  AND r.legacy_recording_id IS NOT NULL;

  -- If no recordings in accessible vaults, return empty
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
    -- Use first matching vault entry (recording may be in multiple accessible vaults)
    (SELECT ve2.vault_id 
     FROM vault_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.vault_id = ANY(accessible_vault_ids)
     LIMIT 1
    ) AS vault_id,
    (SELECT v2.name 
     FROM vault_entries ve2 
     JOIN recordings r2 ON r2.id = ve2.recording_id
     JOIN vaults v2 ON v2.id = ve2.vault_id
     WHERE r2.legacy_recording_id = hs.recording_id
     AND ve2.vault_id = ANY(accessible_vault_ids)
     LIMIT 1
    ) AS vault_name
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
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION hybrid_search_transcripts_scoped TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search_transcripts_scoped TO service_role;

COMMENT ON FUNCTION hybrid_search_transcripts_scoped IS 
  'Vault-scoped wrapper for hybrid_search_transcripts. Filters results to vaults user has membership in. Returns vault_id and vault_name for result attribution.';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
