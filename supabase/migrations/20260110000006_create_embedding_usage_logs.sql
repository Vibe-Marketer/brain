-- ============================================================================
-- EMBEDDING USAGE LOGS TABLE
-- ============================================================================
-- Purpose: Track token counts and costs for embedding API usage
-- Enables cost tracking dashboard and per-user/per-transcript cost analysis
--
-- Components:
--   1. embedding_usage_logs table - tracks individual API calls
--   2. Indexes for efficient querying by user, date, and operation type
--   3. RLS policies for user and service role access
--   4. Helper function to get monthly cost summary
-- ============================================================================

-- 1. Create embedding_usage_logs table
CREATE TABLE IF NOT EXISTS public.embedding_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Operation context
  operation_type TEXT NOT NULL
    CHECK (operation_type IN ('embedding', 'enrichment', 'search', 'chat')),
  model TEXT NOT NULL,

  -- Token tracking
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + COALESCE(output_tokens, 0)) STORED,

  -- Cost tracking (in USD, stored as cents for precision)
  cost_cents NUMERIC(10, 4) NOT NULL DEFAULT 0,

  -- Related entities (optional references for drill-down analysis)
  job_id UUID REFERENCES public.embedding_jobs(id) ON DELETE SET NULL,
  recording_id BIGINT,
  chunk_id UUID REFERENCES public.transcript_chunks(id) ON DELETE SET NULL,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,

  -- Batch tracking
  batch_size INTEGER DEFAULT 1,

  -- Request metadata
  request_id TEXT,
  latency_ms INTEGER,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE public.embedding_usage_logs IS 'Tracks token counts and costs for embedding API calls (OpenAI, etc.)';
COMMENT ON COLUMN public.embedding_usage_logs.operation_type IS 'Type of operation: embedding (vector generation), enrichment (metadata), search (query), chat (conversation)';
COMMENT ON COLUMN public.embedding_usage_logs.cost_cents IS 'Cost in USD cents with 4 decimal places for precision (e.g., 0.0020 = $0.000020)';
COMMENT ON COLUMN public.embedding_usage_logs.model IS 'Model used (e.g., text-embedding-3-small, gpt-4o-mini)';
COMMENT ON COLUMN public.embedding_usage_logs.total_tokens IS 'Auto-calculated total tokens (input + output)';

-- 2. Indexes for efficient queries

-- Index for user lookups and billing queries
CREATE INDEX IF NOT EXISTS idx_embedding_usage_user_created
  ON public.embedding_usage_logs(user_id, created_at DESC);

-- Index for monthly aggregation queries
CREATE INDEX IF NOT EXISTS idx_embedding_usage_created_at
  ON public.embedding_usage_logs(created_at DESC);

-- Index for operation type analysis
CREATE INDEX IF NOT EXISTS idx_embedding_usage_operation_type
  ON public.embedding_usage_logs(operation_type);

-- Index for job-level cost tracking
CREATE INDEX IF NOT EXISTS idx_embedding_usage_job_id
  ON public.embedding_usage_logs(job_id)
  WHERE job_id IS NOT NULL;

-- Index for recording-level cost tracking
CREATE INDEX IF NOT EXISTS idx_embedding_usage_recording_id
  ON public.embedding_usage_logs(recording_id)
  WHERE recording_id IS NOT NULL;

-- Index for model-specific analysis
CREATE INDEX IF NOT EXISTS idx_embedding_usage_model
  ON public.embedding_usage_logs(model);

-- 3. Enable RLS
ALTER TABLE public.embedding_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
  ON public.embedding_usage_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own usage logs (for client-side tracking)
CREATE POLICY "Users can insert own usage logs"
  ON public.embedding_usage_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role full access on embedding_usage_logs"
  ON public.embedding_usage_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Helper function to get monthly cost summary for a user
CREATE OR REPLACE FUNCTION public.get_embedding_cost_summary(
  p_user_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  month DATE,
  operation_type TEXT,
  total_tokens BIGINT,
  total_cost_cents NUMERIC,
  request_count BIGINT,
  avg_tokens_per_request NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    DATE_TRUNC('month', created_at)::DATE AS month,
    el.operation_type,
    SUM(el.total_tokens)::BIGINT AS total_tokens,
    SUM(el.cost_cents) AS total_cost_cents,
    COUNT(*)::BIGINT AS request_count,
    ROUND(AVG(el.total_tokens), 2) AS avg_tokens_per_request
  FROM public.embedding_usage_logs el
  WHERE el.user_id = p_user_id
    AND el.created_at >= DATE_TRUNC('month', NOW()) - (p_months || ' months')::INTERVAL
  GROUP BY DATE_TRUNC('month', created_at), el.operation_type
  ORDER BY month DESC, el.operation_type;
$$;

COMMENT ON FUNCTION public.get_embedding_cost_summary IS 'Get monthly embedding cost summary by operation type for billing dashboard';

-- 5. Helper function to get per-recording cost breakdown
CREATE OR REPLACE FUNCTION public.get_recording_embedding_costs(
  p_user_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  recording_id BIGINT,
  total_tokens BIGINT,
  total_cost_cents NUMERIC,
  embedding_tokens BIGINT,
  enrichment_tokens BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    el.recording_id,
    SUM(el.total_tokens)::BIGINT AS total_tokens,
    SUM(el.cost_cents) AS total_cost_cents,
    SUM(CASE WHEN el.operation_type = 'embedding' THEN el.total_tokens ELSE 0 END)::BIGINT AS embedding_tokens,
    SUM(CASE WHEN el.operation_type = 'enrichment' THEN el.total_tokens ELSE 0 END)::BIGINT AS enrichment_tokens,
    MIN(el.created_at) AS created_at
  FROM public.embedding_usage_logs el
  WHERE el.user_id = p_user_id
    AND el.recording_id IS NOT NULL
  GROUP BY el.recording_id
  ORDER BY MIN(el.created_at) DESC
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.get_recording_embedding_costs IS 'Get per-recording embedding cost breakdown for detailed billing analysis';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
