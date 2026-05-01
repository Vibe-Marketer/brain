-- Launch cleanup: remove remaining embedding storage and cost artifacts.
--
-- The embedding worker functions and queue were retired earlier. This finishes
-- the cleanup by removing persisted embedding jobs/logs and vector columns from
-- transcript chunks while leaving chunk text available for legacy copy/delete
-- routines that still expect the transcript_chunks table to exist.

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('embedding-worker-backup');
  EXCEPTION
    WHEN undefined_function THEN NULL;
    WHEN invalid_parameter_value THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END $$;

DROP FUNCTION IF EXISTS public.get_admin_cost_summary(text);
DROP FUNCTION IF EXISTS public.get_embedding_cost_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.get_recording_embedding_costs(uuid, integer);
DROP FUNCTION IF EXISTS public.get_indexed_recording_count(uuid);

DROP TABLE IF EXISTS public.embedding_usage_logs CASCADE;
DROP TABLE IF EXISTS public.embedding_jobs CASCADE;

ALTER TABLE IF EXISTS public.transcript_chunks
  DROP COLUMN IF EXISTS embedding,
  DROP COLUMN IF EXISTS embedding_model;

DROP INDEX IF EXISTS public.idx_transcript_chunks_embedding;
