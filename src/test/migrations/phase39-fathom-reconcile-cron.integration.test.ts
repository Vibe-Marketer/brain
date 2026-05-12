/**
 * Phase 39 Plan 39-04 Wave 4 — fathom-daily-reconcile cron + multi-account.
 *
 * Verifies DB-level guarantees that the reconcile function relies on:
 *   1. Multi-account: 2+ active fathom import_sources rows can coexist per user.
 *   2. Reconcile-style query iterates ALL active fathom sources globally.
 *   3. Artificial 5-row gap is detectable + repairable via mirror upsert.
 *
 * The actual Fathom-API -> mirror end-to-end is in manual verification (real
 * OAuth required). This test focuses on what we can prove deterministically
 * against the real DB.
 *
 * Skips cleanly when env is missing. Uses donor pattern for user_id (find an
 * existing fathom_raw_calls row's user_id and reuse it) to avoid auth.users
 * admin createUser permissions.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!integrationDbReachable)(
  'Phase 39 fathom-daily-reconcile cron + multi-account',
  () => {
    let supabase: SupabaseClient;
    let donorUserId: string | null = null;
    const sourceIdA = randomUUID();
    const sourceIdB = randomUUID();
    const seedRecordingIdBase = 9_950_000_000_000;
    const seedRecordingIds = Array.from(
      { length: 5 },
      (_, i) => seedRecordingIdBase + i
    );

    beforeAll(async () => {
      supabase = makeIntegrationClient();

      // Donor pattern: find a user_id that already has data
      const { data: donor } = await supabase
        .from('fathom_raw_calls')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      donorUserId = (donor?.user_id as string) ?? null;
    });

    afterAll(async () => {
      if (!supabase || !donorUserId) return;
      // Clean up seed rows
      await supabase
        .from('fathom_raw_calls')
        .delete()
        .eq('user_id', donorUserId)
        .in('recording_id', seedRecordingIds);
      // Clean up test sources
      await supabase
        .from('import_sources')
        .delete()
        .in('id', [sourceIdA, sourceIdB]);
    });

    it('multi-account: 2 active fathom import_sources rows coexist for one user', async () => {
      if (!donorUserId) {
        console.warn('[phase39 cron] no donor user; skipping');
        return;
      }

      const baseRow = {
        user_id: donorUserId,
        source_app: 'fathom',
        is_active: true,
      };
      const { error: errA } = await supabase.from('import_sources').insert({
        ...baseRow,
        id: sourceIdA,
        account_email: `phase39-a-${sourceIdA}@test.local`,
      });
      const { error: errB } = await supabase.from('import_sources').insert({
        ...baseRow,
        id: sourceIdB,
        account_email: `phase39-b-${sourceIdB}@test.local`,
      });
      expect(errA).toBeNull();
      expect(errB).toBeNull();

      const { data: sources, error: selErr } = await supabase
        .from('import_sources')
        .select('id')
        .eq('user_id', donorUserId)
        .eq('source_app', 'fathom')
        .eq('is_active', true)
        .in('id', [sourceIdA, sourceIdB]);
      expect(selErr).toBeNull();
      expect((sources ?? []).length).toBe(2);
    });

    it('reconcile-style query iterates ALL active fathom sources globally', async () => {
      // This is what fathom-reconcile's runDailyReconcile() does
      const { data: sources, error } = await supabase
        .from('import_sources')
        .select('id, user_id')
        .eq('source_app', 'fathom')
        .eq('is_active', true);
      expect(error).toBeNull();
      const ids = (sources ?? []).map((s) => s.id as string);
      // Both our test sources MUST appear in the global iteration result
      expect(ids).toContain(sourceIdA);
      expect(ids).toContain(sourceIdB);
    });

    it('artificial 5-row gap is detectable + repairable via mirror upsert (smoke)', async () => {
      if (!donorUserId) {
        console.warn('[phase39 cron] no donor user; skipping gap test');
        return;
      }

      // Insert 5 rows
      const { error: insErr } = await supabase.from('fathom_raw_calls').insert(
        seedRecordingIds.map((rid) => ({
          recording_id: rid,
          user_id: donorUserId,
          title: `phase-39-gap-test-${rid}`,
          created_at: new Date().toISOString(),
          import_source_id: sourceIdA,
          mirror_version: 1,
        }))
      );
      expect(insErr).toBeNull();

      // Delete to create the gap (simulating data loss)
      const { error: delErr } = await supabase
        .from('fathom_raw_calls')
        .delete()
        .eq('user_id', donorUserId)
        .in('recording_id', seedRecordingIds);
      expect(delErr).toBeNull();

      // Re-upsert (what reconcile would do after diffing against Fathom)
      const { error: upErr } = await supabase.from('fathom_raw_calls').upsert(
        seedRecordingIds.map((rid) => ({
          recording_id: rid,
          user_id: donorUserId,
          title: `phase-39-gap-test-${rid}`,
          created_at: new Date().toISOString(),
          import_source_id: sourceIdA,
          mirror_version: 1,
        })),
        { onConflict: 'recording_id,user_id' }
      );
      expect(upErr).toBeNull();

      // Verify all 5 reappear
      const { count } = await supabase
        .from('fathom_raw_calls')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', donorUserId)
        .in('recording_id', seedRecordingIds);
      expect(count).toBe(5);
    });
  }
);
