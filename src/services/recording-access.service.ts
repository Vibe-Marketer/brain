import { supabase } from '@/integrations/supabase/client'
import type {
  DiscoverableRecordingCopies,
  EventRecordingExistence,
  OwnerRecordingAccessRequest,
  RecordingAccessApprovalResult,
  RecordingAccessDenialResult,
  RecordingAccessEmailDelivery,
  RecordingAccessEvidence,
  RecordingAccessGrant,
  RecordingAccessManagement,
  RecordingAccessRequestResult,
  RecordingAccessRequestStatus,
  RecordingAccessRevocationResult,
} from '@/types/recording-access'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RpcRow = Record<string, unknown>

export class RecordingAccessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'RecordingAccessError'
  }
}

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new RecordingAccessError(`A valid ${label} ID is required.`, 'INVALID_ID')
  }
  return value
}

function firstRow(data: unknown, operation: string): RpcRow {
  if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
    throw new RecordingAccessError(`${operation} returned no result.`, 'INVALID_RESPONSE')
  }
  return data[0] as RpcRow
}

function rpcError(error: { message?: string; code?: string } | null, operation: string): never {
  const message = error?.message ?? `${operation} failed.`
  const knownCode = [
    'ACCESS_ALREADY_AVAILABLE',
    'REQUEST_COOLDOWN_ACTIVE',
    'REQUEST_ALREADY_RESOLVED',
    'REQUEST_NOT_AVAILABLE',
    'GRANT_NOT_AVAILABLE',
    'RECORDING_NOT_AVAILABLE',
  ].find((code) => message.includes(code))
  throw new RecordingAccessError(message, knownCode ?? error?.code ?? 'REQUEST_FAILED')
}

function stringValue(row: RpcRow, key: string, operation: string): string {
  const value = row[key]
  if (typeof value !== 'string') {
    throw new RecordingAccessError(`${operation} returned an invalid ${key}.`, 'INVALID_RESPONSE')
  }
  return value
}

function nullableString(row: RpcRow, key: string): string | null {
  return typeof row[key] === 'string' ? row[key] as string : null
}

function mapEvidence(value: unknown): RecordingAccessEvidence {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as RpcRow
    : {}
  return {
    participantRole: typeof row.participant_role === 'string' ? row.participant_role : null,
    participantType: typeof row.participant_type === 'string' ? row.participant_type : null,
    hasConfirmedSpeech: row.has_confirmed_speech === true,
    sources: Array.isArray(row.sources)
      ? row.sources.filter((source): source is string => typeof source === 'string')
      : [],
  }
}

export async function getEventRecordingExistence(eventId: string): Promise<EventRecordingExistence> {
  requireUuid(eventId, 'event')
  const { data, error } = await supabase.rpc('get_event_existence_for_participant', {
    p_event_id: eventId,
  })
  if (error) rpcError(error, 'Event discovery')
  if (!Array.isArray(data) || data.length === 0) {
    return { eligible: false, hasOtherCopies: false }
  }
  const row = data[0] as RpcRow
  return { eligible: true, hasOtherCopies: row.has_other_copies === true }
}

export async function listDiscoverableRecordingCopies(
  eventId: string,
): Promise<DiscoverableRecordingCopies> {
  const existence = await getEventRecordingExistence(eventId)
  if (!existence.eligible) return { eligible: false, copies: [] }
  if (!existence.hasOtherCopies) return { eligible: true, copies: [] }

  const { data, error } = await supabase.rpc('list_discoverable_recording_copies', {
    p_event_id: eventId,
  })
  if (error) rpcError(error, 'Recording discovery')

  const copies = (Array.isArray(data) ? data : []).flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as RpcRow
    if (typeof row.copy_ordinal !== 'number' || typeof row.recording_id !== 'string') return []
    const status = typeof row.request_status === 'string' ? row.request_status : null
    const cooldownUntil = nullableString(row, 'cooldown_until')
    const cooldownActive = status === 'denied' && cooldownUntil !== null &&
      new Date(cooldownUntil).getTime() > Date.now()
    return [{
      ordinal: row.copy_ordinal,
      requestTarget: row.recording_id,
      requestState: status === 'pending' ? 'pending' as const : cooldownActive ? 'cooldown' as const : 'available' as const,
      cooldownUntil: cooldownActive ? cooldownUntil : null,
    }]
  })
  return { eligible: true, copies }
}

export async function dispatchRecordingAccessEmail(
  requestId: string,
): Promise<RecordingAccessEmailDelivery> {
  requireUuid(requestId, 'request')
  const { data, error } = await supabase.functions.invoke<{
    success?: boolean
    status?: string
  }>('recording-access', { body: { request_id: requestId } })
  if (error) return 'pending'
  return data?.status === 'sent' ? 'sent' : 'pending'
}

