-- Drop coach-related tables (no production data exists)
-- Phase 9: Bank/Vault Architecture - Plan 01 - Task 1
-- These tables are being replaced by the new Bank/Vault architecture

-- Drop coach_notes first (references coach_relationships)
DROP TABLE IF EXISTS coach_notes CASCADE;

-- Drop coach_shares (references coach_relationships)
DROP TABLE IF EXISTS coach_shares CASCADE;

-- Drop coach_relationships (base table)
DROP TABLE IF EXISTS coach_relationships CASCADE;

-- Clean up any orphaned RLS policies (the CASCADE should handle these, but just in case)
-- These will silently fail if the policies don't exist, which is fine
