-- Migration: Update folders table for vault-level organization
-- Purpose: Add vault_id and visibility columns to folders for Bank/Vault architecture
-- Phase: 09-05 - Bank/Vault Architecture
-- Date: 2026-01-31
--
-- Per CONTEXT.md:
-- - Folders can now belong to vaults for shared organization
-- - Visibility controls who can see folder contents (all_members, managers_only, owner_only)
-- - Default folder visibility: all_members (least confusing UX)

-- =============================================================================
-- ADD VAULT_ID COLUMN TO FOLDERS
-- =============================================================================
-- Add vault_id column (nullable for backward compatibility with existing user folders)
-- Folders with vault_id belong to a vault; folders without remain user-scoped

ALTER TABLE folders ADD COLUMN IF NOT EXISTS vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE;

-- =============================================================================
-- ADD VISIBILITY COLUMN TO FOLDERS
-- =============================================================================
-- Add visibility column for folder access control
-- Default to 'all_members' per CONTEXT.md for least confusing UX

ALTER TABLE folders ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'all_members' 
  CHECK (visibility IN ('all_members', 'managers_only', 'owner_only'));

-- =============================================================================
-- CREATE INDEX FOR VAULT_ID
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_folders_vault_id ON folders(vault_id);

-- =============================================================================
-- UPDATE RLS POLICIES
-- =============================================================================
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own folders" ON folders;
DROP POLICY IF EXISTS "Users can create their own folders" ON folders;
DROP POLICY IF EXISTS "Users can update their own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete their own folders" ON folders;

-- New policy: Users can view folders in vaults they belong to OR their own folders
CREATE POLICY "Users can view folders"
  ON folders FOR SELECT
  USING (
    user_id = auth.uid()
    OR (vault_id IS NOT NULL AND is_vault_member(vault_id, auth.uid()))
  );

-- Users can create folders (either personal or in vaults they're manager+ in)
CREATE POLICY "Users can create folders"
  ON folders FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      vault_id IS NULL
      OR EXISTS (
        SELECT 1 FROM vault_memberships
        WHERE vault_memberships.vault_id = folders.vault_id
          AND vault_memberships.user_id = auth.uid()
          AND vault_memberships.role IN ('vault_owner', 'vault_admin', 'manager')
      )
    )
  );

-- Users can update their own folders OR vault folders they have manager+ role
CREATE POLICY "Users can update folders"
  ON folders FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (vault_id IS NOT NULL AND is_vault_admin_or_owner(vault_id, auth.uid()))
  );

-- Users can delete their own folders OR vault folders they have admin+ role
CREATE POLICY "Users can delete folders"
  ON folders FOR DELETE
  USING (
    user_id = auth.uid()
    OR (vault_id IS NOT NULL AND is_vault_admin_or_owner(vault_id, auth.uid()))
  );

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON COLUMN folders.vault_id IS 
  'Reference to vault for shared folders. NULL for user-scoped personal folders.';
COMMENT ON COLUMN folders.visibility IS 
  'Controls who can see folder contents: all_members (default), managers_only, owner_only';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
