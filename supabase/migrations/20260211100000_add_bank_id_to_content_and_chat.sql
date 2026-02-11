-- Migration: Add bank_id to chat_sessions, content_library, content_items, and templates
-- Purpose: Enable workspace (bank) isolation for chat sessions, content library items,
--          content items (posts/emails), and templates.
--          Previously these were user-scoped only. With the bank/vault architecture,
--          each workspace must be a fully isolated environment.
-- Date: 2026-02-11

-- =============================================================================
-- ADD bank_id TO chat_sessions TABLE
-- =============================================================================

ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing chat sessions to the user's personal bank
UPDATE chat_sessions
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = chat_sessions.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned sessions whose users have no personal bank
DELETE FROM chat_sessions WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE chat_sessions ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_bank_id ON chat_sessions(bank_id);

-- Composite index for efficient workspace-scoped session queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_bank ON chat_sessions(user_id, bank_id);

-- =============================================================================
-- ADD bank_id TO content_library TABLE
-- =============================================================================

ALTER TABLE content_library ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing content library items to the user's personal bank
UPDATE content_library
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = content_library.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned content whose users have no personal bank
DELETE FROM content_library WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE content_library ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_content_library_bank_id ON content_library(bank_id);

-- Composite index for efficient workspace-scoped content queries
CREATE INDEX IF NOT EXISTS idx_content_library_user_bank ON content_library(user_id, bank_id);

-- =============================================================================
-- ADD bank_id TO content_items TABLE
-- =============================================================================

ALTER TABLE content_items ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing content items to the user's personal bank
UPDATE content_items
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = content_items.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned content items whose users have no personal bank
DELETE FROM content_items WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE content_items ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_content_items_bank_id ON content_items(bank_id);

-- Composite index for efficient workspace-scoped content item queries
CREATE INDEX IF NOT EXISTS idx_content_items_user_bank ON content_items(user_id, bank_id);

-- =============================================================================
-- ADD bank_id TO templates TABLE
-- =============================================================================

ALTER TABLE templates ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES banks(id) ON DELETE CASCADE;

-- Backfill: Assign existing templates to the user's personal bank
UPDATE templates
SET bank_id = (
  SELECT b.id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = templates.user_id
    AND b.type = 'personal'
  LIMIT 1
)
WHERE bank_id IS NULL;

-- Remove orphaned templates whose users have no personal bank
DELETE FROM templates WHERE bank_id IS NULL;

-- Make bank_id NOT NULL after backfill
ALTER TABLE templates ALTER COLUMN bank_id SET NOT NULL;

-- Add index for bank_id lookups
CREATE INDEX IF NOT EXISTS idx_templates_bank_id ON templates(bank_id);

-- Composite index for efficient workspace-scoped template queries
CREATE INDEX IF NOT EXISTS idx_templates_user_bank ON templates(user_id, bank_id);

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
