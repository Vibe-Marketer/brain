-- Codify orphan: update_transcript_tags_updated_at().
--
-- DETACHED FUNCTION (no trigger references it in prod). Standard touch
-- trigger function (NEW.updated_at = NOW()) that exists in prod with no
-- defining migration AND no trigger using it.
--
-- The transcript_tags table DOES have an updated_at column, so attaching
-- this function as a BEFORE UPDATE trigger would be sensible — but I'm
-- NOT doing that here, because the absence of the trigger in prod might
-- be intentional (transcript_tags is restructured as (user_id, name)
-- unique, see audit INFO section on superseded indexes).
--
-- Captured verbatim from prod via pg_get_functiondef on 2026-05-28 so that
-- a future rebuild-from-migrations doesn't silently break any future code
-- that calls this function directly. If a follow-up audit confirms this is
-- truly dead code, drop both the function and this migration in a
-- dedicated DROP migration (and update the audit log).
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (MEDIUM finding #5)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md

CREATE OR REPLACE FUNCTION public.update_transcript_tags_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.update_transcript_tags_updated_at() IS
  'Touch trigger function for transcript_tags.updated_at. DETACHED in prod (no trigger references it). Codified from prod 2026-05-28 to preserve build-from-migrations parity. Candidate for future DROP if confirmed dead.';
