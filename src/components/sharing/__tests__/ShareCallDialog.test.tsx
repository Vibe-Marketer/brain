import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getSafeUser, revokeShareLink, useSharing } = vi.hoisted(() => ({
  getSafeUser: vi.fn(),
  revokeShareLink: vi.fn(),
  useSharing: vi.fn(),
}))

vi.mock('@/lib/auth-utils', () => ({ getSafeUser }))
vi.mock('@/hooks/useSharing', () => ({ useSharing }))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

import { ShareCallDialog } from '@/components/sharing/ShareCallDialog'

const RECORDING_UUID = '11111111-1111-4111-8111-111111111111'

describe('ShareCallDialog legacy link management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSafeUser.mockResolvedValue({ user: { id: 'owner-1' } })
    revokeShareLink.mockResolvedValue(undefined)
    useSharing.mockReturnValue({
      shareLinks: [],
      unresolvedShareLinks: [{
        id: 'legacy-link-1',
        recording_id: null,
        call_recording_id: 987654,
        user_id: 'owner-1',
        created_by_user_id: 'owner-1',
        share_token: 'must-not-be-presented-as-current-call-link',
        recipient_email: 'recipient@example.com',
        status: 'active',
        created_at: '2026-09-19T00:00:00.000Z',
        revoked_at: null,
        resolved_recording_id: null,
        resolution_status: 'legacy_unresolved',
      }],
      isLoadingLinks: false,
      createShareLink: vi.fn(),
      revokeShareLink,
      isCreating: false,
      isRevoking: false,
    })
  })

  it('shows unmatched legacy links separately and permits revocation without presenting them as this call', async () => {
    render(
      <ShareCallDialog
        open
        onOpenChange={vi.fn()}
        recordingId={RECORDING_UUID}
        callTitle="Current call"
      />,
    )

    expect(screen.getByText('Older Share Links (1)')).toBeInTheDocument()
    expect(screen.getByText(/could not be matched safely/i)).toBeInTheDocument()
    expect(screen.queryByText(/must-not-be-presented-as-current-call-link/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'REVOKE' }))
    await waitFor(() => expect(revokeShareLink).toHaveBeenCalledWith('legacy-link-1'))
  })
})
