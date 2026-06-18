-- Migration: Fix OAuth token crypto lookup under pinned search_path
-- Purpose: encrypt_token/decrypt_token call pgcrypto functions (pgp_sym_encrypt,
--          armor, pgp_sym_decrypt, dearmor) UNQUALIFIED. These functions have no
--          search_path of their own, so they inherit the caller's. The
--          store_encrypted_* SECURITY DEFINER wrappers were later pinned to
--          `SET search_path = public` (Function Search Path Mutable hardening),
--          but pgcrypto is installed in the `extensions` schema on Supabase.
--          Result: every OAuth connect (Fathom/Zoom/Read.ai/Grain/Plaud) and
--          Fireflies credential store failed with:
--            42883 function pgp_sym_encrypt(text, text) does not exist
--          surfacing in the UI as "Edge Function returned a non-2xx status code".
--          Decrypt was masked by decrypt_token's WHEN OTHERS fallback (returned
--          ciphertext as-is), silently degrading refresh paths.
--
-- Fix: schema-qualify all pgcrypto calls AND pin both leaf functions to
--      `SET search_path = extensions, public` so they resolve correctly
--      regardless of the caller's search_path. This repairs every connector
--      at the shared leaf, no per-wrapper changes needed. Mirrors the precedent
--      fix in 20260601054000_fix_mcp_token_crypto_search_path.sql.
-- Author: Debug — fathom-connect-non-200 (john@clickableimpact.com incident)
-- Date: 2026-06-18

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- FUNCTION: encrypt_token — armored pgp_sym_encrypt, schema-safe
-- ============================================================================
CREATE OR REPLACE FUNCTION public.encrypt_token(plaintext TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT
SET search_path = extensions, public
AS $$
  SELECT extensions.armor(extensions.pgp_sym_encrypt(plaintext, encryption_key))
$$;

COMMENT ON FUNCTION public.encrypt_token IS 'Encrypts a plaintext string using pgp_sym_encrypt with the provided key. Returns PGP-armored text. pgcrypto resolved from extensions regardless of caller search_path.';

-- ============================================================================
-- FUNCTION: decrypt_token — armored pgp_sym_decrypt, schema-safe
-- ============================================================================
CREATE OR REPLACE FUNCTION public.decrypt_token(ciphertext TEXT, encryption_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE STRICT
SET search_path = extensions, public
AS $$
BEGIN
  -- Try to decrypt as PGP-armored ciphertext
  RETURN extensions.pgp_sym_decrypt(extensions.dearmor(ciphertext), encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    -- If decryption fails (e.g., value is still plaintext from before encryption
    -- was enabled), return the raw value as-is. This provides backward compatibility
    -- during the transition period.
    RETURN ciphertext;
END;
$$;

COMMENT ON FUNCTION public.decrypt_token IS 'Decrypts a PGP-armored ciphertext string. Falls back to returning the raw value if decryption fails. pgcrypto resolved from extensions regardless of caller search_path.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
