export type RecordingAccessNotificationKind = 'requested' | 'approved' | 'denied'

export interface RecordingAccessNotificationMetadata {
  source: 'recording_access'
  kind: RecordingAccessNotificationKind
  recording_id: string
  request_id?: string
  cooldown_until?: string
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function isRecordingAccessNotificationMetadata(
  metadata: unknown,
): metadata is RecordingAccessNotificationMetadata {
  if (!metadata || typeof metadata !== 'object') return false
  const candidate = metadata as Record<string, unknown>
  if (candidate.source !== 'recording_access' || !isUuid(candidate.recording_id)) return false
  if (!['requested', 'approved', 'denied'].includes(String(candidate.kind))) return false
  if (candidate.request_id !== undefined && !isUuid(candidate.request_id)) return false
  if (candidate.kind === 'requested' && !isUuid(candidate.request_id)) return false
  if (candidate.kind === 'denied') {
    if (typeof candidate.cooldown_until !== 'string') return false
    if (Number.isNaN(new Date(candidate.cooldown_until).getTime())) return false
  }
  return true
}
