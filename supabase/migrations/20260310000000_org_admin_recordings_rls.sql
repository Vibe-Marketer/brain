-- Migration: Confirm org admin recordings RLS
-- Purpose: The "Org admins can view all recordings" policy was already created
--          in migration 20260308000002_tighten_recordings_select_rls.sql.
--          This migration is intentionally a no-op to preserve the migration number.
--          No additional policy is needed — the existing policy covers org admins.
-- Closes: #100
-- Date: 2026-03-10

-- Policy already in place from 20260308000002:
--   CREATE POLICY "Org admins can view all recordings"
--     ON recordings FOR SELECT
--     USING (is_organization_admin_or_owner(organization_id, auth.uid()));
--
-- Drop the duplicate policy if this migration was previously applied with the wrong name.
DROP POLICY IF EXISTS "Org admins can view all recordings in their org" ON recordings;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
