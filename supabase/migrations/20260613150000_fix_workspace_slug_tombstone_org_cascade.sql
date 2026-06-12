-- Migration: Make workspace DELETE triggers org-cascade-aware
-- Purpose:   Deleting an organization cascades through workspaces. The
--            workspace DELETE trigger used to insert a workspace tombstone
--            that referenced the same organization row being deleted, causing
--            FK 23503 during org deletion. The default-workspace protection
--            trigger can also block the same cascade before the tombstone path.
--            Standalone workspace deletion still tombstones its slug and still
--            refuses default workspaces; org deletion skips both workspace-level
--            protections because the parent org is going away.
-- Date:      2026-06-13

CREATE OR REPLACE FUNCTION public.prevent_default_workspace_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF OLD.is_default = TRUE
     AND EXISTS (
       SELECT 1
       FROM public.organizations
       WHERE id = OLD.organization_id
     )
  THEN
    RAISE EXCEPTION 'Cannot delete the default workspace';
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.prevent_default_workspace_delete() IS
  'Prevents standalone deletion of a default workspace. Allows org-delete cascades once the parent organization is already gone.';

CREATE OR REPLACE FUNCTION public.tombstone_workspace_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.organizations
       WHERE id = OLD.organization_id
     )
  THEN
    INSERT INTO public.workspace_slug_tombstone (org_id, slug)
    VALUES (OLD.organization_id, OLD.slug)
    ON CONFLICT (org_id, slug) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.tombstone_workspace_slug() IS
  'Records deleted workspace slugs when the parent organization still exists. Skips org-delete cascades to avoid FK 23503 against workspace_slug_tombstone.org_id.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
