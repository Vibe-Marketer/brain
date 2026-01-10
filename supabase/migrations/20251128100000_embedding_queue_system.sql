-- ============================================================================
-- EMBEDDING QUEUE SYSTEM
-- ============================================================================
-- Purpose: Replaces synchronous embedding processing with a queue-based system
-- that can handle large volumes without timing out.
--
-- Components:
--   1. embedding_queue table - tracks individual recording tasks
--   2. claim_embedding_tasks function - atomic task claiming with locking
--   3. increment_embedding_progress function - atomic progress updates
--   4. Enhanced embedding_jobs columns for queue tracking
-- ============================================================================

-- 1. Create embedding_queue table
CREATE TABLE IF NOT EXISTS public.embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.embedding_jobs(id) ON DELETE CASCADE NOT NULL,
  recording_id BIGINT NOT NULL,

  -- Queue status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),

  -- Worker tracking
  worker_id TEXT,
  locked_at TIMESTAMPTZ,

  -- Retry logic (exponential backoff: 30s, 90s, 270s)
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Prevent duplicate queue entries
  UNIQUE(job_id, recording_id)
);

-- Add comment
COMMENT ON TABLE public.embedding_queue IS 'Task queue for embedding recordings - processes in small batches to avoid timeouts';

-- 2. Indexes for efficient queue operations
-- Index for finding pending/failed tasks ready to process
CREATE INDEX IF NOT EXISTS idx_embedding_queue_pending
  ON public.embedding_queue(status, next_retry_at)
  WHERE status IN ('pending', 'failed');

-- Index for user/job lookups
CREATE INDEX IF NOT EXISTS idx_embedding_queue_user_job
  ON public.embedding_queue(user_id, job_id);

-- Index for detecting stale locks
CREATE INDEX IF NOT EXISTS idx_embedding_queue_stale_locks
  ON public.embedding_queue(locked_at)
  WHERE status = 'processing';

-- Index for job completion checks
CREATE INDEX IF NOT EXISTS idx_embedding_queue_job_status
  ON public.embedding_queue(job_id, status);

-- 3. Add queue tracking columns to embedding_jobs
ALTER TABLE public.embedding_jobs
  ADD COLUMN IF NOT EXISTS queue_total INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queue_completed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS queue_failed INTEGER DEFAULT 0;

-- 4. Enable RLS on embedding_queue
ALTER TABLE public.embedding_queue ENABLE ROW LEVEL SECURITY;

-- Users can view their own queue items
CREATE POLICY "Users can view own queue items"
  ON public.embedding_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role has full access (for worker functions)
CREATE POLICY "Service role full access on embedding_queue"
  ON public.embedding_queue FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. Atomic task claiming function (prevents race conditions)
-- Uses SELECT FOR UPDATE SKIP LOCKED for safe concurrent access
CREATE OR REPLACE FUNCTION public.claim_embedding_tasks(
  p_worker_id TEXT,
  p_batch_size INT DEFAULT 10,
  p_job_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  job_id UUID,
  recording_id BIGINT,
  attempts INT,
  max_attempts INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    UPDATE embedding_queue eq
    SET
      status = 'processing',
      worker_id = p_worker_id,
      locked_at = NOW(),
      started_at = COALESCE(eq.started_at, NOW())
    WHERE eq.id IN (
      SELECT eq2.id
      FROM embedding_queue eq2
      WHERE eq2.status IN ('pending', 'failed')
        AND (p_job_id IS NULL OR eq2.job_id = p_job_id)
        AND (eq2.next_retry_at IS NULL OR eq2.next_retry_at <= NOW())
        -- Release stale locks (tasks stuck in processing for >2 minutes)
        AND (eq2.locked_at IS NULL OR eq2.locked_at < NOW() - INTERVAL '2 minutes')
      ORDER BY
        eq2.status = 'pending' DESC,  -- Pending tasks first
        eq2.created_at ASC            -- FIFO within status
      LIMIT p_batch_size
      FOR UPDATE SKIP LOCKED
    )
    RETURNING eq.*
  )
  SELECT
    claimed.id,
    claimed.user_id,
    claimed.job_id,
    claimed.recording_id,
    claimed.attempts,
    claimed.max_attempts
  FROM claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_embedding_tasks IS 'Atomically claims embedding tasks for processing with lock-based concurrency control';

