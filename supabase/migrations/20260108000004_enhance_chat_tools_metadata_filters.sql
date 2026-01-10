-- =============================================
-- ENHANCE CHAT TOOLS WITH METADATA FILTERS
-- =============================================
-- Migration: 20260108000001
-- Description: Add metadata filter parameters to hybrid_search_transcripts
--              and create metadata discovery function for granular tool support
-- Author: Claude
-- Date: 2026-01-08

-- =============================================
-- PART 1: ENHANCE HYBRID SEARCH WITH METADATA FILTERS
-- =============================================

-- Drop existing function to recreate with new parameters
DROP FUNCTION IF EXISTS public.hybrid_search_transcripts(
  TEXT, vector(1536), INT, FLOAT, FLOAT, INT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], BIGINT[]
);

-- Recreate with additional metadata filter parameters
CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.0,
  rrf_k INT DEFAULT 60,
  filter_user_id UUID DEFAULT NULL,
  filter_date_start TIMESTAMPTZ DEFAULT NULL,
  filter_date_end TIMESTAMPTZ DEFAULT NULL,
  filter_speakers TEXT[] DEFAULT NULL,
  filter_categories TEXT[] DEFAULT NULL,
  filter_recording_ids BIGINT[] DEFAULT NULL,
  -- NEW METADATA FILTERS
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
  similarity_score FLOAT,
  fts_rank FLOAT,
  rrf_score FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Semantic search using vector similarity
  semantic_search AS (
    SELECT
      tc.id,
      1 - (tc.embedding <=> query_embedding) AS similarity,
      ROW_NUMBER() OVER (ORDER BY tc.embedding <=> query_embedding) AS rank
    FROM public.transcript_chunks tc
    WHERE
      tc.embedding IS NOT NULL
      AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
      AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
      AND (filter_speakers IS NULL OR tc.speaker_email = ANY(filter_speakers) OR tc.speaker_name = ANY(filter_speakers))
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      -- NEW METADATA FILTER CONDITIONS
      AND (filter_topics IS NULL OR tc.topics && filter_topics)  -- Array overlap operator
      AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
      AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
      AND (filter_user_tags IS NULL OR tc.user_tags && filter_user_tags)
    ORDER BY tc.embedding <=> query_embedding
    LIMIT LEAST(match_count * 3, 100)
  ),

  -- Full-text search using tsvector
  full_text_search AS (
    SELECT
      tc.id,
      ts_rank_cd(tc.fts, websearch_to_tsquery('english', query_text)) AS rank_score,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(tc.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank
    FROM public.transcript_chunks tc
    WHERE
      tc.fts @@ websearch_to_tsquery('english', query_text)
      AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
      AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
      AND (filter_speakers IS NULL OR tc.speaker_email = ANY(filter_speakers) OR tc.speaker_name = ANY(filter_speakers))
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      -- NEW METADATA FILTER CONDITIONS
      AND (filter_topics IS NULL OR tc.topics && filter_topics)
      AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
      AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
      AND (filter_user_tags IS NULL OR tc.user_tags && filter_user_tags)
    ORDER BY ts_rank_cd(tc.fts, websearch_to_tsquery('english', query_text)) DESC
    LIMIT LEAST(match_count * 3, 100)
  ),

  -- Combine with RRF (Reciprocal Rank Fusion)
  combined AS (
    SELECT
      COALESCE(ss.id, fts.id) AS id,
      COALESCE(ss.similarity, 0) AS similarity,
      COALESCE(fts.rank_score, 0) AS fts_rank,
      (
        COALESCE(semantic_weight / (rrf_k + ss.rank), 0) +
        COALESCE(full_text_weight / (rrf_k + fts.rank), 0)
      ) AS rrf_score
    FROM semantic_search ss
    FULL OUTER JOIN full_text_search fts ON ss.id = fts.id
  )

  SELECT
    tc.id AS chunk_id,
    tc.recording_id,
    tc.chunk_text,
    tc.chunk_index,
    tc.speaker_name,
    tc.speaker_email,
    tc.call_date,
    tc.call_title,
    tc.call_category,
    tc.topics,
    tc.sentiment,
    tc.intent_signals,
    tc.user_tags,
    tc.entities,
    c.similarity::FLOAT AS similarity_score,
    c.fts_rank::FLOAT AS fts_rank,
    c.rrf_score::FLOAT AS rrf_score
  FROM combined c
  JOIN public.transcript_chunks tc ON tc.id = c.id
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_transcripts(
  TEXT, vector(1536), INT, FLOAT, FLOAT, INT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], BIGINT[], TEXT[], TEXT, TEXT[], TEXT[]
) IS 'Hybrid search using RRF (Reciprocal Rank Fusion) combining semantic and keyword search with flexible filtering including topics, sentiment, intent signals, and user tags';

