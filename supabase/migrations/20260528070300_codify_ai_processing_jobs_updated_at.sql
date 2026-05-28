-- Codify orphan: update_ai_processing_jobs_updated_at() + matching trigger.
--
-- Standard touch-trigger pair (sets NEW.updated_at = now() on UPDATE). Exists
-- in prod with no defining migration. Captured from prod via pg_get_functiondef
-- / pg_get_triggerdef on 2026-05-28. Idempotent.
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (MEDIUM finding #3)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md

CREATE OR REPLACE FUNCTION public.update_ai_processing_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.update_ai_processing_jobs_updated_at() IS
  'Touch trigger function for ai_processing_jobs.updated_at. Codified from prod 2026-05-28 (orphan-codification audit).';

DROP TRIGGER IF EXISTS ai_processing_jobs_updated_at ON public.ai_processing_jobs;
CREATE TRIGGER ai_processing_jobs_updated_at
  BEFORE UPDATE ON public.ai_processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ai_processing_jobs_updated_at();
