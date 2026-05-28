-- Restore missing trigger: update_ai_models_updated_at ON ai_models.
--
-- The original migration `20251212000001_create_ai_models.sql` defined this
-- trigger to touch updated_at on every UPDATE, calling the shared
-- update_speakers_updated_at() function (which despite its name is a
-- generic NEW.updated_at = now() touch). At some point this trigger was
-- silently dropped in prod (only ensure_single_default_model_trigger
-- remains). The updated_at column is still present.
--
-- Same drift class as the trg_ensure_home_workspace restoration earlier
-- today (`33e2810b`). Restoring per the LOW-priority audit finding.
--
-- Refs:
--   - .planning/forensics/schema-drift-audit-2026-05-28.md (LOW finding)
--   - .planning/forensics/schema-drift-fix-2026-05-28.md
--   - supabase/migrations/20251212000001_create_ai_models.sql (original)

DROP TRIGGER IF EXISTS update_ai_models_updated_at ON public.ai_models;
CREATE TRIGGER update_ai_models_updated_at
  BEFORE UPDATE ON public.ai_models
  FOR EACH ROW
  EXECUTE FUNCTION public.update_speakers_updated_at();
