import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from '@/components/ui/tabs'

// Badge internals (RPC/popover/loading states) are covered by
// IdentityEvidenceBadge.test.tsx. This file proves only the wiring
// contract: CallParticipantsTab renders the badge exactly when a speaker
// has a truthy identity_id, and never otherwise (IDENT-08 must_haves).
vi.mock('@/components/shared/IdentityEvidenceBadge', () => ({
  IdentityEvidenceBadge: ({ identityId }: { identityId: string }) => (
    <span data-testid="identity-evidence-badge">{identityId}</span>
  ),
}))

import { CallParticipantsTab } from '../CallParticipantsTab'

// CallParticipantsTab renders a Radix TabsContent, which requires a Tabs
// ancestor context — mirror how CallDetailDialog mounts it in production.
function renderInTabs(ui: React.ReactElement) {
  return render(
    <Tabs value="participants">{ui}</Tabs>,
  )
}

describe('CallParticipantsTab identity evidence badge wiring (IDENT-08)', () => {
  it('renders the evidence badge only for the speaker with a resolved identity_id', () => {
    renderInTabs(
      <CallParticipantsTab
        hasTranscripts
        callSpeakers={[
          {
            speaker_name: 'Resolved Rachel',
            speaker_email: 'rachel@example.com',
            identity_id: 'identity-abc',
          },
          {
            speaker_name: 'Unresolved Uma',
            speaker_email: 'uma@example.com',
            identity_id: null,
          },
          {
            speaker_name: 'No Identity Field Nadia',
            speaker_email: 'nadia@example.com',
          },
        ]}
      />,
    )

    const badges = screen.getAllByTestId('identity-evidence-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent('identity-abc')

    expect(screen.getByText('Resolved Rachel')).toBeInTheDocument()
    expect(screen.getByText('Unresolved Uma')).toBeInTheDocument()
    expect(screen.getByText('No Identity Field Nadia')).toBeInTheDocument()
  })

  it('renders no evidence badge when no speaker has resolved to an identity', () => {
    renderInTabs(
      <CallParticipantsTab
        hasTranscripts
        callSpeakers={[{ speaker_name: 'Solo Speaker', speaker_email: null }]}
      />,
    )

    expect(screen.queryByTestId('identity-evidence-badge')).not.toBeInTheDocument()
  })
})
