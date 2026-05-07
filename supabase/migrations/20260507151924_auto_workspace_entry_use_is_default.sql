-- Migration: auto_create_default_workspace_entry uses is_default
-- Purpose: Phase 27 D-05 — Phase 25 introduced is_default (with partial unique index
--          ensuring one-per-org). The original trigger (20260308100000:223) routes new
--          recordings via the legacy default flag. If a user manually flips is_default
--          to a non-Home workspace via the Phase 25 UI, new recordings continue routing
--          to the OLD legacy-default workspace. This migration switches the trigger to
--          is_default so new recordings always land in the user's chosen default.
--          Backwards-compat: Phase 25's ensure_home_workspace() always sets BOTH the
--          legacy default flag AND is_default=TRUE for new orgs, so existing data is
--          unaffected.
-- Author: Phase 27 closure
-- Date: 2026-05-07

CREATE OR REPLACE FUNCTION public.auto_create_default_workspace_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_workspace_id UUID;
BEGIN
  -- Find the DEFAULT workspace for the recording's organization (Phase 25 contract).
  SELECT id INTO v_default_workspace_id
  FROM workspaces
  WHERE organization_id = NEW.organization_id
    AND is_default = TRUE
  LIMIT 1;

  -- If no default workspace exists, silently skip (defensive).
  IF v_default_workspace_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert workspace_entry; skip if already exists.
  INSERT INTO workspace_entries (
    workspace_id,
    recording_id,
    created_at
  )
  VALUES (
    v_default_workspace_id,
    NEW.id,
    NOW()
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger attachment is unchanged (still on AFTER INSERT ON recordings) — the
-- trigger object from migration 20260308100000 still points at this function name.
-- CREATE OR REPLACE FUNCTION updates the function in-place; no DROP/CREATE TRIGGER needed.

COMMENT ON FUNCTION public.auto_create_default_workspace_entry() IS
  'Phase 27 D-05: routes new recordings via is_default (Phase 25 contract) instead of the legacy default flag. '
  'Idempotent (ON CONFLICT DO NOTHING). SECURITY DEFINER + search_path locked (T-27-02).';
