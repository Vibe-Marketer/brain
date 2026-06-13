-- Ensure clean databases match the live runner_runs shape.
-- Production already has this column; IF NOT EXISTS keeps this migration a no-op there.
ALTER TABLE public.runner_runs
  ADD COLUMN IF NOT EXISTS tickets_processed integer NOT NULL DEFAULT 0;
