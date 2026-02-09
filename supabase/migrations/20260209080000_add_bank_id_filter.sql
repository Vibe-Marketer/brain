-- Add filter_bank_id parameter to hybrid_search_transcripts
-- This enables bank-scoped queries in the chat tools

DROP FUNCTION IF EXISTS hybrid_search_transcripts(text, vector, integer, double precision, double precision, integer, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[], text[], text[]);

CREATE OR REPLACE FUNCTION hybrid_search_transcripts(
    query_text text,
    query_embedding vector,
    match_count integer DEFAULT 10,
    full_text_weight double precision DEFAULT 1.0,
    semantic_weight double precision DEFAULT 1.0,
    rrf_k integer DEFAULT 60,
    filter_user_id uuid DEFAULT NULL,
    filter_date_start timestamp with time zone DEFAULT NULL,
    filter_date_end timestamp with time zone DEFAULT NULL,
    filter_speakers text[] DEFAULT NULL,
    filter_categories text[] DEFAULT NULL,
    filter_recording_ids bigint[] DEFAULT NULL,
    filter_topics text[] DEFAULT NULL,
    filter_sentiment text DEFAULT NULL,
    filter_intent_signals text[] DEFAULT NULL,
    filter_user_tags text[] DEFAULT NULL,
    filter_source_platforms text[] DEFAULT NULL,
    filter_bank_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
    rrf_score double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_search AS (
        SELECT 
            tc.id,
            tc.recording_id,
            1 - (tc.embedding <=> query_embedding) AS similarity
        FROM transcript_chunks tc
        JOIN fathom_calls fc ON tc.recording_id = fc.id
        WHERE 
            (filter_user_id IS NULL OR fc.user_id = filter_user_id)
            AND (filter_date_start IS NULL OR fc.call_date >= filter_date_start)
            AND (filter_date_end IS NULL OR fc.call_date <= filter_date_end)
            AND (filter_speakers IS NULL OR tc.speaker_name = ANY(filter_speakers))
            AND (filter_categories IS NULL OR fc.call_category = ANY(filter_categories))
            AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
            AND (filter_topics IS NULL OR fc.topics && filter_topics)
            AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
            AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
            AND (filter_user_tags IS NULL OR fc.user_tags && filter_user_tags)
            AND (filter_source_platforms IS NULL OR fc.source_platform = ANY(filter_source_platforms))
            AND (filter_bank_id IS NULL OR fc.bank_id = filter_bank_id)
        ORDER BY tc.embedding <=> query_embedding
        LIMIT match_count * 2
    ),
    full_text_search AS (
        SELECT 
            tc.id,
            tc.recording_id,
            ts_rank_cd(to_tsvector('english', tc.chunk_text), plainto_tsquery('english', query_text)) AS rank
        FROM transcript_chunks tc
        JOIN fathom_calls fc ON tc.recording_id = fc.id
        WHERE 
            to_tsvector('english', tc.chunk_text) @@ plainto_tsquery('english', query_text)
            AND (filter_user_id IS NULL OR fc.user_id = filter_user_id)
            AND (filter_date_start IS NULL OR fc.call_date >= filter_date_start)
            AND (filter_date_end IS NULL OR fc.call_date <= filter_date_end)
            AND (filter_speakers IS NULL OR tc.speaker_name = ANY(filter_speakers))
            AND (filter_categories IS NULL OR fc.call_category = ANY(filter_categories))
            AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
            AND (filter_topics IS NULL OR fc.topics && filter_topics)
            AND (filter_sentiment IS NULL OR tc.sentiment = filter_sentiment)
            AND (filter_intent_signals IS NULL OR tc.intent_signals && filter_intent_signals)
            AND (filter_user_tags IS NULL OR fc.user_tags && filter_user_tags)
            AND (filter_source_platforms IS NULL OR fc.source_platform = ANY(filter_source_platforms))
            AND (filter_bank_id IS NULL OR fc.bank_id = filter_bank_id)
        ORDER BY rank DESC
        LIMIT match_count * 2
    ),
    combined AS (
        SELECT
            COALESCE(ss.id, fts.id) AS id,
            COALESCE(ss.recording_id, fts.recording_id) AS recording_id,
            COALESCE(ss.similarity, 0) AS similarity,
            COALESCE(fts.rank, 0) AS fts_rank,
            (
                COALESCE(1.0 / (rrf_k + ROW_NUMBER() OVER (ORDER BY ss.similarity DESC NULLS LAST)), 0) * semantic_weight +
                COALESCE(1.0 / (rrf_k + ROW_NUMBER() OVER (ORDER BY fts.rank DESC NULLS LAST)), 0) * full_text_weight
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
        fc.call_date,
        fc.call_title,
        fc.call_category,
        fc.topics,
        tc.sentiment,
        tc.intent_signals,
        fc.user_tags,
        tc.entities,
        fc.source_platform,
        c.similarity AS similarity_score,
        c.fts_rank,
        c.rrf_score
    FROM combined c
    JOIN transcript_chunks tc ON c.id = tc.id
    JOIN fathom_calls fc ON tc.recording_id = fc.id
    ORDER BY c.rrf_score DESC
    LIMIT match_count;
END;
$$;

-- Also drop the old overload to avoid confusion
DROP FUNCTION IF EXISTS hybrid_search_transcripts(text, vector, integer, double precision, double precision, integer, uuid, timestamp with time zone, timestamp with time zone, text[], text[], bigint[], text[], text, text[]);
