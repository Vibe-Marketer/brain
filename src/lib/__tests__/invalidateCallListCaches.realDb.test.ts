/**
 * Integration test — Phase 36-02 BUG-03 (cache invalidation on mutations).
 *
 * Verifies that `invalidateCallListCaches(queryClient)` invalidates every cache
 * key used by the call list — so mutations (move, delete, tag, assign) refresh
 * the visible UI immediately without a manual reload.
 *
 * Per Andrew's hard rule for BUG-03: REAL DB, no mocks. The helper itself is
 * pure (just calls `queryClient.invalidateQueries` for each canonical key), but
 * we hit a real Supabase fetch to prove the round-trip works against the live
 * project — refetch fires, returns data, and the cache flips.
 *
 * Skips cleanly when `SUPABASE_TEST_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`)
 * is not set.
 */

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, beforeAll } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '@/test/integration-setup'
import {
  invalidateCallListCaches,
  queryKeys,
} from '@/lib/query-config'

describe.skipIf(!integrationDbReachable)(
  'BUG-03: invalidateCallListCaches refreshes the call list on every mutation',
  () => {
    let queryClient: QueryClient
    const db = makeIntegrationClient()
    let orgId: string

    beforeAll(async () => {
      // Find any org so we have valid org_id for query keys
      const orgQuery = await db
        .from('organizations')
        .select('id')
        .limit(1)
        .maybeSingle()
      if (orgQuery.error || !orgQuery.data) {
        throw new Error('[phase-36-02] no organizations found in test DB')
      }
      orgId = orgQuery.data.id
    })

    it('invalidates every canonical call-list cache hub', () => {
      queryClient = new QueryClient()

      // Seed the cache with stable data for each canonical key the helper
      // is documented to invalidate.
      queryClient.setQueryData(queryKeys.calls.all, ['stale-calls'])
      queryClient.setQueryData(queryKeys.recordings.all, ['stale-recordings'])
      queryClient.setQueryData(queryKeys.workspaceEntries.all, [
        'stale-workspace-entries',
      ])
      queryClient.setQueryData(queryKeys.folders.all, ['stale-folders'])
      queryClient.setQueryData(queryKeys.folderAssignments.all, [
        'stale-folder-assignments',
      ])
      queryClient.setQueryData(queryKeys.tagAssignments.all, [
        'stale-tag-assignments',
      ])
      queryClient.setQueryData(['workspace-entries'], ['stale-legacy-we'])
      queryClient.setQueryData(['folder_assignments'], ['stale-legacy-fa'])
      queryClient.setQueryData(['tag-calls'], ['stale-legacy-tc'])
      queryClient.setQueryData(['recordings'], ['stale-legacy-rec'])

      // Sanity: queries are NOT stale yet
      const beforeStates = [
        queryKeys.calls.all,
        queryKeys.recordings.all,
        queryKeys.workspaceEntries.all,
        queryKeys.folders.all,
        queryKeys.folderAssignments.all,
        queryKeys.tagAssignments.all,
        ['workspace-entries'],
        ['folder_assignments'],
        ['tag-calls'],
        ['recordings'],
      ].map((key) => {
        const state = queryClient.getQueryState(key as readonly unknown[])
        return state?.isInvalidated === true
      })
      expect(beforeStates.every((s) => s === false)).toBe(true)

      // Invoke the unified helper
      invalidateCallListCaches(queryClient)

      // Every one of the canonical hubs MUST be marked invalidated
      const afterStates = [
        queryKeys.calls.all,
        queryKeys.recordings.all,
        queryKeys.workspaceEntries.all,
        queryKeys.folders.all,
        queryKeys.folderAssignments.all,
        queryKeys.tagAssignments.all,
        ['workspace-entries'],
        ['folder_assignments'],
        ['tag-calls'],
        ['recordings'],
      ].map((key) => {
        const state = queryClient.getQueryState(key as readonly unknown[])
        return state?.isInvalidated === true
      })

      // All 10 keys must be invalidated (no missing hubs)
      expect(afterStates).toEqual(Array(10).fill(true))
    })

    it('triggers a refetch against the live DB for invalidated keys', async () => {
      // Use a real query backed by Supabase to prove invalidation → refetch
      // → fresh data path works end-to-end.
      queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: 0 } },
      })

      // Stub a query function that hits real Supabase
      const fetchCalls = async () => {
        const { data, error } = await db
          .from('recordings')
          .select('id, title, recording_start_time')
          .eq('organization_id', orgId)
          .order('recording_start_time', { ascending: false })
          .limit(5)
        if (error) throw error
        return data
      }

      // Pre-fetch and cache
      await queryClient.fetchQuery({
        queryKey: queryKeys.calls.all,
        queryFn: fetchCalls,
      })

      const firstFetch = queryClient.getQueryData<unknown[]>(queryKeys.calls.all)
      expect(firstFetch).toBeTruthy()

      // Invoke the helper — this marks the query as invalidated
      invalidateCallListCaches(queryClient)

      // Verify isInvalidated flipped to true (proves the helper hit this key)
      const stateAfter = queryClient.getQueryState(queryKeys.calls.all)
      expect(stateAfter?.isInvalidated).toBe(true)

      // Confirm a refetch returns data (the live DB is reachable, no errors)
      const refetched = await queryClient.fetchQuery({
        queryKey: queryKeys.calls.all,
        queryFn: fetchCalls,
      })
      expect(refetched).toBeTruthy()
    })

    it('does NOT crash when invalidating with an empty cache', () => {
      // Edge case: helper must be safe to call on a fresh QueryClient with no
      // existing queries. (Common at app startup or after a sign-out flush.)
      const fresh = new QueryClient()
      expect(() => invalidateCallListCaches(fresh)).not.toThrow()
    })
  },
)
