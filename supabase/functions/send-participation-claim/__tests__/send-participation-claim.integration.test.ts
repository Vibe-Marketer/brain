import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  cleanupPhase39FixtureGraph,
  createPhase39FixtureGraph,
  findPhase39FixtureResidue,
  type Phase39FixtureGraph,
  type Phase39FixtureRole,
} from '../../../../src/test/phase39-fixtures'
import {
  assertDedicatedTestProject,
  getIntegrationTestFetchConfig,
  integrationDbReachable,
} from '../../../../src/test/integration-setup'

type JsonRecord = Record<string, unknown>

interface ParticipantIds {
  eligible: string
  alreadyClaimed: string
  transcriptOnly: string
  inviteeOnly: string
  self: string
}

const GENERIC_UNAVAILABLE = {
  code: 'PARTICIPATION_INVITATION_NOT_AVAILABLE',
  error: 'This invitation is not available.',
}

function functionUrl(): { url: string; anonKey: string } {
  const config = getIntegrationTestFetchConfig()
  if (!config) throw new Error('dedicated test fetch configuration is unavailable')
  return {
    url: `${assertDedicatedTestProject(config.url)}/functions/v1/send-participation-claim`,
    anonKey: config.anonKey,
  }
}

async function bearerFor(graph: Phase39FixtureGraph, role: Phase39FixtureRole): Promise<string> {
  const session = await graph.clients[role].auth.getSession()
  const token = session.data.session?.access_token
  if (!token) throw new Error(`missing ${role} fixture access token`)
  return token
}