export async function requestRecordingAccess(
  recordingId: string,
): Promise<RecordingAccessRequestResult> {
  requireUuid(recordingId, 'recording')
  const { data, error } = await supabase.rpc('request_recording_access', {
    p_recording_id: recordingId,
  })
  if (error) rpcError(error, 'Access request')
  const row = firstRow(data, 'Access request')
  const requestId = stringValue(row, 'request_id', 'Access request')
  const emailDelivery = await dispatchRecordingAccessEmail(requestId)
  return {
    requestId,
    status: 'pending',
    cooldownUntil: nullableString(row, 'cooldown_until'),
    emailDelivery,
  }
}

export async function getRecordingAccessManagement(
  recordingId: string,
): Promise<RecordingAccessManagement> {
  requireUuid(recordingId, 'recording')
  const { data, error } = await supabase.rpc('get_recording_access_management', {
    p_recording_id: recordingId,
  })
  if (error) rpcError(error, 'Access management')

  const requests = new Map<string, OwnerRecordingAccessRequest>()
  const grants = new Map<string, RecordingAccessGrant>()
  for (const raw of Array.isArray(data) ? data : []) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as RpcRow
    if (typeof row.request_id !== 'string' || typeof row.request_status !== 'string') continue
    const status = row.request_status as RecordingAccessRequestStatus
    if (!['pending', 'approved', 'denied'].includes(status)) continue
    const name = typeof row.requester_name === 'string' && row.requester_name.trim()
      ? row.requester_name
      : 'Confirmed participant'
    const verifiedEmail = stringValue(row, 'requester_verified_email', 'Access management')
    requests.set(row.request_id, {
      id: row.request_id,
      status,
      name,
      verifiedEmail,
      meetingTitle: typeof row.meeting_title === 'string' && row.meeting_title.trim()
        ? row.meeting_title
        : 'Untitled meeting',
      meetingDate: stringValue(row, 'meeting_date', 'Access management'),
      evidence: mapEvidence(row.evidence),
      cooldownUntil: nullableString(row, 'cooldown_until'),
      grantId: nullableString(row, 'grant_id'),
    })

    if (
      typeof row.grant_id === 'string' &&
      typeof row.grantee_user_id === 'string' &&
      typeof row.granted_at === 'string' &&
      row.revoked_at === null
    ) {
      grants.set(row.grant_id, {
        id: row.grant_id,
        requestId: row.request_id,
        granteeUserId: row.grantee_user_id,
        name,
        verifiedEmail,
        grantedAt: row.granted_at,
        revokedAt: null,
      })
    }
  }
  return { requests: [...requests.values()], grants: [...grants.values()] }
}

export async function approveRequest(requestId: string): Promise<RecordingAccessApprovalResult> {
  requireUuid(requestId, 'request')
  const { data, error } = await supabase.rpc('approve_recording_access_request', {
    p_request_id: requestId,
  })
  if (error) rpcError(error, 'Approve access')
  const row = firstRow(data, 'Approve access')
  return {
    requestId: stringValue(row, 'request_id', 'Approve access'),
    grantId: stringValue(row, 'grant_id', 'Approve access'),
    status: 'approved',
  }
}

export async function denyRequest(requestId: string): Promise<RecordingAccessDenialResult> {
  requireUuid(requestId, 'request')
  const { data, error } = await supabase.rpc('deny_recording_access_request', {
    p_request_id: requestId,
  })
  if (error) rpcError(error, 'Deny access')
  const row = firstRow(data, 'Deny access')
  return {
    requestId: stringValue(row, 'request_id', 'Deny access'),
    status: 'denied',
    cooldownUntil: stringValue(row, 'cooldown_until', 'Deny access'),
  }
}

export async function revokeGrant(grantId: string): Promise<RecordingAccessRevocationResult> {
  requireUuid(grantId, 'grant')
  const { data, error } = await supabase.rpc('revoke_recording_access_grant', {
    p_grant_id: grantId,
  })
  if (error) rpcError(error, 'Revoke access')
  const row = firstRow(data, 'Revoke access')
  return {
    grantId: stringValue(row, 'grant_id', 'Revoke access'),
    status: 'revoked',
    revokedAt: stringValue(row, 'revoked_at', 'Revoke access'),
  }
}

export const recordingAccessService = {
  getEventRecordingExistence,
  listDiscoverableRecordingCopies,
  dispatchRecordingAccessEmail,
  requestRecordingAccess,
  getRecordingAccessManagement,
  approveRequest,
  denyRequest,
  revokeGrant,
}
