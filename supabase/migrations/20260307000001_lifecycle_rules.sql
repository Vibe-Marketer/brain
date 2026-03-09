-- Phase 7: Lifecycle & Cleanup Rules

-- 1. Protective trigger for workspaces (correcting names after rename)
DROP TRIGGER IF EXISTS protect_default_workspace ON public.workspaces;
CREATE TRIGGER protect_default_workspace
  BEFORE DELETE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.prevent_default_workspace_delete();

-- 2. Protective trigger for recordings (Hard Delete block)
-- "If a Recording has ANY workspace_entries, it cannot be hard deleted."

CREATE OR REPLACE FUNCTION public.prevent_recording_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_count INTEGER;
BEGIN
  -- Check if there are workspace_entries for this recording
  SELECT COUNT(*) INTO v_entry_count
  FROM public.workspace_entries
  WHERE recording_id = OLD.id;

  IF v_entry_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete recording: it is currently present in % workspace(s). Remove it from all workspaces first.', v_entry_count;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_recording_delete ON public.recordings;
CREATE TRIGGER protect_recording_delete
  BEFORE DELETE ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_recording_hard_delete();

COMMENT ON FUNCTION public.prevent_recording_hard_delete() IS
  'Prevents hard deletion of a recording if it is still referenced in any workspace_entries.';

-- 3. Home Workspace auto-assignment (Consistency check)
-- Ensure every recording in an organization has an entry in that organization's HOME workspace.

CREATE OR REPLACE FUNCTION public.ensure_recording_home_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_workspace_id UUID;
BEGIN
  -- Find HOME workspace for this organization
  SELECT id INTO v_home_workspace_id
  FROM workspaces
  WHERE organization_id = NEW.organization_id
    AND is_home = TRUE
  LIMIT 1;

  IF v_home_workspace_id IS NOT NULL THEN
    -- Upsert entry into HOME workspace
    INSERT INTO workspace_entries (workspace_id, recording_id)
    VALUES (v_home_workspace_id, NEW.id)
    ON CONFLICT (workspace_id, recording_id) DO NOTHING;
  ELSE
    RAISE WARNING 'No HOME workspace found for organization % — recording % will not appear in HOME workspace', NEW.organization_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_home_workspace_entry ON public.recordings;
CREATE TRIGGER auto_home_workspace_entry
  AFTER INSERT ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.ensure_recording_home_entry();

COMMENT ON FUNCTION public.ensure_recording_home_entry() IS
  'Ensures that every new recording is automatically visible in the organization-level HOME workspace.';
