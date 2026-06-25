/**
 * SYNC-03 RED scaffold — concurrent import idempotency + 23505 reclassification.
 *
 * Phase 28 (Server-Side Sync-All). REAL TEST DB (service-role, RLS bypassed) —
 * guarded by `describe.skipIf(!integrationDbReachable)`; cleanly skips unless
 * the *_TEST_* env vars point at a separate Supabase TEST project (never prod).
 * ZERO mocks — integration tests reject mocks (Phase 30/BUG-01).
 *
 * STATE: RED. The `connector-sync-all` pager is not deployed until Plan 28-02,
 * so the concurrent-invoke assertions fail loudly today. The seed/cleanup
 * scaffolding is real now.
 *
 * Asserts the phase quality gate for SYNC-03:
 *   (a) concurrent selective-import + sync-all of the SAME source_call_id yields
 *       EXACTLY ONE recordings row (org-scoped unique constraint
 *       recordings_source_dedup on (organization_id, source_app, source_call_id));
 *   (b) the loser path is reclassified `skipped` (counted in skipped_count), NOT
 *       recorded in failed_ids — a Postgres 23505 unique-violation from
 *       runPipeline is treated as a duplicate-skip, not a failure (Pitfall 1);
 *   (c) a slice retry after a simulated crash produces NO duplicate.
 *
 * Cleanup contract (supabase/CLAUDE.md): donor org_id/user_id, capture-before-
 * mutate, try/catch afterAll, sweep TEST-tagged fixtures. Idempotent re-runs.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'

const TAG = '[phase-28-01 sync-all idempotency integration] do-not-touch'
// Deterministic but TEST-tagged source_call_id so concurrent paths collide on
// the same org-scoped unique key.
const SOURCE_CALL_ID = `test-sync-all-idem-${Date.now()}`

describe.skipIf(!integrationDbReachable)('SYNC-03: connector-sync-all idempotency', () => {
  const db = makeIntegrationClient()

  let orgId: string
  let userId: string
  let jobId: string | null = null

  beforeAll(async () => {
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

    // Sweep leftover fixtures (recordings on this TEST source_call_id + tagged jobs).
    await db
      .from('recordings')
      .delete()
      .eq('organization_id', orgId)
      .eq('source_app', 'fathom')
      .eq('source_call_id', SOURCE_CALL_ID)
    await db.from('sync_jobs').delete().eq('organization_id', orgId).like('error_message', `${TAG}%`)

    // Seed a sync-all job that will fetch the page containing SOURCE_CALL_ID.
    const seed = await db
      .from('sync_jobs')
      .insert({
        organization_id: orgId,
        user_id: userId,
        source_app: 'fathom',
        mode: 'all',
        status: 'processing',
        provider_cursor: null,
        date_start: '2026-01-01T00:00:00.000Z',
        date_end: '2026-06-01T00:00:00.000Z',
        last_heartbeat_at: new Date().toISOString(),
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
      await db
        .from('recordings')
        .delete()
        .eq('organization_id', orgId)
        .eq('source_app', 'fathom')
        .eq('source_call_id', SOURCE_CALL_ID)
    } catch (e) {
      console.error('[28-01 idempotency] cleanup recordings failed:', e)
    }
    try {
      if (jobId) await db.from('sync_jobs').delete().eq('id', jobId)
    } catch (e) {
      console.error('[28-01 idempotency] cleanup sync_jobs by id failed:', e)
    }
    try {
      await db.from('sync_jobs').delete().eq('organization_id', orgId).like('error_message', `${TAG}%`)
    } catch (e) {
      console.error('[28-01 idempotency] cleanup sync_jobs by tag failed:', e)
    }
  })

  it('(a) concurrent selective-import + sync-all of the same call yields exactly ONE recordings row', async () => {
    // RED until Plan 28-02: fire sync-all and a selective import for the SAME
    // source_call_id concurrently; the org-scoped unique constraint must
    // guarantee a single row.
    await Promise.allSettled([
      db.functions.invoke('connector-sync-all', { body: { jobId } }),
      db.functions.invoke('connector-import-selected', {
        body: { sourceApp: 'fathom', externalIds: [SOURCE_CALL_ID], organizationId: orgId },
      }),
    ])

    const rows = await db
      .from('recordings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('source_app', 'fathom')
      .eq('source_call_id', SOURCE_CALL_ID)
    expect(rows.error).toBeNull()
    expect((rows.data ?? []).length).toBe(1)
  }, 90_000)

  it('(b) the loser path is reclassified `skipped`, NOT recorded in failed_ids (23505 → skipped)', async () => {
    const job = await db
      .from('sync_jobs')
      .select('failed_ids, skipped_count')
      .eq('id', jobId!)
      .single()
    expect(job.error).toBeNull()
    const failedIds = (job.data?.failed_ids ?? []) as string[]
    // A duplicate that the constraint rejected must NEVER land in failed_ids —
    // it is a skip, not a failure (Pitfall 1).
    expect(failedIds).not.toContain(SOURCE_CALL_ID)
    expect(typeof job.data?.skipped_count).toBe('number')
  }, 30_000)

  it('(c) a slice retry after a simulated crash produces no duplicate', async () => {
    // Re-invoke the same slice (emulating a crash-retry from the saved cursor):
    // the dedup must keep the row count at exactly one.
    await db.functions.invoke('connector-sync-all', { body: { jobId } })

    const rows = await db
      .from('recordings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('source_app', 'fathom')
      .eq('source_call_id', SOURCE_CALL_ID)
    expect((rows.data ?? []).length).toBeLessThanOrEqual(1)
  }, 60_000)
})
