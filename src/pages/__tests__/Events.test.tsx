import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const eventState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  requestAccess: vi.fn(),
}))

vi.mock('@/hooks/useEventDiscovery', () => ({
  useDiscoveredEvents: () => eventState.value,
}))
vi.mock('@/hooks/useRecordingAccess', () => ({
  useRequestRecordingAccess: () => ({
    mutateAsync: eventState.requestAccess,
    isPending: false,
  }),
}))

const EVENTS_MODULE = '/src/pages/Events.tsx'

async function loadEvents(): Promise<ComponentType> {
  const module = await import(/* @vite-ignore */ EVENTS_MODULE) as {
    default?: ComponentType
    Events?: ComponentType
  }
  const Page = module.default ?? module.Events
  if (!Page) throw new Error('Events page export is missing')
  return Page
}

function renderEvents(Page: ComponentType) {
  return render(<MemoryRouter><Page /></MemoryRouter>)
}

const eventFixture = (group: 'needs_action' | 'available' | 'waiting', start: string) => ({
  eventId: `${group}-event`,
  group,
  startsAt: start,
  heading: group === 'available' ? 'Permitted customer call' : 'Event on September 20, 2026',
  connection: { verifiedEmail: 'a***@example.com', verifiedEmailCount: 1 },
  readableRecordings: group === 'available'
    ? [{ recordingId: 'readable-id', title: 'Permitted customer call', source: 'zoom' }]
    : [],
  restrictedRecordings: group === 'needs_action'
    ? [{ ordinal: 1, requestTarget: 'restricted-id', requestState: 'available', availableAt: null }]
    : group === 'waiting'
      ? [{ ordinal: 1, requestTarget: null, requestState: 'pending', availableAt: null }]
      : [],
})

describe('Events page approved UX and privacy contract (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventState.value = {
      data: {
        pages: [{
          items: [
            eventFixture('needs_action', '2026-09-20T12:00:00.000Z'),
            eventFixture('available', '2026-09-19T12:00:00.000Z'),
            eventFixture('waiting', '2026-09-18T12:00:00.000Z'),
          ],
          nextCursor: 'next-page',
        }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    }
  })

  it.fails('RED: renders semantic action, available, and waiting groups in server order', async () => {
    const Events = await loadEvents()
    const { container } = renderEvents(Events)

    const headings = screen.getAllByRole('heading').map((node) => node.textContent)
    expect(headings).toEqual(expect.arrayContaining([
      'Events', 'Needs your action', 'Available to you', 'Waiting for access',
    ]))
    expect(container.querySelectorAll('article')).toHaveLength(3)
    expect(screen.getByText('Recording 1')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: /Request access to recording 1 from September 20/i,
    })).toHaveClass(expect.stringMatching(/min-h-11|h-11/))
  })

  it.fails('RED: exposes readable details but never restricted recording metadata', async () => {
    const privateValues = [
      'private-owner@example.com', 'Hidden board title', 'fireflies',
      'Confidential transcript', 'Executive workspace',
    ]
    const firstPage = (eventState.value.data as { pages: Array<{ items: Array<Record<string, unknown>> }> }).pages[0]
    const restrictedEvent = firstPage.items[0]
    restrictedEvent.restrictedRecordings = [{
      ordinal: 1,
      requestTarget: 'restricted-id',
      requestState: 'available',
      ownerEmail: privateValues[0],
      title: privateValues[1],
      provider: privateValues[2],
      transcript: privateValues[3],
      workspaceName: privateValues[4],
    }]

    const Events = await loadEvents()
    const { container } = renderEvents(Events)
    expect(screen.getByText('Permitted customer call')).toBeInTheDocument()
    for (const value of privateValues) expect(container.innerHTML).not.toContain(value)
  })

  it.fails.each([
    ['empty', { data: { pages: [{ items: [], nextCursor: null }] }, isLoading: false, isError: false }, 'No events found yet'],
    ['error', { data: undefined, isLoading: false, isError: true }, "We couldn't load your events."],
  ] as const)('RED: renders the exact %s state', async (_state, state, expectedCopy) => {
    eventState.value = { ...eventState.value, ...state }
    const Events = await loadEvents()
    renderEvents(Events)
    expect(screen.getByText(expectedCopy)).toBeInTheDocument()
  })

  it.fails('RED: keeps existing cards while loading more and offers one load-more action', async () => {
    eventState.value = { ...eventState.value, isFetchingNextPage: true }
    const Events = await loadEvents()
    renderEvents(Events)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Load more events' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveAccessibleName(/loading more events/i)
  })
})
