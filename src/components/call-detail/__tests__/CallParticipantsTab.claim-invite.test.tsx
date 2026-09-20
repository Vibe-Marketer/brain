import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { Tabs } from '@/components/ui/tabs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invitation = vi.hoisted(() => ({
  statuses: [] as Array<Record<string, unknown>>,
  send: vi.fn(),
  resend: vi.fn(),
  cancelReminder: vi.fn(),
}))

vi.mock('@/components/shared/IdentityEvidenceBadge', () => ({
  IdentityEvidenceBadge: () => null,
}))
vi.mock('@/hooks/useEventDiscovery', () => ({
  useParticipationInvitationStatuses: () => ({ data: invitation.statuses, isLoading: false }),
  useSendParticipationInvitation: () => ({ mutateAsync: invitation.send, isPending: false }),
  useResendParticipationInvitation: () => ({ mutateAsync: invitation.resend, isPending: false }),
  useCancelParticipationReminder: () => ({ mutateAsync: invitation.cancelReminder, isPending: false }),
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
    invitation.statuses = [{ participantId: canonical.participant_id, status: 'eligible' }]
  })

  it.fails('RED: sends one canonical participant invitation with reminder off by default', async () => {
    invitation.send.mockResolvedValue({ status: 'sent' })
    renderTab()
    const reminder = screen.getByRole('switch', { name: 'Send one reminder' })
    expect(reminder).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Invite to claim' }))
    expect(invitation.send).toHaveBeenCalledWith({ sendReminder: false })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Invite everyone/i)).not.toBeInTheDocument()
  })

  it('keeps invitation affordances absent for non-owners and noncanonical speakers', () => {
    renderTab({
      isRecordingOwner: false,
      callSpeakers: [canonical, { speaker_name: 'Transcript only', speaker_email: 'guess@example.com' }],
    })
    expect(screen.queryByRole('button', { name: /Invite to claim/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Send one reminder/i })).not.toBeInTheDocument()
  })

  it.fails.each([
    ['sent', 'Invitation sent', 'Sent September 20, 2026'],
    ['claimed', 'Claimed', 'Claimed September 20, 2026'],
    ['expired', 'Expired', 'Resend invite'],
  ] as const)('RED: renders server-authorized %s lifecycle state', (_state, statusCopy, secondaryCopy) => {
    invitation.statuses = [{
      participantId: canonical.participant_id,
      status: _state,
      sentAt: '2026-09-20T12:00:00.000Z',
      claimedAt: _state === 'claimed' ? '2026-09-20T12:00:00.000Z' : null,
      canResend: _state === 'expired',
    }]
    renderTab()
    expect(screen.getByText(statusCopy)).toBeInTheDocument()
    expect(screen.getByText(secondaryCopy)).toBeInTheDocument()
  })
})
