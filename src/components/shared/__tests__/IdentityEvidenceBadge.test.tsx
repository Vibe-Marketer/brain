import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useIdentityEvidence: vi.fn(),
}))

vi.mock('@/hooks/useIdentityEvidence', () => ({
  useIdentityEvidence: mocks.useIdentityEvidence,
}))

// Mirrors this codebase's established pattern for testing Radix-popover
// components in jsdom (see SupportTicketDialog.test.tsx) — the popover
// primitives are mocked to plain wrapper elements so tests exercise the
// component's own open-state logic without Radix portal/positioning APIs.
vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { IdentityEvidenceBadge } from '../IdentityEvidenceBadge'

function openBadge() {
  fireEvent.mouseEnter(screen.getByRole('button', { name: /view identity match confidence/i }))
}

describe('IdentityEvidenceBadge (IDENT-08)', () => {
  beforeEach(() => {
    mocks.useIdentityEvidence.mockReset()
  })

  it('does not enable the evidence fetch until the popover opens (T-34-05-03, lazy fetch)', () => {
    mocks.useIdentityEvidence.mockReturnValue({ data: undefined, isLoading: false, error: null })

    render(<IdentityEvidenceBadge identityId="identity-1" />)

    expect(mocks.useIdentityEvidence).toHaveBeenCalledWith('identity-1', false)
  })

  it('enables the evidence fetch once opened', () => {
    mocks.useIdentityEvidence.mockReturnValue({ data: undefined, isLoading: true, error: null })

    render(<IdentityEvidenceBadge identityId="identity-1" />)
    openBadge()

    expect(mocks.useIdentityEvidence).toHaveBeenLastCalledWith('identity-1', true)
  })

  it('shows a loading state while the evidence request is in flight', () => {
    mocks.useIdentityEvidence.mockReturnValue({ data: undefined, isLoading: true, error: null })

    render(<IdentityEvidenceBadge identityId="identity-1" />)
    openBadge()

    expect(screen.queryByText(/Confidence:/i)).not.toBeInTheDocument()
  })

  it('renders the highest-confidence evidence line with a human confidence label, never a raw email (T-34-05-01)', () => {
    mocks.useIdentityEvidence.mockReturnValue({
      data: [
        { alias_type: 'display_name', confidence: 0.4, evidence: 'Matched via display-name variant' },
        { alias_type: 'email', confidence: 0.95, evidence: 'Matched via verified email' },
      ],
      isLoading: false,
      error: null,
    })

    render(<IdentityEvidenceBadge identityId="identity-1" />)
    openBadge()

    expect(screen.getByText(/Confidence:/i)).toBeInTheDocument()
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Matched via verified email')).toBeInTheDocument()
    // Lower-confidence row is not shown — only the top evidence line renders.
    expect(screen.queryByText(/display-name variant/i)).not.toBeInTheDocument()
    // The component has no email field to render at all; assert none leaks through regardless.
    expect(screen.queryByText(/@[\w.-]+\.\w+/)).not.toBeInTheDocument()
  })

  it('shows a graceful empty state when the identity has no recorded evidence', () => {
    mocks.useIdentityEvidence.mockReturnValue({ data: [], isLoading: false, error: null })

    render(<IdentityEvidenceBadge identityId="identity-1" />)
    openBadge()

    expect(screen.getByText('No match evidence recorded.')).toBeInTheDocument()
  })

  it('shows a graceful error state when the RPC call fails', () => {
    mocks.useIdentityEvidence.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    })

    render(<IdentityEvidenceBadge identityId="identity-1" />)
    openBadge()

    expect(screen.getByText('Unable to load match evidence.')).toBeInTheDocument()
  })
})
