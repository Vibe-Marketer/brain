import { createHash } from 'node:crypto'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  cleanupPhase39FixtureGraph,
  createPhase39FixtureGraph,
  type Phase39FixtureGraph,
} from '@/test/phase39-fixtures'
import { integrationDbReachable } from '@/test/integration-setup'

const SUITE_TAG = '[phase-39-05 participation-claim invitation]'

function digest(label: string): string {
  return createHash('sha256').update(`${label}:${Date.now()}:${Math.random()}`).digest('hex')
}

function rows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : []
}

describe.skipIf(!integrationDbReachable)(`${SUITE_TAG} real TEST database`, () => {
  const prefix = `phase39-claim-send-${Date.now().toString(36)}`
  let graph: Phase39FixtureGraph
  let participantId = ''

  beforeAll(async () => {
    graph = await createPhase39FixtureGraph(prefix)
    const participant = await graph.admin
      .from('call_participants')
      .select('id')
      .eq('event_id', graph.events.confirmedPrimaryNeedsAction.id)
      .single()
    if (participant.error || !participant.data) {
      throw new Error(`${SUITE_TAG} participant fixture: ${participant.error?.message}`)
    }
    participantId = String(participant.data.id)
  }, 180_000)

  beforeEach(async () => {
    const deleted = await graph.admin
      .from('participation_claim_invitations')
      .delete()
      .eq('participant_id', participantId)
    expect(deleted.error, `${SUITE_TAG} reset invitation state`).toBeNull()
  })

  afterAll(async () => {
    if (!graph) return
    try {
      await graph.admin
        .from('participation_claim_invitations')
        .delete()
        .in('recording_id', Object.values(graph.events).flatMap((event) => [...event.recordingIds]))
    } finally {
      await cleanupPhase39FixtureGraph(graph)
    }
  }, 180_000)

  it('derives owner, participant, recipient, expiry, and reminder state server-side', async () => {
    const tokenHash = digest('initial')
    const created = await graph.clients.owner.rpc('create_or_rotate_participation_claim', {
      p_participant_id: participantId,
      p_token_hash: tokenHash,
      p_send_one_reminder: true,
    })
    expect(created.error, created.error?.message).toBeNull()
    const [result] = rows(created.data)
    expect(result).toMatchObject({
      invited_email: graph.users.confirmedPrimary.email,
      reminder_opt_in: true,
      rotated: false,
    })

    const stored = await graph.admin
      .from('participation_claim_invitations')
      .select('recording_id,participant_id,inviter_user_id,invited_email_normalized,token_hash,state,sent_at,expires_at,reminder_opt_in')
      .eq('participant_id', participantId)
      .single()
    expect(stored.error).toBeNull()
    expect(stored.data).toMatchObject({
      recording_id: graph.events.confirmedPrimaryNeedsAction.recordingIds[0],
      participant_id: participantId,
      inviter_user_id: graph.users.owner.id,
      invited_email_normalized: graph.users.confirmedPrimary.email,
      token_hash: tokenHash,
      state: 'active',
      reminder_opt_in: true,
    })
    expect(new Date(String(stored.data?.expires_at)).getTime() - new Date(String(stored.data?.sent_at)).getTime())
      .toBe(7 * 24 * 60 * 60_000)

    const status = await graph.clients.owner.rpc('get_participation_claim_invitation_status', {
      p_participant_id: participantId,
    })
    expect(status.error).toBeNull()
    expect(rows(status.data)[0]).toMatchObject({ state: 'active', reminder_opt_in: true })
  })

  it('denies non-owners, weak participants, and browser table access', async () => {
    const nonOwner = await graph.clients.unrelated.rpc('create_or_rotate_participation_claim', {
      p_participant_id: participantId,
      p_token_hash: digest('non-owner'),
      p_send_one_reminder: false,
    })
    expect(nonOwner.error).not.toBeNull()

    const weakParticipant = await graph.admin
      .from('call_participants')
      .select('id')
      .eq('event_id', graph.events.calendarOnlyDenied.id)
      .single()
    expect(weakParticipant.error).toBeNull()
    const weak = await graph.clients.owner.rpc('create_or_rotate_participation_claim', {
      p_participant_id: weakParticipant.data?.id,
      p_token_hash: digest('weak'),
      p_send_one_reminder: false,
    })
    expect(weak.error).not.toBeNull()

    const browserRead = await graph.clients.owner
      .from('participation_claim_invitations')
      .select('*')
    expect(browserRead.data ?? []).toEqual([])
  })

  it('serializes concurrent creation and permits rotation only after seven days', async () => {
    const firstHash = digest('race-a')
    const secondHash = digest('race-b')
    const raced = await Promise.all([
      graph.clients.owner.rpc('create_or_rotate_participation_claim', {
        p_participant_id: participantId,
        p_token_hash: firstHash,
        p_send_one_reminder: false,
      }),
      graph.clients.owner.rpc('create_or_rotate_participation_claim', {
        p_participant_id: participantId,
        p_token_hash: secondHash,
        p_send_one_reminder: false,
      }),
    ])
    expect(raced.filter((result) => result.error === null)).toHaveLength(1)

    const active = await graph.admin
      .from('participation_claim_invitations')
      .select('id,token_hash')
      .eq('participant_id', participantId)
      .eq('state', 'active')
      .single()
    expect(active.error).toBeNull()

    const tooSoon = await graph.clients.owner.rpc('create_or_rotate_participation_claim', {
      p_participant_id: participantId,
      p_token_hash: digest('too-soon'),
      p_send_one_reminder: false,
    })
    expect(tooSoon.error).not.toBeNull()

    const aged = await graph.admin
      .from('participation_claim_invitations')
      .update({ sent_at: new Date(Date.now() - 7 * 24 * 60 * 60_000 - 1_000).toISOString() })
      .eq('id', active.data?.id)
    expect(aged.error).toBeNull()

    const rotatedHash = digest('rotated')
    const rotated = await graph.clients.owner.rpc('create_or_rotate_participation_claim', {
      p_participant_id: participantId,
      p_token_hash: rotatedHash,
      p_send_one_reminder: false,
    })
    expect(rotated.error, rotated.error?.message).toBeNull()
    expect(rows(rotated.data)[0]).toMatchObject({ rotated: true, reminder_opt_in: false })

    const invitations = await graph.admin
      .from('participation_claim_invitations')
      .select('token_hash,state,superseded_at')
      .eq('participant_id', participantId)
      .order('created_at')
    expect(invitations.error).toBeNull()
    expect(invitations.data).toHaveLength(2)
    expect(invitations.data?.find((row) => row.token_hash === rotatedHash)?.state).toBe('active')
    expect(invitations.data?.find((row) => row.token_hash !== rotatedHash)).toMatchObject({
      state: 'superseded',
    })
  })
})
