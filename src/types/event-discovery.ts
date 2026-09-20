/**
 * Privacy-safe frontend contracts for verified-email event discovery.
 *
 * Raw RPC rows deliberately stay in the service layer. These types contain no
 * open metadata object, participant roster, owner identity, transcript,
 * summary, or restricted recording detail.
 */

export type EventDiscoveryGroup = 'needs_action' | 'available' | 'waiting'

export interface EventConnectionEvidence {
  verifiedEmail: string
  verifiedEmailCount: number
}

/** A recording already readable under the separate Phase 38 access policy. */
export interface ReadableEventRecording {
  recordingId: string
  recordingStartedAt: string | null
}

export type RestrictedEventRecording =
  | {
      ordinal: number
      requestTarget: string | null
      requestState: 'available'
      availableAt: null
    }
  | {
      ordinal: number
      requestTarget: null
      requestState: 'pending'
      availableAt: null
    }
  | {
      ordinal: number
      requestTarget: null
      requestState: 'cooldown'
      availableAt: string
    }

export interface DiscoveredEvent {
  eventId: string
  group: EventDiscoveryGroup
  startsAt: string
  heading: string
  connection: EventConnectionEvidence
  readableRecordings: ReadableEventRecording[]
  restrictedRecordings: RestrictedEventRecording[]
}

export interface DiscoveredEventPage {
  items: DiscoveredEvent[]
  nextCursor: string | null
}

export interface EventDiscoveryPageInput {
  limit: number
  cursor: string | null
}

export type ParticipationInvitationState =
  | 'eligible'
  | 'sent'
  | 'claimed'
  | 'expired'
  | 'revoked'
  | 'superseded'

export type ParticipationInvitationStatus =
  | {
      participantId: string
      status: 'eligible'
      sentAt: null
      expiresAt: null
      claimedAt: null
      reminder: { state: 'off' }
      canResend: false
    }
  | {
      participantId: string
      status: Exclude<ParticipationInvitationState, 'eligible'>
      sentAt: string
      expiresAt: string
      claimedAt: string | null
      reminder:
        | { state: 'off' }
        | { state: 'scheduled'; scheduledFor: string }
        | { state: 'sent'; sentAt: string }
      canResend: boolean
    }

export interface ParticipationInvitationInput {
  recordingId: string
  participantId: string
  sendReminder: boolean
}

export type ParticipationInvitationResult =
  | { status: 'sent' }
  | { status: 'delivery_pending' }

export type ParticipationClaimInspectResult =
  | { status: 'valid'; maskedInvitedEmail: string; confirmationRequired: boolean }
  | { status: 'unavailable' }
  | { status: 'retryable' }

export type ParticipationClaimConsumeResult =
  | { status: 'claimed'; discoveredEventCount: number }
  | { status: 'unavailable' }
  | { status: 'retryable' }

export interface ParticipationClaimConsumeInput {
  token: string
  confirmEmailAttachment: boolean
}

export interface DiscoveryNotificationSyncResult {
  createdCount: number
}

/** Exact safe metadata accepted by notification consumers. */
export interface EventDiscoveredNotificationMetadata {
  kind: 'event_discovered'
  eventId: string
  action: 'view_events'
}

export interface DisconnectVerifiedEmailResult {
  status: 'disconnected'
}