-- 6. Atomic job progress increment function
CREATE OR REPLACE FUNCTION public.increment_embedding_progress(
  p_job_id UUID,
  p_success BOOLEAN,
  p_chunks_created INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE embedding_jobs
  SET
    progress_current = progress_current + 1,
    queue_completed = CASE WHEN p_success THEN queue_completed + 1 ELSE queue_completed END,
    queue_failed = CASE WHEN NOT p_success THEN queue_failed + 1 ELSE queue_failed END,
    chunks_created = chunks_created + p_chunks_created,
    updated_at = NOW()
  WHERE id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.increment_embedding_progress IS 'Atomically updates embedding job progress counters';

-- 7. Function to finalize completed jobs
CREATE OR REPLACE FUNCTION public.finalize_embedding_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  finalized_count INT := 0;
BEGIN
  -- Find and finalize jobs where all queue items are processed
  WITH jobs_to_finalize AS (
    SELECT DISTINCT ej.id
    FROM embedding_jobs ej
    WHERE ej.status = 'running'
      AND NOT EXISTS (
        SELECT 1 FROM embedding_queue eq
        WHERE eq.job_id = ej.id
          AND eq.status IN ('pending', 'processing', 'failed')
      )
  ),
  updated AS (
    UPDATE embedding_jobs ej
    SET
      status = CASE
        WHEN ej.queue_failed > 0 THEN 'completed_with_errors'
        ELSE 'completed'
      END,
      completed_at = NOW()
    FROM jobs_to_finalize jtf
    WHERE ej.id = jtf.id
    RETURNING ej.id
  )
  SELECT COUNT(*) INTO finalized_count FROM updated;

  RETURN finalized_count;
END;
$$;

COMMENT ON FUNCTION public.finalize_embedding_jobs IS 'Marks embedding jobs as completed when all queue items are processed';

-- 8. Add 'completed_with_errors' to embedding_jobs status check
-- First check if the constraint exists and needs updating
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'embedding_jobs_status_check'
    AND conrelid = 'public.embedding_jobs'::regclass
  ) THEN
    ALTER TABLE public.embedding_jobs DROP CONSTRAINT embedding_jobs_status_check;
  END IF;

  -- Add updated constraint with 'completed_with_errors' status
  ALTER TABLE public.embedding_jobs
    ADD CONSTRAINT embedding_jobs_status_check
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'completed_with_errors'));
EXCEPTION
  WHEN others THEN
    -- Constraint might not exist or have different name, that's ok
    NULL;
END $$;

-- 9. Enable pg_net extension for HTTP calls (needed for pg_cron to call edge functions)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 10. Set up pg_cron backup trigger
-- This ensures embeddings continue processing even if the self-chain breaks
-- Note: pg_cron uses cron syntax, not intervals. This runs every 30 seconds.
-- The worker is idempotent - if no work exists, it returns immediately.

-- First, enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Schedule the backup worker trigger
-- Runs every minute (pg_cron minimum interval) to check for pending work
DO $$
BEGIN
  -- Remove existing schedule if it exists
  PERFORM cron.unschedule('embedding-worker-backup');
EXCEPTION
  WHEN undefined_function THEN
    -- pg_cron not available, skip
    RAISE NOTICE 'pg_cron not available, skipping cron schedule';
  WHEN others THEN
    -- Job might not exist, that's ok
    NULL;
END $$;

-- Create the scheduled job
-- Note: pg_cron minimum interval is 1 minute, but the self-chain handles faster processing
DO $outer$
BEGIN
  PERFORM cron.schedule(
    'embedding-worker-backup',
    '* * * * *',  -- Every minute
    $body$
    SELECT net.http_post(
      url := 'https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/process-embeddings',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"triggered_by": "cron", "batch_size": 10}'::jsonb
    );
    $body$
  );
  RAISE NOTICE 'Successfully scheduled embedding-worker-backup cron job';
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pg_cron not available - cron backup disabled. Self-chain will handle processing.';
  WHEN others THEN
    RAISE NOTICE 'Could not schedule cron job: %. Self-chain will handle processing.', SQLERRM;
END $outer$;
