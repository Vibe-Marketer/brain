-- Migration: Drop old team tables
-- Purpose: Remove legacy team infrastructure being replaced by Bank/Vault model
-- Phase: 09-05 - Bank/Vault Architecture
-- Date: 2026-01-31
--
-- Per CONTEXT.md: Teams table is dropped and rebuilt - no production usage, start fresh
-- These tables are being replaced by banks, bank_memberships, vaults, vault_memberships

-- =============================================================================
-- DROP HELPER FUNCTIONS
-- =============================================================================
-- First drop dependent functions that won't be needed anymore

DROP FUNCTION IF EXISTS is_manager_of(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS would_create_circular_hierarchy(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_team_members(UUID) CASCADE;
DROP FUNCTION IF EXISTS check_team_membership(UUID, UUID) CASCADE;

-- =============================================================================
-- DROP TRIGGERS
-- =============================================================================
-- Drop triggers before dropping tables

DROP TRIGGER IF EXISTS set_teams_updated_at ON teams;
DROP TRIGGER IF EXISTS set_manager_notes_updated_at ON manager_notes;

-- =============================================================================
-- DROP TRIGGER FUNCTIONS
-- =============================================================================
DROP FUNCTION IF EXISTS update_teams_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_manager_notes_updated_at() CASCADE;

-- =============================================================================
-- DROP TABLES
-- =============================================================================
-- Drop tables in correct order (foreign key dependencies)
-- manager_notes and team_shares depend on teams/team_memberships

DROP TABLE IF EXISTS manager_notes CASCADE;
DROP TABLE IF EXISTS team_shares CASCADE;
DROP TABLE IF EXISTS team_memberships CASCADE;
DROP TABLE IF EXISTS teams CASCADE;

-- =============================================================================
-- COMMENTS
-- =============================================================================
-- These tables have been replaced by:
-- - teams → banks + vaults
-- - team_memberships → bank_memberships + vault_memberships
-- - team_shares → vault_entries (recordings in vaults with local context)
-- - manager_notes → can be added to vault_entries.notes or separate table in future

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