async function invoke(
  body: JsonRecord,
  token?: string,
): Promise<{ response: Response; json: JsonRecord }> {
  const target = functionUrl()
  const response = await fetch(target.url, {
    method: 'POST',
    headers: {
      apikey: target.anonKey,
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  let json: JsonRecord = {}
  try {
    json = JSON.parse(text) as JsonRecord
  } catch {
    json = { error: 'non-json response' }
  }
  return { response, json }
}

function expectNoPrivateEventData(value: unknown): void {
  const serialized = JSON.stringify(value)
  expect(serialized).not.toMatch(/canonical_start|event_id|recording_title|transcript|summary|speaker|source_call_id/i)
}

function isMissingPhase39Relation(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (
    error.code === 'PGRST205'
    || error.code === '42P01'
    || /participation_claim_invitations.*(?:schema cache|does not exist)/i.test(error.message ?? '')
  ))
}

async function findParticipantId(
  graph: Phase39FixtureGraph,
  recordingId: string,
  email: string | null,
): Promise<string> {
  let query = graph.admin
    .from('call_participants')
    .select('id')
    .eq('recording_id', recordingId)
  query = email === null ? query.is('email', null) : query.eq('email', email)
  const result = await query.single()
  if (result.error || typeof result.data?.id !== 'string') {
    throw new Error(`participant fixture lookup failed: ${result.error?.message}`)
  }
  return result.data.id
}

describe.skipIf(!integrationDbReachable)('send-participation-claim owner and lifecycle contract (RED)', () => {
  let graph: Phase39FixtureGraph
  let participants: ParticipantIds
  let prefix = ''

  beforeAll(async () => {
    prefix = `phase39-snd-${Date.now().toString().slice(-6)}`
    graph = await createPhase39FixtureGraph(prefix)

    const adminMembership = await graph.admin.from('organization_memberships').insert({
      organization_id: graph.organizationId,
      user_id: graph.users.verifiedAlias.id,
      role: 'organization_admin',
    })
    expect(adminMembership.error).toBeNull()
    const viewerMembership = await graph.admin.from('workspace_memberships').insert({
      workspace_id: graph.workspaceId,
      user_id: graph.users.calendarOnly.id,
      role: 'member',
    })
    expect(viewerMembership.error).toBeNull()

    const selfInsert = await graph.admin.from('call_participants').insert({
      recording_id: graph.events.requestRejected.recordingIds[0],
      organization_id: graph.organizationId,
      event_id: graph.events.requestRejected.id,
      identity_id: null,
      name: 'Recording Owner',
      email: graph.users.owner.email,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    }).select('id').single()
    expect(selfInsert.error).toBeNull()
    if (typeof selfInsert.data?.id !== 'string') throw new Error('self participant insert returned no id')

    participants = {
      eligible: await findParticipantId(
        graph,
        graph.events.confirmedPrimaryNeedsAction.recordingIds[0],
        graph.users.confirmedPrimary.email,
      ),
      alreadyClaimed: await findParticipantId(
        graph,
        graph.events.aliasAvailable.recordingIds[0],
        graph.participants.verifiedAlias.email,
      ),
      transcriptOnly: await findParticipantId(
        graph,
        graph.events.nameOnlyDenied.recordingIds[0],
        null,
      ),
      inviteeOnly: await findParticipantId(
        graph,
        graph.events.calendarOnlyDenied.recordingIds[0],
        graph.users.calendarOnly.email,
      ),
      self: selfInsert.data.id,
    }
  }, 90_000)

  afterAll(async () => {
    if (!graph) return
    const recordingIds = Object.values(graph.events).flatMap((event) => [...event.recordingIds])
    const invitations = await graph.admin
      .from('participation_claim_invitations')
      .delete()
      .in('recording_id', recordingIds)
    if (invitations.error && !isMissingPhase39Relation(invitations.error)) {
      throw new Error(`claim invitation cleanup failed: ${invitations.error.message}`)
    }
    await cleanupPhase39FixtureGraph(graph)
    expect(await findPhase39FixtureResidue(graph.admin, prefix)).toEqual({
      authUsers: 0,
      organizations: 0,
      events: 0,
      recordings: 0,
      participants: 0,
      identities: 0,
      aliases: 0,
      requests: 0,
      grants: 0,
      notifications: 0,
    })
  }, 90_000)

  it.fails('RED: rejects a request with no authenticated recording owner', async () => {
    const result = await invoke({ participant_id: participants.eligible })
    expect(result.response.status).toBe(401)
    expectNoPrivateEventData(result.json)
  })

  it.fails.each([
    ['unrelated caller', 'unrelated'],
    ['organization admin', 'verifiedAlias'],
    ['workspace viewer', 'calendarOnly'],
  ] as const)('RED: rejects %s even when the caller can otherwise access the organization', async (_label, role) => {
    const result = await invoke(
      { participant_id: participants.eligible },
      await bearerFor(graph, role),
    )
    expect(result.response.status).toBe(404)
    expect(result.json).toEqual(GENERIC_UNAVAILABLE)
  })

  it.fails('RED: accepts only canonical participant ID and optional reminder flag', async () => {
    const token = await bearerFor(graph, 'owner')
    const forged = await invoke({
      participant_id: participants.eligible,
      send_one_reminder: true,
      email: 'forged@example.invalid',
      owner_user_id: graph.users.unrelated.id,
      status: 'claimed',
      claim_url: 'https://example.invalid/forged',
    }, token)
    expect(forged.response.status).toBe(400)
    expect(forged.json).toMatchObject({ code: 'INVALID_REQUEST' })
    expectNoPrivateEventData(forged.json)
  })

  it.fails.each([
    ['transcript-only row with no email', 'transcriptOnly'],
    ['calendar invitee without confirmed speech', 'inviteeOnly'],
    ['recording owner self-invite', 'self'],
    ['participant email already claimed by an account', 'alreadyClaimed'],
  ] as const)('RED: rejects %s as ineligible', async (_label, key) => {
    const result = await invoke(
      { participant_id: participants[key] },
      await bearerFor(graph, 'owner'),
    )
    expect(result.response.status).toBe(404)
    expect(result.json).toEqual(GENERIC_UNAVAILABLE)
  })

  it.fails('RED: owner sends one invitation derived from the canonical participant', async () => {
    const result = await invoke(
      { participant_id: participants.eligible },
      await bearerFor(graph, 'owner'),
    )
    expect([200, 202]).toContain(result.response.status)
    expect(result.json).toMatchObject({ success: true, status: expect.stringMatching(/sent|delivery_pending/) })
    expect(Object.keys(result.json).sort()).toEqual(['status', 'success'])
    expectNoPrivateEventData(result.json)

    const invitation = await graph.admin
      .from('participation_claim_invitations')
      .select('participant_id, recording_id, inviter_user_id, invited_email, state, token_hash, sent_at, expires_at, reminder_opt_in, reminder_scheduled_for, reminder_provider_id')
      .eq('participant_id', participants.eligible)
      .single()
    expect(invitation.error).toBeNull()
    expect(invitation.data).toMatchObject({
      participant_id: participants.eligible,
      recording_id: graph.events.confirmedPrimaryNeedsAction.recordingIds[0],
      inviter_user_id: graph.users.owner.id,
      invited_email: graph.users.confirmedPrimary.email,
      state: 'sent',
      token_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      reminder_opt_in: false,
      reminder_scheduled_for: null,
      reminder_provider_id: null,
    })
    const lifetime = Date.parse(String(invitation.data?.expires_at)) - Date.parse(String(invitation.data?.sent_at))
    expect(lifetime).toBe(7 * 24 * 60 * 60_000)
    expect(JSON.stringify(invitation.data)).not.toMatch(/claim-participation\?|raw_token|claim_url/i)
  })

  it.fails('RED: parallel duplicate sends are idempotent with one active invitation', async () => {
    const token = await bearerFor(graph, 'owner')
    const [first, second] = await Promise.all([
      invoke({ participant_id: participants.eligible }, token),
      invoke({ participant_id: participants.eligible }, token),
    ])
    expect([first.response.status, second.response.status].sort()).toEqual([200, 200])
    const active = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash, state')
      .eq('participant_id', participants.eligible)
      .eq('state', 'sent')
    expect(active.error).toBeNull()
    expect(active.data).toHaveLength(1)
    expectNoPrivateEventData(first.json)
    expectNoPrivateEventData(second.json)
  })

  it.fails('RED: reminder opt-in schedules exactly once before the invitation expires', async () => {
    const token = await bearerFor(graph, 'owner')
    const [first, duplicate] = await Promise.all([
      invoke({ participant_id: participants.eligible, send_one_reminder: true }, token),
      invoke({ participant_id: participants.eligible, send_one_reminder: true }, token),
    ])
    expect([first.response.status, duplicate.response.status].every((status) => status === 200 || status === 202)).toBe(true)

    const active = await graph.admin
      .from('participation_claim_invitations')
      .select('id, expires_at, reminder_opt_in, reminder_scheduled_for, reminder_provider_id, reminder_sent_at')
      .eq('participant_id', participants.eligible)
      .eq('state', 'sent')
    expect(active.error).toBeNull()
    expect(active.data).toHaveLength(1)
    expect(active.data?.[0]).toMatchObject({
      reminder_opt_in: true,
      reminder_scheduled_for: expect.any(String),
      reminder_provider_id: expect.any(String),
      reminder_sent_at: null,
    })
    expect(Date.parse(String(active.data?.[0]?.reminder_scheduled_for))).toBeLessThan(
      Date.parse(String(active.data?.[0]?.expires_at)),
    )
  })

  it.fails('RED: manual resend is denied before day seven without rotating the digest', async () => {
    const token = await bearerFor(graph, 'owner')
    await invoke({ participant_id: participants.eligible }, token)
    const before = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash, expires_at')
      .eq('participant_id', participants.eligible)
      .eq('state', 'sent')
      .single()
    expect(before.error).toBeNull()

    const resend = await invoke({ participant_id: participants.eligible }, token)
    expect(resend.response.status).toBe(409)
    expect(resend.json).toEqual({ code: 'RESEND_NOT_AVAILABLE', error: 'This invitation cannot be resent yet.' })
    const after = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash, expires_at')
      .eq('participant_id', participants.eligible)
      .eq('state', 'sent')
      .single()
    expect(after.data).toEqual(before.data)
  })

  it.fails('RED: resend after day seven rotates the digest, supersedes the old row, and cancels its reminder', async () => {
    const token = await bearerFor(graph, 'owner')
    await invoke({ participant_id: participants.eligible, send_one_reminder: true }, token)
    const old = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash')
      .eq('participant_id', participants.eligible)
      .eq('state', 'sent')
      .single()
    expect(old.error).toBeNull()
    const age = await graph.admin
      .from('participation_claim_invitations')
      .update({ sent_at: new Date(Date.now() - 8 * 24 * 60 * 60_000).toISOString() })
      .eq('id', old.data?.id)
    expect(age.error).toBeNull()

    const resend = await invoke({ participant_id: participants.eligible }, token)
    expect([200, 202]).toContain(resend.response.status)
    const rows = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash, state, superseded_at, reminder_cancelled_at')
      .eq('participant_id', participants.eligible)
      .order('created_at', { ascending: true })
    expect(rows.error).toBeNull()
    expect(rows.data).toHaveLength(2)
    expect(rows.data?.[0]).toMatchObject({ state: 'superseded', superseded_at: expect.any(String), reminder_cancelled_at: expect.any(String) })
    expect(rows.data?.[1]).toMatchObject({ state: 'sent' })
    expect(rows.data?.[1]?.token_hash).not.toBe(old.data?.token_hash)
  })

  it.fails('RED: browser clients cannot read or mutate the invitation ledger', async () => {
    const read = await graph.clients.owner
      .from('participation_claim_invitations')
      .select('*')
    expect(read.error).toBeNull()
    expect(read.data).toEqual([])
    const write = await graph.clients.owner.from('participation_claim_invitations').insert({
      participant_id: participants.eligible,
      recording_id: graph.events.confirmedPrimaryNeedsAction.recordingIds[0],
      token_hash: '0'.repeat(64),
      state: 'sent',
    })
    expect(write.error).not.toBeNull()
  })
})
