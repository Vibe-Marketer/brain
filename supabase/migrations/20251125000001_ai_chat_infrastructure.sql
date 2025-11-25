-- =============================================
-- AI CHAT INFRASTRUCTURE MIGRATION
-- =============================================
-- Created: 2025-11-25
-- Purpose: Add tables and functions for AI chat with hybrid RAG
-- Contains: transcript_chunks, chat_sessions, chat_messages, hybrid_search
-- =============================================

-- =============================================
-- PART 1: ENABLE EXTENSIONS
-- =============================================

-- Enable pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enable pg_trgm for fuzzy text search (may already exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- =============================================
-- PART 2: TRANSCRIPT CHUNKS TABLE (Knowledge Base)
-- =============================================

-- Chunked transcript segments with embeddings for RAG
CREATE TABLE IF NOT EXISTS public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recording_id BIGINT REFERENCES public.fathom_calls(recording_id) ON DELETE CASCADE NOT NULL,

  -- Content
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL, -- Order within recording (0-indexed)

  -- Embeddings (1536 dimensions for text-embedding-3-small)
  embedding vector(1536),

  -- Speaker context
  speaker_name TEXT,
  speaker_email TEXT,
  timestamp_start TEXT, -- Start timestamp in call
  timestamp_end TEXT,   -- End timestamp in call

  -- Call metadata (denormalized for fast filtering)
  call_date TIMESTAMPTZ,
  call_title TEXT,
  call_category TEXT,

  -- Auto-extracted metadata (meta tag enhancement)
  topics TEXT[] DEFAULT '{}',        -- Auto-extracted topics
  sentiment TEXT,                     -- positive, negative, neutral, mixed
  entities JSONB DEFAULT '{}',       -- Named entities {companies: [], people: [], products: []}
  intent_signals TEXT[] DEFAULT '{}', -- buying_signal, objection, question, concern

  -- User tags (merge with auto-extracted for search)
  user_tags TEXT[] DEFAULT '{}',

  -- Full-text search vector
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(chunk_text, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(speaker_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(call_title, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(topics, ' '), '')), 'B')
  ) STORED,

  -- Embedding status
  embedding_model TEXT DEFAULT 'text-embedding-3-small',
  embedded_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for idempotent upserts
  UNIQUE(recording_id, chunk_index)
);

COMMENT ON TABLE public.transcript_chunks IS 'Chunked transcript segments with vector embeddings for hybrid RAG search';
COMMENT ON COLUMN public.transcript_chunks.embedding IS 'Vector embedding using text-embedding-3-small (1536 dimensions)';
COMMENT ON COLUMN public.transcript_chunks.fts IS 'Weighted full-text search: chunk_text (A), speaker/topics (B), title (C)';
COMMENT ON COLUMN public.transcript_chunks.topics IS 'Auto-extracted topics from LLM analysis';
COMMENT ON COLUMN public.transcript_chunks.intent_signals IS 'Auto-detected intent: buying_signal, objection, question, concern';

-- Indexes for transcript_chunks
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user_id
  ON public.transcript_chunks(user_id);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_recording_id
  ON public.transcript_chunks(recording_id);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_call_date
  ON public.transcript_chunks(call_date DESC);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_speaker
  ON public.transcript_chunks(speaker_email, speaker_name);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_category
  ON public.transcript_chunks(call_category);

-- Vector similarity index (HNSW for fast approximate nearest neighbor)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_embedding
  ON public.transcript_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Full-text search index (GIN)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_fts
  ON public.transcript_chunks USING gin(fts);

