-- Migration: Add 'youtube' to vault_type CHECK constraint
-- Purpose: Enable YouTube-specific vault type for dedicated video intelligence UX
-- Phase: 10.3 - YouTube-Specific Vaults & Video Intelligence
-- Date: 2026-02-11

-- =============================================================================
-- UPDATE VAULT_TYPE CHECK CONSTRAINT
-- =============================================================================

-- Drop existing constraint that only allows: personal, team, coach, community, client
ALTER TABLE vaults DROP CONSTRAINT IF EXISTS vaults_vault_type_check;

-- Add updated constraint with 'youtube' included
ALTER TABLE vaults ADD CONSTRAINT vaults_vault_type_check
  CHECK (vault_type IN ('personal', 'team', 'coach', 'community', 'client', 'youtube'));

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON COLUMN vaults.vault_type IS 'Type of vault: personal, team, coach, community, client, youtube';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
