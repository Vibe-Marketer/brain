import { supabase } from '@/integrations/supabase/client'
import type {
  DiscoveredEvent,
  DiscoveredEventPage,
  DisconnectVerifiedEmailResult,
  DiscoveryNotificationSyncResult,
  EventDiscoveryPageInput,
  ParticipationClaimConsumeInput,
  ParticipationClaimConsumeResult,
  ParticipationClaimInspectResult,
  ParticipationInvitationInput,
  ParticipationInvitationResult,
  ParticipationInvitationStatus,
  ReadableEventRecording,
  RestrictedEventRecording,
} from '@/types/event-discovery'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u
const CURSOR_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/u
const MASKED_EMAIL_PATTERN = /^[^\s@]*\*[^\s@]*@[^\s@]+$/u
const MAX_PAGE_SIZE = 50
const MAX_CURSOR_LENGTH = 512

type UnknownRecord = Record<string, unknown>

export class EventDiscoveryError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'EventDiscoveryError'
  }
}

function invalidResponse(operation: string): never {
  throw new EventDiscoveryError(`${operation} returned an invalid response.`, 'INVALID_RESPONSE')
}

function requireRecord(value: unknown, operation: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse(operation)
  return value as UnknownRecord
}

function exactKeys(row: UnknownRecord, keys: readonly string[], operation: string): void {
  const expected = new Set(keys)
  if (Object.keys(row).some((key) => !expected.has(key))) invalidResponse(operation)
}

function requireString(row: UnknownRecord, key: string, operation: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) invalidResponse(operation)
  return value
}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new EventDiscoveryError(`A valid ${label} ID is required.`, 'INVALID_ID')
  }
  return value
}

function requireResponseUuid(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalidResponse(operation)
  return value
}

function requireDate(value: unknown, operation: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) invalidResponse(operation)
  return value
}

function nullableDate(value: unknown, operation: string): string | null {
  if (value === null) return null
  return requireDate(value, operation)
}

function requireClaimToken(token: string): string {
  if (!CLAIM_TOKEN_PATTERN.test(token)) {
    throw new EventDiscoveryError('This claim link is unavailable.', 'CLAIM_UNAVAILABLE')
  }
  return token
}

function requireCursor(cursor: string | null): string | null {
  if (cursor === null) return null
  if (
    cursor.length === 0
    || cursor.length > MAX_CURSOR_LENGTH
    || !CURSOR_PATTERN.test(cursor)
  ) {
    throw new EventDiscoveryError('A valid discovery cursor is required.', 'INVALID_CURSOR')
  }
  try {
    atob(cursor)
  } catch {
    throw new EventDiscoveryError('A valid discovery cursor is required.', 'INVALID_CURSOR')
  }
  return cursor
}

function requireLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new EventDiscoveryError('Discovery limit must be between 1 and 50.', 'INVALID_LIMIT')
  }
  return limit
}

function rpcFailure(operation: string): never {
  throw new EventDiscoveryError(`${operation} failed.`, 'REQUEST_FAILED')
}

function mapConnection(value: unknown): DiscoveredEvent['connection'] {
  const operation = 'Event discovery'
  const row = requireRecord(value, operation)
  exactKeys(row, ['verified_email', 'verified_email_count'], operation)
  const verifiedEmail = requireString(row, 'verified_email', operation)
  if (!MASKED_EMAIL_PATTERN.test(verifiedEmail)) invalidResponse(operation)
  const verifiedEmailCount = row.verified_email_count
  if (!Number.isInteger(verifiedEmailCount) || Number(verifiedEmailCount) < 1) invalidResponse(operation)
  return { verifiedEmail, verifiedEmailCount: Number(verifiedEmailCount) }
}

function mapReadableRecording(value: unknown): ReadableEventRecording {
  const operation = 'Event discovery'
  const row = requireRecord(value, operation)
  exactKeys(row, ['recording_id', 'recording_start_time'], operation)
  const recordingId = requireResponseUuid(row.recording_id, operation)
  const recordingStartedAt = row.recording_start_time === null
    ? null
    : requireDate(row.recording_start_time, operation)
  return { recordingId, recordingStartedAt }
}

