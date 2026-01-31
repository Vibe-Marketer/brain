-- Migration: Update signup trigger to create personal bank and vault
-- Purpose: Ensure new users automatically get their personal bank and vault on signup
-- Phase: 09-05 - Bank/Vault Architecture
-- Date: 2026-01-31

-- =============================================================================
-- UPDATE handle_new_user() FUNCTION
-- =============================================================================
-- Per CONTEXT.md: Personal Bank auto-created for every new user at signup
-- This extends the existing handle_new_user() trigger to also create:
-- 1. Personal bank named "Personal" with type='personal'
-- 2. Bank membership as bank_owner
-- 3. Personal vault named "My Calls" with vault_type='personal'
-- 4. Vault membership as vault_owner

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bank_id UUID;
  v_vault_id UUID;
BEGIN
  -- Insert profile for new user (existing logic)
  INSERT INTO public.user_profiles (user_id, email, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    false
  );
  
  -- Assign default FREE role (existing logic)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'FREE')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- NEW: Create personal bank for new user
  INSERT INTO banks (name, type)
  VALUES ('Personal', 'personal')
  RETURNING id INTO v_bank_id;
  
  -- NEW: Create bank membership as owner
  INSERT INTO bank_memberships (bank_id, user_id, role)
  VALUES (v_bank_id, NEW.id, 'bank_owner');
  
  -- NEW: Create default personal vault (named "My Calls" per CONTEXT.md)
  INSERT INTO vaults (bank_id, name, vault_type)
  VALUES (v_bank_id, 'My Calls', 'personal')
  RETURNING id INTO v_vault_id;
  
  -- NEW: Create vault membership as owner
  INSERT INTO vault_memberships (vault_id, user_id, role)
  VALUES (v_vault_id, NEW.id, 'vault_owner');
  
  RETURN NEW;
END;
$$;

-- Update comment to reflect new behavior
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Automatically create user profile, FREE role, personal bank, and personal vault on signup';

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
