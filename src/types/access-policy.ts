/**
 * Persisted access policy contracts shared by services, hooks, and UI.
 *
 * Recording identifiers crossing this boundary are canonical CallVault UUID
 * strings. Legacy numeric provider IDs are intentionally not represented.
 */
export const ACCESS_LEVELS = [
  'private',
  'attendees',
  'invitees',
  'organization',
  'link',
  'public',
] as const

export type RecordingAccessLevel = (typeof ACCESS_LEVELS)[number]

export const ACCESS_POLICY_ORIGINS = ['default', 'custom'] as const

export type AccessPolicyOrigin = (typeof ACCESS_POLICY_ORIGINS)[number]

export interface AccountAccessDefault {
  accessLevel: RecordingAccessLevel
}

export interface StoredRecordingAccessPolicy {
  accessLevel: RecordingAccessLevel
  origin: AccessPolicyOrigin
}

/**
 * Policy shape consumed by the recording access surface. `accountDefault` is
 * included so a reset can be shown optimistically without another table read.
 */
export interface RecordingAccessPolicy extends StoredRecordingAccessPolicy {
  accountDefault: RecordingAccessLevel
}

export type AccessPolicyRpcCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_ACCESS_LEVEL'
  | 'RECORDING_NOT_AVAILABLE'

export type AccessPolicyMutationResult =
  | { ok: true; policy: StoredRecordingAccessPolicy }
  | { ok: false; code: AccessPolicyRpcCode }
