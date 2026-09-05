/**
 * IDENT-03 confirm-email-alias-verification regression test (Phase 34, Plan 03).
 *
 * confirm-email-alias-verification/index.ts is a Deno edge function
 * (Deno.serve + esm.sh URL imports) and cannot be invoked directly from
 * Node/vitest -- there is no local Deno function server running (Docker is
 * not running on this machine; see supabase/CLAUDE.md). Consistent with this
 * repo's existing integration-test pattern for schema/RPC contracts
 * (identity-schema-noop.integration.test.ts, identity-evidence-rpc.
 * integration.test.ts from Plan 02), this file proves the DATA CONTRACT the
 * confirm function relies on and produces, replicating its hash-compare +
 * get-or-create-identity + verified-alias-upsert + pending-row-delete
 * sequence directly against a REAL TEST database via the service-role admin
 * client: happy path, expiry, the 5-attempt brute-force cap, and
 * identity_alias_verifications' client-deny RLS posture. The confirm
 * function's own auth/Zod/HTTP wrapping is covered by the acceptance grep
 * (no `updateUser`, no direct write to the Supabase-managed users table) --
 * this file's job is the security-critical DB contract.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and supabase/CLAUDE.md
 * "Running integration tests safely". No fallback to production-like env vars.
 *
 * otp.ts and confirm-email-alias-verification/index.ts do not exist yet --
 * this file is expected to fail to even resolve its `hashCode` import (RED)
 * until Task 2/3 create them (34-03-PLAN.md Task 1).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup';
import { hashCode } from '../../_shared/otp.ts';

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || '';
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || '';

const SUITE_TAG = '[phase-34-03 confirm-email-alias]';
const KNOWN_CODE = '482913';
const CODE_EXPIRY_MS = 10 * 60_000;

/**
 * Replicates confirm-email-alias-verification/index.ts's contract: look up
 * the pending row, reject on missing/expired, hash-compare with an attempt
 * cap, then on match get-or-create the identity, upsert a verified email
 * alias, and delete the pending row. See file header for why this is
 * exercised directly rather than via an HTTP call to the Deno function.
 */