function mapRestrictedRecording(value: unknown): RestrictedEventRecording {
  const operation = 'Event discovery'
  const row = requireRecord(value, operation)
  exactKeys(row, ['copy_ordinal', 'request_target', 'request_status', 'cooldown_until'], operation)
  if (!Number.isInteger(row.copy_ordinal) || Number(row.copy_ordinal) < 1) invalidResponse(operation)
  const ordinal = Number(row.copy_ordinal)
  if (row.request_status === 'available') {
    const requestTarget = requireResponseUuid(row.request_target, operation)
    if (row.cooldown_until !== null) invalidResponse(operation)
    return { ordinal, requestTarget, requestState: 'available', availableAt: null }
  }
  if (row.request_status === 'pending') {
    if (row.request_target !== null || row.cooldown_until !== null) invalidResponse(operation)
    return { ordinal, requestTarget: null, requestState: 'pending', availableAt: null }
  }
  if (row.request_status === 'cooldown') {
    if (row.request_target !== null) invalidResponse(operation)
    return {
      ordinal,
      requestTarget: null,
      requestState: 'cooldown',
      availableAt: requireDate(row.cooldown_until, operation),
    }
  }
  return invalidResponse(operation)
}

function safeEventHeading(startsAt: string): string {
  return `Event on ${new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(startsAt))}`
}

function mapEvent(value: unknown): { item: DiscoveredEvent; nextCursor: string | null } {
  const operation = 'Event discovery'
  const row = requireRecord(value, operation)
  exactKeys(row, [
    'event_id',
    'event_time',
    'connection',
    'readable_copies',
    'restricted_copies',
    'state_group',
    'next_cursor',
  ], operation)
  const eventId = requireResponseUuid(row.event_id, operation)
  const startsAt = requireDate(row.event_time, operation)
  if (!['needs_action', 'available', 'waiting'].includes(String(row.state_group))) {
    invalidResponse(operation)
  }
  if (!Array.isArray(row.readable_copies) || !Array.isArray(row.restricted_copies)) {
    invalidResponse(operation)
  }
  const nextCursor = row.next_cursor === null
    ? null
    : requireCursor(requireString(row, 'next_cursor', operation))
  return {
    item: {
      eventId,
      group: row.state_group as DiscoveredEvent['group'],
      startsAt,
      heading: safeEventHeading(startsAt),
      connection: mapConnection(row.connection),
      readableRecordings: row.readable_copies.map(mapReadableRecording),
      restrictedRecordings: row.restricted_copies.map(mapRestrictedRecording),
    },
    nextCursor,
  }
}

function parseInvitationStatus(
  participantId: string,
  value: unknown,
): ParticipationInvitationStatus {
  const operation = 'Invitation status'
  const row = requireRecord(value, operation)
  exactKeys(row, [
    'state',
    'sent_at',
    'expires_at',
    'claimed_at',
    'reminder_opt_in',
    'reminder_scheduled_for',
    'reminder_sent_at',
    'reminder_cancelled_at',
    'can_resend',
  ], operation)
  if (row.state === 'eligible') {
    if (
      row.sent_at !== null
      || row.expires_at !== null
      || row.claimed_at !== null
      || row.reminder_opt_in !== false
      || row.reminder_scheduled_for !== null
      || row.reminder_sent_at !== null
      || row.reminder_cancelled_at !== null
      || row.can_resend !== false
    ) invalidResponse(operation)
    return {
      participantId,
      status: 'eligible',
      sentAt: null,
      expiresAt: null,
      claimedAt: null,
      reminder: { state: 'off' },
      canResend: false,
    }
  }
  if (!['sent', 'claimed', 'expired', 'revoked', 'superseded'].includes(String(row.state))) {
    invalidResponse(operation)
  }
  if (typeof row.reminder_opt_in !== 'boolean' || typeof row.can_resend !== 'boolean') {
    invalidResponse(operation)
  }
  const sentAt = requireDate(row.sent_at, operation)
  const expiresAt = requireDate(row.expires_at, operation)
  const claimedAt = nullableDate(row.claimed_at, operation)
  const reminderCancelledAt = nullableDate(row.reminder_cancelled_at, operation)
  const reminderSentAt = nullableDate(row.reminder_sent_at, operation)
  const reminderScheduledFor = nullableDate(row.reminder_scheduled_for, operation)
  const reminder = reminderSentAt
    ? { state: 'sent' as const, sentAt: reminderSentAt }
    : reminderScheduledFor && !reminderCancelledAt
      ? { state: 'scheduled' as const, scheduledFor: reminderScheduledFor }
      : { state: 'off' as const }
  return {
    participantId,
    status: row.state as Exclude<ParticipationInvitationStatus['status'], 'eligible'>,
    sentAt,
    expiresAt,
    claimedAt,
    reminder,
    canResend: row.can_resend,
  }
}

