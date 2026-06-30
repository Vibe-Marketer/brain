/**
 * SYNC-03 real-DB idempotency proof — concurrent dedup + 23505 reclassification.
 *
 * Phase 28 (Server-Side Sync-All). REAL TEST DB (service-role, RLS bypassed) —
 * guarded by `describe.skipIf(!integrationDbReachable)`; cleanly skips unless
 * the *_TEST_* env vars point at a separate Supabase TEST project (never prod).
 * ZERO mocks — integration tests reject mocks (Phase 30/BUG-01).
 *
 * This proves the BUG-01 risk class — the dedup correctness that MUST hold on a
 * real DB, not a mock — WITHOUT requiring live provider credentials, by
 * exercising the actual org-scoped unique constraint + the exact
 * isUniqueViolation() reclassification predicate from connector-sync-all/index.ts
 * against the real `recordings` table. (The provider-fetch is NOT what SYNC-03's
 * correctness rests on; the org-scoped constraint + skip-not-fail reclassification
 * is.) Mirrors the 27-04 reaper proof technique: seed under a real auth.users id.
 *
 * Asserts the phase quality gate for SYNC-03:
 *   (a) two concurrent writers on the SAME (organization_id, source_app,
 *       source_call_id) yield EXACTLY ONE recordings row
 *       (recordings_source_dedup unique constraint);
 *   (b) the loser's error is a Postgres 23505 that isUniqueViolation() classifies
 *       as a SKIP — never a failure (Pitfall 1);
 *   (c) a crash-retry of the same write produces NO duplicate (still one row).
 *
 * Cleanup contract (supabase/CLAUDE.md): seed under a real org/user, delete by
 * tag in afterAll clearing child workspace_entries first (a trigger auto-creates
 * them and blocks a bare recordings delete), try/catch each step. Idempotent.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  integrationDbReachable,
  makeIntegrationClient,
} from '../../../../src/test/integration-setup'

const TAG = '[phase-28-05 sync-all idempotency integration] do-not-touch'

/** The exact unique-violation predicate from connector-sync-all/index.ts. */
function isUniqueViolation(error: unknown): boolean {
  if (!error) return false
  const h = String(
    (error as { code?: string; message?: string }).code ??
      (error as { message?: string }).message ??
      error,
  ).toLowerCase()
  return (
    h.includes('23505') ||
    h.includes('duplicate key') ||
    h.includes('unique constraint') ||
    h.includes('unique violation') ||
    h.includes('recordings_source_dedup')
  )
}

describe.skipIf(!integrationDbReachable)('SYNC-03: connector-sync-all idempotency', () => {
  const db = makeIntegrationClient()

  let orgId: string
  let userId: string
  let setupUnavailable: string | null = null
  const sourceCallId = `test-sync03-${Date.now()}`

  const insertDup = () =>
    db
      .from('recordings')
      .insert({
        organization_id: orgId,
        owner_user_id: userId,
        source_app: 'fathom',
        source_call_id: sourceCallId,
        title: `${TAG} ${sourceCallId}`,
        recording_start_time: new Date().toISOString(),
      })
      .select('id')
      .single()

  beforeAll(async () => {
    // Borrow a real organization + a real auth.users id (FK satisfaction). The
    // TEST project always carries organization_memberships fixtures.
    const member = await db
      .from('organization_memberships')
      .select('organization_id, user_id')
      .limit(1)
      .maybeSingle()

    if (member.error || !member.data) {
      setupUnavailable = `No organization_memberships fixture in TEST project: ${member.error?.message ?? 'none found'}`
      console.warn(`[28-05 idempotency] ${setupUnavailable}`)
      return
    }
    orgId = member.data.organization_id as string
    userId = member.data.user_id as string

    // Sweep any leftover tagged recordings from an aborted run (child rows first).
    await sweepTagged()
  })

  async function sweepTagged() {
    try {
      const recs = await db.from('recordings').select('id').like('title', `${TAG}%`)
      for (const r of (recs.data ?? []) as Array<{ id: string }>) {
        try { await db.from('workspace_entries').delete().eq('recording_id', r.id) } catch { /* noop */ }
        try { await db.from('call_speakers').delete().eq('recording_id', r.id) } catch { /* noop */ }
        try { await db.from('call_participants').delete().eq('recording_id', r.id) } catch { /* noop */ }
        try { await db.from('recordings').delete().eq('id', r.id) } catch (e) { console.error('[28-05 idempotency] rec delete failed:', e) }
      }
    } catch (e) {
      console.error('[28-05 idempotency] sweep failed:', e)
    }
  }

  afterAll(async () => {
    await sweepTagged()
  })

  it('(a) two concurrent writers on the same dedup key yield exactly ONE recordings row', async () => {
    if (setupUnavailable) {
      // This is a real fixture gap, not a correctness pass. Surface it loudly so
      // it can never be mistaken for a green proof.
      throw new Error(`[28-05 idempotency] cannot run real-DB proof: ${setupUnavailable}`)
    }
    const results = await Promise.allSettled([insertDup(), insertDup()])
    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof insertDup>>> =>
        r.status === 'fulfilled' && !r.value.error,
    )
    // Exactly one writer wins at the DB level.
    expect(fulfilled.length).toBe(1)

    const rows = await db
      .from('recordings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('source_app', 'fathom')
      .eq('source_call_id', sourceCallId)
    expect(rows.error).toBeNull()
    expect((rows.data ?? []).length).toBe(1)
  }, 60_000)

  it('(b) the loser is a 23505 that isUniqueViolation() reclassifies as skip, NOT a failure', async () => {
    if (setupUnavailable) {
      throw new Error(`[28-05 idempotency] cannot run real-DB proof: ${setupUnavailable}`)
    }
    // A second write on the same dedup key (the loser path) must surface a unique
    // violation that the pager's predicate counts as skipped, never failed_ids.
    const loser = await insertDup()
    expect(loser.error).not.toBeNull()
    expect(isUniqueViolation(loser.error)).toBe(true)
  }, 30_000)

  it('(c) a crash-retry of the same write produces no duplicate (still one row)', async () => {
    if (setupUnavailable) {
      throw new Error(`[28-05 idempotency] cannot run real-DB proof: ${setupUnavailable}`)
    }
    const retry = await insertDup()
    // The retry must be rejected (unique violation), keeping the row count at one.
    expect(retry.error).not.toBeNull()
    expect(isUniqueViolation(retry.error)).toBe(true)

    const rows = await db
      .from('recordings')
      .select('id')
      .eq('organization_id', orgId)
      .eq('source_app', 'fathom')
      .eq('source_call_id', sourceCallId)
    expect((rows.data ?? []).length).toBe(1)
  }, 30_000)
})
