-- ============================================================================
-- FIX increment_embedding_progress FUNCTION
-- ============================================================================
-- Purpose: Remove reference to non-existent updated_at column that was
-- causing all progress updates to fail silently
-- ============================================================================

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
    chunks_created = chunks_created + p_chunks_created
    -- Removed: updated_at = NOW() -- This column doesn't exist!
  WHERE id = p_job_id;
END;
$$;

COMMENT ON FUNCTION public.increment_embedding_progress IS 'Atomically updates embedding job progress counters (FIXED: removed updated_at)';
