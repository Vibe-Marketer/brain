-- =============================================
-- ADD METADATA FILTERS TO HYBRID SEARCH
-- =============================================
-- Created: 2025-11-25
-- Purpose: Expose metadata filtering (topics, sentiment, intent_signals) in hybrid_search_transcripts
-- Related: WEEK 1 - TASK 1.3 from hybrid-rag-implementation-plan.md
-- =============================================

-- =============================================
-- PART 1: ADD SENTIMENT INDEX
-- =============================================
-- Topics and intent_signals already have GIN indexes
-- Add index for sentiment (TEXT column, not array, so use btree)

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_sentiment
  ON public.transcript_chunks(sentiment)
  WHERE sentiment IS NOT NULL;

COMMENT ON INDEX idx_transcript_chunks_sentiment IS 'Index for sentiment filtering in hybrid search';

-- =============================================
-- PART 2: UPDATE HYBRID SEARCH FUNCTION
-- =============================================

-- Drop existing function (will recreate with new parameters)
DROP FUNCTION IF EXISTS public.hybrid_search_transcripts(
  TEXT, vector(1536), INT, FLOAT, FLOAT, INT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], TEXT[], BIGINT[]
);

-- Recreate with metadata filters added
CREATE OR REPLACE FUNCTION public.hybrid_search_transcripts(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  full_text_weight FLOAT DEFAULT 1.0,
  semantic_weight FLOAT DEFAULT 1.0,
  rrf_k INT DEFAULT 60,
  -- Existing filters
  filter_user_id UUID DEFAULT NULL,
  filter_date_start TIMESTAMPTZ DEFAULT NULL,
  filter_date_end TIMESTAMPTZ DEFAULT NULL,
  filter_speakers TEXT[] DEFAULT NULL,
  filter_categories TEXT[] DEFAULT NULL,
  filter_recording_ids BIGINT[] DEFAULT NULL,
  -- NEW metadata filters (WEEK 1 - TASK 1.3)
  filter_topics TEXT[] DEFAULT NULL,
  filter_sentiment TEXT DEFAULT NULL,
  filter_intent TEXT[] DEFAULT NULL
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
      -- Existing filters
      AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
      AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
      AND (filter_speakers IS NULL OR tc.speaker_email = ANY(filter_speakers) OR tc.speaker_name = ANY(filter_speakers))
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      -- NEW metadata filters (array overlap for topics/intent, equality for sentiment)
      AND (filter_topics IS NULL OR tc.topics && filter_topics)
      AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
      AND (filter_intent IS NULL OR tc.intent_signals && filter_intent)
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
      -- Existing filters
      AND (filter_user_id IS NULL OR tc.user_id = filter_user_id)
      AND (filter_date_start IS NULL OR tc.call_date >= filter_date_start)
      AND (filter_date_end IS NULL OR tc.call_date <= filter_date_end)
      AND (filter_speakers IS NULL OR tc.speaker_email = ANY(filter_speakers) OR tc.speaker_name = ANY(filter_speakers))
      AND (filter_categories IS NULL OR tc.call_category = ANY(filter_categories))
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      -- NEW metadata filters (array overlap for topics/intent, equality for sentiment)
      AND (filter_topics IS NULL OR tc.topics && filter_topics)
      AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
      AND (filter_intent IS NULL OR tc.intent_signals && filter_intent)
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
    c.similarity::FLOAT AS similarity_score,
    c.fts_rank::FLOAT AS fts_rank,
    c.rrf_score::FLOAT AS rrf_score
  FROM combined c
  JOIN public.transcript_chunks tc ON tc.id = c.id
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_transcripts IS 'Hybrid search using RRF (Reciprocal Rank Fusion) combining semantic and keyword search with flexible filtering including metadata (topics, sentiment, intent)';

-- =============================================
-- END OF MIGRATION
-- =============================================
