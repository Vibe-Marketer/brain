/**
 * OAuth Token Encryption Helpers
 *
 * Provides a consistent interface for reading OAuth tokens that may be
 * stored encrypted (via pgcrypto pgp_sym_encrypt) or as plaintext
 * (pre-encryption migration).
 *
 * Write path: use `store_encrypted_oauth_tokens` RPC directly.
 * Read path: use `getDecryptedOAuthTokens()` from this module.
 *
 * The encryption key is read from OAUTH_ENCRYPTION_KEY env var.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Read and decrypt OAuth tokens for an import source.
 * Falls back to plaintext if OAUTH_ENCRYPTION_KEY is not set or
 * the decrypt_token() SQL function falls back internally.
 */
export async function getDecryptedOAuthTokens(
  supabase: ReturnType<typeof createClient>,
  sourceId: string,
  userId: string,
): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  token_expires: number | null;
}> {
  const encryptionKey = Deno.env.get("OAUTH_ENCRYPTION_KEY");
  const client = supabase as any;

  if (encryptionKey) {
    const { data, error } = await client.rpc("get_decrypted_oauth_tokens", {
      p_source_id: sourceId,
      p_user_id: userId,
      p_encryption_key: encryptionKey,
    });

    if (!error && data && data.length > 0) {
      return {
        access_token: data[0].access_token,
        refresh_token: data[0].refresh_token,
        token_expires: data[0].token_expires,
      };
    }

    // Fall through to plaintext read on error
    if (error) {
      console.warn(
        "Decryption RPC failed, falling back to plaintext:",
        error.message,
      );
    }
  }

  // Plaintext fallback
  const { data } = await client
    .from("import_sources")
    .select("oauth_access_token, oauth_refresh_token, oauth_token_expires")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    access_token: data?.oauth_access_token ?? null,
    refresh_token: data?.oauth_refresh_token ?? null,
    token_expires: data?.oauth_token_expires ?? null,
  };
}
