-- Migration: Fix ensure_home_workspace search_path
-- Purpose: Add SET search_path = public to the SECURITY DEFINER function
--          to prevent search_path injection attacks
-- Author: Andrew Naegele
-- Date: 2026-03-08

-- ============================================================================
-- FUNCTION: ensure_home_workspace (recreate with search_path)
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_home_workspace()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workspaces (organization_id, name, workspace_type, is_home)
  VALUES (NEW.id, 'Home Workspace', 'team', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
