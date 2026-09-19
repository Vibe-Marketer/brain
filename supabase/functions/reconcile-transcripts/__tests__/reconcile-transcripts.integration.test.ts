/**
 * reconcile-transcripts edge function integration proof (Phase 37, Plan 03,
 * Task 3).
 *
 * reconcile-transcripts is deploy-deferred -- this suite proves the REAL
 * edge function code against a REAL TEST-project database without
 * deploying to Supabase Cloud: it spawns the actual index.ts under
 * `deno run` (Phase 35 P03 / Phase 36 P04 precedent -- resolve-speakers,
 * merge-organizations), pointed at the TEST project's URL/service-role key
 * via env vars, and drives it over real HTTP with a real X-Reconcile-Secret
 * header. This is the genuine code path -- not a reimplementation of its
 * logic in the test.
 *
 * Fixtures are entirely SYNTHETIC (37-RESEARCH.md Pitfall 1 -- no real
 * cross-source disagreeing transcript data exists yet): two recordings on
 * one event, deliberately adversarial near-miss text ("ChatGPT"/"ChatGBT"
 * spelling variant that MUST fuzzy-align as agreement per Pitfall 4, plus a
 * genuine word substitution "grew"/"shrank" that MUST resolve via weighted
 * vote), and a second, non-overlapping chunk on only one recording to prove
 * RECON-06's single-source marking.
 *
 * Proves:
 *  - Secret gate: no/wrong X-Reconcile-Secret -> 401 before any DB work.
 *  - Gating: an event whose recordings share only a raw event_id (no
 *    event_match_decisions merge_applied row) produces zero reconciled
 *    rows (37-RESEARCH.md Pitfall 2).
 *  - RECON-04 (negative): a source transcript_chunks row's chunk_text is
 *    byte-unchanged after the sweep.
 *  - RECON-07 (negative): transcript_chunks.embedded_at is unchanged
 *    (still NULL) across the sweep, and the function's own source contains
 *    zero embedding-pipeline references.
 *  - Happy path: the overlapping interval reconciles into a 'consensus'
 *    segment with both recording ids in source_recording_ids/
 *    agreeing_recording_ids; the non-overlapping interval reconciles into
 *    a 'single_source' segment with exactly its own lone recording id.
 *
 * Run: VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/reconcile-transcripts/__tests__/reconcile-transcripts.integration.test.ts --reporter=verbose
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { integrationDbReachable, makeIntegrationClient } from '@/test/integration-setup'

const SUITE_TAG = '[phase-37-03 reconcile-transcripts]'
// Distinct from every other deploy-deferred deno-run suite's port
// (resolve-speakers 8000, merge-organizations 8031, unclaim-organization-
// domain 8032) so `npm run test:integration` can run them all in one
// invocation without a port collision.
const FUNCTION_PORT = 8033
const FUNCTION_URL = `http://localhost:${FUNCTION_PORT}`
const REPO_ROOT = resolve(__dirname, '../../../..')
const FUNCTION_ENTRY = resolve(REPO_ROOT, 'supabase/functions/reconcile-transcripts/index.ts')
const FUNCTION_SOURCE_PATH = FUNCTION_ENTRY

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || ''
const TEST_RECONCILE_SECRET = `phase37-03-reconcile-secret-${Date.now()}`

/** Poll the spawned Deno server until it accepts connections (or timeout). */
async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      await fetch(FUNCTION_URL, { method: 'OPTIONS' })
      return
    } catch (err) {
      lastError = err
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  throw new Error(`${SUITE_TAG} reconcile-transcripts server did not become reachable: ${String(lastError)}`)
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} event_match_decisions gating, delete+rebuild, RECON-04/07 negatives`, () => {
  const admin = makeIntegrationClient() // service-role, TEST project only
  let denoProc: ChildProcessWithoutNullStreams | null = null

  const stamp = Date.now()
  const since = new Date(stamp - 60 * 60 * 1000).toISOString() // 1h before fixture creation -- forward-only cutover.
  const anchor = new Date(stamp - 30 * 60 * 1000).toISOString() // shared recording_start_time anchor for recA/recB.

  let orgId = ''
  let testUserId = ''
  let testUserEmail = ''

  // Eligible event: 2 recordings, event_match_decisions decision='merge_applied'.
  let eventEligibleId = ''
  let recAId = ''
  let recBId = ''
  let decisionEligibleId = ''

  // Ineligible event: 2 recordings share event_id, but NO merge_applied
  // event_match_decisions row -- 37-RESEARCH.md Pitfall 2's exact case.
  let eventIneligibleId = ''
  let recCId = ''
  let recDId = ''

  let chunkA0OriginalText = ''
  let chunkA0Id = ''

  const sourceCode = readFileSync(FUNCTION_SOURCE_PATH, 'utf-8')

  beforeAll(async () => {
    if (!integrationDbReachable) return

    testUserEmail = `phase37-03-user-${stamp}@callvault.test`
    const createUser = await admin.auth.admin.createUser({
      email: testUserEmail,
      password: `phase37-03-pwd-${stamp}!`,
      email_confirm: true,
    })
    if (createUser.error || !createUser.data.user) {
      throw new Error(`${SUITE_TAG} createUser failed: ${createUser.error?.message}`)
    }
    testUserId = createUser.data.user.id

    const org = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} Org ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (org.error || !org.data) {
      throw new Error(`${SUITE_TAG} insert organization failed: ${org.error?.message}`)
    }
    orgId = org.data.id as string

    // --- Eligible event: recA + recB, event_match_decisions merge_applied ---
    const eventEligible = await admin.from('events').insert({}).select('id').single()
    if (eventEligible.error || !eventEligible.data) {
      throw new Error(`${SUITE_TAG} insert eligible event failed: ${eventEligible.error?.message}`)
    }
    eventEligibleId = eventEligible.data.id as string

    const recA = await admin
      .from('recordings')
      .insert({
        organization_id: orgId,
        owner_user_id: testUserId,
        title: `${SUITE_TAG} Recording A ${stamp}`,
        source_app: 'manual',
        event_id: eventEligibleId,
        recording_start_time: anchor,
      })
      .select('id')
      .single()
    if (recA.error || !recA.data) {
      throw new Error(`${SUITE_TAG} insert recording A failed: ${recA.error?.message}`)
    }
    recAId = recA.data.id as string

    const recB = await admin
      .from('recordings')
      .insert({
        organization_id: orgId,
        owner_user_id: testUserId,
        title: `${SUITE_TAG} Recording B ${stamp}`,
        source_app: 'manual',
        event_id: eventEligibleId,
        recording_start_time: anchor,
      })
      .select('id')
      .single()
    if (recB.error || !recB.data) {
      throw new Error(`${SUITE_TAG} insert recording B failed: ${recB.error?.message}`)
    }
    recBId = recB.data.id as string

    const participantA = await admin.from('call_participants').insert({
      recording_id: recAId,
      organization_id: orgId,
      email: testUserEmail,
      name: 'Phase 37-03 Participant A',
      participant_type: 'attendee',
      event_id: eventEligibleId,
    })
    if (participantA.error) {
      throw new Error(`${SUITE_TAG} insert call_participants A failed: ${participantA.error.message}`)
    }

    const participantB = await admin.from('call_participants').insert({
      recording_id: recBId,
      organization_id: orgId,
      email: testUserEmail,
      name: 'Phase 37-03 Participant B',
      participant_type: 'attendee',
      event_id: eventEligibleId,
    })
    if (participantB.error) {
      throw new Error(`${SUITE_TAG} insert call_participants B failed: ${participantB.error.message}`)
    }

    const [orderedA, orderedB] = [recAId, recBId].sort()
    const decisionEligible = await admin
      .from('event_match_decisions')
      .insert({
        recording_id_a: orderedA,
        recording_id_b: orderedB,
        event_id: eventEligibleId,
        tier: 'deterministic',
        decision: 'merge_applied',
        decided_by: 'admin',
        applied: true,
      })
      .select('id')
      .single()
    if (decisionEligible.error || !decisionEligible.data) {
      throw new Error(`${SUITE_TAG} insert event_match_decisions (eligible) failed: ${decisionEligible.error?.message}`)
    }
    decisionEligibleId = decisionEligible.data.id as string

    // Overlapping chunk pair: same [00:00:00, 00:00:05] window on both
    // recordings. "ChatGPT"/"ChatGBT" is a near-miss spelling variant that
    // MUST fuzzy-align as agreement (Pitfall 4); "grew"/"shrank" is a
    // genuine word substitution that MUST resolve via weighted vote.
    const chunkA0 = await admin
      .from('transcript_chunks')
      .insert({
        user_id: testUserId,
        canonical_recording_id: recAId,
        chunk_index: 0,
        chunk_text: 'Revenue grew significantly after the ChatGPT rollout',
        source_platform: 'fathom',
        timestamp_start: '00:00:00',
        timestamp_end: '00:00:05',
      })
      .select('id, chunk_text')
      .single()
    if (chunkA0.error || !chunkA0.data) {
      throw new Error(`${SUITE_TAG} insert transcript_chunks A0 failed: ${chunkA0.error?.message}`)
    }
    chunkA0Id = chunkA0.data.id as string
    chunkA0OriginalText = chunkA0.data.chunk_text as string

    const chunkB0 = await admin.from('transcript_chunks').insert({
      user_id: testUserId,
      canonical_recording_id: recBId,
      chunk_index: 0,
      chunk_text: 'Revenue shrank significantly after the ChatGBT rollout',
      source_platform: 'zoom',
      timestamp_start: '00:00:00',
      timestamp_end: '00:00:05',
    })
    if (chunkB0.error) {
      throw new Error(`${SUITE_TAG} insert transcript_chunks B0 failed: ${chunkB0.error.message}`)
    }

    // Non-overlapping chunk: only recA has coverage of [00:05:00,
    // 00:05:05] -- RECON-06's single-source proof.
    const chunkA1 = await admin.from('transcript_chunks').insert({
      user_id: testUserId,
      canonical_recording_id: recAId,
      chunk_index: 1,
      chunk_text: 'This portion was only captured by one recorder',
      source_platform: 'fathom',
      timestamp_start: '00:05:00',
      timestamp_end: '00:05:05',
    })
    if (chunkA1.error) {
      throw new Error(`${SUITE_TAG} insert transcript_chunks A1 failed: ${chunkA1.error.message}`)
    }

    // --- Ineligible event: recC + recD share event_id, but NO
    //     event_match_decisions row exists at all -- 37-RESEARCH.md
    //     Pitfall 2's exact "raw event_id only" case.
    const eventIneligible = await admin.from('events').insert({}).select('id').single()
    if (eventIneligible.error || !eventIneligible.data) {
      throw new Error(`${SUITE_TAG} insert ineligible event failed: ${eventIneligible.error?.message}`)
    }
    eventIneligibleId = eventIneligible.data.id as string

    const recC = await admin
      .from('recordings')
      .insert({
        organization_id: orgId,
        owner_user_id: testUserId,
        title: `${SUITE_TAG} Recording C ${stamp}`,
        source_app: 'manual',
        event_id: eventIneligibleId,
        recording_start_time: anchor,
      })
      .select('id')
      .single()
    if (recC.error || !recC.data) {
      throw new Error(`${SUITE_TAG} insert recording C failed: ${recC.error?.message}`)
    }
    recCId = recC.data.id as string

    const recD = await admin
      .from('recordings')
      .insert({
        organization_id: orgId,
        owner_user_id: testUserId,
        title: `${SUITE_TAG} Recording D ${stamp}`,
        source_app: 'manual',
        event_id: eventIneligibleId,
        recording_start_time: anchor,
      })
      .select('id')
      .single()
    if (recD.error || !recD.data) {
      throw new Error(`${SUITE_TAG} insert recording D failed: ${recD.error?.message}`)
    }
    recDId = recD.data.id as string

    const participantC = await admin.from('call_participants').insert({
      recording_id: recCId,
      organization_id: orgId,
      email: testUserEmail,
      name: 'Phase 37-03 Participant C',
      participant_type: 'attendee',
      event_id: eventIneligibleId,
    })
    if (participantC.error) {
      throw new Error(`${SUITE_TAG} insert call_participants C failed: ${participantC.error.message}`)
    }

    const participantD = await admin.from('call_participants').insert({
      recording_id: recDId,
      organization_id: orgId,
      email: testUserEmail,
      name: 'Phase 37-03 Participant D',
      participant_type: 'attendee',
      event_id: eventIneligibleId,
    })
    if (participantD.error) {
      throw new Error(`${SUITE_TAG} insert call_participants D failed: ${participantD.error.message}`)
    }

    const chunkC0 = await admin.from('transcript_chunks').insert({
      user_id: testUserId,
      canonical_recording_id: recCId,
      chunk_index: 0,
      chunk_text: 'This event never went through the resolution pipeline',
      source_platform: 'fathom',
      timestamp_start: '00:00:00',
      timestamp_end: '00:00:05',
    })
    if (chunkC0.error) {
      throw new Error(`${SUITE_TAG} insert transcript_chunks C0 failed: ${chunkC0.error.message}`)
    }

    const chunkD0 = await admin.from('transcript_chunks').insert({
      user_id: testUserId,
      canonical_recording_id: recDId,
      chunk_index: 0,
      chunk_text: 'This event never went through the resolution pipeline either',
      source_platform: 'zoom',
      timestamp_start: '00:00:00',
      timestamp_end: '00:00:05',
    })
    if (chunkD0.error) {
      throw new Error(`${SUITE_TAG} insert transcript_chunks D0 failed: ${chunkD0.error.message}`)
    }

    // Spawn the REAL edge function under `deno run`, pointed at the TEST
    // project via env vars -- never deployed to Supabase Cloud.
    denoProc = spawn('deno', ['run', '--allow-net', '--allow-env', FUNCTION_ENTRY], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        SUPABASE_URL: TEST_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
        RECONCILE_SECRET: TEST_RECONCILE_SECRET,
        LOCAL_DENO_TEST_PORT: String(FUNCTION_PORT),
      },
    })
    let stderrBuf = ''
    denoProc.stderr.on('data', (chunk) => {
      stderrBuf += String(chunk)
    })
    denoProc.on('exit', (code) => {
      if (code !== null && code !== 0) {
        console.error(`${SUITE_TAG} deno run exited early (code=${code}): ${stderrBuf}`)
      }
    })

    await waitForServer(20_000)
  }, 60_000)

  afterAll(async () => {
    if (denoProc) {
      denoProc.kill()
      denoProc = null
    }
    if (!integrationDbReachable) return

    const eventIds = [eventEligibleId, eventIneligibleId].filter(Boolean)
    const recordingIds = [recAId, recBId, recCId, recDId].filter(Boolean)

    try {
      if (eventIds.length > 0) {
        const { error } = await admin.from('reconciled_transcript_segments').delete().in('event_id', eventIds)
        if (error) console.warn(`${SUITE_TAG} reconciled_transcript_segments cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} reconciled_transcript_segments cleanup threw:`, err)
    }

    try {
      if (recordingIds.length > 0) {
        const { error } = await admin.from('transcript_chunks').delete().in('canonical_recording_id', recordingIds)
        if (error) console.warn(`${SUITE_TAG} transcript_chunks cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} transcript_chunks cleanup threw:`, err)
    }

    try {
      if (recordingIds.length > 0) {
        const { error } = await admin.from('call_participants').delete().in('recording_id', recordingIds)
        if (error) console.warn(`${SUITE_TAG} call_participants cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} call_participants cleanup threw:`, err)
    }

    try {
      if (decisionEligibleId) {
        const { error } = await admin.from('event_match_decisions').delete().eq('id', decisionEligibleId)
        if (error) console.warn(`${SUITE_TAG} event_match_decisions cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} event_match_decisions cleanup threw:`, err)
    }

    // protect_recording_delete trigger bug (supabase/CLAUDE.md): a recording
    // cannot be hard-deleted while it still has a workspace_entries row
    // (auto-created by ensure_recording_home_entry on insert) -- clear
    // those first, check .error on every step.
    try {
      if (recordingIds.length > 0) {
        const { error } = await admin.from('workspace_entries').delete().in('recording_id', recordingIds)
        if (error) console.warn(`${SUITE_TAG} workspace_entries cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} workspace_entries cleanup threw:`, err)
    }

    try {
      if (recordingIds.length > 0) {
        const { error } = await admin.from('recordings').delete().in('id', recordingIds)
        if (error) console.warn(`${SUITE_TAG} recordings cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} recordings cleanup threw:`, err)
    }

    try {
      if (eventIds.length > 0) {
        const { error } = await admin.from('events').delete().in('id', eventIds)
        if (error) console.warn(`${SUITE_TAG} events cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} events cleanup threw:`, err)
    }

    try {
      if (orgId) {
        const { error } = await admin.from('organizations').delete().eq('id', orgId)
        if (error) console.warn(`${SUITE_TAG} organizations cleanup failed:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} organizations cleanup threw:`, err)
    }

    try {
      const { error } = await admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 })
      if (error) console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC failed:`, error.message)
    } catch (err) {
      console.warn(`${SUITE_TAG} cleanup threw:`, err)
    }
  }, 60_000)

  it('rejects a request with no X-Reconcile-Secret with 401 before any DB work', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'forward', since }),
    })
    expect(res.status).toBe(401)

    const rowCount = await admin.from('reconciled_transcript_segments').select('id', { count: 'exact', head: true }).eq('event_id', eventEligibleId)
    expect(rowCount.count ?? 0, 'an unauthorized request must produce zero reconciled rows').toBe(0)
  })

  it('rejects a request with a wrong X-Reconcile-Secret with 401', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reconcile-Secret': 'not-the-real-secret' },
      body: JSON.stringify({ mode: 'forward', since }),
    })
    expect(res.status).toBe(401)
  })

  it('the real sweep reconciles only the event_match_decisions-eligible event (gating exclusion proof)', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reconcile-Secret': TEST_RECONCILE_SECRET },
      body: JSON.stringify({ mode: 'forward', since }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.eventsReconciled).toBeGreaterThanOrEqual(1)
    expect(body.segmentsWritten).toBeGreaterThanOrEqual(2) // consensus + single_source

    // Gating exclusion (37-RESEARCH.md Pitfall 2): eventIneligible's
    // recordings share only a raw event_id, no merge_applied decision --
    // must produce ZERO reconciled rows.
    const ineligibleRows = await admin.from('reconciled_transcript_segments').select('id').eq('event_id', eventIneligibleId)
    expect(ineligibleRows.error).toBeNull()
    expect(ineligibleRows.data ?? [], 'an event with only a raw event_id (no merge_applied decision) must never be reconciled').toHaveLength(0)
  })

  it('happy path: overlapping interval reconciles to consensus with both recording ids; non-overlapping interval is single_source', async () => {
    const rows = await admin
      .from('reconciled_transcript_segments')
      .select('segment_text, source_recording_ids, agreeing_recording_ids, start_time')
      .eq('event_id', eventEligibleId)
      .order('start_time', { ascending: true })

    expect(rows.error).toBeNull()
    const segments = rows.data ?? []
    expect(segments.length).toBeGreaterThanOrEqual(2)

    const consensusSegment = segments.find((s) => s.source_recording_ids.length === 2)
    expect(consensusSegment, 'the overlapping [00:00:00,00:00:05] interval must produce a 2-source segment').toBeTruthy()
    expect([...consensusSegment!.source_recording_ids].sort()).toEqual([recAId, recBId].sort())
    expect(consensusSegment!.agreeing_recording_ids, 'a source that loses any token disagreement is not counted as agreeing with the final segment').toHaveLength(1)
    expect([recAId, recBId]).toContain(consensusSegment!.agreeing_recording_ids[0])
    // Never fabricated (T-37-05): the reconciled text must contain a real
    // candidate token at the disagreement position, not something neither
    // source said.
    expect(consensusSegment!.segment_text).toMatch(/grew|shrank/)
    expect(consensusSegment!.segment_text).toMatch(/ChatGPT|ChatGBT/i)

    const singleSourceSegment = segments.find((s) => s.source_recording_ids.length === 1)
    expect(singleSourceSegment, 'the non-overlapping [00:05:00,00:05:05] interval must produce a 1-source segment').toBeTruthy()
    expect(singleSourceSegment!.source_recording_ids).toEqual([recAId])
    expect(singleSourceSegment!.agreeing_recording_ids, 'RECON-06: a single-source segment must claim agreement only from its own lone source').toEqual([recAId])
  })

  it('RECON-04 (negative): the source transcript_chunks row is byte-unchanged after the sweep', async () => {
    const after = await admin.from('transcript_chunks').select('chunk_text').eq('id', chunkA0Id).single()
    expect(after.error).toBeNull()
    expect(after.data?.chunk_text, 'the reconciliation write path must never mutate a source transcript_chunks row').toBe(chunkA0OriginalText)
  })

  it('RECON-07 (negative): transcript_chunks.embedded_at is unchanged, and the function source calls no embedding pipeline', async () => {
    const after = await admin.from('transcript_chunks').select('embedded_at').eq('id', chunkA0Id).single()
    expect(after.error).toBeNull()
    expect(after.data?.embedded_at, 'reconciliation must never trigger a silent re-embed').toBeNull()

    // Static negative proof over the REAL deployed source, not a
    // reimplementation -- catches a future edit that re-introduces a call
    // into the embedding pipeline just as reliably as a runtime assertion.
    expect(sourceCode).not.toMatch(/process-embeddings/i)
    expect(sourceCode).not.toMatch(/embed-chunks/i)
    expect(sourceCode).not.toMatch(/embedded_at/i)
    expect(sourceCode).not.toMatch(/\.upsert\(/i)
    expect(sourceCode).not.toMatch(/onConflict/i)
  })
})
