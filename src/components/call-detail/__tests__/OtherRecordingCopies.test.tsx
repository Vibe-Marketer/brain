import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OtherRecordingCopies } from '@/components/call-detail/OtherRecordingCopies'
import { useDiscoverableRecordingCopies, useRequestRecordingAccess } from '@/hooks/useRecordingAccess'

vi.mock('@/hooks/useRecordingAccess', () => ({
  useDiscoverableRecordingCopies: vi.fn(),
  useRequestRecordingAccess: vi.fn(),
}))

const mockDiscovery = vi.mocked(useDiscoverableRecordingCopies)
const mockRequest = vi.mocked(useRequestRecordingAccess)
const mutate = vi.fn()

const props = {
  eventId: '11111111-1111-4111-a111-111111111111',
  recordingId: '22222222-2222-4222-a222-222222222222',
}

function setDiscovery(data: unknown, overrides: Record<string, unknown> = {}) {
  mockDiscovery.mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as ReturnType<typeof useDiscoverableRecordingCopies>)
}

function setRequest(overrides: Record<string, unknown> = {}) {
  mockRequest.mockReturnValue({ mutate, isPending: false, variables: undefined, isError: false, ...overrides } as unknown as ReturnType<typeof useRequestRecordingAccess>)
}

describe('OtherRecordingCopies privacy contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDiscovery(null)
    setRequest()
  })

  it.each([
    ['loading', null, { isLoading: true }],
    ['unqualified', { eligible: false, copies: [] }, {}],
    ['zero rows', { eligible: true, copies: [] }, {}],
  ])('renders no discovery surface for %s', (_label, data, state) => {
    setDiscovery(data, state)
    render(<OtherRecordingCopies {...props} />)
    expect(screen.queryByRole('region', { name: 'Other recordings from this meeting' })).not.toBeInTheDocument()
  })

  it('renders only anonymous numbered copy details and no identifiers or protected fields', () => {
    setDiscovery({ eligible: true, copies: [
      { ordinal: 1, requestTarget: 'opaque-server-target', requestState: 'available', cooldownUntil: null },
      { ordinal: 2, requestTarget: 'another-opaque-target', requestState: 'pending', cooldownUntil: null },
    ] })
    const { container } = render(<OtherRecordingCopies {...props} />)
    expect(screen.getByRole('region', { name: 'Other recordings from this meeting' })).toBeInTheDocument()
    expect(screen.getByText('Recording 1')).toBeInTheDocument()
    expect(screen.getByText('Recording 2')).toBeInTheDocument()
    expect(screen.getAllByText('Another recording from this meeting.')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Request access to recording 1' })).toBeInTheDocument()
    expect(screen.getByText('Request sent')).toBeInTheDocument()
    const serializedDom = container.innerHTML.toLowerCase()
    for (const forbidden of ['opaque-server-target', 'another-opaque-target', 'owner', 'provider', 'real recording title', 'summary', 'transcript', 'thumbnail', 'source_app', 'source_call_id', 'organization', 'workspace', 'duration', props.eventId, props.recordingId]) {
      expect(serializedDom).not.toContain(forbidden.toLowerCase())
    }
    expect(container.querySelectorAll('a[href]')).toHaveLength(0)
  })

  it('submits one click and scopes the sending state to the matching row', () => {
    setDiscovery({ eligible: true, copies: [
      { ordinal: 1, requestTarget: 'target-one', requestState: 'available', cooldownUntil: null },
      { ordinal: 2, requestTarget: 'target-two', requestState: 'available', cooldownUntil: null },
    ] })
    setRequest({ isPending: true, variables: 'target-one' })
    render(<OtherRecordingCopies {...props} />)
    expect(screen.getByRole('button', { name: 'Sending request for recording 1' })).toBeDisabled()
    const second = screen.getByRole('button', { name: 'Request access to recording 2' })
    expect(second).toBeEnabled()
    fireEvent.click(second)
    expect(mutate).toHaveBeenCalledWith('target-two')
  })

  it('renders cooldown, request failure, and discovery failure states', () => {
    setDiscovery({ eligible: true, copies: [{ ordinal: 1, requestTarget: 'target-one', requestState: 'cooldown', cooldownUntil: '2026-10-19T12:00:00Z' }] })
    const { rerender } = render(<OtherRecordingCopies {...props} />)
    expect(screen.getByRole('button', { name: /Available / })).toBeDisabled()
    setDiscovery({ eligible: true, copies: [{ ordinal: 1, requestTarget: 'target-one', requestState: 'available', cooldownUntil: null }] })
    setRequest({ isError: true, variables: 'target-one' })
    rerender(<OtherRecordingCopies {...props} />)
    expect(screen.getByText("Couldn't send your request. Try again.")).toBeInTheDocument()
    setDiscovery(null, { isError: true })
    rerender(<OtherRecordingCopies {...props} />)
    expect(screen.getByText("Couldn't load other recordings. Try again.")).toBeInTheDocument()
  })

  it('removes approved copies and shows revoked copies when the server returns them as available', () => {
    setDiscovery({ eligible: true, copies: [{ ordinal: 1, requestTarget: 'target-one', requestState: 'pending', cooldownUntil: null }] })
    const { rerender } = render(<OtherRecordingCopies {...props} />)
    expect(screen.getByText('Recording 1')).toBeInTheDocument()
    setDiscovery({ eligible: true, copies: [] })
    rerender(<OtherRecordingCopies {...props} />)
    expect(screen.queryByText('Recording 1')).not.toBeInTheDocument()
    setDiscovery({ eligible: true, copies: [{ ordinal: 1, requestTarget: 'target-one', requestState: 'available', cooldownUntil: null }] })
    rerender(<OtherRecordingCopies {...props} />)
    expect(screen.getByRole('button', { name: 'Request access to recording 1' })).toBeEnabled()
  })
})
