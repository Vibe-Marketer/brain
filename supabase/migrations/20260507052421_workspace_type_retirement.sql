-- Migration: Phase 25 — Workspace Type Retirement
-- Purpose: Retire workspace_type as a behavior switch. Replaces it with two cleaner derivations:
--   - is_default (singleton per org, protected from deletion)
--   - workspace_memberships.sort_order (per-user sidebar ordering)
--   The workspace_type column itself is preserved as legacy data — no code reads it after Phase 25.
-- Author: Phase 25 (Workspace Type Retirement)
-- Date: 2026-05-07

-- ============================================================================
-- 1. DROP the workspace_type CHECK constraint
-- ============================================================================
-- After this point, workspace_type accepts any TEXT value. New code never branches on it.
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_workspace_type_check;

-- ============================================================================
-- 2. ADD workspace_memberships.sort_order column
-- ============================================================================
-- Lower sort_order = appears first in the user's sidebar. Per-user ordering lives on
-- the membership row, not on the workspace itself, because each user has their own preferred order.
ALTER TABLE workspace_memberships
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- ============================================================================
-- 3. BACKFILL sort_order — rank by created_at per user, tie-break by id
-- ============================================================================
-- ROW_NUMBER() is non-deterministic when two rows share created_at, so we tie-break
-- by id (UUID is stable). Result: every user's first-created membership gets sort_order=0,
-- second gets 1, etc.
WITH ranked AS (
  SELECT id,
         (ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY created_at ASC, id ASC
          ) - 1)::INT AS new_order
  FROM workspace_memberships
)
UPDATE workspace_memberships wm
SET sort_order = ranked.new_order
FROM ranked
WHERE wm.id = ranked.id;

-- Index supports the per-user ordered query in useWorkspaces.ts.
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user_sort
  ON workspace_memberships (user_id, sort_order);

-- ============================================================================
-- 4. BACKFILL is_default per organization
-- ============================================================================
-- Rule (deterministic): for each org, pick the workspace with the highest priority:
--   1st: is_home = true (existing Home workspace from ensure_home_workspace trigger)
--   2nd: workspace_type = 'personal' (legacy personal workspace)
--   3rd: oldest created_at (final fallback)
--   tie-break: lowest id (UUID, stable)
-- Idempotent — only sets is_default if the org currently has none.
WITH chosen AS (
  SELECT DISTINCT ON (organization_id) id, organization_id
  FROM workspaces
  ORDER BY organization_id,
           is_home DESC,
           (workspace_type = 'personal') DESC,
           created_at ASC,
           id ASC
)
UPDATE workspaces w
SET is_default = TRUE
FROM chosen
WHERE w.id = chosen.id
  AND NOT EXISTS (
    SELECT 1 FROM workspaces w2
    WHERE w2.organization_id = chosen.organization_id
      AND w2.is_default = TRUE
  );

-- ============================================================================
-- 5. DEMOTE duplicate personals
-- ============================================================================
-- Any workspace_type='personal' that did NOT win the is_default lottery becomes a
-- regular deletable workspace. We change workspace_type to 'team' (legacy column
-- compat) so legacy `= 'personal'` checks treat it as a normal workspace.
-- Affects Andrew's "AI Simple" org and any other org with multiple personals.
UPDATE workspaces
SET workspace_type = 'team'
WHERE workspace_type = 'personal'
  AND COALESCE(is_default, FALSE) = FALSE;

-- ============================================================================
-- 6. ENFORCE one is_default per org at the database level
-- ============================================================================
-- Partial unique index. Inserts/updates that would create a 2nd is_default for
-- an org will raise a unique violation.
CREATE UNIQUE INDEX IF NOT EXISTS workspaces_one_default_per_org_idx
  ON workspaces (organization_id)
  WHERE is_default = TRUE;

-- ============================================================================
-- 7. UPDATE ensure_home_workspace() trigger function
-- ============================================================================
-- The trigger currently inserts the Home workspace WITHOUT setting is_default.
-- After this migration, every new org needs is_default=TRUE on its Home so the
-- partial unique index invariant holds for newly-created orgs too.
-- Preserve `SET search_path = public` from migration 20260308120000.
CREATE OR REPLACE FUNCTION public.ensure_home_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspaces (organization_id, name, workspace_type, is_home, is_default)
  VALUES (NEW.id, 'Home Workspace', 'team', TRUE, TRUE)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 8. PATCH delete_workspace RPC to refuse is_default=TRUE
-- ============================================================================
-- Re-creates the existing function (from 20260401120000_delete_workspace_rpc.sql)
-- with an is_default guard inserted as the FIRST check. The rest of the body
-- (role verification, transfer, membership delete, workspace delete) is
-- preserved verbatim.
CREATE OR REPLACE FUNCTION public.delete_workspace(
  p_workspace_id UUID,
  p_transfer_to_workspace_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_org_id UUID;
  v_is_default BOOLEAN;
BEGIN
  -- 0. NEW: Refuse to delete the org's default workspace.
  SELECT COALESCE(is_default, FALSE) INTO v_is_default
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_is_default THEN
    RAISE EXCEPTION 'Cannot delete the default workspace.';
  END IF;

  -- 1. Verify the caller is a workspace_owner
  SELECT role INTO v_caller_role
  FROM workspace_memberships
  WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid();

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace.';
  END IF;

  IF v_caller_role <> 'workspace_owner' THEN
    RAISE EXCEPTION 'Only workspace owners can delete a workspace.';
  END IF;

  -- 2. Get the organization_id for validation
  SELECT organization_id INTO v_org_id
  FROM workspaces
  WHERE id = p_workspace_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Workspace not found.';
  END IF;

  -- 3. If transferring recordings, move workspace_entries to the target workspace
  IF p_transfer_to_workspace_id IS NOT NULL
     AND p_transfer_to_workspace_id <> p_workspace_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = p_transfer_to_workspace_id
        AND organization_id = v_org_id
    ) THEN
      RAISE EXCEPTION 'Target workspace not found or belongs to a different organization.';
    END IF;

    UPDATE workspace_entries
    SET workspace_id = p_transfer_to_workspace_id,
        folder_id = NULL
    WHERE workspace_id = p_workspace_id;
  END IF;

  -- 4. Delete remaining workspace_entries
  DELETE FROM workspace_entries
  WHERE workspace_id = p_workspace_id;

  -- 5. Disable last-owner trigger, delete memberships, re-enable
  ALTER TABLE workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE workspace_memberships DISABLE TRIGGER prevent_last_workspace_owner_demotion;

  DELETE FROM workspace_memberships
  WHERE workspace_id = p_workspace_id;

  ALTER TABLE workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner;
  ALTER TABLE workspace_memberships ENABLE TRIGGER prevent_last_workspace_owner_demotion;

  -- 6. Delete the workspace itself
  DELETE FROM workspaces
  WHERE id = p_workspace_id;
END;
$$;

COMMENT ON FUNCTION public.delete_workspace(UUID, UUID) IS
  'Safely deletes a workspace. Refuses is_default=TRUE workspaces. Verifies caller is workspace_owner, optionally transfers recordings, then removes memberships (bypassing last-owner trigger) and the workspace row.';

GRANT EXECUTE ON FUNCTION public.delete_workspace(UUID, UUID) TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN workspace_memberships.sort_order IS
  'Per-user sidebar ordering. Lower = appears first. New memberships should set MAX(existing for that user) + 1.';
COMMENT ON COLUMN workspaces.is_default IS
  'TRUE for exactly one workspace per organization (enforced by workspaces_one_default_per_org_idx). The default workspace cannot be deleted via the delete_workspace RPC.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