-- =============================================
-- PART 2: METADATA DISCOVERY FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.get_available_metadata(
  p_user_id UUID,
  p_metadata_type TEXT  -- 'speakers' | 'categories' | 'topics' | 'tags' | 'intents' | 'sentiments'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  CASE p_metadata_type
    WHEN 'speakers' THEN
      -- Get distinct speakers with their email and name count
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', speaker_name,
          'email', speaker_email,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          speaker_name,
          speaker_email,
          COUNT(*) as chunk_count
        FROM transcript_chunks
        WHERE user_id = p_user_id
          AND speaker_name IS NOT NULL
        GROUP BY speaker_name, speaker_email
      ) speakers;

    WHEN 'categories' THEN
      -- Get distinct categories with counts
      SELECT jsonb_agg(
        jsonb_build_object(
          'category', call_category,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          call_category,
          COUNT(*) as chunk_count
        FROM transcript_chunks
        WHERE user_id = p_user_id
          AND call_category IS NOT NULL
        GROUP BY call_category
      ) categories;

    WHEN 'topics' THEN
      -- Get distinct topics from arrays with counts
      SELECT jsonb_agg(
        jsonb_build_object(
          'topic', topic,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          topic,
          COUNT(*) as chunk_count
        FROM transcript_chunks, unnest(topics) AS topic
        WHERE user_id = p_user_id
        GROUP BY topic
      ) topics;

    WHEN 'tags' THEN
      -- Get distinct user tags with counts
      SELECT jsonb_agg(
        jsonb_build_object(
          'tag', tag,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          tag,
          COUNT(*) as chunk_count
        FROM transcript_chunks, unnest(user_tags) AS tag
        WHERE user_id = p_user_id
        GROUP BY tag
      ) tags;

    WHEN 'intents' THEN
      -- Get distinct intent signals with counts
      SELECT jsonb_agg(
        jsonb_build_object(
          'intent', intent,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          intent,
          COUNT(*) as chunk_count
        FROM transcript_chunks, unnest(intent_signals) AS intent
        WHERE user_id = p_user_id
        GROUP BY intent
      ) intents;

    WHEN 'sentiments' THEN
      -- Get distinct sentiments with counts
      SELECT jsonb_agg(
        jsonb_build_object(
          'sentiment', sentiment,
          'chunk_count', chunk_count
        ) ORDER BY chunk_count DESC
      ) INTO result
      FROM (
        SELECT
          sentiment,
          COUNT(*) as chunk_count
        FROM transcript_chunks
        WHERE user_id = p_user_id
          AND sentiment IS NOT NULL
        GROUP BY sentiment
      ) sentiments;

    ELSE
      RAISE EXCEPTION 'Invalid metadata type: %. Must be one of: speakers, categories, topics, tags, intents, sentiments', p_metadata_type;
  END CASE;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_available_metadata IS 'Retrieve distinct metadata values for a user to enable faceted search and discovery';

-- =============================================
-- PART 3: GRANT PERMISSIONS
-- =============================================

-- Grant execute permissions for authenticated users
GRANT EXECUTE ON FUNCTION public.hybrid_search_transcripts(
  TEXT, vector(1536), INT, FLOAT, FLOAT, INT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], BIGINT[], TEXT[], TEXT, TEXT[], TEXT[]
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_metadata(UUID, TEXT) TO authenticated;

-- Grant execute permissions for service role (for Edge Functions)
GRANT EXECUTE ON FUNCTION public.hybrid_search_transcripts(
  TEXT, vector(1536), INT, FLOAT, FLOAT, INT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], BIGINT[], TEXT[], TEXT, TEXT[], TEXT[]
) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_available_metadata(UUID, TEXT) TO service_role;
