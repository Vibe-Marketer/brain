import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Meeting } from '@/types'

const authState = { userId: 'owner-1' }
const recordingPolicyHook = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authState.userId ? { id: authState.userId } : null,
    session: null,
    loading: false,
  }),
}))

vi.mock('@/hooks/useOrganizationContext', () => ({
  useOrganizationContext: () => ({ activeWorkspaceId: 'workspace-1' }),
}))

vi.mock('@/hooks/useFathomRefresh', () => ({
  useFathomRefresh: () => ({ isPending: false, mutate: vi.fn() }),
}))

vi.mock('@/hooks/useBreakpoint', () => ({
  useBreakpointFlags: () => ({ isMobile: false }),
}))

vi.mock('@/hooks/useAccessPolicy', () => ({
  useRecordingAccessPolicy: (recordingId: string) => {
    recordingPolicyHook(recordingId)
    return {
      data: { accessLevel: 'private', origin: 'default', accountDefault: 'private' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }
  },
  useSetRecordingAccessLevel: () => ({ mutate: vi.fn(), isPending: false }),
  useResetRecordingAccessLevel: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useRecordingAccess', () => ({
  useRecordingAccessManagement: () => ({
    data: { requests: [], grants: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useApproveRecordingAccessRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useDenyRecordingAccessRequest: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeRecordingAccessGrant: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/components/sharing/ShareCallDialog', () => ({
  ShareCallDialog: () => null,
}))

vi.mock('@/components/dialogs/MoveOrCopyDialog', () => ({
  MoveOrCopyDialog: () => null,
}))

vi.mock('@/components/dialogs/RefreshFromFathomDialog', () => ({
  RefreshFromFathomDialog: () => null,
}))

vi.mock('@/components/ui/dialog', () => ({
  DialogHeader: ({ children, ...props }: React.ComponentProps<'div'>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.ComponentProps<'h2'>) => <h2 {...props}>{children}</h2>,
  Dialog: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { CallDetailHeader } from '@/components/call-detail/CallDetailHeader'

function makeCall(overrides: Partial<Meeting> = {}): Meeting {
  return {
    recording_id: 'legacy-123',
    canonical_uuid: '11111111-1111-4111-a111-111111111111',
    title: 'Quarterly review',
    created_at: '2026-09-19T12:00:00Z',
    user_id: 'owner-1',
    ...overrides,
  }
}

function renderHeader(call: Meeting, extraProps: Record<string, unknown> = {}) {
  return render(
    <CallDetailHeader
      call={call}
      isEditing={false}
      setIsEditing={vi.fn()}
      editedTitle={call.title}
      setEditedTitle={vi.fn()}
      setEditedSummary={vi.fn()}
      onSave={vi.fn()}
      isSaving={false}
      {...extraProps}
    />,
  )
}

describe('CallDetailHeader recording access entry', () => {
  beforeEach(() => {
    authState.userId = 'owner-1'
    recordingPolicyHook.mockClear()
  })

  it('shows ACCESS immediately before SHARE for the owner and uses the canonical UUID', () => {
    renderHeader(makeCall())

    const access = screen.getByRole('button', { name: 'ACCESS' })
    const share = screen.getByRole('button', { name: 'SHARE' })
    expect(access.compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(recordingPolicyHook).toHaveBeenCalledWith('11111111-1111-4111-a111-111111111111')
  })

  it('does not render an ACCESS element for a non-owner', () => {
    authState.userId = 'viewer-2'
    renderHeader(makeCall())
    expect(screen.queryByRole('button', { name: 'ACCESS' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SHARE' })).toBeInTheDocument()
  })

  it('supports controlled open state for a focused request deep link', () => {
    renderHeader(makeCall(), {
      accessPanelOpen: true,
      onAccessPanelOpenChange: vi.fn(),
      focusedAccessRequestId: '22222222-2222-4222-a222-222222222222',
    })
    expect(screen.getByText('This access request is no longer available.')).toBeInTheDocument()
  })
})
