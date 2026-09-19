export type RecordingAccessRequestState = 'available' | 'pending' | 'cooldown'
export type RecordingAccessRequestStatus = 'pending' | 'approved' | 'denied'
export type RecordingAccessEmailDelivery = 'sent' | 'pending'

/** Requester-safe projection. Protected recording and owner fields do not belong here. */
export interface DiscoverableRecordingCopy {
  ordinal: number
  requestTarget: string
  requestState: RecordingAccessRequestState
  cooldownUntil: string | null
}

export interface DiscoverableRecordingCopies {
  eligible: boolean
  copies: DiscoverableRecordingCopy[]
}

export interface EventRecordingExistence {
  eligible: boolean
  hasOtherCopies: boolean
}

/** Owner-only evidence returned by the owner-authorized management RPC. */
export interface RecordingAccessEvidence {
  participantRole: string | null
  participantType: string | null
  hasConfirmedSpeech: boolean
  sources: string[]
}

export interface OwnerRecordingAccessRequest {
  id: string
  status: RecordingAccessRequestStatus
  name: string
  verifiedEmail: string
  requestedAt: string
  meetingTitle: string
  meetingDate: string
  evidence: RecordingAccessEvidence
  cooldownUntil: string | null
  grantId: string | null
}

export interface RecordingAccessGrant {
  id: string
  requestId: string
  granteeUserId: string
  name: string
  verifiedEmail: string
  grantedAt: string
  revokedAt: string | null
}

export interface RecordingAccessManagement {
  requests: OwnerRecordingAccessRequest[]
  grants: RecordingAccessGrant[]
}

export interface RecordingAccessRequestResult {
  requestId: string
  status: 'pending'
  cooldownUntil: string | null
  emailDelivery: RecordingAccessEmailDelivery
}

export interface RecordingAccessApprovalResult {
  requestId: string
  grantId: string
  status: 'approved'
}

export interface RecordingAccessDenialResult {
  requestId: string
  status: 'denied'
  cooldownUntil: string
}

export interface RecordingAccessRevocationResult {
  grantId: string
  status: 'revoked'
  revokedAt: string
}