-- Topics and tags indexes (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_topics
  ON public.transcript_chunks USING gin(topics);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_user_tags
  ON public.transcript_chunks USING gin(user_tags);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_intent_signals
  ON public.transcript_chunks USING gin(intent_signals);

-- =============================================
-- PART 3: CHAT SESSIONS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Session metadata
  title TEXT,                    -- Auto-generated or user-provided
  description TEXT,              -- Optional description

  -- Active filters for this session
  filter_date_start TIMESTAMPTZ,
  filter_date_end TIMESTAMPTZ,
  filter_speakers TEXT[] DEFAULT '{}',
  filter_categories TEXT[] DEFAULT '{}',
  filter_recording_ids BIGINT[] DEFAULT '{}',

  -- Session state
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  -- Usage tracking
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.chat_sessions IS 'Chat conversation sessions with optional filters';
COMMENT ON COLUMN public.chat_sessions.filter_recording_ids IS 'Limit chat to specific calls (empty = all)';

-- Indexes for chat_sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON public.chat_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_last_message
  ON public.chat_sessions(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned
  ON public.chat_sessions(is_pinned) WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON public.chat_sessions(user_id, is_archived) WHERE is_archived = false;

-- =============================================
-- PART 4: CHAT MESSAGES TABLE (AI SDK UIMessage format)
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Message content (Vercel AI SDK UIMessage format)
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,                   -- Text content (for simple messages)
  parts JSONB,                    -- UIMessage parts array for complex messages

  -- For assistant messages
  model TEXT,                     -- Model used (e.g., 'gpt-4o', 'gpt-4-turbo')
  finish_reason TEXT,             -- 'stop', 'length', 'tool-calls', etc.

  -- Token usage tracking
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.chat_messages IS 'Chat messages in Vercel AI SDK UIMessage format';
COMMENT ON COLUMN public.chat_messages.parts IS 'UIMessage parts: [{type: "text", text: "..."}, {type: "tool-call", ...}]';
COMMENT ON COLUMN public.chat_messages.content IS 'Simple text content (fallback when parts not used)';

-- Indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON public.chat_messages(session_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON public.chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_order
  ON public.chat_messages(session_id, created_at ASC);

-- =============================================
-- PART 5: CHAT TOOL CALLS TABLE (Analytics)
-- =============================================

CREATE TABLE IF NOT EXISTS public.chat_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Tool information
  tool_call_id TEXT NOT NULL,     -- From AI SDK
  tool_name TEXT NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,

  -- Execution tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
  error_message TEXT,
  execution_time_ms INTEGER,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.chat_tool_calls IS 'Tool invocations from chat sessions for analytics and debugging';

-- Indexes for chat_tool_calls
CREATE INDEX IF NOT EXISTS idx_tool_calls_message_id
  ON public.chat_tool_calls(message_id);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session_id
  ON public.chat_tool_calls(session_id);

CREATE INDEX IF NOT EXISTS idx_tool_calls_tool_name
  ON public.chat_tool_calls(tool_name);

CREATE INDEX IF NOT EXISTS idx_tool_calls_status
  ON public.chat_tool_calls(status) WHERE status != 'success';

-- =============================================
-- PART 6: EMBEDDING JOBS TABLE (Tracking)
-- =============================================

CREATE TABLE IF NOT EXISTS public.embedding_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Job scope
  recording_ids BIGINT[] NOT NULL,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  failed_recording_ids BIGINT[] DEFAULT '{}',

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.embedding_jobs IS 'Tracks transcript embedding/indexing jobs';

-- Indexes for embedding_jobs
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_user_id
  ON public.embedding_jobs(user_id);

CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status
  ON public.embedding_jobs(status);

-- =============================================
-- PART 7: HYBRID SEARCH FUNCTION (RRF)
-- =============================================

-- Hybrid search using Reciprocal Rank Fusion (RRF)
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
  filter_recording_ids BIGINT[] DEFAULT NULL
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
    c.similarity::FLOAT AS similarity_score,
    c.fts_rank::FLOAT AS fts_rank,
    c.rrf_score::FLOAT AS rrf_score
  FROM combined c
  JOIN public.transcript_chunks tc ON tc.id = c.id
  ORDER BY c.rrf_score DESC
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION public.hybrid_search_transcripts IS 'Hybrid search using RRF (Reciprocal Rank Fusion) combining semantic and keyword search with flexible filtering';

-- =============================================
-- PART 8: HELPER FUNCTIONS
-- =============================================

-- Function to get distinct speakers for a user
CREATE OR REPLACE FUNCTION public.get_user_speakers(p_user_id UUID)
RETURNS TABLE (
  speaker_name TEXT,
  speaker_email TEXT,
  call_count BIGINT,
  latest_call TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    tc.speaker_name,
    tc.speaker_email,
    COUNT(DISTINCT tc.recording_id) AS call_count,
    MAX(tc.call_date) AS latest_call
  FROM public.transcript_chunks tc
  WHERE tc.user_id = p_user_id
    AND tc.speaker_name IS NOT NULL
  GROUP BY tc.speaker_name, tc.speaker_email
  ORDER BY call_count DESC;
$$;

COMMENT ON FUNCTION public.get_user_speakers IS 'Get distinct speakers with call counts for filter dropdown';

-- Function to get distinct categories for a user
CREATE OR REPLACE FUNCTION public.get_user_categories(p_user_id UUID)
RETURNS TABLE (
  category TEXT,
  call_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    tc.call_category AS category,
    COUNT(DISTINCT tc.recording_id) AS call_count
  FROM public.transcript_chunks tc
  WHERE tc.user_id = p_user_id
    AND tc.call_category IS NOT NULL
  GROUP BY tc.call_category
  ORDER BY call_count DESC;
$$;

COMMENT ON FUNCTION public.get_user_categories IS 'Get distinct categories with counts for filter dropdown';

-- Function to update session message count
CREATE OR REPLACE FUNCTION public.update_session_message_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.chat_sessions
    SET
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.chat_sessions
    SET
      message_count = GREATEST(message_count - 1, 0),
      updated_at = NOW()
    WHERE id = OLD.session_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to update session message count
DROP TRIGGER IF EXISTS update_session_message_count_trigger ON public.chat_messages;
CREATE TRIGGER update_session_message_count_trigger
  AFTER INSERT OR DELETE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_session_message_count();

-- =============================================
-- PART 9: ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_tool_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_jobs ENABLE ROW LEVEL SECURITY;

-- transcript_chunks policies
CREATE POLICY "Users can read own chunks"
  ON public.transcript_chunks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chunks"
  ON public.transcript_chunks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chunks"
  ON public.transcript_chunks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chunks"
  ON public.transcript_chunks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- chat_sessions policies
CREATE POLICY "Users can read own sessions"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON public.chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON public.chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- chat_messages policies
CREATE POLICY "Users can read own messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- chat_tool_calls policies
CREATE POLICY "Users can read own tool calls"
  ON public.chat_tool_calls FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tool calls"
  ON public.chat_tool_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tool calls"
  ON public.chat_tool_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- embedding_jobs policies
CREATE POLICY "Users can read own embedding jobs"
  ON public.embedding_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embedding jobs"
  ON public.embedding_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embedding jobs"
  ON public.embedding_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- PART 10: SERVICE ROLE POLICIES (Edge Functions)
-- =============================================

-- Allow service role full access for Edge Functions
CREATE POLICY "Service role full access to chunks"
  ON public.transcript_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to sessions"
  ON public.chat_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to messages"
  ON public.chat_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to tool calls"
  ON public.chat_tool_calls FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to embedding jobs"
  ON public.embedding_jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- END OF MIGRATION
-- =============================================
