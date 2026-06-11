-- Migration: Pin search_path on SECURITY DEFINER functions
-- Purpose: Supabase security-advisor "function_search_path_mutable" fix.
--          A SECURITY DEFINER function with a mutable search_path is a real
--          privilege-escalation surface: a caller can prepend a schema they
--          control and shadow unqualified object references, executing their
--          own code with the function owner's elevated rights. Pinning
--          search_path = public closes that hole.
-- Scope:   ONLY functions that currently have NO search_path set at all
--          (pg_proc.proconfig IS NULL). Functions already pinned to an
--          explicit search_path (e.g. 'extensions, public', 'public, auth',
--          'public, pg_temp') are intentional and are deliberately left
--          untouched — forcing them to bare 'public' would change behavior.
-- Behavior: No behavior change. ALTER FUNCTION ... SET search_path is
--           idempotent; re-applying this migration is a no-op. All listed
--           functions reference objects in the public schema only.
-- Date:    2026-06-12

-- ============================================================================
-- ALTER FUNCTIONS (alphabetical by name; exact identity args from pg_proc)
-- ============================================================================

ALTER FUNCTION public.encrypt_existing_fireflies_credentials(p_key text)
  SET search_path = public;

ALTER FUNCTION public.encrypt_existing_oauth_tokens(p_key text)
  SET search_path = public;

ALTER FUNCTION public.get_decrypted_fireflies_source_by_path_token(p_path_token text, p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.get_decrypted_fireflies_source_for_user(p_user_id uuid, p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.get_decrypted_oauth_tokens(p_source_id uuid, p_user_id uuid, p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.get_unindexed_recording_ids(p_user_id uuid)
  SET search_path = public;

ALTER FUNCTION public.list_decrypted_active_fireflies_sources(p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.store_encrypted_fireflies_credentials(p_source_id uuid, p_user_id uuid, p_account_email text, p_api_key text, p_webhook_signing_secret text, p_webhook_path_token text, p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.store_encrypted_oauth_tokens(p_source_id uuid, p_user_id uuid, p_access_token text, p_refresh_token text, p_token_expires bigint, p_encryption_key text, p_is_active boolean)
  SET search_path = public;

ALTER FUNCTION public.store_encrypted_user_settings_tokens(p_user_id uuid, p_access_token text, p_refresh_token text, p_token_expires bigint, p_encryption_key text)
  SET search_path = public;

ALTER FUNCTION public.sync_profile_email()
  SET search_path = public;

ALTER FUNCTION public.verify_rpc_type_signatures()
  SET search_path = public;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
