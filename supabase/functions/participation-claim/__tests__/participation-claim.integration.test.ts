import { createHash, randomBytes } from 'node:crypto'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

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
type InvitationState = 'sent' | 'claimed' | 'expired' | 'revoked' | 'superseded'

interface RuntimeClaim {
  token: string
  digest: string
}

interface SeededInvitation extends RuntimeClaim {
  id: string
  participantId: string
  recordingId: string
  invitedEmail: string
}

interface DetachedParticipant {
  id: string
  recordingId: string
  eventId: string
}

const GENERIC_UNAVAILABLE = {
  status: 'unavailable',
  error: 'This claim link is unavailable.',
}

function functionUrl(): { url: string; anonKey: string } {
  const config = getIntegrationTestFetchConfig()
  if (!config) throw new Error('dedicated test fetch configuration is unavailable')
  return {
    url: `${assertDedicatedTestProject(config.url)}/functions/v1/participation-claim`,
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

function newRuntimeClaim(): RuntimeClaim {
  const token = randomBytes(32).toString('base64url')
  return {
    token,
    digest: createHash('sha256').update(token).digest('hex'),
  }
}

function expectPrivacySafe(value: unknown, rawToken?: string): void {
  const serialized = JSON.stringify(value)
  if (rawToken) expect(serialized).not.toContain(rawToken)
  expect(serialized).not.toMatch(/event_id|recording_id|recording_title|owner_user_id|transcript|summary|source_call_id|provider/i)
}

function isMissingPhase39Relation(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error && (
    error.code === 'PGRST205'
    || error.code === '42P01'
    || /participation_claim_invitations.*(?:schema cache|does not exist)/i.test(error.message ?? '')
  ))
}

describe.skipIf(!integrationDbReachable)('participation-claim inspect and atomic consume contract (RED)', () => {
  let graph: Phase39FixtureGraph
  let prefix = ''
  let intendedParticipantId = ''
  let conflictingParticipantId = ''
  let detachedEmail = ''
  let detachedParticipants: DetachedParticipant[] = []

  async function seedInvitation(options: {
    participantId?: string
    recordingId?: string
    invitedEmail?: string
    state?: InvitationState
    sentAt?: string
    expiresAt?: string
    reminder?: boolean
  } = {}): Promise<SeededInvitation> {
    const claim = newRuntimeClaim()
    const participantId = options.participantId ?? intendedParticipantId
    const recordingId = options.recordingId ?? graph.events.confirmedPrimaryNeedsAction.recordingIds[0]
    const invitedEmail = options.invitedEmail ?? graph.users.confirmedPrimary.email
    const state = options.state ?? 'sent'
    const sentAt = options.sentAt ?? new Date().toISOString()
    const expiresAt = options.expiresAt ?? new Date(Date.parse(sentAt) + 7 * 24 * 60 * 60_000).toISOString()
    const now = new Date().toISOString()
    const terminalFields = {
      claimed_at: state === 'claimed' ? now : null,
      revoked_at: state === 'revoked' ? now : null,
      superseded_at: state === 'superseded' ? now : null,
    }
    const inserted = await graph.admin.from('participation_claim_invitations').insert({
      recording_id: recordingId,
      participant_id: participantId,
      inviter_user_id: graph.users.owner.id,
      invited_email: invitedEmail,
      token_hash: claim.digest,
      state,
      sent_at: sentAt,
      expires_at: expiresAt,
      reminder_opt_in: options.reminder ?? false,
      reminder_scheduled_for: options.reminder
        ? new Date(Date.parse(sentAt) + 6 * 24 * 60 * 60_000).toISOString()
        : null,
      reminder_provider_id: options.reminder ? `phase39-reminder-${randomBytes(8).toString('hex')}` : null,
      ...terminalFields,
    }).select('id').single()
    if (inserted.error || typeof inserted.data?.id !== 'string') {
      throw new Error(`seed participation claim invitation: ${inserted.error?.message}`)
    }
    return { ...claim, id: inserted.data.id, participantId, recordingId, invitedEmail }
  }

  async function clearClaimState(): Promise<void> {
    if (!graph) return
    const invitationDelete = await graph.admin
      .from('participation_claim_invitations')
      .delete()
      .eq('inviter_user_id', graph.users.owner.id)
    if (invitationDelete.error && !isMissingPhase39Relation(invitationDelete.error)) {
      throw new Error(`claim invitation cleanup failed: ${invitationDelete.error.message}`)
    }

    const owned = await graph.admin
      .from('identities')
      .select('id')
      .in('owner_user_id', [graph.users.confirmedPrimary.id, graph.users.unrelated.id])
    if (owned.error) throw new Error(`claim identity lookup cleanup failed: ${owned.error.message}`)
    const identityIds = (owned.data ?? []).flatMap((row) => typeof row.id === 'string' ? [row.id] : [])
    if (identityIds.length === 0) return
    const unlink = await graph.admin.from('call_participants').update({ identity_id: null }).in('identity_id', identityIds)
    if (unlink.error) throw new Error(`claim participant unlink cleanup failed: ${unlink.error.message}`)
    const aliases = await graph.admin.from('identity_aliases').delete().in('identity_id', identityIds)
    if (aliases.error) throw new Error(`claim alias cleanup failed: ${aliases.error.message}`)
    const identities = await graph.admin.from('identities').delete().in('id', identityIds)
    if (identities.error) throw new Error(`claim identity cleanup failed: ${identities.error.message}`)
  }

  async function invitationSnapshot(id: string): Promise<JsonRecord> {
    const result = await graph.admin
      .from('participation_claim_invitations')
      .select('id, token_hash, state, sent_at, expires_at, claimed_at, superseded_at, revoked_at, reminder_scheduled_for, reminder_provider_id, reminder_cancelled_at')
      .eq('id', id)
      .single()
    if (result.error) throw new Error(`invitation snapshot: ${result.error.message}`)
    return result.data as JsonRecord
  }

  beforeAll(async () => {
    prefix = `phase39-clm-${Date.now().toString().slice(-6)}`
    graph = await createPhase39FixtureGraph(prefix)
    detachedEmail = `${prefix.replace(/[^a-z0-9]/gi, '')}-detached@example.invalid`

    const intended = await graph.admin
      .from('call_participants')
      .select('id')
      .eq('recording_id', graph.events.confirmedPrimaryNeedsAction.recordingIds[0])
      .eq('email', graph.users.confirmedPrimary.email)
      .single()
    expect(intended.error).toBeNull()
    if (typeof intended.data?.id !== 'string') throw new Error('intended participant fixture has no id')
    intendedParticipantId = intended.data.id

    const conflicting = await graph.admin
      .from('call_participants')
      .select('id')
      .eq('recording_id', graph.events.conflictingAliasDenied.recordingIds[0])
      .eq('email', `${prefix.replace(/[^a-z0-9]/gi, '').slice(0, 28)}-conflicting-evidence@example.invalid`)
      .single()
    expect(conflicting.error).toBeNull()
    if (typeof conflicting.data?.id !== 'string') throw new Error('conflicting participant fixture has no id')
    conflictingParticipantId = conflicting.data.id

    const detachedRows = [
      {
        recording_id: graph.events.requestPending.recordingIds[0],
        event_id: graph.events.requestPending.id,
        identity_id: null,
      },
      {
        recording_id: graph.events.requestRejected.recordingIds[0],
        event_id: graph.events.requestRejected.id,
        identity_id: null,
      },
      {
        recording_id: graph.events.notificationBaseline.recordingIds[0],
        event_id: graph.events.notificationBaseline.id,
        identity_id: graph.identities.conflictingAlias,
      },
    ].map((row, index) => ({
      ...row,
      organization_id: graph.organizationId,
      name: `Detached Match ${index}`,
      email: detachedEmail,
      participant_type: 'speaker',
      role: 'speaker',
      has_confirmed_speech: true,
      sources: ['transcript_speaker'],
    }))
    const inserted = await graph.admin
      .from('call_participants')
      .insert(detachedRows)
      .select('id, recording_id, event_id')
    expect(inserted.error).toBeNull()
    detachedParticipants = (inserted.data ?? []) as DetachedParticipant[]
    expect(detachedParticipants).toHaveLength(3)
  }, 90_000)

  afterEach(async () => {
    await clearClaimState()
  }, 30_000)

  afterAll(async () => {
    if (!graph) return
    await clearClaimState()
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

  it.each(['inspect', 'consume'] as const)('%s requires an authenticated caller', async (mode) => {
    const claim = newRuntimeClaim()
    const result = await invoke({ mode, token: claim.token })
    expect(result.response.status).toBe(401)
    expectPrivacySafe(result.json, claim.token)
  })

  it('inspect accepts only a bounded token and returns no private metadata', async () => {
    const invitation = await seedInvitation()
    const result = await invoke({
      mode: 'inspect',
      token: invitation.token,
      event_id: graph.events.confirmedPrimaryNeedsAction.id,
      email: invitation.invitedEmail,
    }, await bearerFor(graph, 'confirmedPrimary'))
    expect(result.response.status).toBe(400)
    expect(result.json).toMatchObject({ code: 'INVALID_REQUEST' })
    expectPrivacySafe(result.json, invitation.token)
  })

  it('intended-account inspect is non-consuming and returns only masked email plus confirmation flag', async () => {
    const invitation = await seedInvitation({ reminder: true })
    const before = await invitationSnapshot(invitation.id)
    const participantBefore = await graph.admin
      .from('call_participants')
      .select('id, identity_id')
      .eq('email', invitation.invitedEmail)
      .order('id')
    const notificationBefore = await graph.admin
      .from('user_notifications')
      .select('id')
      .eq('user_id', graph.users.confirmedPrimary.id)
    const [first, second] = await Promise.all([
      invoke({ mode: 'inspect', token: invitation.token }, await bearerFor(graph, 'confirmedPrimary')),
      invoke({ mode: 'inspect', token: invitation.token }, await bearerFor(graph, 'confirmedPrimary')),
    ])
    for (const result of [first, second]) {
      expect(result.response.status).toBe(200)
      expect(result.json).toEqual({
        maskedInvitedEmail: expect.stringMatching(/^.{1,3}\*+@/),
        confirmationRequired: false,
      })
      expectPrivacySafe(result.json, invitation.token)
    }
    expect(await invitationSnapshot(invitation.id)).toEqual(before)
    const participantAfter = await graph.admin
      .from('call_participants')
      .select('id, identity_id')
      .eq('email', invitation.invitedEmail)
      .order('id')
    const notificationAfter = await graph.admin
      .from('user_notifications')
      .select('id')
      .eq('user_id', graph.users.confirmedPrimary.id)
    expect(participantAfter.data).toEqual(participantBefore.data)
    expect(notificationAfter.data).toEqual(notificationBefore.data)
    const identities = await graph.admin.from('identities').select('id').eq('owner_user_id', graph.users.confirmedPrimary.id)
    const aliases = await graph.admin.from('identity_aliases').select('id').eq('value', invitation.invitedEmail).eq('verified', true)
    expect(identities.data).toEqual([])
    expect(aliases.data).toEqual([])
  })

  it('intended primary can atomically consume without a second confirmation step', async () => {
    const invitation = await seedInvitation({ reminder: true })
    const result = await invoke(
      { mode: 'consume', token: invitation.token },
      await bearerFor(graph, 'confirmedPrimary'),
    )
    expect(result.response.status).toBe(200)
    expect(result.json).toMatchObject({ status: 'claimed', discoveredEventCount: expect.any(Number) })
    expectPrivacySafe(result.json, invitation.token)

    const row = await invitationSnapshot(invitation.id)
    expect(row).toMatchObject({ state: 'claimed', claimed_at: expect.any(String), reminder_cancelled_at: expect.any(String) })
    const identities = await graph.admin.from('identities').select('id').eq('owner_user_id', graph.users.confirmedPrimary.id)
    expect(identities.data).toHaveLength(1)
    const aliases = await graph.admin
      .from('identity_aliases')
      .select('identity_id, verified, verified_at')
      .eq('value', invitation.invitedEmail)
      .eq('verified', true)
    expect(aliases.data).toHaveLength(1)
    expect(aliases.data?.[0]).toMatchObject({ identity_id: identities.data?.[0]?.id, verified: true, verified_at: expect.any(String) })
  })

  it('different-primary inspect requires confirmation and a declined consume leaves the token active', async () => {
    const invitation = await seedInvitation({
      participantId: detachedParticipants[0].id,
      recordingId: detachedParticipants[0].recordingId,
      invitedEmail: detachedEmail,
    })
    const token = await bearerFor(graph, 'unrelated')
    const inspected = await invoke({ mode: 'inspect', token: invitation.token }, token)
    expect(inspected.response.status).toBe(200)
    expect(inspected.json).toEqual({
      maskedInvitedEmail: expect.stringMatching(/^.{1,3}\*+@/),
      confirmationRequired: true,
    })
    const declined = await invoke({ mode: 'consume', token: invitation.token }, token)
    expect(declined.response.status).toBe(404)
    expect(declined.json).toEqual(GENERIC_UNAVAILABLE)
    expect(await invitationSnapshot(invitation.id)).toMatchObject({ state: 'sent', claimed_at: null })
    expectPrivacySafe(declined.json, invitation.token)
  })

  it('explicit different-primary confirmation attaches the email once and discovers every null-linked match', async () => {
    const invitation = await seedInvitation({
      participantId: detachedParticipants[0].id,
      recordingId: detachedParticipants[0].recordingId,
      invitedEmail: detachedEmail,
      reminder: true,
    })
    const result = await invoke({
      mode: 'consume',
      token: invitation.token,
      confirmEmailAttachment: true,
    }, await bearerFor(graph, 'unrelated'))
    expect(result.response.status).toBe(200)
    expect(result.json).toMatchObject({ status: 'claimed', discoveredEventCount: 2 })
    expectPrivacySafe(result.json, invitation.token)

    const identities = await graph.admin.from('identities').select('id').eq('owner_user_id', graph.users.unrelated.id)
    expect(identities.data).toHaveLength(1)
    const identityId = identities.data?.[0]?.id
    const alias = await graph.admin
      .from('identity_aliases')
      .select('identity_id, verified')
      .eq('value', detachedEmail)
      .eq('verified', true)
      .single()
    expect(alias.data).toEqual({ identity_id: identityId, verified: true })
    const links = await graph.admin
      .from('call_participants')
      .select('id, identity_id')
      .eq('email', detachedEmail)
      .order('id')
    expect(links.data?.filter((row) => row.identity_id === identityId)).toHaveLength(2)
    expect(links.data?.find((row) => row.id === detachedParticipants[2].id)?.identity_id).toBe(graph.identities.conflictingAlias)

    const discovered = await graph.clients.unrelated.rpc('list_my_discovered_events', {
      p_limit: 50,
      p_cursor: null,
    })
    expect(discovered.error).toBeNull()
    expect((discovered.data as JsonRecord[]).map((row) => row.event_id)).toEqual(expect.arrayContaining([
      detachedParticipants[0].eventId,
      detachedParticipants[1].eventId,
    ]))
    const deniedContent = await graph.clients.unrelated
      .from('recordings')
      .select('*')
      .eq('id', detachedParticipants[0].recordingId)
    expect(deniedContent.error).toBeNull()
    expect(deniedContent.data).toEqual([])
  })

  it('two parallel consumes commit exactly one winner and one generic loser', async () => {
    const invitation = await seedInvitation()
    const bearer = await bearerFor(graph, 'confirmedPrimary')
    const results = await Promise.all([
      invoke({ mode: 'consume', token: invitation.token }, bearer),
      invoke({ mode: 'consume', token: invitation.token }, bearer),
    ])
    expect(results.filter((result) => result.json.status === 'claimed')).toHaveLength(1)
    expect(results.filter((result) => result.json.status === 'unavailable')).toHaveLength(1)
    expect(results.find((result) => result.json.status === 'unavailable')?.json).toEqual(GENERIC_UNAVAILABLE)
    const aliases = await graph.admin
      .from('identity_aliases')
      .select('id')
      .eq('value', invitation.invitedEmail)
      .eq('verified', true)
    expect(aliases.data).toHaveLength(1)
    expectPrivacySafe(results.map((result) => result.json), invitation.token)
  })

  it('successful consume supersedes every active sibling for the invited email', async () => {
    const first = await seedInvitation({
      participantId: detachedParticipants[0].id,
      recordingId: detachedParticipants[0].recordingId,
      invitedEmail: detachedEmail,
    })
    const sibling = await seedInvitation({
      participantId: detachedParticipants[1].id,
      recordingId: detachedParticipants[1].recordingId,
      invitedEmail: detachedEmail,
      reminder: true,
    })
    const result = await invoke({
      mode: 'consume',
      token: first.token,
      confirmEmailAttachment: true,
    }, await bearerFor(graph, 'unrelated'))
    expect(result.response.status).toBe(200)
    expect(await invitationSnapshot(first.id)).toMatchObject({ state: 'claimed', claimed_at: expect.any(String) })
    expect(await invitationSnapshot(sibling.id)).toMatchObject({
      state: 'superseded',
      superseded_at: expect.any(String),
      reminder_cancelled_at: expect.any(String),
    })
  })

  it('replay and every terminal, conflict, malformed, or unknown token are externally identical', async () => {
    const now = Date.now()
    const replay = await seedInvitation({ state: 'claimed' })
    const expired = await seedInvitation({
      state: 'sent',
      sentAt: new Date(now - 8 * 24 * 60 * 60_000).toISOString(),
      expiresAt: new Date(now - 24 * 60 * 60_000).toISOString(),
    })
    const revoked = await seedInvitation({ state: 'revoked' })
    const superseded = await seedInvitation({ state: 'superseded' })
    const conflict = await seedInvitation({
      participantId: conflictingParticipantId,
      recordingId: graph.events.conflictingAliasDenied.recordingIds[0],
      invitedEmail: graph.participants.verifiedAlias.email.replace('verified-evidence', 'conflicting-evidence'),
    })
    const unknown = newRuntimeClaim()
    const bearer = await bearerFor(graph, 'unrelated')
    const tokens = [replay.token, expired.token, revoked.token, superseded.token, conflict.token, unknown.token, 'malformed']
    const results = await Promise.all(tokens.map((token) => invoke({ mode: 'consume', token, confirmEmailAttachment: true }, bearer)))
    for (const result of results) {
      expect(result.response.status).toBe(404)
      expect(result.json).toEqual(GENERIC_UNAVAILABLE)
      expectPrivacySafe(result.json)
    }
  })

  it('invitation storage is digest-only with exact seven-day lifetime', async () => {
    const invitation = await seedInvitation({ reminder: true })
    const row = await graph.admin.from('participation_claim_invitations').select('*').eq('id', invitation.id).single()
    expect(row.error).toBeNull()
    const serialized = JSON.stringify(row.data)
    expect(serialized).not.toContain(invitation.token)
    expect(serialized).not.toMatch(/"(?:token|raw_token|claim_url)"\s*:/i)
    expect(row.data?.token_hash).toBe(invitation.digest)
    expect(Date.parse(String(row.data?.expires_at)) - Date.parse(String(row.data?.sent_at))).toBe(7 * 24 * 60 * 60_000)
    expect(Date.parse(String(row.data?.reminder_scheduled_for))).toBeLessThan(Date.parse(String(row.data?.expires_at)))
  })

  it('browser callers cannot inspect the private invitation ledger directly', async () => {
    const invitation = await seedInvitation()
    const direct = await graph.clients.confirmedPrimary
      .from('participation_claim_invitations')
      .select('*')
      .eq('id', invitation.id)
    expect(direct.error).not.toBeNull()
    expect(direct.data).toBeNull()
  })

  it('database inspect is privacy-safe, authenticated, and exactly non-consuming', async () => {
    const invitation = await seedInvitation({ reminder: true })
    const before = await invitationSnapshot(invitation.id)
    const identityBefore = await graph.admin
      .from('identities')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', graph.users.confirmedPrimary.id)

    const [first, second] = await Promise.all([
      graph.clients.confirmedPrimary.rpc('inspect_my_participation_claim', {
        p_token_hash: invitation.digest,
      }),
      graph.clients.confirmedPrimary.rpc('inspect_my_participation_claim', {
        p_token_hash: invitation.digest,
      }),
    ])
    for (const inspected of [first, second]) {
      expect(inspected.error, inspected.error?.message).toBeNull()
      expect(inspected.data).toEqual([{
        available: true,
        masked_invited_email: expect.stringMatching(/^.{1,3}\*+@/),
        confirmation_required: false,
      }])
      expectPrivacySafe(inspected.data, invitation.token)
    }

    expect(await invitationSnapshot(invitation.id)).toEqual(before)
    const identityAfter = await graph.admin
      .from('identities')
      .select('*', { count: 'exact', head: true })
      .eq('owner_user_id', graph.users.confirmedPrimary.id)
    expect(identityAfter.count).toBe(identityBefore.count)
  })

  it('database consume requires explicit attachment for a different primary and claims all null matches', async () => {
    const invitation = await seedInvitation({
      participantId: detachedParticipants[0].id,
      recordingId: detachedParticipants[0].recordingId,
      invitedEmail: detachedEmail,
      reminder: true,
    })

    const declined = await graph.clients.unrelated.rpc('consume_my_participation_claim', {
      p_token_hash: invitation.digest,
      p_confirm_email_attachment: false,
    })
    expect(declined.error).toBeNull()
    expect(declined.data).toEqual([{
      success: false,
      discovered_event_count: 0,
      reminder_provider_id: null,
      reminder_cancellation_required: false,
    }])
    expect(await invitationSnapshot(invitation.id)).toMatchObject({ state: 'sent', claimed_at: null })

    const claimed = await graph.clients.unrelated.rpc('consume_my_participation_claim', {
      p_token_hash: invitation.digest,
      p_confirm_email_attachment: true,
    })
    expect(claimed.error, claimed.error?.message).toBeNull()
    expect(claimed.data).toEqual([{
      success: true,
      discovered_event_count: 2,
      reminder_provider_id: expect.any(String),
      reminder_cancellation_required: true,
    }])

    const identity = await graph.admin
      .from('identities')
      .select('id')
      .eq('owner_user_id', graph.users.unrelated.id)
      .single()
    expect(identity.error).toBeNull()
    const alias = await graph.admin
      .from('identity_aliases')
      .select('identity_id,verified,verified_at')
      .eq('value', detachedEmail)
      .eq('verified', true)
      .single()
    expect(alias.data).toMatchObject({ identity_id: identity.data?.id, verified: true })
    const links = await graph.admin
      .from('call_participants')
      .select('id,identity_id')
      .eq('email', detachedEmail)
    expect(links.data?.filter((row) => row.identity_id === identity.data?.id)).toHaveLength(2)
    expect(links.data?.find((row) => row.id === detachedParticipants[2].id)?.identity_id)
      .toBe(graph.identities.conflictingAlias)
  })

  it('database consume has one winner under parallel replay and never grants recording content', async () => {
    const invitation = await seedInvitation()
    const results = await Promise.all([
      graph.clients.confirmedPrimary.rpc('consume_my_participation_claim', {
        p_token_hash: invitation.digest,
        p_confirm_email_attachment: false,
      }),
      graph.clients.confirmedPrimary.rpc('consume_my_participation_claim', {
        p_token_hash: invitation.digest,
        p_confirm_email_attachment: false,
      }),
    ])
    expect(results.every((result) => result.error === null)).toBe(true)
    expect(results.flatMap((result) => result.data ?? []).filter((row) => row.success)).toHaveLength(1)
    expect(results.flatMap((result) => result.data ?? []).filter((row) => !row.success)).toHaveLength(1)

    const aliases = await graph.admin
      .from('identity_aliases')
      .select('id')
      .eq('value', invitation.invitedEmail)
      .eq('verified', true)
    expect(aliases.data).toHaveLength(1)
    const content = await graph.clients.confirmedPrimary
      .from('recordings')
      .select('id,title,full_transcript')
      .eq('id', invitation.recordingId)
    expect(content.error).toBeNull()
    expect(content.data).toEqual([])
  })

  it('database denial is identical for unknown, expired, terminal, and conflicting claims', async () => {
    const now = Date.now()
    const expired = await seedInvitation({
      sentAt: new Date(now - 8 * 24 * 60 * 60_000).toISOString(),
      expiresAt: new Date(now - 24 * 60 * 60_000).toISOString(),
    })
    const revoked = await seedInvitation({ state: 'revoked' })
    const conflict = await seedInvitation({
      participantId: conflictingParticipantId,
      recordingId: graph.events.conflictingAliasDenied.recordingIds[0],
      invitedEmail: graph.participants.verifiedAlias.email.replace('verified-evidence', 'conflicting-evidence'),
    })
    const unknown = newRuntimeClaim()
    const results = await Promise.all([expired.digest, revoked.digest, conflict.digest, unknown.digest].map(
      (p_token_hash) => graph.clients.unrelated.rpc('consume_my_participation_claim', {
        p_token_hash,
        p_confirm_email_attachment: true,
      }),
    ))
    for (const result of results) {
      expect(result.error).toBeNull()
      expect(result.data).toEqual([{
        success: false,
        discovered_event_count: 0,
        reminder_provider_id: null,
        reminder_cancellation_required: false,
      }])
    }
  })
})
