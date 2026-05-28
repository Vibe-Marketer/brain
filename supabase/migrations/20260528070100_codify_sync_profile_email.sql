-- Codify orphan: sync_profile_email() + trg_sync_profile_email ON auth.users.
--
-- This function + trigger pair exists in prod with no defining migration.
-- It keeps public.user_profiles.email in sync with auth.users.email when a
-- user changes their email address. Without it, the app-visible email
-- becomes stale after Supabase auth email changes.
--
-- Definition captured from prod (`pg_get_functiondef` / `pg_get_triggerdef`)
-- on 2026-05-28 and recreated here verbatim. Idempotent (CREATE OR REPLACE
-- function; DROP IF EXISTS + CREATE TRIGGER).
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (MEDIUM finding #1)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.user_profiles
  SET email = NEW.email, updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sync_profile_email() IS
  'Trigger function that syncs auth.users.email -> public.user_profiles.email on UPDATE. Codified from prod 2026-05-28 (orphan-codification audit).';

-- Trigger lives on auth.users — Supabase grants the postgres role permission
-- to create triggers in the auth schema.
DROP TRIGGER IF EXISTS trg_sync_profile_email ON auth.users;
CREATE TRIGGER trg_sync_profile_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_email();
