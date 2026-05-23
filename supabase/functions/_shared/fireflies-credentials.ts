/**
 * Fireflies credential helpers — encrypted-at-rest read/write for
 * `import_sources.api_key` and `import_sources.webhook_signing_secret`.
 *
 * Mirrors the pattern in `_shared/oauth-encrypt.ts`:
 *   - Reads `OAUTH_ENCRYPTION_KEY` from env.
 *   - When the key is set, calls the SECURITY DEFINER RPCs added in migration
 *     `20260524000000_encrypt_fireflies_credentials.sql` which wrap
 *     `pgp_sym_encrypt` / `pgp_sym_decrypt`.
 *   - Falls back to a plaintext read/write when no key is configured (local
 *     dev, CI without secrets). The `decrypt_token` SQL helper also gracefully
 *     returns plaintext if a row predates encryption, so a mixed-state table
 *     reads correctly from either branch.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseLike = ReturnType<typeof createClient>;

export interface DecryptedFirefliesCredentials {
  id: string;
  user_id: string;
  api_key: string | null;
  webhook_signing_secret: string | null;
}

export interface DecryptedFirefliesCredentialsWithPathToken extends DecryptedFirefliesCredentials {
  webhook_path_token: string | null;
}

function encryptionKey(): string | null {
  return Deno.env.get("OAUTH_ENCRYPTION_KEY") ?? null;
}

/**
 * Read the active Fireflies source for a user with plaintext credentials.
 * Returns null when the user has no active source.
 */
export async function getDecryptedFirefliesSourceForUser(
  supabase: SupabaseLike,
  userId: string,
): Promise<DecryptedFirefliesCredentials | null> {
  const client = supabase as any;
  const key = encryptionKey();

  if (key) {
    const { data, error } = await client.rpc(
      "get_decrypted_fireflies_source_for_user",
      {
        p_user_id: userId,
        p_encryption_key: key,
      },
    );
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        api_key: row.api_key ?? null,
        webhook_signing_secret: row.webhook_signing_secret ?? null,
      };
    }
    if (error) {
      console.warn(
        "Fireflies decryption RPC failed, falling back to plaintext:",
        error.message,
      );
    }
  }

  const { data: row, error: queryError } = await client
    .from("import_sources")
    .select("id, user_id, api_key, webhook_signing_secret")
    .eq("user_id", userId)
    .eq("source_app", "fireflies")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) throw queryError;
  if (!row) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    api_key: row.api_key ?? null,
    webhook_signing_secret: row.webhook_signing_secret ?? null,
  };
}

/**
 * Look up the Fireflies source addressed by a webhook path token, with the
 * api_key and webhook_signing_secret decrypted. Returns null if no active
 * source matches the token.
 */
export async function getDecryptedFirefliesSourceByPathToken(
  supabase: SupabaseLike,
  pathToken: string,
): Promise<DecryptedFirefliesCredentialsWithPathToken | null> {
  const client = supabase as any;
  const key = encryptionKey();

  if (key) {
    const { data, error } = await client.rpc(
      "get_decrypted_fireflies_source_by_path_token",
      {
        p_path_token: pathToken,
        p_encryption_key: key,
      },
    );
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0];
      return {
        id: String(row.id),
        user_id: String(row.user_id),
        api_key: row.api_key ?? null,
        webhook_signing_secret: row.webhook_signing_secret ?? null,
        webhook_path_token: row.webhook_path_token ?? null,
      };
    }
    if (error) {
      console.warn(
        "Fireflies path-token decryption RPC failed, falling back to plaintext:",
        error.message,
      );
    }
  }

  const { data: row, error: queryError } = await client
    .from("import_sources")
    .select("id, user_id, api_key, webhook_signing_secret, webhook_path_token")
    .eq("source_app", "fireflies")
    .eq("is_active", true)
    .eq("webhook_path_token", pathToken)
    .maybeSingle();

  if (queryError) throw queryError;
  if (!row) return null;
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    api_key: row.api_key ?? null,
    webhook_signing_secret: row.webhook_signing_secret ?? null,
    webhook_path_token: row.webhook_path_token ?? null,
  };
}

/**
 * List every active Fireflies source whose webhook_signing_secret is non-null,
 * with credentials decrypted. Used by the webhook signature-scan fallback for
 * legacy senders that don't include a path token.
 */
export async function listDecryptedActiveFirefliesSources(
  supabase: SupabaseLike,
): Promise<DecryptedFirefliesCredentials[]> {
  const client = supabase as any;
  const key = encryptionKey();

  if (key) {
    const { data, error } = await client.rpc(
      "list_decrypted_active_fireflies_sources",
      {
        p_encryption_key: key,
      },
    );
    if (!error && Array.isArray(data)) {
      return data.map((row: any) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        api_key: row.api_key ?? null,
        webhook_signing_secret: row.webhook_signing_secret ?? null,
      }));
    }
    if (error) {
      console.warn(
        "Fireflies list decryption RPC failed, falling back to plaintext:",
        error.message,
      );
    }
  }

  const { data: rows, error: queryError } = await client
    .from("import_sources")
    .select("id, user_id, api_key, webhook_signing_secret")
    .eq("source_app", "fireflies")
    .eq("is_active", true)
    .not("webhook_signing_secret", "is", null);

  if (queryError) throw queryError;
  return ((rows ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    api_key: (row.api_key as string | null) ?? null,
    webhook_signing_secret:
      (row.webhook_signing_secret as string | null) ?? null,
  }));
}

/**
 * Write Fireflies credentials encrypted at rest. Updates an existing
 * import_sources row in place, or inserts a new one if `existingSourceId` is
 * null. Returns the persisted row id.
 */
export async function storeEncryptedFirefliesCredentials(
  supabase: SupabaseLike,
  params: {
    existingSourceId: string | null;
    userId: string;
    accountEmail: string | null;
    apiKey: string;
    webhookSigningSecret: string;
    webhookPathToken: string;
  },
): Promise<{ id: string }> {
  const client = supabase as any;
  const key = encryptionKey();

  if (key) {
    const { data, error } = await client.rpc(
      "store_encrypted_fireflies_credentials",
      {
        p_source_id: params.existingSourceId,
        p_user_id: params.userId,
        p_account_email: params.accountEmail,
        p_api_key: params.apiKey,
        p_webhook_signing_secret: params.webhookSigningSecret,
        p_webhook_path_token: params.webhookPathToken,
        p_encryption_key: key,
      },
    );
    if (!error && data) {
      return { id: String(data) };
    }
    if (error) {
      console.warn(
        "Fireflies credential encryption RPC failed, falling back to plaintext:",
        error.message,
      );
    }
  }

  // Plaintext fallback (no encryption key configured — local dev only).
  const payload = {
    user_id: params.userId,
    source_app: "fireflies",
    account_email: params.accountEmail,
    is_active: true,
    error_message: null,
    api_key: params.apiKey,
    webhook_signing_secret: params.webhookSigningSecret,
    webhook_path_token: params.webhookPathToken,
    updated_at: new Date().toISOString(),
  };

  if (params.existingSourceId) {
    const { data, error } = await client
      .from("import_sources")
      .update(payload)
      .eq("id", params.existingSourceId)
      .eq("user_id", params.userId)
      .select("id")
      .single();
    if (error) throw error;
    return { id: String(data.id) };
  }

  const { data, error } = await client
    .from("import_sources")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return { id: String(data.id) };
}
