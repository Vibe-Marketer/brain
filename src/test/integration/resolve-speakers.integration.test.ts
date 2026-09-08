/**
 * resolve-speakers integration proof (Phase 35 Plan 03, Task 2).
 *
 * resolve-speakers is deploy-deferred (Plan 04) -- this suite proves the
 * REAL edge function code against a REAL TEST-project database without
 * deploying it to Supabase Cloud: it spawns the actual index.ts under
 * `deno run` (Deno.serve defaults to :8000), pointed at the TEST project's
 * URL/service-role key via env vars, and drives it over real HTTP. This is
 * the genuine code path -- not a reimplementation of its logic in the test.
 *
 * Fixtures (one shared event, Org A + Org B, all @callvault.test emails so
 * cleanup_test_fixture_users sweeps them):
 *   - recA (Org A, donor): one chunk, speaker "Alice", identity resolved via
 *     a call_participants row carrying identity_id -- the only eligible
 *     donor per Pitfall 3 (speaker-resolver.ts).
 *   - recB (Org A, target): one anonymous "Speaker 1" chunk overlapping
 *     recA's donor span -- proves propagation (IDENT-04).
 *   - recC (Org A, target): TWO anonymous chunks ("Speaker 1", "Speaker 2"),
 *     both wholly subsumed within recA's donor span -- proves consensus
 *     collapse (IDENT-05).
 *   - recD (Org B, adversarial): one anonymous chunk with the same
 *     overlapping interval as recB's, but bucketed under Org B via its own
 *     call_participants.organization_id -- must NEVER receive a name.
 *
 * Run: npm run test:integration -- resolve-speakers
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { integrationDbReachable, makeIntegrationClient } from '../integration-setup'

const SUITE_TAG = '[phase-35-03 resolve-speakers]'
const RECONCILE_SECRET = `test-secret-${randomUUID()}`
const FUNCTION_PORT = 8000
const FUNCTION_URL = `http://localhost:${FUNCTION_PORT}`
const REPO_ROOT = resolve(__dirname, '../../..')
const FUNCTION_ENTRY = resolve(REPO_ROOT, 'supabase/functions/resolve-speakers/index.ts')

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
  throw new Error(`${SUITE_TAG} resolve-speakers server did not become reachable: ${String(lastError)}`)
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} propagation + consensus collapse + isolation`, () => {
  const admin = makeIntegrationClient() // service-role, TEST project only
  let denoProc: ChildProcessWithoutNullStreams | null = null

  const stamp = Date.now()
  let orgAId = ''
  let orgBId = ''
  let userAId = ''
  let userBId = ''
  let identityAId = ''
  let eventId = ''
  let recAId = '' // Org A donor
  let recBId = '' // Org A propagation target
  let recCId = '' // Org A consensus-collapse target
  let recDId = '' // Org B adversarial (must never receive a name)

  const T0 = '2026-09-01T10:00:00.000Z'

  beforeAll(async () => {
    if (!integrationDbReachable) return

    // 1. Two orgs, two users (test-domain emails -> cleanup_test_fixture_users sweeps them).
    const createA = await admin.auth.admin.createUser({
      email: `phase35-03-a-${stamp}@callvault.test`,
      password: `Pw!${randomUUID()}`,
      email_confirm: true,
    })
    if (createA.error || !createA.data.user) {
      throw new Error(`${SUITE_TAG} createUser A failed: ${createA.error?.message}`)
    }
    userAId = createA.data.user.id

    const createB = await admin.auth.admin.createUser({
      email: `phase35-03-b-${stamp}@callvault.test`,
      password: `Pw!${randomUUID()}`,
      email_confirm: true,
    })
    if (createB.error || !createB.data.user) {
      throw new Error(`${SUITE_TAG} createUser B failed: ${createB.error?.message}`)
    }
    userBId = createB.data.user.id

    const orgA = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} Org A ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (orgA.error || !orgA.data) {
      throw new Error(`${SUITE_TAG} insert org A failed: ${orgA.error?.message}`)
    }
    orgAId = orgA.data.id as string

    const orgB = await admin
      .from('organizations')
      .insert({ name: `${SUITE_TAG} Org B ${stamp}`, type: 'business' })
      .select('id')
      .single()
    if (orgB.error || !orgB.data) {
      throw new Error(`${SUITE_TAG} insert org B failed: ${orgB.error?.message}`)
    }
    orgBId = orgB.data.id as string

    // 2. One event shared by all four recordings (event_id lives on recordings directly).
    const event = await admin
      .from('events')
      .insert({ canonical_start_time: T0, canonical_end_time: '2026-09-01T10:30:00.000Z' })
      .select('id')
      .single()
    if (event.error || !event.data) {
      throw new Error(`${SUITE_TAG} insert event failed: ${event.error?.message}`)
    }
    eventId = event.data.id as string

    // 3. Four recordings, all sharing recording_start_time=T0 for simple offset math.
    async function insertRecording(orgId: string, ownerUserId: string, title: string): Promise<string> {
      const rec = await admin
        .from('recordings')
        .insert({
          organization_id: orgId,
          owner_user_id: ownerUserId,
          title: `${SUITE_TAG} ${title}`,
          source_app: 'manual',
          recording_start_time: T0,
          event_id: eventId,
        })
        .select('id')
        .single()
      if (rec.error || !rec.data) {
        throw new Error(`${SUITE_TAG} insert recording (${title}) failed: ${rec.error?.message}`)
      }
      return rec.data.id as string
    }

    recAId = await insertRecording(orgAId, userAId, 'recA (donor)')
    recBId = await insertRecording(orgAId, userAId, 'recB (propagation target)')
    recCId = await insertRecording(orgAId, userAId, 'recC (consensus-collapse target)')
    recDId = await insertRecording(orgBId, userBId, 'recD (adversarial cross-org)')

    // 4. Identity + donor call_participants row (the ONLY eligible donor --
    //    Pitfall 3: identity_id must come from a resolved participant match,
    //    never a bare speaker_name guess).
    const identityA = await admin
      .from('identities')
      .insert({ owner_user_id: userAId, display_name: `${SUITE_TAG} Identity A` })
      .select('id')
      .single()
    if (identityA.error || !identityA.data) {
      throw new Error(`${SUITE_TAG} insert identity failed: ${identityA.error?.message}`)
    }
    identityAId = identityA.data.id as string

    const donorEmail = `phase35-03-donor-${stamp}@callvault.test`
    async function insertParticipant(
      recordingId: string,
      orgId: string,
      email: string,
      name: string,
      identityId: string | null,
    ) {
      const p = await admin.from('call_participants').insert({
        recording_id: recordingId,
        organization_id: orgId,
        email,
        name,
        participant_type: 'attendee',
        event_id: eventId,
        identity_id: identityId,
      })
      if (p.error) {
        throw new Error(`${SUITE_TAG} insert call_participants (${name}) failed: ${p.error.message}`)
      }
    }
    await insertParticipant(recAId, orgAId, donorEmail, 'Alice Donor', identityAId)
    await insertParticipant(recBId, orgAId, `phase35-03-orgb-anon-${stamp}@callvault.test`, 'Org A Anon B', null)
    await insertParticipant(recCId, orgAId, `phase35-03-orgc-anon-${stamp}@callvault.test`, 'Org A Anon C', null)
    await insertParticipant(recDId, orgBId, `phase35-03-orgd-anon-${stamp}@callvault.test`, 'Org B Anon D', null)

    // 5. transcript_chunks: recording_id NULL (legacy BIGINT column, Phase
    //    33/34 pattern), canonical_recording_id keys every chunk to its
    //    recording.
    async function insertChunk(
      canonicalRecordingId: string,
      ownerUserId: string,
      chunkIndex: number,
      speakerName: string | null,
      speakerEmail: string | null,
      start: string,
      end: string,
    ) {
      const c = await admin.from('transcript_chunks').insert({
        user_id: ownerUserId,
        recording_id: null,
        canonical_recording_id: canonicalRecordingId,
        chunk_text: `${SUITE_TAG} chunk text`,
        chunk_index: chunkIndex,
        speaker_name: speakerName,
        speaker_email: speakerEmail,
        timestamp_start: start,
        timestamp_end: end,
      })
      if (c.error) {
        throw new Error(`${SUITE_TAG} insert transcript_chunks (${canonicalRecordingId}#${chunkIndex}) failed: ${c.error.message}`)
      }
    }

    // Donor span: 00:00:00 - 00:00:10.
    await insertChunk(recAId, userAId, 0, 'Alice Donor', donorEmail, '00:00:00', '00:00:10')
    // Propagation target: overlaps donor span.
    await insertChunk(recBId, userAId, 0, 'Speaker 1', null, '00:00:02', '00:00:06')
    // Consensus-collapse targets: two distinct anonymous labels, both wholly
    // subsumed within the donor's span.
    await insertChunk(recCId, userAId, 0, 'Speaker 1', null, '00:00:01', '00:00:04')
    await insertChunk(recCId, userAId, 1, 'Speaker 2', null, '00:00:05', '00:00:09')
    // Adversarial cross-org: same overlapping interval as recB's, different org.
    await insertChunk(recDId, userBId, 0, 'Speaker 1', null, '00:00:02', '00:00:06')

    // 6. Spawn the REAL edge function under `deno run`, pointed at the TEST
    //    project via env vars -- never deployed to Supabase Cloud.
    denoProc = spawn(
      'deno',
      ['run', '--allow-net', '--allow-env', FUNCTION_ENTRY],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          SUPABASE_URL: process.env.VITE_SUPABASE_TEST_URL,
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
          RECONCILE_SECRET,
        },
      },
    )
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

    try {
      await admin.from('speaker_resolution_decisions').delete().in('target_recording_id', [recBId, recCId, recDId].filter(Boolean))
    } catch (err) {
      console.warn(`${SUITE_TAG} speaker_resolution_decisions cleanup threw:`, err)
    }

    try {
      const cleanup = await admin.rpc('cleanup_test_fixture_users', { p_max_age_minutes: 0 })
      if (cleanup.error) {
        console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC error:`, cleanup.error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC threw:`, err)
    }

    try {
      if (identityAId) {
        const { error } = await admin.from('identities').delete().eq('id', identityAId)
        if (error) console.warn(`${SUITE_TAG} identities cleanup error:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} identities cleanup threw:`, err)
    }

    try {
      if (eventId) {
        const { error } = await admin.from('events').delete().eq('id', eventId)
        if (error) console.warn(`${SUITE_TAG} events cleanup error:`, error.message)
      }
    } catch (err) {
      console.warn(`${SUITE_TAG} events cleanup threw:`, err)
    }

    for (const orgId of [orgAId, orgBId]) {
      try {
        if (orgId) {
          const { error } = await admin.from('organizations').delete().eq('id', orgId)
          if (error) console.warn(`${SUITE_TAG} organizations cleanup error:`, error.message)
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err)
      }
    }
  }, 60_000)

  it('rejects a request with no X-Reconcile-Secret header with 401 before any DB work', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'forward', since: '2020-01-01T00:00:00Z' }),
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('rejects a request with a wrong X-Reconcile-Secret with 401', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reconcile-Secret': 'wrong-secret' },
      body: JSON.stringify({ mode: 'forward', since: '2020-01-01T00:00:00Z' }),
    })
    expect(res.status).toBe(401)
  })

  it('propagates the donor identity onto the overlapping anonymous target (IDENT-04) via the ledger, not an in-place overwrite', async () => {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Reconcile-Secret': RECONCILE_SECRET },
      body: JSON.stringify({ mode: 'forward', since: '2020-01-01T00:00:00Z' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.propagated).toBeGreaterThanOrEqual(1)

    const decision = await admin
      .from('speaker_resolution_decisions')
      .select('*')
      .eq('target_recording_id', recBId)
      .eq('tier', 'propagation')
      .maybeSingle()
    if (decision.error) {
      throw new Error(`${SUITE_TAG} querying propagation decision failed: ${decision.error.message}`)
    }
    expect(decision.data, `${SUITE_TAG} expected a propagation ledger row for recB`).toBeTruthy()
    expect(decision.data?.identity_id).toBe(identityAId)
    expect(decision.data?.applied).toBe(false)
    expect(decision.data?.decided_by).toBe('auto')

    // Never an in-place overwrite: the source chunk's speaker_name must
    // still read the original anonymous label.
    const chunk = await admin
      .from('transcript_chunks')
      .select('speaker_name')
      .eq('canonical_recording_id', recBId)
      .eq('chunk_index', 0)
      .single()
    expect(chunk.data?.speaker_name).toBe('Speaker 1')
  })

  it('collapses the over-segmented anonymous pair into the donor identity (IDENT-05) via a consensus_collapse ledger row', async () => {
    const decisions = await admin
      .from('speaker_resolution_decisions')
      .select('*')
      .eq('target_recording_id', recCId)
      .eq('tier', 'consensus_collapse')
    if (decisions.error) {
      throw new Error(`${SUITE_TAG} querying consensus_collapse decisions failed: ${decisions.error.message}`)
    }
    expect(
      decisions.data?.length ?? 0,
      `${SUITE_TAG} expected consensus_collapse ledger rows for recC's over-segmented pair`,
    ).toBeGreaterThanOrEqual(2)
    for (const row of decisions.data ?? []) {
      expect(row.identity_id).toBe(identityAId)
      expect(row.applied).toBe(false)
    }

    const chunks = await admin
      .from('transcript_chunks')
      .select('speaker_name')
      .eq('canonical_recording_id', recCId)
      .order('chunk_index')
    expect((chunks.data ?? []).map((c) => c.speaker_name)).toEqual(['Speaker 1', 'Speaker 2'])
  })

  it('never resolves the cross-org anonymous chunk (adversarial isolation)', async () => {
    const decisions = await admin
      .from('speaker_resolution_decisions')
      .select('*')
      .eq('target_recording_id', recDId)
    if (decisions.error) {
      throw new Error(`${SUITE_TAG} querying recD decisions failed: ${decisions.error.message}`)
    }
    expect(
      decisions.data?.length ?? 0,
      `${SUITE_TAG} SAFE-04 VIOLATION: Org B's anonymous chunk received ${decisions.data?.length ?? 0} resolution decision(s) from an Org A donor`,
    ).toBe(0)
  })
})
