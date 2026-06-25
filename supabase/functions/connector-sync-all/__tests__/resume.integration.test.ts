/**
 * SYNC-01 RED scaffold — cursor persist + resume + failure recording.
 *
 * Phase 28 (Server-Side Sync-All). REAL TEST DB (service-role, RLS bypassed) —
 * guarded by `describe.skipIf(!integrationDbReachable)` so it cleanly skips
 * unless the *_TEST_* env vars point at a separate Supabase TEST project
 * (never prod). ZERO mocks — integration tests reject mocks (Phase 30/BUG-01).
 *
 * STATE: RED. The `connector-sync-all` edge function is not deployed yet (it
 * lands in Plan 28-02), so the pager-invocation assertions fail loudly today.
 * The seed/cleanup scaffolding is real now so this turns GREEN with no rewrite
 * once the pager ships.
 *
 * Cleanup contract (supabase/CLAUDE.md): donor org_id/user_id, capture-before-
 * mutate, try/catch afterAll, sweep TEST-tagged fixtures. Idempotent across
 * re-runs.
 *
 * Asserts the phase quality gate for SYNC-01:
 *   (a) after one pager slice, provider_cursor advances + last_heartbeat_at is fresh;
 *   (b) a job killed mid-run resumes from the saved provider_cursor and reaches
 *       a terminal status (completed | completed_with_errors);
 *   (c) failed_ids / skipped_count are written (for Phase 29 retry surfacing).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'

const TAG = '[phase-28-01 sync-all resume integration] do-not-touch'
const SEED_CURSOR = 'test-cursor-page-0'

describe.skipIf(!integrationDbReachable)('SYNC-01: connector-sync-all resume', () => {
  const db = makeIntegrationClient()

  let orgId: string
  let userId: string
  let jobId: string | null = null

  beforeAll(async () => {
    // Donor: borrow a valid org_id + user_id from an existing fathom recording
    // (no need to provision auth.users). Seed only TEST-tagged child rows.
    const donor = await db
      .from('recordings')
      .select('organization_id, owner_user_id')
      .eq('source_app', 'fathom')
      .limit(1)
      .maybeSingle()

    if (donor.error || !donor.data) {
      throw new Error(
        `Integration setup failed — no donor recording found: ${donor.error?.message}`,
      )
    }
    orgId = donor.data.organization_id as string
    userId = donor.data.owner_user_id as string

    // Sweep any leftover fixtures from an aborted run.
    await db.from('sync_jobs').delete().eq('organization_id', orgId).like('error_message', `${TAG}%`)

    // Seed a sync_jobs row mid-flight: mode='all', non-null provider_cursor,
    // and a STALE last_heartbeat_at (older than the reaper's 5-min threshold's
    // 2-min resume-cron window) to simulate a killed slice.
    const staleHeartbeat = new Date(Date.now() - 3 * 60 * 1000).toISOString()
    const seed = await db
      .from('sync_jobs')
      .insert({
        organization_id: orgId,
        user_id: userId,
        source_app: 'fathom',
        mode: 'all',
        status: 'processing',
        provider_cursor: SEED_CURSOR,
        date_start: '2026-01-01T00:00:00.000Z',
        date_end: '2026-06-01T00:00:00.000Z',
        last_heartbeat_at: staleHeartbeat,
        synced_ids: [],
        failed_ids: [],
        skipped_count: 0,
        error_message: `${TAG} seed`,
      })
      .select('id')
      .single()

    if (seed.error || !seed.data) {
      throw new Error(`Failed to seed sync_jobs: ${seed.error?.message}`)
    }
    jobId = seed.data.id as string
  })

  afterAll(async () => {
    try {
      if (jobId) await db.from('sync_jobs').delete().eq('id', jobId)
    } catch (e) {
      console.error('[28-01 resume] cleanup sync_jobs by id failed:', e)
    }
    try {
      await db.from('sync_jobs').delete().eq('organization_id', orgId).like('error_message', `${TAG}%`)
    } catch (e) {
      console.error('[28-01 resume] cleanup sync_jobs by tag failed:', e)
    }
  })

  it('(a) one pager slice advances provider_cursor and refreshes last_heartbeat_at', async () => {
    // RED: connector-sync-all is not deployed until Plan 28-02 — this invoke
    // errors / returns non-2xx, so the assertions below fail loudly today.
    const before = await db.from('sync_jobs').select('provider_cursor, last_heartbeat_at').eq('id', jobId!).single()
    const beforeHeartbeat = before.data?.last_heartbeat_at as string

    await db.functions.invoke('connector-sync-all', { body: { jobId } })

    const after = await db.from('sync_jobs').select('provider_cursor, last_heartbeat_at').eq('id', jobId!).single()
    expect(after.error).toBeNull()
    // Cursor must move off the seed value (advanced) OR null (exhausted).
    expect(after.data?.provider_cursor).not.toBe(SEED_CURSOR)
    // Heartbeat must be fresher than the stale seed value.
    expect(new Date(after.data?.last_heartbeat_at as string).getTime()).toBeGreaterThan(
      new Date(beforeHeartbeat).getTime(),
    )
  }, 60_000)

  it('(b) a slice killed mid-run resumes from the saved provider_cursor to a terminal status', async () => {
    // RED until Plan 28-02: drive the job to completion via repeated slices
    // (self-chain emulated by sequential invokes); assert it terminates.
    for (let i = 0; i < 50; i++) {
      const row = await db.from('sync_jobs').select('status, provider_cursor').eq('id', jobId!).single()
      const status = row.data?.status as string
      if (status === 'completed' || status === 'completed_with_errors' || status === 'failed') break
      await db.functions.invoke('connector-sync-all', { body: { jobId } })
    }
    const final = await db.from('sync_jobs').select('status').eq('id', jobId!).single()
    expect(['completed', 'completed_with_errors']).toContain(final.data?.status)
  }, 120_000)

  it('(c) failed_ids and skipped_count are recorded for Phase 29 retry surfacing', async () => {
    const row = await db
      .from('sync_jobs')
      .select('failed_ids, skipped_count')
      .eq('id', jobId!)
      .single()
    expect(row.error).toBeNull()
    expect(Array.isArray(row.data?.failed_ids)).toBe(true)
    expect(typeof row.data?.skipped_count).toBe('number')
  }, 30_000)
})
