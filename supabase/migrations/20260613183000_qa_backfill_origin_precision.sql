-- Migration: QA backfill origin precision
-- Purpose: Reclassify legacy QA-created tickets that carried the crawler marker
--          in context.origin instead of context.userAgent.
-- Date: 2026-06-13

UPDATE public.tickets
SET source = 'nightly_qa'
WHERE source = 'manual'
  AND context->>'origin' = 'qa-nightly-crawler';