async function attemptConfirm(
  admin: SupabaseClient,
  userId: string,
  email: string,
  submittedCode: string,
): Promise<{ ok: boolean; status: number; identityId?: string }> {
  const pending = await admin
    .from('identity_alias_verifications')
    .select('id, code_hash, expires_at, attempts')
    .eq('user_id', userId)
    .eq('email', email)
    .maybeSingle();

  if (pending.error) {
    throw new Error(`${SUITE_TAG} pending lookup failed: ${pending.error.message}`);
  }
  if (!pending.data) {
    return { ok: false, status: 400 };
  }

  if (new Date(pending.data.expires_at as string).getTime() < Date.now()) {
    await admin.from('identity_alias_verifications').delete().eq('id', pending.data.id);
    return { ok: false, status: 410 };
  }

  const submittedHash = await hashCode(submittedCode);
  if (submittedHash !== pending.data.code_hash) {
    const newAttempts = (pending.data.attempts as number) + 1;
    if (newAttempts >= 5) {
      await admin.from('identity_alias_verifications').delete().eq('id', pending.data.id);
      return { ok: false, status: 400 };
    }
    await admin
      .from('identity_alias_verifications')
      .update({ attempts: newAttempts })
      .eq('id', pending.data.id);
    return { ok: false, status: 400 };
  }

  let identityId: string;
  const existingIdentity = await admin
    .from('identities')
    .select('id')
    .eq('owner_user_id', userId)
    .limit(1)
    .maybeSingle();
  if (existingIdentity.error) {
    throw new Error(`${SUITE_TAG} identity lookup failed: ${existingIdentity.error.message}`);
  }

  if (existingIdentity.data) {
    identityId = existingIdentity.data.id as string;
  } else {
    const created = await admin.from('identities').insert({ owner_user_id: userId }).select('id').single();
    if (created.error || !created.data) {
      throw new Error(`${SUITE_TAG} identity create failed: ${created.error?.message}`);
    }
    identityId = created.data.id as string;
  }

  const existingAlias = await admin
    .from('identity_aliases')
    .select('id, identity_id')
    .eq('alias_type', 'email')
    .eq('value', email)
    .eq('verified', true)
    .maybeSingle();
  if (existingAlias.error) {
    throw new Error(`${SUITE_TAG} alias lookup failed: ${existingAlias.error.message}`);
  }

  if (existingAlias.data && existingAlias.data.identity_id !== identityId) {
    return { ok: false, status: 409, identityId };
  }

  if (existingAlias.data) {
    const upd = await admin
      .from('identity_aliases')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
        confidence: 1.0,
        evidence: 'verified email',
      })
      .eq('id', existingAlias.data.id);
    if (upd.error) throw new Error(`${SUITE_TAG} alias update failed: ${upd.error.message}`);
  } else {
    const ins = await admin.from('identity_aliases').insert({
      identity_id: identityId,
      alias_type: 'email',
      value: email,
      verified: true,
      verified_at: new Date().toISOString(),
      confidence: 1.0,
      evidence: 'verified email',
    });
    if (ins.error) throw new Error(`${SUITE_TAG} alias insert failed: ${ins.error.message}`);
  }

  await admin.from('identity_alias_verifications').delete().eq('id', pending.data.id);

  return { ok: true, status: 200, identityId };
}

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} IDENT-03 happy path, expiry, attempt-cap, client-deny RLS`,
  () => {
    const admin = makeIntegrationClient();

    let userId = '';
    let userEmail = '';
    const userPassword = `phase34-otp-confirm-${Date.now()}-pwd!`;
    let userClient: SupabaseClient;

    const createdIdentityIds: string[] = [];

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY env vars (dedicated test project only -- no prod fallback)`,
        );
      }

      const stamp = Date.now();
      userEmail = `phase34-otp-confirm-${stamp}@callvault.test`;

      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      if (createUser.error || !createUser.data.user) {
        throw new Error(`${SUITE_TAG} createUser failed: ${createUser.error?.message}`);
      }
      userId = createUser.data.user.id;

      userClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await userClient.auth.signInWithPassword({ email: userEmail, password: userPassword });
      if (signIn.error) throw new Error(`${SUITE_TAG} signIn failed: ${signIn.error.message}`);
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      try {
        for (const id of createdIdentityIds) {
          await admin.from('identity_aliases').delete().eq('identity_id', id);
          await admin.from('identities').delete().eq('id', id);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} identity cleanup threw:`, err);
      }

      try {
        await admin.from('identity_alias_verifications').delete().eq('user_id', userId);
      } catch (err) {
        console.warn(`${SUITE_TAG} pending-row cleanup threw:`, err);
      }

      try {
        const { error } = await admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 });
        if (error) {
          console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC failed:`, error.message);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} cleanup threw:`, err);
      }
    });

    it('happy path: correct code links a verified email to a new identity', async () => {
      const email = `phase34-otp-happy-${Date.now()}@example.com`;
      const codeHash = await hashCode(KNOWN_CODE);

      const seed = await admin.from('identity_alias_verifications').insert({
        user_id: userId,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + CODE_EXPIRY_MS).toISOString(),
        attempts: 0,
      });
      if (seed.error) throw new Error(`${SUITE_TAG} seed failed: ${seed.error.message}`);

      const result = await attemptConfirm(admin, userId, email, KNOWN_CODE);
      expect(result.ok).toBe(true);
      expect(result.identityId).toBeTruthy();
      if (result.identityId) createdIdentityIds.push(result.identityId);

      const identity = await admin
        .from('identities')
        .select('owner_user_id')
        .eq('id', result.identityId as string)
        .single();
      expect(identity.data?.owner_user_id).toBe(userId);

      const alias = await admin
        .from('identity_aliases')
        .select('verified, alias_type, value')
        .eq('identity_id', result.identityId as string)
        .eq('alias_type', 'email')
        .single();
      expect(alias.data?.verified).toBe(true);
      expect(alias.data?.value).toBe(email);

      const pending = await admin
        .from('identity_alias_verifications')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle();
      expect(pending.data).toBeNull();
    });

    it('expiry: an expired pending row is rejected and creates no alias', async () => {
      const email = `phase34-otp-expired-${Date.now()}@example.com`;
      const codeHash = await hashCode(KNOWN_CODE);

      const seed = await admin.from('identity_alias_verifications').insert({
        user_id: userId,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
        attempts: 0,
      });
      if (seed.error) throw new Error(`${SUITE_TAG} seed failed: ${seed.error.message}`);

      const result = await attemptConfirm(admin, userId, email, KNOWN_CODE);
      expect(result.ok).toBe(false);

      const alias = await admin
        .from('identity_aliases')
        .select('id')
        .eq('alias_type', 'email')
        .eq('value', email)
        .maybeSingle();
      expect(alias.data).toBeNull();
    });

    it('attempt-cap: 5 wrong submissions invalidate the row; a 6th correct submission is rejected', async () => {
      const email = `phase34-otp-attemptcap-${Date.now()}@example.com`;
      const codeHash = await hashCode(KNOWN_CODE);

      const seed = await admin.from('identity_alias_verifications').insert({
        user_id: userId,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + CODE_EXPIRY_MS).toISOString(),
        attempts: 0,
      });
      if (seed.error) throw new Error(`${SUITE_TAG} seed failed: ${seed.error.message}`);

      for (let i = 0; i < 5; i++) {
        const wrong = await attemptConfirm(admin, userId, email, '000000');
        expect(wrong.ok).toBe(false);
      }

      const pendingAfterCap = await admin
        .from('identity_alias_verifications')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email)
        .maybeSingle();
      expect(pendingAfterCap.data).toBeNull();

      const sixth = await attemptConfirm(admin, userId, email, KNOWN_CODE);
      expect(sixth.ok).toBe(false);

      const alias = await admin
        .from('identity_aliases')
        .select('id')
        .eq('alias_type', 'email')
        .eq('value', email)
        .maybeSingle();
      expect(alias.data).toBeNull();
    });

    it('client-deny RLS: an authenticated JWT reads ZERO rows from identity_alias_verifications', async () => {
      const email = `phase34-otp-clientdeny-${Date.now()}@example.com`;
      const codeHash = await hashCode(KNOWN_CODE);

      const seed = await admin.from('identity_alias_verifications').insert({
        user_id: userId,
        email,
        code_hash: codeHash,
        expires_at: new Date(Date.now() + CODE_EXPIRY_MS).toISOString(),
        attempts: 0,
      });
      if (seed.error) throw new Error(`${SUITE_TAG} seed failed: ${seed.error.message}`);

      try {
        const { data, error } = await userClient
          .from('identity_alias_verifications')
          .select('*')
          .eq('user_id', userId)
          .eq('email', email);

        // A denial can surface as a Postgres/RLS error rather than an empty
        // result set depending on driver behavior -- either is an acceptable
        // client-deny outcome as long as zero rows are ever exposed.
        if (!error) {
          expect(data ?? []).toHaveLength(0);
        }
      } finally {
        await admin.from('identity_alias_verifications').delete().eq('user_id', userId).eq('email', email);
      }
    });
  },
);
