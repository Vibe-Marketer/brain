-- Migration: Create ensure_personal_bank RPC for legacy user backfill
-- Purpose: Provide an idempotent function that ensures a user has a personal bank + vault.
--          Called from the frontend when useBankContext detects no banks for the user.
--          Fixes pre-Phase 9 users who never got bank/vault records created.
-- Date: 2026-02-09

-- =============================================================================
-- ENSURE_PERSONAL_BANK RPC FUNCTION
-- =============================================================================
-- This function:
--   1. Checks if the user already has a personal bank (idempotent)
--   2. If not, creates: personal bank, bank_membership, personal vault, vault_membership
--   3. Returns the bank_id (existing or newly created)
--   4. Uses SECURITY DEFINER to bypass RLS (needed for self-service creation)

CREATE OR REPLACE FUNCTION ensure_personal_bank(p_user_id UUID)
RETURNS UUID -- Returns bank_id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
BEGIN
  -- Check if user already has a personal bank
  SELECT b.id INTO v_bank_id
  FROM banks b
  JOIN bank_memberships bm ON bm.bank_id = b.id
  WHERE bm.user_id = p_user_id
    AND b.type = 'personal'
  LIMIT 1;

  -- If personal bank exists, return it (idempotent)
  IF v_bank_id IS NOT NULL THEN
    RETURN v_bank_id;
  END IF;

  -- Create personal bank
  INSERT INTO banks (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_bank_id;

  -- Create bank membership as owner
  INSERT INTO bank_memberships (bank_id, user_id, role)
  VALUES (v_bank_id, p_user_id, 'bank_owner');

  -- Check if user already has a personal vault in this bank (shouldn't happen, but defensive)
  SELECT v.id INTO v_vault_id
  FROM vaults v
  JOIN vault_memberships vm ON vm.vault_id = v.id
  WHERE vm.user_id = p_user_id
    AND v.bank_id = v_bank_id
    AND v.vault_type = 'personal'
  LIMIT 1;

  IF v_vault_id IS NULL THEN
    -- Create personal vault
    INSERT INTO vaults (bank_id, name, vault_type)
    VALUES (v_bank_id, 'My Calls', 'personal')
    RETURNING id INTO v_vault_id;

    -- Create vault membership as owner
    INSERT INTO vault_memberships (vault_id, user_id, role)
    VALUES (v_vault_id, p_user_id, 'vault_owner');
  END IF;

  RETURN v_bank_id;
END;
$$;

COMMENT ON FUNCTION ensure_personal_bank IS
  'Ensures a user has a personal bank and vault. Idempotent - returns existing bank_id if already present. Used to backfill pre-Phase 9 users.';

-- =============================================================================
-- BACKFILL: Create personal banks for all existing users who don't have one
-- =============================================================================
-- This runs once during migration to fix all 6 affected users

DO $$
DECLARE
  v_user RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN bank_memberships bm ON bm.user_id = au.id
    WHERE bm.id IS NULL
  LOOP
    PERFORM ensure_personal_bank(v_user.id);
    v_count := v_count + 1;
    RAISE NOTICE 'Created personal bank for user: % (%)', v_user.email, v_user.id;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete: % users received personal banks', v_count;
END;
$$;

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
