/**
 * Phase 40 Fathom Refresh — preservation invariants integration test (FEAT-02).
 *
 * Verifies that the same UPDATE + UPSERT statements `fathom-refresh` runs:
 *   1. Overwrite ONLY: title, full_transcript, summary, duration,
 *      recording_end_time, synced_at, source_metadata.
 *   2. Preserve: id, organization_id, owner_user_id, legacy_recording_id,
 *      source_app, source_call_id, created_at, plus workspace_entries,
 *      folder_assignments, and call_tag_assignments rows.
 *
 * Hits a real Supabase DB via service-role key. Skips cleanly when env is missing.
 * Uses the donor pattern (find an existing user with fathom data) to avoid needing
 * auth.users admin privileges.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../integration-setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe.skipIf(!integrationDbReachable)(
  'Phase 40 fathom-refresh preservation invariants',
  () => {
    let supabase: SupabaseClient;
    let donorUserId: string | null = null;
    let donorOrgId: string | null = null;
    let donorWorkspaceId: string | null = null;

    // Synthetic IDs well above Fathom's real range
    const testLegacyId = 9_910_000_000_000 + Math.floor(Math.random() * 1_000_000);
    let testRecordingUuid: string | null = null;
    let testFolderId: string | null = null;
    let testTagId: string | null = null;

    beforeAll(async () => {
      supabase = makeIntegrationClient();

      // Donor: find an existing user that already has fathom data + a personal org
      const { data: donor } = await supabase
        .from('recordings')
        .select('owner_user_id, organization_id')
        .eq('source_app', 'fathom')
        .not('legacy_recording_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (!donor) {
        console.warn('[phase40] no donor user with fathom data; skipping');
        return;
      }

      donorUserId = donor.owner_user_id as string;
      donorOrgId = donor.organization_id as string;

      // Find or create a workspace for the donor
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', donorOrgId)
        .limit(1)
        .maybeSingle();
      donorWorkspaceId = (ws?.id as string) ?? null;

      // Create the test recording with a known starting state
      const beforeCreatedAt = new Date('2024-01-01T00:00:00Z').toISOString();
      const { data: inserted, error: insErr } = await supabase
        .from('recordings')
        .insert({
          organization_id: donorOrgId,
          owner_user_id: donorUserId,
          title: 'phase-40-PRE',
          full_transcript: 'PRE transcript',
          summary: 'PRE summary',
          duration: 100,
          source_app: 'fathom',
          source_call_id: String(testLegacyId),
          legacy_recording_id: testLegacyId,
          recording_start_time: beforeCreatedAt,
          source_metadata: { external_id: String(testLegacyId), keep_me: 'PRE' },
          created_at: beforeCreatedAt,
        })
        .select('id, created_at')
        .single();
      expect(insErr).toBeNull();
      testRecordingUuid = inserted!.id as string;

      // Add a workspace_entry (invariant target)
      if (donorWorkspaceId) {
        await supabase.from('workspace_entries').insert({
          workspace_id: donorWorkspaceId,
          recording_id: testRecordingUuid,
        });
      }

      // Add a folder + folder_assignment (invariant target)
      const { data: folder } = await supabase
        .from('folders')
        .insert({
          name: 'phase-40-test-folder',
          organization_id: donorOrgId,
        })
        .select('id')
        .maybeSingle();
      if (folder) {
        testFolderId = folder.id as string;
        await supabase.from('folder_assignments').insert({
          folder_id: testFolderId,
          call_recording_id: testLegacyId,
          organization_id: donorOrgId,
        });
      }

      // Add a tag + assignment (invariant target)
      const { data: tag } = await supabase
        .from('tags')
        .insert({
          name: `phase-40-test-tag-${Math.floor(Math.random() * 1_000_000)}`,
          organization_id: donorOrgId,
        })
        .select('id')
        .maybeSingle();
      if (tag) {
        testTagId = tag.id as string;
        await supabase.from('call_tag_assignments').insert({
          tag_id: testTagId,
          recording_id: testRecordingUuid,
        });
      }
    });

    afterAll(async () => {
      if (!supabase) return;
      if (testRecordingUuid) {
        await supabase.from('call_tag_assignments').delete().eq('recording_id', testRecordingUuid);
        await supabase.from('workspace_entries').delete().eq('recording_id', testRecordingUuid);
        await supabase.from('recordings').delete().eq('id', testRecordingUuid);
      }
      if (testFolderId) {
        await supabase.from('folder_assignments').delete().eq('folder_id', testFolderId);
        await supabase.from('folders').delete().eq('id', testFolderId);
      }
      if (testTagId) {
        await supabase.from('tags').delete().eq('id', testTagId);
      }
      if (donorUserId) {
        await supabase
          .from('fathom_raw_calls')
          .delete()
          .eq('recording_id', testLegacyId)
          .eq('user_id', donorUserId);
      }
    });

    it('overwrites ONLY title, full_transcript, summary, duration, recording_end_time, synced_at, source_metadata', async () => {
      if (!testRecordingUuid || !donorUserId) {
        console.warn('[phase40] no fixture; skipping');
        return;
      }

      // Snapshot the PRE state
      const { data: pre } = await supabase
        .from('recordings')
        .select(
          'id, organization_id, owner_user_id, legacy_recording_id, source_app, source_call_id, created_at, title, full_transcript, summary, duration',
        )
        .eq('id', testRecordingUuid)
        .single();

      expect(pre!.title).toBe('phase-40-PRE');

      // Run the same UPDATE the edge function would run
      const syncedAt = new Date().toISOString();
      const { error: upErr } = await supabase
        .from('recordings')
        .update({
          title: 'phase-40-POST',
          full_transcript: 'POST transcript',
          summary: 'POST summary',
          duration: 200,
          recording_end_time: new Date('2024-01-01T00:03:20Z').toISOString(),
          synced_at: syncedAt,
          source_metadata: { external_id: String(testLegacyId), keep_me: 'PRE', synced_at: syncedAt },
        })
        .eq('id', testRecordingUuid)
        .eq('owner_user_id', donorUserId);
      expect(upErr).toBeNull();

      // Read POST state
      const { data: post } = await supabase
        .from('recordings')
        .select(
          'id, organization_id, owner_user_id, legacy_recording_id, source_app, source_call_id, created_at, title, full_transcript, summary, duration, recording_end_time, synced_at, source_metadata',
        )
        .eq('id', testRecordingUuid)
        .single();

      // PRESERVED
      expect(post!.id).toBe(pre!.id);
      expect(post!.organization_id).toBe(pre!.organization_id);
      expect(post!.owner_user_id).toBe(pre!.owner_user_id);
      expect(post!.legacy_recording_id).toBe(pre!.legacy_recording_id);
      expect(post!.source_app).toBe(pre!.source_app);
      expect(post!.source_call_id).toBe(pre!.source_call_id);
      expect(post!.created_at).toBe(pre!.created_at);

      // OVERWRITTEN
      expect(post!.title).toBe('phase-40-POST');
      expect(post!.full_transcript).toBe('POST transcript');
      expect(post!.summary).toBe('POST summary');
      expect(post!.duration).toBe(200);
      // Postgres returns timestamps with `+00:00` offset; compare as Date.
      expect(new Date(post!.synced_at as string).toISOString()).toBe(
        new Date(syncedAt).toISOString(),
      );

      // source_metadata merge — kept `keep_me`, added `synced_at`
      const meta = post!.source_metadata as Record<string, unknown>;
      expect(meta.keep_me).toBe('PRE');
      expect(meta.synced_at).toBe(syncedAt);
    });

    it('preserves workspace_entries, folder_assignments, call_tag_assignments after refresh', async () => {
      if (!testRecordingUuid || !donorUserId) {
        console.warn('[phase40] no fixture; skipping');
        return;
      }

      // Run another UPDATE
      await supabase
        .from('recordings')
        .update({
          title: 'phase-40-POST-2',
          synced_at: new Date().toISOString(),
        })
        .eq('id', testRecordingUuid)
        .eq('owner_user_id', donorUserId);

      // Verify invariants

      // workspace_entries
      if (donorWorkspaceId) {
        const { data: we } = await supabase
          .from('workspace_entries')
          .select('workspace_id, recording_id')
          .eq('recording_id', testRecordingUuid);
        expect(we?.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(we!.some((e) => e.workspace_id === donorWorkspaceId)).toBe(true);
      }

      // folder_assignments (BIGINT-keyed)
      if (testFolderId) {
        const { data: fa } = await supabase
          .from('folder_assignments')
          .select('folder_id, call_recording_id')
          .eq('folder_id', testFolderId)
          .eq('call_recording_id', testLegacyId);
        expect(fa?.length ?? 0).toBe(1);
      }

      // call_tag_assignments (UUID-keyed)
      if (testTagId) {
        const { data: cta } = await supabase
          .from('call_tag_assignments')
          .select('tag_id, recording_id')
          .eq('tag_id', testTagId)
          .eq('recording_id', testRecordingUuid);
        expect(cta?.length ?? 0).toBe(1);
      }
    });

    it('upserts fathom_raw_calls on composite key (recording_id, user_id)', async () => {
      if (!testRecordingUuid || !donorUserId) {
        console.warn('[phase40] no fixture; skipping');
        return;
      }

      const syncedAt = new Date().toISOString();

      // First upsert
      const { error: upErr1 } = await supabase.from('fathom_raw_calls').upsert(
        {
          recording_id: testLegacyId,
          user_id: donorUserId,
          mirror_version: 1,
          canonical_recording_id: testRecordingUuid,
          title: 'mirror-1',
          created_at: new Date().toISOString(),
          recording_start_time: new Date().toISOString(),
          full_transcript: 'mirror transcript v1',
          summary: 'mirror summary v1',
          synced_at: syncedAt,
        },
        { onConflict: 'recording_id,user_id' },
      );
      expect(upErr1).toBeNull();

      // Second upsert (refresh path)
      const { error: upErr2 } = await supabase.from('fathom_raw_calls').upsert(
        {
          recording_id: testLegacyId,
          user_id: donorUserId,
          mirror_version: 1,
          canonical_recording_id: testRecordingUuid,
          title: 'mirror-2',
          created_at: new Date().toISOString(),
          recording_start_time: new Date().toISOString(),
          full_transcript: 'mirror transcript v2',
          summary: 'mirror summary v2',
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'recording_id,user_id' },
      );
      expect(upErr2).toBeNull();

      // Verify only ONE row exists for this composite key
      const { data: rows, count } = await supabase
        .from('fathom_raw_calls')
        .select('recording_id, user_id, title', { count: 'exact' })
        .eq('recording_id', testLegacyId)
        .eq('user_id', donorUserId);
      expect(count).toBe(1);
      expect(rows![0].title).toBe('mirror-2');
    });

    it('cross-org caller (owner_user_id mismatch) — UPDATE matches zero rows', async () => {
      if (!testRecordingUuid) {
        console.warn('[phase40] no fixture; skipping');
        return;
      }

      const fakeUserId = '00000000-0000-4000-8000-000000000000';

      const { data: updated, error: upErr } = await supabase
        .from('recordings')
        .update({ title: 'should-not-happen', synced_at: new Date().toISOString() })
        .eq('id', testRecordingUuid)
        .eq('owner_user_id', fakeUserId)
        .select('id');
      expect(upErr).toBeNull();
      expect(updated?.length ?? 0).toBe(0);

      // Confirm the real title is untouched
      const { data: rec } = await supabase
        .from('recordings')
        .select('title')
        .eq('id', testRecordingUuid)
        .maybeSingle();
      expect(rec?.title).not.toBe('should-not-happen');
    });
  },
);
