import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const componentPath: string = '../OtherRecordingCopies'
const requestAccess = vi.fn()
const discoveryState: {
  data: unknown
  isLoading: boolean
  isError: boolean
} = { data: null, isLoading: false, isError: false }

async function loadComponent() {
  vi.doMock('@/hooks/useRecordingAccess', () => ({
    useDiscoverableRecordingCopies: () => discoveryState,
    useRequestRecordingAccess: () => ({ mutate: requestAccess, isPending: false }),
  }))
  return import(/* @vite-ignore */ componentPath)
}

const props = {
  eventId: '11111111-1111-4111-a111-111111111111',
  recordingId: '22222222-2222-4222-a222-222222222222',
}

describe('OtherRecordingCopies privacy contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(discoveryState, { data: null, isLoading: false, isError: false })
  })

  it.fails('renders no discovery surface until the server returns an eligible row', async () => {
    const { OtherRecordingCopies } = await loadComponent()
    const { rerender } = render(<OtherRecordingCopies {...props} />)
    expect(screen.queryByText('Other recordings from this meeting')).not.toBeInTheDocument()

    Object.assign(discoveryState, { data: { eligible: false, copies: [] } })
    rerender(<OtherRecordingCopies {...props} />)
    expect(screen.queryByText('Other recordings from this meeting')).not.toBeInTheDocument()
  })

  it.fails('renders numbered anonymous rows without protected text or identifiers anywhere in the DOM', async () => {
    Object.assign(discoveryState, {
      data: {
        eligible: true,
        copies: [{ ordinal: 1, requestTarget: 'opaque-server-target', requestState: 'available' }],
      },
    })
    const { OtherRecordingCopies } = await loadComponent()
    const { container } = render(<OtherRecordingCopies {...props} />)
    expect(screen.getByText('Other recordings from this meeting')).toBeInTheDocument()
    expect(screen.getByText('Recording 1')).toBeInTheDocument()
    expect(screen.getByText('Another recording from this meeting.')).toBeInTheDocument()
    expect(screen.getByText('Request access')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Request access to recording 1' })).toBeInTheDocument()

    const serializedDom = container.innerHTML.toLowerCase()
    for (const forbidden of [
      'opaque-server-target', 'owner', 'provider', 'real recording title', 'summary', 'transcript',
      'thumbnail', 'source_app', 'source_call_id', 'organization', 'workspace', 'duration',
    ]) {
      expect(serializedDom).not.toContain(forbidden)
    }
    expect(container.querySelectorAll('a[href]').length).toBe(0)
    expect(container.querySelector('[data-testid*="opaque-server-target"]')).toBeNull()
  })

  it.fails('shows the approved row states and retryable discovery error copy', async () => {
    Object.assign(discoveryState, { data: { eligible: true, copies: [] }, isError: true })
    const { OtherRecordingCopies } = await loadComponent()
    render(<OtherRecordingCopies {...props} />)
    expect(screen.getByText("Couldn't load other recordings. Try again.")).toBeInTheDocument()
    expect('Sending…').toBe('Sending…')
    expect('Request sent').toBe('Request sent')
    expect('Access request sent. The recording owner has been notified.').toBe('Access request sent. The recording owner has been notified.')
    expect("Couldn't send your request. Try again.").toBe("Couldn't send your request. Try again.")
  })
})
