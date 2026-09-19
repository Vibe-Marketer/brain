import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const componentPath: string = '../RecordingAccessPanel'
const NOTICE = 'This controls your recording only. Other attendees control their own copies.'
const breakpointState = { isMobile: false }

const policyState = {
  data: { accessLevel: 'private', origin: 'default', accountDefault: 'private' },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}
const managementState = {
  data: { requests: [], grants: [] },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

async function loadPanel() {
  vi.doMock('@/hooks/useBreakpoint', () => ({ useBreakpointFlags: () => breakpointState }))
  vi.doMock('@/hooks/useAccessPolicy', () => ({
    useRecordingAccessPolicy: () => policyState,
    useSetRecordingAccessLevel: () => ({ mutate: vi.fn(), isPending: false }),
    useResetRecordingAccessLevel: () => ({ mutate: vi.fn(), isPending: false }),
  }))
  vi.doMock('@/hooks/useRecordingAccess', () => ({
    useRecordingAccessManagement: () => managementState,
    useApproveRecordingAccessRequest: () => ({ mutate: vi.fn(), isPending: false }),
    useDenyRecordingAccessRequest: () => ({ mutate: vi.fn(), isPending: false }),
    useRevokeRecordingAccessGrant: () => ({ mutate: vi.fn(), isPending: false }),
  }))
  return import(/* @vite-ignore */ componentPath)
}

function props() {
  return {
    recordingId: '11111111-1111-4111-a111-111111111111',
    recordingTitle: 'Quarterly review',
    open: true,
    onOpenChange: vi.fn(),
  }
}

describe('RecordingAccessPanel acceptance contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    breakpointState.isMobile = false
    Object.assign(policyState, { isLoading: false, isError: false })
    Object.assign(managementState, { isLoading: false, isError: false, data: { requests: [], grants: [] } })
  })

  it.each([
    ['loading', true, false],
    ['error', false, true],
    ['loaded', false, false],
  ])('keeps the required notice visible in the %s state', async (_state, isLoading, isError) => {
    Object.assign(policyState, { isLoading, isError })
    const { RecordingAccessPanel } = await loadPanel()
    render(<RecordingAccessPanel {...props()} />)
    expect(screen.getByRole('heading', { name: 'Recording access' })).toBeInTheDocument()
    expect(screen.getByText(NOTICE)).toBeVisible()
    expect(screen.getByText('Existing team, coach, and share-link access remains active.')).toBeVisible()
    if (isError) {
      expect(screen.getByText("Couldn't load access settings. Close this panel and try again.")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    }
  })

  it('renders inherited/custom/reset state and requests before grants', async () => {
    Object.assign(policyState, { data: { accessLevel: 'private', origin: 'custom', accountDefault: 'attendees' } })
    Object.assign(managementState, {
      data: {
        requests: [{
          id: 'request-1',
          status: 'pending',
          name: 'Taylor',
          verifiedEmail: 'taylor@example.invalid',
          requestedAt: '2026-09-19T12:05:00Z',
          meetingTitle: 'Quarterly review',
          meetingDate: '2026-09-19T12:00:00Z',
          evidence: { participantRole: 'attendee', participantType: 'invitee', hasConfirmedSpeech: false, sources: ['calendar'] },
          cooldownUntil: null,
          grantId: null,
        }],
        grants: [{
          id: 'grant-1',
          requestId: 'request-2',
          granteeUserId: '33333333-3333-4333-a333-333333333333',
          name: 'Jordan',
          verifiedEmail: 'jordan@example.invalid',
          grantedAt: '2026-09-19T12:30:00Z',
          revokedAt: null,
        }],
      },
    })
    const { RecordingAccessPanel } = await loadPanel()
    render(<RecordingAccessPanel {...props()} />)
    expect(screen.getByText('Custom')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeInTheDocument()
    const requests = screen.getByText('Access requests (1)').closest('section')
    const grants = screen.getByText('People with access (1)').closest('section')
    expect(requests).not.toBeNull()
    expect(grants).not.toBeNull()
    expect(requests!.compareDocumentPosition(grants!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(requests!).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows the exact empty copy and uses destructive Deny/Revoke confirmations', async () => {
    const { RecordingAccessPanel } = await loadPanel()
    const { unmount } = render(<RecordingAccessPanel {...props()} />)
    expect(screen.getByText('No pending requests')).toBeInTheDocument()
    expect(screen.getByText('New requests will appear here.')).toBeInTheDocument()
    expect(screen.getByText('No individual access grants')).toBeInTheDocument()
    expect(screen.getByText('Approved requests will appear here. Share links stay under Share.')).toBeInTheDocument()

    unmount()
    Object.assign(managementState, {
      data: {
        requests: [{
          id: 'request-1',
          status: 'pending',
          name: 'Taylor',
          verifiedEmail: 'taylor@example.invalid',
          requestedAt: '2026-09-19T12:05:00Z',
          meetingTitle: 'Quarterly review',
          meetingDate: '2026-09-19T12:00:00Z',
          evidence: { participantRole: 'attendee', participantType: 'invitee', hasConfirmedSpeech: false, sources: ['calendar'] },
          cooldownUntil: null,
          grantId: null,
        }],
        grants: [{
          id: 'grant-1',
          requestId: 'request-2',
          granteeUserId: '33333333-3333-4333-a333-333333333333',
          name: 'Jordan',
          verifiedEmail: 'jordan@example.invalid',
          grantedAt: '2026-09-19T12:30:00Z',
          revokedAt: null,
        }],
      },
    })
    render(<RecordingAccessPanel {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review request' }))
    expect(screen.getByRole('button', { name: 'Approve access' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deny request' }))
    expect(screen.getByRole('heading', { name: 'Deny this access request?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deny request' })).toHaveClass('from-[#E54D4D]')
    fireEvent.click(screen.getByRole('button', { name: 'Keep request' }))

    fireEvent.click(screen.getByRole('button', { name: 'Revoke access' }))
    expect(screen.getByRole('heading', { name: 'Revoke access for Jordan?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Revoke access' })).toHaveClass('from-[#E54D4D]')
  })

  it('confirms Public with a non-destructive primary action', async () => {
    const { RecordingAccessPanel } = await loadPanel()
    render(<RecordingAccessPanel {...props()} />)
    fireEvent.click(screen.getByRole('radio', { name: /^Public/ }))
    expect(screen.getByText('Make this recording public?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make public' })).not.toHaveClass('bg-destructive')
  })

  it('uses the generic unavailable copy for unavailable and non-owner deep links', async () => {
    const { RecordingAccessPanel } = await loadPanel()
    render(<RecordingAccessPanel {...props()} focusedRequestId="22222222-2222-4222-a222-222222222222" />)
    expect(screen.getByText('This access request is no longer available.')).toBeInTheDocument()
  })

  it('renders one mobile dialog tree with mobile-sized review controls', async () => {
    breakpointState.isMobile = true
    Object.assign(managementState, {
      data: {
        requests: [{
          id: 'request-mobile',
          status: 'pending',
          name: 'Morgan',
          verifiedEmail: 'morgan@example.invalid',
          requestedAt: '2026-09-19T12:05:00Z',
          meetingTitle: 'Mobile review',
          meetingDate: '2026-09-19T12:00:00Z',
          evidence: { participantRole: 'attendee', participantType: null, hasConfirmedSpeech: true, sources: [] },
          cooldownUntil: null,
          grantId: null,
        }],
        grants: [],
      },
    })
    const { RecordingAccessPanel } = await loadPanel()
    render(<RecordingAccessPanel {...props()} />)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    const review = screen.getByRole('button', { name: 'Review request' })
    expect(review).toHaveClass('min-h-11')
  })
})
