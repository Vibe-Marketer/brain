/**
 * Phase 28 sync-all credential resolution — regression test (real DB, TEST-guarded).
 *
 * BUG: connector-sync-all's resolveJobOwnerAccessToken read only oauth_access_token
 * and fathom_api_key. API-key providers (Fireflies, Plaud) store their secret in the
 * generic `api_key` column, so server-side sync-all failed with
 * "No provider credentials for source ..." even though search/import worked.
 *
 * FIX: get_decrypted_source_credential(source_id, user_id, key) returns the first
 * available DECRYPTED credential — COALESCE(oauth_access_token, api_key, fathom_api_key).
 *
 * This test proves the resolver now READS the api_key column (the actual bug) and honors
 * the OAuth-first precedence, via a real-DB round-trip on the TEST project. The PGP
 * encryption path itself is covered by decrypt_token's plaintext-safe fallback and the
 * live prod retry; here we assert column selection + precedence deterministically.
 *
 * NEVER runs against prod: guarded by integrationDbReachable + the setup helper's
 * hard refusal when TEST url/key equal prod (see supabase/CLAUDE.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationDbReachable, makeIntegrationClient } from '../integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

const TEST_KEY = 'phase28-cred-test-key-not-a-real-secret';

describe.skipIf(!integrationDbReachable)(
  'Phase 28 — get_decrypted_source_credential (api-key provider fix)',
  () => {
    let sb: SupabaseClient;
    let donorUserId: string;
    const tempSourceIds: string[] = [];

    beforeAll(async () => {
      sb = makeIntegrationClient();
      // Donor pattern: borrow an existing user_id (import_sources FKs to auth.users).
      const { data } = await sb
        .from('import_sources')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      donorUserId = (data as { user_id?: string } | null)?.user_id ?? '';
    });

    afterAll(async () => {
      for (const id of tempSourceIds) {
        try {
          await sb.from('import_sources').delete().eq('id', id);
        } catch {
          /* absorb individual cleanup failures */
        }
      }
    });

    async function seedSource(row: Record<string, unknown>): Promise<string> {
      const { data, error } = await sb
        .from('import_sources')
        .insert({ user_id: donorUserId, is_active: true, ...row })
        .select('id')
        .single();
      if (error) throw new Error(`seed failed: ${error.message}`);
      const id = (data as { id: string }).id;
      tempSourceIds.push(id);
      return id;
    }

    it('resolves a Fireflies source whose credential lives in the api_key column (the bug)', async () => {
      if (!donorUserId) return; // no donor user on empty TEST DB — skip silently
      const id = await seedSource({ source_app: 'fireflies', api_key: 'ff-plaintext-key-123' });

      const { data, error } = await sb.rpc('get_decrypted_source_credential', {
        p_source_id: id,
        p_user_id: donorUserId,
        p_encryption_key: TEST_KEY,
      });

      expect(error).toBeNull();
      // decrypt_token returns plaintext as-is when the value isn't PGP-armored.
      expect(data).toBe('ff-plaintext-key-123');
    });

    it('prefers oauth_access_token over api_key when both are present (precedence)', async () => {
      if (!donorUserId) return;
      const id = await seedSource({
        source_app: 'zoom',
        oauth_access_token: 'oauth-token-abc',
        api_key: 'should-not-be-returned',
      });

      const { data, error } = await sb.rpc('get_decrypted_source_credential', {
        p_source_id: id,
        p_user_id: donorUserId,
        p_encryption_key: TEST_KEY,
      });

      expect(error).toBeNull();
      expect(data).toBe('oauth-token-abc');
    });

    it('returns null when the source has no credential in any column', async () => {
      if (!donorUserId) return;
      const id = await seedSource({ source_app: 'fireflies' });

      const { data, error } = await sb.rpc('get_decrypted_source_credential', {
        p_source_id: id,
        p_user_id: donorUserId,
        p_encryption_key: TEST_KEY,
      });

      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it('is scoped by user_id — a mismatched user resolves nothing (IDOR boundary)', async () => {
      if (!donorUserId) return;
      const id = await seedSource({ source_app: 'fireflies', api_key: 'ff-scoped-key' });

      const { data, error } = await sb.rpc('get_decrypted_source_credential', {
        p_source_id: id,
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_encryption_key: TEST_KEY,
      });

      expect(error).toBeNull();
      expect(data).toBeNull();
    });
  },
);
