/**
 * Integration test — cross-org copy/move deduplication (ticket 8c1761e6).
 *
 * Regression coverage for the bug where copy_recording_to_org (and its
 * siblings copy_recording_to_organization / route_recording_cross_org)
 * nulled out source_call_id on every cross-org copy, silently bypassing the
 * recordings_source_dedup unique constraint. Repeated Move/Copy actions
 * (double-click, re-running the same copy) created exact-duplicate
 * `recordings` rows in the target org/workspace. Fixed in migration
 * 20260730160000_fix_cross_org_copy_dedup.sql.
 *
 * Hits a REAL Supabase DB via a signed-in test user JWT (copy_recording_to_org
 * reads auth.uid() internally, so a service-role client can't exercise it —
 * service-role has no JWT `sub` claim). Mocks are explicitly rejected for
 * this class of bug per supabase/CLAUDE.md — the prior incident showed
 * mocked RPC tests passed while the real SQL logic was broken.
 *
 * Skips cleanly when the dedicated test-project env vars are not set.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || ''
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || ''

const SUITE_TAG = '[ticket-8c1761e6 cross-org-copy-dedup]'

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} copy_recording_to_org deduplication`,
  () => {
    const admin = makeIntegrationClient() // service-role, for fixture setup + cleanup

    const stamp = Date.now()
    const userEmail = `ticket-8c1761e6-${stamp}@callvault.test`
    const userPassword = `ticket-8c1761e6-${stamp}-pwd!`
    const sourceCallId = `dedup-test-${stamp}`

    let userId = ''
    let sourceOrgId = ''
    let targetOrgId = ''
    let sourceWorkspaceId = ''
    let targetWorkspaceId = ''
    let sourceRecordingId = ''
    let userClient: SupabaseClient

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY (dedicated test project only)`
        )
      }

      // 1. Test user
      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      })
      if (createUser.error || !createUser.data.user) {
        throw new Error(`${SUITE_TAG} createUser failed: ${createUser.error?.message}`)
      }
      userId = createUser.data.user.id

      // 2. Source + target orgs
      const sourceOrg = await admin
        .from('organizations')
        .insert({ name: `${SUITE_TAG} Source ${stamp}`, type: 'business' })
        .select('id')
        .single()
      if (sourceOrg.error || !sourceOrg.data) {
        throw new Error(`${SUITE_TAG} insert source org failed: ${sourceOrg.error?.message}`)
      }
      sourceOrgId = sourceOrg.data.id as string

      const targetOrg = await admin
        .from('organizations')
        .insert({ name: `${SUITE_TAG} Target ${stamp}`, type: 'business' })
        .select('id')
        .single()
      if (targetOrg.error || !targetOrg.data) {
        throw new Error(`${SUITE_TAG} insert target org failed: ${targetOrg.error?.message}`)
      }
      targetOrgId = targetOrg.data.id as string

      // 3. Org memberships (RPC requires membership in BOTH orgs)
      const memSource = await admin
        .from('organization_memberships')
        .insert({ organization_id: sourceOrgId, user_id: userId, role: 'organization_owner' })
      if (memSource.error) {
        throw new Error(`${SUITE_TAG} source org membership failed: ${memSource.error.message}`)
      }
      const memTarget = await admin
        .from('organization_memberships')
        .insert({ organization_id: targetOrgId, user_id: userId, role: 'organization_owner' })
      if (memTarget.error) {
        throw new Error(`${SUITE_TAG} target org membership failed: ${memTarget.error.message}`)
      }

      // 4. HOME workspaces (auto-created by trigger on org insert)
      const wsSource = await admin
        .from('workspaces')
        .select('id')
        .eq('organization_id', sourceOrgId)
        .eq('is_home', true)
        .single()
      if (wsSource.error || !wsSource.data) {
        throw new Error(`${SUITE_TAG} fetch source home workspace failed: ${wsSource.error?.message}`)
      }
      sourceWorkspaceId = wsSource.data.id as string

      const wsTarget = await admin
        .from('workspaces')
        .select('id')
        .eq('organization_id', targetOrgId)
        .eq('is_home', true)
        .single()
      if (wsTarget.error || !wsTarget.data) {
        throw new Error(`${SUITE_TAG} fetch target home workspace failed: ${wsTarget.error?.message}`)
      }
      targetWorkspaceId = wsTarget.data.id as string

      // 5. Workspace membership on the TARGET workspace (RPC checks it explicitly)
      const wsMembership = await admin
        .from('workspace_memberships')
        .insert({ workspace_id: targetWorkspaceId, user_id: userId, role: 'workspace_owner' })
      if (wsMembership.error) {
        throw new Error(`${SUITE_TAG} target workspace membership failed: ${wsMembership.error.message}`)
      }

      // 6. Source recording — a Fathom-style call with a real source_call_id,
      // matching the reported bug (John Serbian's Fathom sales calls).
      const sourceRecording = await admin
        .from('recordings')
        .insert({
          organization_id: sourceOrgId,
          owner_user_id: userId,
          title: `${SUITE_TAG} call`,
          source_app: 'fathom',
          source_call_id: sourceCallId,
          full_transcript: 'hello world',
          recording_start_time: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (sourceRecording.error || !sourceRecording.data) {
        throw new Error(
          `${SUITE_TAG} insert source recording failed: ${sourceRecording.error?.message}`
        )
      }
      sourceRecordingId = sourceRecording.data.id as string

      // 7. Sign in as the test user (RPC reads auth.uid() from the JWT)
      userClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const signIn = await userClient.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      })
      if (signIn.error) {
        throw new Error(`${SUITE_TAG} signIn failed: ${signIn.error.message}`)
      }
    }, 60_000)

    afterAll(async () => {
      try {
        if (targetWorkspaceId) {
          await admin.from('workspace_entries').delete().eq('workspace_id', targetWorkspaceId)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} workspace_entries cleanup threw:`, err)
      }
      try {
        if (targetOrgId) {
          await admin.from('recordings').delete().eq('organization_id', targetOrgId)
        }
        if (sourceRecordingId) {
          await admin.from('recordings').delete().eq('id', sourceRecordingId)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} recordings cleanup threw:`, err)
      }
      try {
        if (targetWorkspaceId && userId) {
          await admin
            .from('workspace_memberships')
            .delete()
            .eq('workspace_id', targetWorkspaceId)
            .eq('user_id', userId)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} workspace_memberships cleanup threw:`, err)
      }
      try {
        if (sourceWorkspaceId) await admin.from('workspaces').delete().eq('id', sourceWorkspaceId)
        if (targetWorkspaceId) await admin.from('workspaces').delete().eq('id', targetWorkspaceId)
      } catch (err) {
        console.warn(`${SUITE_TAG} workspaces cleanup threw:`, err)
      }
      try {
        if (sourceOrgId) await admin.from('organizations').delete().eq('id', sourceOrgId)
        if (targetOrgId) await admin.from('organizations').delete().eq('id', targetOrgId)
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err)
      }
      try {
        const { error } = await admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 })
        if (error) console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC failed:`, error.message)
      } catch (err) {
        console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC threw:`, err)
      }
    }, 60_000)

    it('copies the recording cross-org on first call', async () => {
      const { data, error } = await userClient.rpc('copy_recording_to_org', {
        p_recording_id: sourceRecordingId,
        p_target_org_id: targetOrgId,
        p_target_workspace_id: targetWorkspaceId,
        p_delete_original: false,
      })

      expect(error).toBeNull()
      expect(typeof data).toBe('string')

      const { data: matches, error: queryError } = await admin
        .from('recordings')
        .select('id')
        .eq('organization_id', targetOrgId)
        .eq('source_app', 'fathom')
        .eq('source_call_id', sourceCallId)

      expect(queryError).toBeNull()
      expect(matches).toHaveLength(1)
      expect(matches?.[0]?.id).toBe(data)
    })

    it('does NOT create a duplicate and does NOT error when copying the same call again (the reported bug)', async () => {
      // Regression: this is exactly John Serbian's scenario — copying the
      // same batch of calls into the same target org/workspace twice.
      const first = await userClient.rpc('copy_recording_to_org', {
        p_recording_id: sourceRecordingId,
        p_target_org_id: targetOrgId,
        p_target_workspace_id: targetWorkspaceId,
        p_delete_original: false,
      })
      expect(first.error).toBeNull()

      const second = await userClient.rpc('copy_recording_to_org', {
        p_recording_id: sourceRecordingId,
        p_target_org_id: targetOrgId,
        p_target_workspace_id: targetWorkspaceId,
        p_delete_original: false,
      })

      // Ticket requirement: never error out on the client.
      expect(second.error).toBeNull()
      // Ticket requirement: reuse the existing copy, don't create a duplicate.
      expect(second.data).toBe(first.data)

      const { data: matches, error: queryError } = await admin
        .from('recordings')
        .select('id')
        .eq('organization_id', targetOrgId)
        .eq('source_app', 'fathom')
        .eq('source_call_id', sourceCallId)

      expect(queryError).toBeNull()
      expect(matches).toHaveLength(1)
    })

    it('links the (deduped) recording into the requested target workspace', async () => {
      const { data: recordingId } = await userClient.rpc('copy_recording_to_org', {
        p_recording_id: sourceRecordingId,
        p_target_org_id: targetOrgId,
        p_target_workspace_id: targetWorkspaceId,
        p_delete_original: false,
      })

      const { data: entry, error } = await admin
        .from('workspace_entries')
        .select('workspace_id, recording_id')
        .eq('workspace_id', targetWorkspaceId)
        .eq('recording_id', recordingId as string)
        .maybeSingle()

      expect(error).toBeNull()
      expect(entry).not.toBeNull()
    })
  }
)
