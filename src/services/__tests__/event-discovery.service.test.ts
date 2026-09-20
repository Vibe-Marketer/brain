import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventDiscoveryError, eventDiscoveryService } from '@/services/event-discovery.service'

const rpc = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, functions: { invoke } },
}))

const EVENT_ID = '11111111-1111-4111-a111-111111111111'
const RECORDING_ID = '22222222-2222-4222-a222-222222222222'
const PARTICIPANT_ID = '33333333-3333-4333-a333-333333333333'
const ALIAS_ID = '44444444-4444-4444-a444-444444444444'
const CLAIM_TOKEN = 'a'.repeat(43)
const CURSOR = btoa(`1|1789891200|${EVENT_ID}`)

const safeRow = {
  event_id: EVENT_ID,
  event_time: '2026-09-20T12:00:00.000Z',
  connection: { verified_email: 'a***@example.com', verified_email_count: 1 },
  readable_copies: [],
  restricted_copies: [{
    copy_ordinal: 1,
    request_target: RECORDING_ID,
    request_status: 'available',
    cooldown_until: null,
  }],
  state_group: 'needs_action',
  next_cursor: null,
}

describe('event discovery service privacy boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    rpc.mockResolvedValue({ data: [safeRow], error: null })
    invoke.mockResolvedValue({
      data: { maskedInvitedEmail: 'a***@example.com', confirmationRequired: false },
      error: null,
    })
  })

  it('maps the exact TEST RPC row without changing authoritative order', async () => {
    const second = { ...safeRow, event_id: '55555555-5555-4555-a555-555555555555' }
    rpc.mockResolvedValueOnce({ data: [safeRow, second], error: null })
    const result = await eventDiscoveryService.listEvents({ limit: 25, cursor: null })
    expect(result.items.map((item) => item.eventId)).toEqual([EVENT_ID, second.event_id])
    expect(result.items[0]).toMatchObject({
      group: 'needs_action',
      heading: 'Event on September 20, 2026',
      restrictedRecordings: [{ ordinal: 1, requestTarget: RECORDING_ID, requestState: 'available' }],
    })
    expect(rpc).toHaveBeenCalledWith('list_my_discovered_events', {
      p_limit: 25,
      p_cursor: null,
    })
  })

  it.each([
    ['private restricted metadata', {
      ...safeRow,
      restricted_copies: [{
        ...safeRow.restricted_copies[0],
        owner_email: 'private-owner@example.com',
        title: 'Private roadmap call',
      }],
    }],
    ['private readable metadata', {
      ...safeRow,
      readable_copies: [{
        recording_id: RECORDING_ID,
        recording_start_time: safeRow.event_time,
        transcript: 'private transcript',
      }],
    }],
    ['unexpected top-level metadata', { ...safeRow, participant_roster: ['private@example.com'] }],
    ['malformed request target', {
      ...safeRow,
      restricted_copies: [{ ...safeRow.restricted_copies[0], request_target: 'not-a-uuid' }],
    }],
  ])('rejects %s instead of widening the safe domain', async (_label, row) => {
    rpc.mockResolvedValueOnce({ data: [row], error: null })
    await expect(eventDiscoveryService.listEvents({ limit: 25, cursor: null }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('bounds page size and validates the opaque cursor before RPC I/O', async () => {
    await expect(eventDiscoveryService.listEvents({ limit: 51, cursor: null }))
      .rejects.toMatchObject({ code: 'INVALID_LIMIT' })
    await expect(eventDiscoveryService.listEvents({ limit: 25, cursor: 'not-an-opaque-cursor' }))
      .rejects.toMatchObject({ code: 'INVALID_CURSOR' })
    expect(rpc).not.toHaveBeenCalled()
    rpc.mockResolvedValueOnce({ data: [{ ...safeRow, next_cursor: CURSOR }], error: null })
    await expect(eventDiscoveryService.listEvents({ limit: 25, cursor: CURSOR }))
      .resolves.toMatchObject({ nextCursor: CURSOR })
  })

  it('parses count, notification sync, and disconnect through narrow RPC results', async () => {
    rpc
      .mockResolvedValueOnce({ data: [{ event_count: 7 }], error: null })
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
    await expect(eventDiscoveryService.countEvents()).resolves.toBe(7)
    await expect(eventDiscoveryService.syncDiscoveredEventNotifications())
      .resolves.toEqual({ createdCount: 2 })
    await expect(eventDiscoveryService.disconnectVerifiedEmail(ALIAS_ID))
      .resolves.toEqual({ status: 'disconnected' })
  })

  it('maps server-owned invitation state and rejects extra invitation fields', async () => {
    rpc.mockResolvedValueOnce({
      data: [{
        state: 'sent', sent_at: '2026-09-20T12:00:00.000Z',
        expires_at: '2026-09-27T12:00:00.000Z', claimed_at: null,
        reminder_opt_in: true, reminder_scheduled_for: '2026-09-26T12:00:00.000Z',
        reminder_sent_at: null, reminder_cancelled_at: null, can_resend: false,
      }],
      error: null,
    })
    await expect(eventDiscoveryService.getParticipationInvitationStatus(PARTICIPANT_ID))
      .resolves.toMatchObject({ participantId: PARTICIPANT_ID, status: 'sent', reminder: { state: 'scheduled' } })
    rpc.mockResolvedValueOnce({
      data: [{
        state: 'eligible', sent_at: null, expires_at: null, claimed_at: null,
        reminder_opt_in: false, reminder_scheduled_for: null, reminder_sent_at: null,
        reminder_cancelled_at: null, can_resend: false, invited_email: 'private@example.com',
      }],
      error: null,
    })
    await expect(eventDiscoveryService.getParticipationInvitationStatus(PARTICIPANT_ID))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('sends, resends, and cancels using only participant-scoped Edge inputs', async () => {
    invoke
      .mockResolvedValueOnce({ data: { success: true, status: 'sent' }, error: null })
      .mockResolvedValueOnce({ data: { success: true, status: 'delivery_pending' }, error: null })
      .mockResolvedValueOnce({ data: { success: true, status: 'reminder_canceled' }, error: null })
    const input = { recordingId: RECORDING_ID, participantId: PARTICIPANT_ID, sendReminder: false }
    await expect(eventDiscoveryService.sendParticipationInvitation(input)).resolves.toEqual({ status: 'sent' })
    await expect(eventDiscoveryService.resendParticipationInvitation(input)).resolves.toEqual({ status: 'delivery_pending' })
    await expect(eventDiscoveryService.cancelParticipationReminder({
      recordingId: RECORDING_ID,
      participantId: PARTICIPANT_ID,
    })).resolves.toEqual({ status: 'reminder_canceled' })
    expect(invoke.mock.calls).toEqual([
      ['send-participation-claim', { body: { participant_id: PARTICIPANT_ID, send_one_reminder: false } }],
      ['send-participation-claim', { body: { participant_id: PARTICIPANT_ID, send_one_reminder: false } }],
      ['send-participation-claim', { body: { action: 'cancel_reminder', participant_id: PARTICIPANT_ID } }],
    ])
  })

  it('exposes only the masked email and confirmation flag from valid inspect', async () => {
    await expect(eventDiscoveryService.inspectParticipationClaim(CLAIM_TOKEN)).resolves.toEqual({
      status: 'valid', maskedInvitedEmail: 'a***@example.com', confirmationRequired: false,
    })
    expect(invoke).toHaveBeenCalledWith('participation-claim', {
      body: { mode: 'inspect', token: CLAIM_TOKEN },
    })
    invoke.mockResolvedValueOnce({
      data: { maskedInvitedEmail: 'alice@example.com', confirmationRequired: false },
      error: null,
    })
    await expect(eventDiscoveryService.inspectParticipationClaim(CLAIM_TOKEN))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  it('collapses terminal claim states and never includes the raw token in the error', async () => {
    invoke.mockResolvedValueOnce({
      data: { status: 'expired', event_title: 'Private board meeting', owner_email: 'owner@example.com' },
      error: null,
    })
    const error = await eventDiscoveryService.inspectParticipationClaim(CLAIM_TOKEN)
      .catch((reason: unknown) => reason)
    expect(error).toBeInstanceOf(EventDiscoveryError)
    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' })
    expect(String(error)).not.toContain(CLAIM_TOKEN)
    invoke.mockResolvedValueOnce({ data: { status: 'unavailable' }, error: null })
    await expect(eventDiscoveryService.inspectParticipationClaim(CLAIM_TOKEN))
      .rejects.toMatchObject({ code: 'CLAIM_UNAVAILABLE' })
  })

  it('consumes with explicit confirmation only and rejects overbroad success data', async () => {
    invoke.mockResolvedValueOnce({ data: { status: 'claimed', discoveredEventCount: 3 }, error: null })
    await expect(eventDiscoveryService.consumeParticipationClaim({
      token: CLAIM_TOKEN,
      confirmEmailAttachment: true,
    })).resolves.toEqual({ status: 'claimed', discoveredEventCount: 3 })
    invoke.mockResolvedValueOnce({
      data: { status: 'claimed', discoveredEventCount: 3, event_id: EVENT_ID }, error: null,
    })
    await expect(eventDiscoveryService.consumeParticipationClaim({
      token: CLAIM_TOKEN,
      confirmEmailAttachment: false,
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
})