function parseInvitationResult(value: unknown): ParticipationInvitationResult {
  const operation = 'Participation invitation'
  const row = requireRecord(value, operation)
  exactKeys(row, ['success', 'status'], operation)
  if (row.success !== true || !['sent', 'delivery_pending'].includes(String(row.status))) {
    invalidResponse(operation)
  }
  return { status: row.status as ParticipationInvitationResult['status'] }
}

function claimFailure(retryable: boolean): never {
  throw new EventDiscoveryError(
    retryable ? 'Unable to process this claim right now.' : 'This claim link is unavailable.',
    retryable ? 'CLAIM_RETRYABLE' : 'CLAIM_UNAVAILABLE',
  )
}

async function countEvents(): Promise<number> {
  const { data, error } = await supabase.rpc('count_my_discovered_events')
  if (error) rpcFailure('Event count')
  if (!Array.isArray(data) || data.length !== 1) invalidResponse('Event count')
  const row = requireRecord(data[0], 'Event count')
  exactKeys(row, ['event_count'], 'Event count')
  if (!Number.isSafeInteger(row.event_count) || Number(row.event_count) < 0) invalidResponse('Event count')
  return Number(row.event_count)
}

async function listEvents(input: EventDiscoveryPageInput): Promise<DiscoveredEventPage> {
  const limit = requireLimit(input.limit)
  const cursor = requireCursor(input.cursor)
  const { data, error } = await supabase.rpc('list_my_discovered_events', {
    p_limit: limit,
    p_cursor: cursor,
  })
  if (error) rpcFailure('Event discovery')
  if (!Array.isArray(data)) invalidResponse('Event discovery')
  const mapped = data.map(mapEvent)
  const cursorValues = new Set(mapped.map((entry) => entry.nextCursor))
  if (cursorValues.size > 1) invalidResponse('Event discovery')
  return {
    items: mapped.map((entry) => entry.item),
    nextCursor: mapped[0]?.nextCursor ?? null,
  }
}

async function getParticipationInvitationStatus(
  participantId: string,
): Promise<ParticipationInvitationStatus | null> {
  const safeParticipantId = requireUuid(participantId, 'participant')
  const { data, error } = await supabase.rpc('get_participation_claim_invitation_status', {
    p_participant_id: safeParticipantId,
  })
  if (error) rpcFailure('Invitation status')
  if (!Array.isArray(data) || data.length > 1) invalidResponse('Invitation status')
  return data.length === 0 ? null : parseInvitationStatus(safeParticipantId, data[0])
}

async function getParticipationInvitationStatuses(input: {
  recordingId: string
  participantIds: string[]
}): Promise<ParticipationInvitationStatus[]> {
  requireUuid(input.recordingId, 'recording')
  if (input.participantIds.length > MAX_PAGE_SIZE) {
    throw new EventDiscoveryError('At most 50 participant statuses can be requested.', 'INVALID_LIMIT')
  }
  const participantIds = [...new Set(input.participantIds.map((id) => requireUuid(id, 'participant')))]
  const statuses = await Promise.all(participantIds.map(getParticipationInvitationStatus))
  return statuses.filter((status): status is ParticipationInvitationStatus => status !== null)
}

async function invokeInvitation(input: ParticipationInvitationInput): Promise<ParticipationInvitationResult> {
  requireUuid(input.recordingId, 'recording')
  const participantId = requireUuid(input.participantId, 'participant')
  const { data, error } = await supabase.functions.invoke('send-participation-claim', {
    body: {
      participant_id: participantId,
      send_one_reminder: input.sendReminder,
    },
  })
  if (error) rpcFailure('Participation invitation')
  return parseInvitationResult(data)
}

