import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ComponentType } from 'react'
import { Tabs } from '@/components/ui/tabs'
import { mergeCallSpeakers } from '@/hooks/useCallDetailQueries'
import type { Speaker } from '@/types/meetings'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invitation = vi.hoisted(() => ({
  statuses: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
  resend: vi.fn(),
  cancelReminder: vi.fn(),
  pendingParticipantId: null as string | null,
}))

vi.mock('@/components/shared/IdentityEvidenceBadge', () => ({
  IdentityEvidenceBadge: () => null,
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useParticipationInvitationStatuses: () => ({ data: invitation.statuses, isLoading: false }),
  useSendParticipationInvitation: (_recordingId: string, participantId: string) => ({
    mutateAsync: invitation.send,
    isPending: invitation.pendingParticipantId === participantId,
  }),
  useResendParticipationInvitation: (_recordingId: string, participantId: string) => ({
    mutateAsync: invitation.resend,
    isPending: invitation.pendingParticipantId === participantId,
  }),
  useCancelParticipationReminder: (_recordingId: string, participantId: string) => ({
    mutateAsync: invitation.cancelReminder,
    isPending: invitation.pendingParticipantId === participantId,
  }),
}))

import { CallParticipantsTab } from '../CallParticipantsTab'

const InviteTab = CallParticipantsTab as unknown as ComponentType<Record<string, unknown>>
const canonical = {
  speaker_name: 'Taylor',
  speaker_email: 'taylor@example.com',
  participant_id: '22222222-2222-4222-a222-222222222222',
}

function renderTab(props: Record<string, unknown> = {}) {
  return render(
    <Tabs value="participants">
      <InviteTab
        hasTranscripts
        recordingId="11111111-1111-4111-a111-111111111111"
        isRecordingOwner
        callSpeakers={[canonical]}
        {...props}
      />
    </Tabs>,
  )
}

