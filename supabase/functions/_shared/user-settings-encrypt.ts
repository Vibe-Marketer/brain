/**
 * User Settings Token Encryption Helpers
 *
 * Provides a consistent interface for reading OAuth tokens from user_settings that may be
 * stored encrypted (via pgcrypto pgp_sym_encrypt) or as plaintext (pre-encryption migration).
 *
 * Read path: use these helpers.
 * The encryption key is read from OAUTH_ENCRYPTION_KEY env var.
 */

/**
 * Read and decrypt Fathom OAuth tokens for a user.
 * Falls back to plaintext if OAUTH_ENCRYPTION_KEY is not set or
 * the decrypt_token() SQL function falls back internally.
 */
export async function getDecryptedUserSettingsFathomTokens(
  supabase: any,
  userId: string,
): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  token_expires: number | null;
}> {
  const encryptionKey = Deno.env.get("OAUTH_ENCRYPTION_KEY");
  const client = supabase as any;

  const { data: settings, error: settingsError } = await client
    .from('user_settings')
    .select('oauth_access_token, oauth_refresh_token, oauth_token_expires')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  if (!encryptionKey) {
    return {
      access_token: settings?.oauth_access_token ?? null,
      refresh_token: settings?.oauth_refresh_token ?? null,
      token_expires: settings?.oauth_token_expires ?? null,
    };
  }

  return {
    access_token: settings?.oauth_access_token
      ? await decryptTokenIfEncrypted(client, settings.oauth_access_token, encryptionKey)
      : null,
    refresh_token: settings?.oauth_refresh_token
      ? await decryptTokenIfEncrypted(client, settings.oauth_refresh_token, encryptionKey)
      : null,
    token_expires: settings?.oauth_token_expires ?? null,
  };
}

/**
 * Read and decrypt Zoom OAuth tokens for a user.
 * Falls back to plaintext if OAUTH_ENCRYPTION_KEY is not set or
 * the decrypt_token() SQL function falls back internally.
 */
export async function getDecryptedUserSettingsZoomTokens(
  supabase: any,
  userId: string,
): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  token_expires: number | null;
}> {
  const encryptionKey = Deno.env.get("OAUTH_ENCRYPTION_KEY");
  const client = supabase as any;

  const { data: settings, error: settingsError } = await client
    .from('user_settings')
    .select('zoom_oauth_access_token, zoom_oauth_refresh_token, zoom_oauth_token_expires')
    .eq('user_id', userId)
    .maybeSingle();

  if (settingsError) {
    throw settingsError;
  }

  if (!encryptionKey) {
    return {
      access_token: settings?.zoom_oauth_access_token ?? null,
      refresh_token: settings?.zoom_oauth_refresh_token ?? null,
      token_expires: settings?.zoom_oauth_token_expires ?? null,
    };
  }

  return {
    access_token: settings?.zoom_oauth_access_token
      ? await decryptTokenIfEncrypted(client, settings.zoom_oauth_access_token, encryptionKey)
      : null,
    refresh_token: settings?.zoom_oauth_refresh_token
      ? await decryptTokenIfEncrypted(client, settings.zoom_oauth_refresh_token, encryptionKey)
      : null,
    token_expires: settings?.zoom_oauth_token_expires ?? null,
  };
}

async function decryptTokenIfEncrypted(
  client: any,
  ciphertext: string,
  encryptionKey: string,
): Promise<string> {
  if (!ciphertext.startsWith('-----BEGIN PGP')) {
    return ciphertext;
  }

  try {
    const { data, error } = await client.rpc('decrypt_token', {
      ciphertext,
      encryption_key: encryptionKey,
    });

    if (error) {
      console.warn('Decryption RPC failed, returning ciphertext as plaintext:', error.message);
      return ciphertext;
    }

    return data as string;
  } catch (err) {
    console.error('Unexpected error during decryption:', err);
    return ciphertext;
  }
}
