-- Codify orphan: trigger_assign_free_role ON public.user_profiles.
--
-- Trigger exists in prod with no defining migration. Fires on INSERT into
-- user_profiles and calls the existing assign_free_role_to_new_user()
-- function (which IS defined in repo) to give every new user the default
-- "free" billing tier role.
--
-- Trigger definition captured from prod (`pg_get_triggerdef`) on 2026-05-28.
-- The function it references already lives in a prior migration; only the
-- trigger needed codification.
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (MEDIUM finding #2)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md

DROP TRIGGER IF EXISTS trigger_assign_free_role ON public.user_profiles;
CREATE TRIGGER trigger_assign_free_role
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_free_role_to_new_user();