describe('participant claim invitation controls (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invitation.send.mockResolvedValue({ status: 'sent' })
    invitation.resend.mockResolvedValue({ status: 'sent' })
    invitation.cancelReminder.mockResolvedValue({ status: 'reminder_canceled' })
    invitation.pendingParticipantId = null
    invitation.statuses = [{ participantId: canonical.participant_id, status: 'eligible' }]
  })

  it('preserves only persisted participant IDs while merging transcript speakers', () => {
    const persisted = {
      ...canonical,
      participant_type: 'attendee',
    } as Speaker
    const merged = mergeCallSpeakers(
      [persisted],
      [
        { speaker_name: canonical.speaker_name, speaker_email: canonical.speaker_email },
        { speaker_name: 'Transcript only', speaker_email: 'guess@example.com' },
      ],
    )

    expect(merged).toEqual(expect.arrayContaining([
      expect.objectContaining({
        speaker_name: canonical.speaker_name,
        participant_id: canonical.participant_id,
      }),
      expect.not.objectContaining({
        speaker_name: 'Transcript only',
        participant_id: expect.anything(),
      }),
    ]))
  })

  it('selects and maps canonical participant IDs from call_participants', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/hooks/useCallDetailQueries.ts'),
      'utf8',
    )

    expect(source).toContain('.select("id, name, email, participant_type, organization_id, identity_id")')
    expect(source).toContain('participant_id: p.id')
  })

  it('sends one canonical participant invitation with reminder off by default', async () => {
    renderTab()
    const reminder = screen.getByRole('switch', { name: 'Send one reminder' })
    expect(reminder).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Invite Taylor to claim participation' }))
    expect(invitation.send).toHaveBeenCalledWith({ sendReminder: false })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Invite everyone/i)).not.toBeInTheDocument()
  })

  it('opts into at most one reminder for the selected participant', async () => {
    renderTab()
    const reminder = screen.getByRole('switch', { name: 'Send one reminder' })
    fireEvent.click(reminder)
    expect(reminder).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Invite Taylor to claim participation' }))
    expect(invitation.send).toHaveBeenCalledWith({ sendReminder: true })
    await waitFor(() => expect(reminder).toHaveAttribute('aria-checked', 'false'))
  })

  it('keeps invitation affordances absent for non-owners and noncanonical speakers', () => {
    renderTab({
      isRecordingOwner: false,
      callSpeakers: [canonical, { speaker_name: 'Transcript only', speaker_email: 'guess@example.com' }],
    })
    expect(screen.queryByRole('button', { name: /Invite to claim/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Send one reminder/i })).not.toBeInTheDocument()
  })

  it('keeps invitation affordances absent when a legacy call has no canonical UUID', () => {
    renderTab({ recordingId: undefined, isRecordingOwner: true })

    expect(screen.queryByRole('button', { name: /Invite to claim/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Send one reminder/i })).not.toBeInTheDocument()
  })

  it.each([
    ['sent', 'Invitation sent', 'Resend available September 27, 2026'],
    ['claimed', 'Claimed', 'Claimed September 20, 2026'],
    ['expired', 'Expired', 'Resend invite'],
  ] as const)('renders server-authorized %s lifecycle state', (_state, statusCopy, secondaryCopy) => {
    invitation.statuses = [{
      participantId: canonical.participant_id,
      status: _state,
      sentAt: '2026-09-20T12:00:00.000Z',
      expiresAt: '2026-09-27T12:00:00.000Z',
      claimedAt: _state === 'claimed' ? '2026-09-20T12:00:00.000Z' : null,
      reminder: { state: 'off' },
      canResend: _state === 'expired',
    }]
    renderTab()
    expect(screen.getByText(statusCopy)).toBeInTheDocument()
    expect(screen.getByText(secondaryCopy)).toBeInTheDocument()
  })

  it('renders scheduled and sent reminder dates and cancels only through the participant hook', () => {
    invitation.statuses = [{
      participantId: canonical.participant_id,
      status: 'sent',
      sentAt: '2026-09-20T12:00:00.000Z',
      expiresAt: '2026-09-27T12:00:00.000Z',
      claimedAt: null,
      reminder: { state: 'scheduled', scheduledFor: '2026-09-25T12:00:00.000Z' },
      canResend: false,
    }]
    renderTab()
    expect(screen.getByText('Reminder scheduled September 25, 2026')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel reminder' }))
    expect(invitation.cancelReminder).toHaveBeenCalledTimes(1)

    invitation.statuses = [{
      ...invitation.statuses[0],
      reminder: { state: 'sent', sentAt: '2026-09-25T12:00:00.000Z' },
    }]
    renderTab()
    expect(screen.getByText('Reminder sent')).toBeInTheDocument()
    expect(screen.getByText('Reminded September 25, 2026')).toBeInTheDocument()
  })

  it('keeps only the active participant row pending', () => {
    const other = {
      speaker_name: 'Jordan',
      speaker_email: 'jordan@example.com',
      participant_id: '33333333-3333-4333-a333-333333333333',
    }
    invitation.statuses = [
      { participantId: canonical.participant_id, status: 'eligible' },
      { participantId: other.participant_id, status: 'eligible' },
    ]
    invitation.pendingParticipantId = canonical.participant_id
    renderTab({ callSpeakers: [canonical, other] })

    expect(screen.getByRole('button', { name: 'Sending invitation to Taylor' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Invite Jordan to claim participation' })).toBeEnabled()
    const switches = screen.getAllByRole('switch', { name: 'Send one reminder' })
    expect(switches[0]).toBeDisabled()
    expect(switches[1]).toBeEnabled()
  })

  it('shows no active invitation without exposing a reason', () => {
    invitation.statuses = [{
      participantId: canonical.participant_id,
      status: 'superseded',
      sentAt: '2026-09-20T12:00:00.000Z',
      expiresAt: '2026-09-27T12:00:00.000Z',
      claimedAt: null,
      reminder: { state: 'off' },
      canResend: false,
    }]
    renderTab()

    expect(screen.getByText('No active invitation')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /invite/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/superseded|ineligible|owner|email/i)).not.toBeInTheDocument()
  })

  it('resends only when the server status explicitly authorizes it', () => {
    invitation.statuses = [{
      participantId: canonical.participant_id,
      status: 'expired',
      sentAt: '2026-09-20T12:00:00.000Z',
      expiresAt: '2026-09-27T12:00:00.000Z',
      claimedAt: null,
      reminder: { state: 'off' },
      canResend: true,
    }]
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Resend invitation to Taylor' }))
    expect(invitation.resend).toHaveBeenCalledWith({ sendReminder: false })
  })
})
