-- Migration: Protect HOME workspace entries from deletion
--
-- Every recording in an org must always appear in the HOME workspace (is_home=true).
-- Recordings cannot be removed from HOME — only deleting the recording itself is allowed.
--
-- Implementation: BEFORE DELETE trigger on workspace_entries that raises an exception
-- when the target workspace has is_home = true.

CREATE OR REPLACE FUNCTION prevent_home_workspace_entry_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT is_home FROM workspaces WHERE id = OLD.workspace_id) THEN
    RAISE EXCEPTION
      'Cannot remove a recording from the HOME workspace. '
      'Delete the recording itself to remove it from the org.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER protect_home_workspace_entries
  BEFORE DELETE ON workspace_entries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_home_workspace_entry_delete();

COMMENT ON FUNCTION prevent_home_workspace_entry_delete IS
  'Prevents workspace_entries rows from being deleted when the workspace is the HOME workspace (is_home=true). '
  'Enforces the invariant that every recording always appears in HOME.';
