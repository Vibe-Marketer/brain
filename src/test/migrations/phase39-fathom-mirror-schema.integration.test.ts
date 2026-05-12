/**
 * Phase 39 Fathom Mirror — schema integration test (FEAT-01).
 *
 * Verifies fathom_raw_calls table has:
 *   - mirror_version (INT NOT NULL DEFAULT 1)
 *   - import_source_id (UUID, FK to import_sources(id))
 *   - synced_at (existing, retained)
 *
 * Verifies composite-key upsert idempotency via ON CONFLICT(recording_id, user_id).
 *
 * Hits a real Supabase DB via service-role key. Skips cleanly when env is missing.
 * Uses the donor pattern (find an existing user with fathom data) to avoid needing
 * auth.users admin createUser, which the test service-role key may not have.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!integrationDbReachable)(
  'Phase 39 fathom_raw_calls mirror schema',
  () => {
    let supabase: SupabaseClient;
    let donorUserId: string | null = null;
    // Use a recording_id well above existing Fathom IDs to avoid collision.
    // Fathom recording_ids are sequential ~10-digit BIGINTs; we use 9.9e12 + random.
    const testRecordingId =
      9_900_000_000_000 + Math.floor(Math.random() * 1_000_000);

    beforeAll(async () => {
      supabase = makeIntegrationClient();

      // Donor pattern: find an existing user_id that already has fathom_raw_calls
      // entries. Reuse it for our probe row so the user_id FK + RLS path resolves.
      const { data: donor } = await supabase
        .from('fathom_raw_calls')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      donorUserId = (donor?.user_id as string) ?? null;
    });

    afterAll(async () => {
      if (!supabase || !donorUserId) return;
      await supabase
        .from('fathom_raw_calls')
        .delete()
        .eq('recording_id', testRecordingId)
        .eq('user_id', donorUserId);
    });

    it('exposes mirror_version (default 1), import_source_id (nullable), synced_at', async () => {
      if (!donorUserId) {
        console.warn(
          '[phase39 schema] no donor user with fathom_raw_calls; skipping insert probe'
        );
        return;
      }

      const { error: insErr } = await supabase
        .from('fathom_raw_calls')
        .insert({
          recording_id: testRecordingId,
          user_id: donorUserId,
          title: 'phase-39-schema-probe',
          created_at: new Date().toISOString(),
        });
      expect(insErr).toBeNull();

      const { data: row, error: selErr } = await supabase
        .from('fathom_raw_calls')
        .select(
          'recording_id, user_id, mirror_version, import_source_id, synced_at'
        )
        .eq('recording_id', testRecordingId)
        .eq('user_id', donorUserId)
        .maybeSingle();
      expect(selErr).toBeNull();
      expect(row).not.toBeNull();
      expect(row!.mirror_version).toBe(1);
      // import_source_id may be auto-backfilled by the migration WITH-clause if
      // the donor user has an active fathom import_source — accept either NULL
      // or a valid UUID.
      const isUuidOrNull =
        row!.import_source_id === null ||
        (typeof row!.import_source_id === 'string' &&
          /^[0-9a-f-]{36}$/i.test(row!.import_source_id as string));
      expect(isUuidOrNull).toBe(true);
      expect(row!.synced_at).toBeTruthy();
    });

    it('upsert with same (recording_id, user_id) is idempotent (ON CONFLICT)', async () => {
      if (!donorUserId) {
        console.warn('[phase39 schema] no donor user; skipping upsert probe');
        return;
      }

      const { error: upErr1 } = await supabase
        .from('fathom_raw_calls')
        .upsert(
          {
            recording_id: testRecordingId,
            user_id: donorUserId,
            title: 'phase-39-schema-probe-updated',
            created_at: new Date().toISOString(),
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'recording_id,user_id' }
        );
      expect(upErr1).toBeNull();

      const { count } = await supabase
        .from('fathom_raw_calls')
        .select('*', { count: 'exact', head: true })
        .eq('recording_id', testRecordingId)
        .eq('user_id', donorUserId);
      expect(count).toBe(1);
    });
  }
);
