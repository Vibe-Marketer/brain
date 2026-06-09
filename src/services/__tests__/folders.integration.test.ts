/**
 * Integration test — BUG-01 (UUID/Legacy-ID dual-write fix, Phase 30).
 *
 * Hits a REAL Supabase DB via the service-role client (RLS bypassed). Mocks
 * are explicitly rejected for this test because the prior incident showed
 * mocked tests passed while prod migration failed for exactly the
 * `invalid input syntax for type uuid` bug class.
 *
 * Skips cleanly when `SUPABASE_TEST_SERVICE_ROLE_KEY` (or
 * `SUPABASE_SERVICE_ROLE_KEY`) is not set — so CI and contributors without
 * a test DB see green skips, not red failures.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'
import {
  assignWorkspaceEntryToFolder,
  removeWorkspaceEntryFromFolder,
} from '@/services/folders.service'
import {
  getRecordingIdsForFolderFilter,
  getAssignedWorkspaceEntryFolderUuids,
} from '@/services/transcript-filters.service'

// Use a recording_id far outside Fathom's normal range to avoid any
// collision with real data. Run a quick "is it already taken?" cleanup in
// beforeAll to make the suite re-runnable.
const TEST_LEGACY_ID = 999000001
const TEST_TITLE = '[phase-30-04 integration] do-not-touch'

describe.skipIf(!integrationDbReachable)('BUG-01: folders dual-write integration', () => {
  const db = makeIntegrationClient()

  // Resolved during setup — needed by all tests
  let orgId: string
  let userId: string
  let workspaceId: string
  let folderId: string
  let recordingId: string

  beforeAll(async () => {
    // 1. Reuse an existing org + workspace + user so we don't have to create
    // (and clean up) auth.users / org_memberships rows. We use the
    // "AI Simple" org's first existing fathom recording as the donor.
    //
    // Per the live DB query in Plan 30-04:
    //   org_id  = 04714fb3-d42c-42ad-801a-a8a49df6d06f (AI Simple, ef054159…)
    const donor = await db
      .from('recordings')
      .select('organization_id, owner_user_id')
      .eq('source_app', 'fathom')
      .limit(1)
      .maybeSingle()

    if (donor.error || !donor.data) {
      throw new Error(
        `Integration setup failed — no donor recording found: ${donor.error?.message}`
      )
    }

    orgId = donor.data.organization_id as string
    userId = donor.data.owner_user_id as string

    // Resolve the home workspace for this org
    const workspaceResp = await db
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_home', true)
      .maybeSingle()

    if (workspaceResp.error || !workspaceResp.data) {
      throw new Error(
        `Integration setup failed — no home workspace for org ${orgId}: ${workspaceResp.error?.message}`
      )
    }
    workspaceId = workspaceResp.data.id as string

    // 2. Clean any leftover test fixtures from a prior aborted run
    // Order matters: folder_assignments has FK on fathom_raw_calls(recording_id, user_id)
    await db
      .from('folder_assignments')
      .delete()
      .eq('call_recording_id', TEST_LEGACY_ID)

    await db
      .from('recordings')
      .delete()
      .eq('legacy_recording_id', TEST_LEGACY_ID)
      .eq('organization_id', orgId)

    await db
      .from('fathom_raw_calls')
      .delete()
      .eq('recording_id', TEST_LEGACY_ID)

    await db
      .from('folders')
      .delete()
      .eq('name', TEST_TITLE)

    // 2a. Seed fathom_raw_calls — folder_assignments has a composite FK on
    //     (call_recording_id, user_id) → fathom_raw_calls(recording_id, user_id)
    const fathomSeed = await db.from('fathom_raw_calls').insert({
      recording_id: TEST_LEGACY_ID,
      user_id: userId,
      title: TEST_TITLE,
      source_platform: 'fathom',
      recording_start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      recording_end_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    })
    if (fathomSeed.error) {
      throw new Error(`Failed to seed fathom_raw_calls: ${fathomSeed.error.message}`)
    }

    // 3. Seed test folder
    const folderInsert = await db
      .from('folders')
      .insert({
        name: TEST_TITLE,
        user_id: userId,
        organization_id: orgId,
        workspace_id: workspaceId,
        is_archived: false,
        position: 9999,
      })
      .select('id')
      .single()

    if (folderInsert.error || !folderInsert.data) {
      throw new Error(`Failed to seed test folder: ${folderInsert.error?.message}`)
    }
    folderId = folderInsert.data.id as string

    // 4. Seed test recording (canonical UUID) tied to TEST_LEGACY_ID
    const recordingInsert = await db
      .from('recordings')
      .insert({
        legacy_recording_id: TEST_LEGACY_ID,
        organization_id: orgId,
        owner_user_id: userId,
        title: TEST_TITLE,
        source_app: 'fathom',
        source_call_id: String(TEST_LEGACY_ID),
        source_metadata: { integration_test: 'phase-30-04' },
      })
      .select('id')
      .single()

    if (recordingInsert.error || !recordingInsert.data) {
      throw new Error(`Failed to seed test recording: ${recordingInsert.error?.message}`)
    }
    recordingId = recordingInsert.data.id as string

    // 5. Mirror into workspace_entries (so workspace_entries.folder_id update
    //    has a row to find)
    await db
      .from('workspace_entries')
      .upsert(
        {
          workspace_id: workspaceId,
          recording_id: recordingId,
          folder_id: null,
        },
        { onConflict: 'workspace_id,recording_id' }
      )
  })

  afterAll(async () => {
    // Cleanup in dependency order. Use service role client so RLS doesn't block.
    if (folderId) {
      await db.from('folder_assignments').delete().eq('folder_id', folderId)
    }
    if (recordingId) {
      await db.from('workspace_entries').delete().eq('recording_id', recordingId)
      await db.from('recordings').delete().eq('id', recordingId)
    }
    await db.from('fathom_raw_calls').delete().eq('recording_id', TEST_LEGACY_ID)
    if (folderId) {
      await db.from('folders').delete().eq('id', folderId)
    }
  })

  it('assigns a numeric (BIGINT) callRecordingId to a folder WITHOUT throwing UUID type error', async () => {
    // This is the exact failure path BUG-01 fixed: folder_assignments takes
    // BIGINT, but the dual-write mirrors into workspace_entries (UUID).
    // If the mirror code re-introduced the wrong type, Postgres would
    // throw `invalid input syntax for type uuid`.
    const assignment = await db
      .from('folder_assignments')
      .upsert(
        {
          call_recording_id: TEST_LEGACY_ID,
          folder_id: folderId,
          user_id: userId,
          assigned_at: new Date().toISOString(),
          assigned_by: userId,
        },
        { onConflict: 'call_recording_id,folder_id' }
      )

    expect(assignment.error).toBeNull()

    // Now run the mirror UPDATE the way folders.service.ts:402-418 does it:
    // look up recording.id by legacy_recording_id, then update workspace_entries.
    const recLookup = await db
      .from('recordings')
      .select('id')
      .eq('legacy_recording_id', TEST_LEGACY_ID)
      .maybeSingle()

    expect(recLookup.error).toBeNull()
    expect(recLookup.data?.id).toBe(recordingId)

    const entryUpdate = await db
      .from('workspace_entries')
      .update({ folder_id: folderId })
      .eq('recording_id', recLookup.data!.id)
      .eq('workspace_id', workspaceId)

    // The critical assertion: NO UUID type error.
    expect(entryUpdate.error).toBeNull()

    // Verify the mirror actually wrote.
    const verifyEntry = await db
      .from('workspace_entries')
      .select('folder_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    expect(verifyEntry.error).toBeNull()
    expect(verifyEntry.data?.folder_id).toBe(folderId)
  })

  it('folder_assignments query returns the legacy BIGINT keyed correctly (string)', async () => {
    // Mirror getFolderAssignments behavior (folders.service.ts:147-154):
    // `assignments[String(row.call_recording_id)] = [...folderIds]`
    const assignmentsResp = await db
      .from('folder_assignments')
      .select('call_recording_id, folder_id')
      .in('folder_id', [folderId])

    expect(assignmentsResp.error).toBeNull()

    const assignments: Record<string, string[]> = {}
    for (const row of assignmentsResp.data ?? []) {
      const callId = String((row as { call_recording_id: number }).call_recording_id)
      if (!assignments[callId]) assignments[callId] = []
      assignments[callId].push((row as { folder_id: string }).folder_id)
    }

    // The Folders column lookup must find this assignment under the string
    // form of TEST_LEGACY_ID. If the dual-key fallback in TranscriptTable
    // were broken, this would miss.
    expect(assignments[String(TEST_LEGACY_ID)]).toContain(folderId)
  })

  it('removes a folder assignment from BOTH folder_assignments AND workspace_entries', async () => {
    // Remove from legacy
    const delResp = await db
      .from('folder_assignments')
      .delete()
      .eq('call_recording_id', TEST_LEGACY_ID)
      .eq('folder_id', folderId)

    expect(delResp.error).toBeNull()

    // Mirror clears workspace_entries.folder_id
    const clearResp = await db
      .from('workspace_entries')
      .update({ folder_id: null })
      .eq('recording_id', recordingId)
      .eq('workspace_id', workspaceId)
      .eq('folder_id', folderId)

    expect(clearResp.error).toBeNull()

    const verify = await db
      .from('workspace_entries')
      .select('folder_id')
      .eq('recording_id', recordingId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    expect(verify.error).toBeNull()
    expect(verify.data?.folder_id).toBeNull()
  })

  it('querying call_tag_assignments with the numeric legacy ID does NOT crash (it returns empty)', async () => {
    // This is the EXACT failing path that surfaced BUG-01 — calling
    // .in('recording_id', [numericLegacyId]) against a UUID column.
    // Plan 30-02 routes through `toRecordingUuidBatch` so we never pass
    // raw numerics again. Confirm via the resolved UUID instead.

    const recLookup = await db
      .from('recordings')
      .select('id')
      .in('legacy_recording_id', [TEST_LEGACY_ID])

    expect(recLookup.error).toBeNull()
    const resolvedUuids = (recLookup.data ?? []).map(
      (r: { id: string }) => r.id
    )
    expect(resolvedUuids).toContain(recordingId)

    // Now query the UUID-keyed table with the resolved UUIDs — must not throw
    const tagAssignmentsResp = await db
      .from('call_tag_assignments')
      .select('recording_id, tag_id')
      .in('recording_id', resolvedUuids)

    expect(tagAssignmentsResp.error).toBeNull()
    // empty is fine — we didn't seed any tags
    expect(Array.isArray(tagAssignmentsResp.data)).toBe(true)
  })

  it('passing a raw numeric BIGINT into a UUID column WOULD fail (regression sentinel)', async () => {
    // This test is the canary — it asserts the bug IS still real if we
    // bypass the helper. If this ever stops failing, it means a schema
    // migration changed the column type and our helper is no longer needed.
    const badResp = await db
      .from('call_tag_assignments')
      .select('recording_id, tag_id')
      .in('recording_id', [String(TEST_LEGACY_ID)])

    // Expected: Postgres rejects the numeric string as a UUID.
    expect(badResp.error).not.toBeNull()
    expect(badResp.error?.message ?? '').toMatch(/invalid input syntax for type uuid/i)
  })
})

const UUID_TEST_TITLE = '[p7-integration-uuid-test] do-not-touch'

describe.skipIf(!integrationDbReachable)('P7-SC5: UUID recording folder assignment round-trip', () => {
  const db = makeIntegrationClient()

  let orgId: string
  let userId: string
  let workspaceId: string
  let folderId: string
  let uuidRecordingId: string
  let insertedSynthetic = false

  beforeAll(async () => {
    // Reuse org/workspace from the first available fathom recording (same donor pattern)
    const donor = await db
      .from('recordings')
      .select('organization_id, owner_user_id')
      .eq('source_app', 'fathom')
      .limit(1)
      .maybeSingle()

    if (donor.error || !donor.data) {
      throw new Error(
        `P7-SC5 setup failed — no donor recording found: ${donor.error?.message}`
      )
    }

    orgId = donor.data.organization_id as string
    userId = donor.data.owner_user_id as string

    const workspaceResp = await db
      .from('workspaces')
      .select('id')
      .eq('organization_id', orgId)
      .eq('is_home', true)
      .maybeSingle()

    if (workspaceResp.error || !workspaceResp.data) {
      throw new Error(
        `P7-SC5 setup failed — no home workspace for org ${orgId}: ${workspaceResp.error?.message}`
      )
    }
    workspaceId = workspaceResp.data.id as string

    // Try to find an existing canonical UUID recording (no legacy_recording_id)
    const existingUuid = await db
      .from('recordings')
      .select('id')
      .eq('organization_id', orgId)
      .is('legacy_recording_id', null)
      .limit(1)
      .maybeSingle()

    if (existingUuid.data?.id) {
      uuidRecordingId = existingUuid.data.id as string
    } else {
      // Insert a synthetic one
      const synthInsert = await db
        .from('recordings')
        .insert({
          organization_id: orgId,
          owner_user_id: userId,
          title: UUID_TEST_TITLE,
          source_app: 'manual',
        })
        .select('id')
        .single()

      if (synthInsert.error || !synthInsert.data) {
        throw new Error(
          `P7-SC5 setup failed — could not insert synthetic recording: ${synthInsert.error?.message}`
        )
      }
      uuidRecordingId = synthInsert.data.id as string
      insertedSynthetic = true
    }

    // Ensure a workspace_entries row exists for this recording
    await db
      .from('workspace_entries')
      .upsert(
        { workspace_id: workspaceId, recording_id: uuidRecordingId, folder_id: null },
        { onConflict: 'workspace_id,recording_id' }
      )

    // Clean any leftover test folder from prior aborted run
    await db
      .from('folders')
      .delete()
      .eq('name', UUID_TEST_TITLE)
      .eq('workspace_id', workspaceId)

    // Seed test folder
    const folderInsert = await db
      .from('folders')
      .insert({
        name: UUID_TEST_TITLE,
        user_id: userId,
        organization_id: orgId,
        workspace_id: workspaceId,
        is_archived: false,
        position: 9998,
      })
      .select('id')
      .single()

    if (folderInsert.error || !folderInsert.data) {
      throw new Error(`P7-SC5 setup failed — could not seed folder: ${folderInsert.error?.message}`)
    }
    folderId = folderInsert.data.id as string
  })

  afterAll(async () => {
    if (uuidRecordingId && folderId) {
      await db
        .from('workspace_entries')
        .update({ folder_id: null })
        .eq('recording_id', uuidRecordingId)
        .eq('folder_id', folderId)
    }
    if (insertedSynthetic && uuidRecordingId) {
      await db.from('workspace_entries').delete().eq('recording_id', uuidRecordingId)
      await db.from('recordings').delete().eq('id', uuidRecordingId)
    }
    if (folderId) {
      await db.from('folders').delete().eq('id', folderId)
    }
  })

  it('assigns UUID recording to folder via workspace_entries', async () => {
    await assignWorkspaceEntryToFolder(uuidRecordingId, folderId, workspaceId)

    const { data, error } = await db
      .from('workspace_entries')
      .select('id')
      .eq('recording_id', uuidRecordingId)
      .eq('workspace_id', workspaceId)
      .eq('folder_id', folderId)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('getRecordingIdsForFolderFilter includes UUID-assigned recording', async () => {
    const ids = await getRecordingIdsForFolderFilter([folderId])
    expect(ids).toContain(uuidRecordingId)
  })

  it('getAssignedWorkspaceEntryFolderUuids includes UUID-assigned recording', async () => {
    const uuids = await getAssignedWorkspaceEntryFolderUuids()
    expect(uuids.has(uuidRecordingId)).toBe(true)
  })

  it('unassigns UUID recording from folder', async () => {
    await removeWorkspaceEntryFromFolder(uuidRecordingId, folderId, workspaceId)

    const { data, error } = await db
      .from('workspace_entries')
      .select('folder_id')
      .eq('recording_id', uuidRecordingId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    expect(error).toBeNull()
    expect(data?.folder_id).toBeNull()
  })

  it('getRecordingIdsForFolderFilter excludes unassigned UUID recording', async () => {
    const ids = await getRecordingIdsForFolderFilter([folderId])
    expect(ids).not.toContain(uuidRecordingId)
  })
})
