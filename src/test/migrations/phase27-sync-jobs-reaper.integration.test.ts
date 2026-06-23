/**
 * Phase 27 Plan 27-02 (JOB-02) — sync_jobs zombie reaper, real-DB proof.
 *
 * Proves the `reap_stale_sync_jobs()` pg function (migration
 * 20260623120000_sync_jobs_reaper.sql) flips stale `processing` jobs to
 * `failed` while sparing healthy jobs, and is idempotent.
 *
 * REAL DB ONLY — zero mocks (Phase 30 / BUG-01: mocks are rejected for
 * integration tests). Runs against the SEPARATE TEST project; the TEST-ref
 * guard in integration-setup.ts throws if the TEST URL/key equals prod
 * (PROD ref vltmrnjsubfzrgrtdqey must NEVER be targeted).
 *
 * IMPORTANT — RPC resolution: `reap_stale_sync_jobs()` only resolves once the
 * migration has been applied to the TEST project (`supabase db push --linked`
 * against the TEST ref). That push is performed by the [BLOCKING] Plan 27-04.
 * Until then, the reaper-invoking cases surface a CLEAR RPC error (function not
 * found) rather than a false pass — they are NOT silently mocked. When the
 * integration env is unset, the whole suite cleanly SKIPS (no failure).
 *
 * Donor pattern for user_id: read one existing sync_jobs row's user_id (fallback
 * to fathom_raw_calls) to satisfy the user_id FK without auth admin createUser.
 * Seed/cleanup go through the service-role client (RLS bypassed — fine for
 * seeding; the reaper itself runs SECURITY DEFINER).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!integrationDbReachable)(
  'Phase 27 sync_jobs zombie reaper (reap_stale_sync_jobs)',
  () => {
    let supabase: SupabaseClient;
    let donorUserId: string | null = null;
    const seededJobIds: string[] = [];

    const minutesAgo = (m: number) =>
      new Date(Date.now() - m * 60_000).toISOString();

    // Insert a sync_jobs row with explicit timing; track id for cleanup.
    async function seedJob(fields: {
      status: string;
      last_heartbeat_at: string | null;
      created_at?: string;
    }): Promise<string | null> {
      if (!donorUserId) return null;
      const id = randomUUID();
      const { error } = await supabase.from('sync_jobs').insert({
        id,
        user_id: donorUserId,
        recording_ids: [],
        status: fields.status,
        progress_current: 0,
        progress_total: 0,
        type: 'fathom',
        last_heartbeat_at: fields.last_heartbeat_at,
        ...(fields.created_at ? { created_at: fields.created_at } : {}),
      });
      if (error) {
        throw new Error(`seedJob failed: ${error.message}`);
      }
      seededJobIds.push(id);
      return id;
    }

    async function getJob(id: string) {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('status, error, completed_at, last_heartbeat_at')
        .eq('id', id)
        .single();
      expect(error).toBeNull();
      return data;
    }

    async function runReaper() {
      const { error } = await supabase.rpc('reap_stale_sync_jobs');
      // If the migration has NOT yet been applied to TEST (pre Plan 27-04),
      // this returns a clear "function not found" error — surfaced, not faked.
      expect(error).toBeNull();
    }

    beforeAll(async () => {
      supabase = makeIntegrationClient();

      // Donor pattern: find a user_id that already has data.
      const { data: jobDonor } = await supabase
        .from('sync_jobs')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      donorUserId = (jobDonor?.user_id as string) ?? null;

      if (!donorUserId) {
        const { data: callDonor } = await supabase
          .from('fathom_raw_calls')
          .select('user_id')
          .limit(1)
          .maybeSingle();
        donorUserId = (callDonor?.user_id as string) ?? null;
      }
    });

    afterAll(async () => {
      if (!supabase || seededJobIds.length === 0) return;
      for (const id of seededJobIds) {
        try {
          await supabase.from('sync_jobs').delete().eq('id', id);
        } catch {
          // absorb individual cleanup failures (cleanup contract)
        }
      }
    });

    it('case 1 — STALE heartbeat: processing → failed', async () => {
      if (!donorUserId) {
        console.warn('[phase27 reaper] no donor user; skipping');
        return;
      }
      const id = await seedJob({
        status: 'processing',
        last_heartbeat_at: minutesAgo(10),
      });
      expect(id).toBeTruthy();

      await runReaper();

      const row = await getJob(id!);
      expect(row.status).toBe('failed');
      expect((row.error ?? '').toLowerCase()).toContain('no heartbeat');
      expect(row.completed_at).not.toBeNull();
    });

    it('case 2 — FRESH heartbeat: processing untouched', async () => {
      if (!donorUserId) return;
      const id = await seedJob({
        status: 'processing',
        last_heartbeat_at: new Date().toISOString(),
      });
      expect(id).toBeTruthy();

      await runReaper();

      const row = await getJob(id!);
      expect(row.status).toBe('processing');
    });

    it('case 3 — NULL heartbeat + old created_at: absolute fallback reaps', async () => {
      if (!donorUserId) return;
      const id = await seedJob({
        status: 'processing',
        last_heartbeat_at: null,
        created_at: minutesAgo(20),
      });
      expect(id).toBeTruthy();

      await runReaper();

      const row = await getJob(id!);
      expect(row.status).toBe('failed');
    });

    it('case 4 — NULL heartbeat + young created_at: spared', async () => {
      if (!donorUserId) return;
      const id = await seedJob({
        status: 'processing',
        last_heartbeat_at: null,
        created_at: minutesAgo(2),
      });
      expect(id).toBeTruthy();

      await runReaper();

      const row = await getJob(id!);
      expect(row.status).toBe('processing');
    });

    it('case 5 — IDEMPOTENT: already-failed row is not re-touched', async () => {
      if (!donorUserId) return;
      const id = await seedJob({
        status: 'processing',
        last_heartbeat_at: minutesAgo(10),
      });
      expect(id).toBeTruthy();

      // First run reaps it to failed.
      await runReaper();
      const first = await getJob(id!);
      expect(first.status).toBe('failed');
      const firstCompletedAt = first.completed_at;
      const firstError = first.error;

      // Second run: predicate only matches status='processing', so this row
      // (now 'failed') must be untouched — completed_at and error unchanged.
      await runReaper();
      const second = await getJob(id!);
      expect(second.status).toBe('failed');
      expect(second.completed_at).toBe(firstCompletedAt);
      expect(second.error).toBe(firstError);
    });
  }
);