async function cancelParticipationReminder(input: {
  recordingId: string
  participantId: string
}): Promise<{ status: 'reminder_canceled' }> {
  requireUuid(input.recordingId, 'recording')
  const participantId = requireUuid(input.participantId, 'participant')
  const { data, error } = await supabase.functions.invoke('send-participation-claim', {
    body: { action: 'cancel_reminder', participant_id: participantId },
  })
  if (error) rpcFailure('Reminder cancellation')
  const row = requireRecord(data, 'Reminder cancellation')
  exactKeys(row, ['success', 'status'], 'Reminder cancellation')
  if (row.success !== true || row.status !== 'reminder_canceled') invalidResponse('Reminder cancellation')
  return { status: 'reminder_canceled' }
}

async function inspectParticipationClaim(token: string): Promise<ParticipationClaimInspectResult> {
  const safeToken = requireClaimToken(token)
  const { data, error } = await supabase.functions.invoke('participation-claim', {
    body: { mode: 'inspect', token: safeToken },
  })
  if (error) claimFailure(false)
  const row = requireRecord(data, 'Claim inspection')
  if (row.status === 'unavailable') claimFailure(false)
  if (row.status === 'retryable') claimFailure(true)
  exactKeys(row, ['maskedInvitedEmail', 'confirmationRequired'], 'Claim inspection')
  const maskedInvitedEmail = requireString(row, 'maskedInvitedEmail', 'Claim inspection')
  if (!MASKED_EMAIL_PATTERN.test(maskedInvitedEmail) || typeof row.confirmationRequired !== 'boolean') {
    invalidResponse('Claim inspection')
  }
  return {
    status: 'valid',
    maskedInvitedEmail,
    confirmationRequired: row.confirmationRequired,
  }
}

async function consumeParticipationClaim(
  input: ParticipationClaimConsumeInput,
): Promise<ParticipationClaimConsumeResult> {
  const token = requireClaimToken(input.token)
  const { data, error } = await supabase.functions.invoke('participation-claim', {
    body: {
      mode: 'consume',
      token,
      confirmEmailAttachment: input.confirmEmailAttachment,
    },
  })
  if (error) claimFailure(false)
  const row = requireRecord(data, 'Claim consumption')
  if (row.status === 'unavailable') claimFailure(false)
  if (row.status === 'retryable') claimFailure(true)
  exactKeys(row, ['status', 'discoveredEventCount'], 'Claim consumption')
  if (
    row.status !== 'claimed'
    || !Number.isSafeInteger(row.discoveredEventCount)
    || Number(row.discoveredEventCount) < 0
  ) invalidResponse('Claim consumption')
  return { status: 'claimed', discoveredEventCount: Number(row.discoveredEventCount) }
}

async function syncDiscoveredEventNotifications(): Promise<DiscoveryNotificationSyncResult> {
  const { data, error } = await supabase.rpc('sync_my_discovered_event_notifications')
  if (error) rpcFailure('Discovery notification sync')
  if (!Number.isSafeInteger(data) || Number(data) < 0) invalidResponse('Discovery notification sync')
  return { createdCount: Number(data) }
}

async function disconnectVerifiedEmail(aliasId: string): Promise<DisconnectVerifiedEmailResult> {
  const { data, error } = await supabase.rpc('disconnect_my_verified_email_alias', {
    p_alias_id: requireUuid(aliasId, 'alias'),
  })
  if (error || data !== true) rpcFailure('Verified email disconnect')
  return { status: 'disconnected' }
}

export const eventDiscoveryService = {
  countEvents,
  listEvents,
  getParticipationInvitationStatus,
  getParticipationInvitationStatuses,
  sendParticipationInvitation: invokeInvitation,
  resendParticipationInvitation: invokeInvitation,
  cancelParticipationReminder,
  inspectParticipationClaim,
  consumeParticipationClaim,
  syncDiscoveredEventNotifications,
  disconnectVerifiedEmail,
}
