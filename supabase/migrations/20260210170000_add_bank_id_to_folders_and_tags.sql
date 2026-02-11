-- Migration: Add bank_id to folders and call_tags for workspace scoping
-- Purpose: Enable workspace (bank) isolation for folders and tags.
--          Previously, folders and tags were user-scoped only. With the bank/vault
--          architecture, each workspace must be a fully isolated environment.
-- Date: 2026-02-10

-- =============================================================================
-- ADD bank_id TO folders TABLE
-- =============================================================================

ALTER TABLE folders ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing folders to the user's personal bank
UPDATE folders
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = folders.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned folders whose users have no personal bank (can't assign a workspace)
DELETE FROM folders WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE folders ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_folders_bank_id ON folders(bank_id);

-- Composite index for efficient workspace-scoped folder queries
CREATE INDEX IF NOT EXISTS idx_folders_user_bank ON folders(user_id, bank_id);

-- Update unique constraint to be bank-scoped instead of just user-scoped
-- Drop old constraint, add new one
ALTER TABLE folders DROP CONSTRAINT IF EXISTS folders_user_id_name_parent_id_key;
ALTER TABLE folders ADD CONSTRAINT folders_user_id_bank_id_name_parent_id_key 
  UNIQUE(user_id, bank_id, name, parent_id);

-- =============================================================================
-- ADD bank_id TO call_tags TABLE
-- =============================================================================

ALTER TABLE call_tags ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing tags to the user's personal bank
UPDATE call_tags
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = call_tags.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned tags whose users have no personal bank (can't assign a workspace)
DELETE FROM call_tags WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE call_tags ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups  
CREATE INDEX IF NOT EXISTS idx_call_tags_bank_id ON call_tags(bank_id);

-- Composite index for efficient workspace-scoped tag queries
CREATE INDEX IF NOT EXISTS idx_call_tags_user_bank ON call_tags(user_id, bank_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
