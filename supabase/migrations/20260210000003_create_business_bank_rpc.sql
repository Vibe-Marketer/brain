-- Migration: Create business bank RPC
-- Purpose: Provide a SECURITY DEFINER function for creating business banks with default vaults
-- Author: OpenCode
-- Date: 2026-02-10

-- =============================================================================
-- CREATE_BUSINESS_BANK RPC FUNCTION
-- =============================================================================
-- Creates a business bank with owner membership and a default team vault.
-- Returns both bank_id and vault_id for immediate client-side context switching.

CREATE OR REPLACE FUNCTION create_business_bank(
  p_name TEXT,
  p_cross_bank_default TEXT DEFAULT 'copy_only',
  p_logo_url TEXT DEFAULT NULL,
  p_default_vault_name TEXT DEFAULT NULL
)
RETURNS TABLE (bank_id UUID, vault_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_bank_id UUID;
  v_vault_id UUID;
  v_name TEXT;
  v_cross_bank_default TEXT;
  v_vault_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_name := trim(p_name);
  IF v_name IS NULL OR length(v_name) < 3 OR length(v_name) > 50 THEN
    RAISE EXCEPTION 'Organization name must be between 3 and 50 characters';
  END IF;

  v_cross_bank_default := COALESCE(p_cross_bank_default, 'copy_only');
  IF v_cross_bank_default NOT IN ('copy_only', 'copy_and_remove') THEN
    v_cross_bank_default := 'copy_only';
  END IF;

  v_vault_name := COALESCE(NULLIF(trim(p_default_vault_name), ''), v_name || '''s Vault');

  INSERT INTO banks (name, type, cross_bank_default, logo_url)
  VALUES (v_name, 'business', v_cross_bank_default, p_logo_url)
  RETURNING id INTO v_bank_id;

  INSERT INTO bank_memberships (bank_id, user_id, role)
  VALUES (v_bank_id, v_user_id, 'bank_owner');

  INSERT INTO vaults (bank_id, name, vault_type)
  VALUES (v_bank_id, v_vault_name, 'team')
  RETURNING id INTO v_vault_id;

  INSERT INTO vault_memberships (vault_id, user_id, role)
  VALUES (v_vault_id, v_user_id, 'vault_owner');

  bank_id := v_bank_id;
  vault_id := v_vault_id;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION create_business_bank IS
  'Creates a business bank, owner membership, and default team vault for the authenticated user.';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
