import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EventCard } from '@/components/events/EventCard'
import {
  EventListEmpty,
  EventListError,
  EventListLoading,
  EventPaginationLoading,
} from '@/components/events/EventListStates'
import type { DiscoveredEvent } from '@/types/event-discovery'

const eventState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  requestAccess: vi.fn(),
  requestVariables: undefined as string | undefined,
  requestPending: false,
  requestSuccess: false,
  requestError: false,
}))

vi.mock('@/hooks/useEventDiscovery', () => ({
  useDiscoveredEvents: () => eventState.value,
}))
vi.mock('@/hooks/useRecordingAccess', () => ({
  useRequestRecordingAccess: () => ({
    mutateAsync: eventState.requestAccess,
    variables: eventState.requestVariables,
    isPending: eventState.requestPending,
    isSuccess: eventState.requestSuccess,
    isError: eventState.requestError,
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
    ? [{ recordingId: 'readable-id', recordingStartedAt: start }]
    : [],
  restrictedRecordings: group === 'needs_action'
    ? [{ ordinal: 1, requestTarget: 'restricted-id', requestState: 'available', availableAt: null }]
    : group === 'waiting'
      ? [{ ordinal: 1, requestTarget: null, requestState: 'pending', availableAt: null }]
      : [],
})

describe('Event card and list-state privacy boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventState.requestAccess.mockResolvedValue(undefined)
    eventState.requestVariables = undefined
    eventState.requestPending = false
    eventState.requestSuccess = false
    eventState.requestError = false
  })

  it('renders permitted details and excludes injected restricted fields and its opaque handle', () => {
    const event = {
      ...eventFixture('needs_action', '2026-09-20T12:00:00.000Z'),
      heading: 'Hidden board title',
      restrictedRecordings: [{
        ordinal: 1,
        requestTarget: 'opaque-request-handle',
        requestState: 'available',
        availableAt: null,
        ownerEmail: 'private-owner@example.com',
        title: 'Hidden board title',
        provider: 'fireflies',
        transcript: 'Confidential transcript',
        summary: 'Executive summary',
        roster: ['Hidden Person'],
        sourceId: 'stable-source-id',
      }],
    } as unknown as DiscoveredEvent

    const { container } = render(<MemoryRouter><EventCard event={event} /></MemoryRouter>)

    expect(screen.getByRole('article')).toHaveAccessibleName('Event on September 20, 2026')
    expect(screen.getByText('Recording 1')).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'Request access to recording 1 from September 20, 2026',
    }).className).toMatch(/min-h-11|h-11/)
    for (const privateValue of [
      'opaque-request-handle',
      'private-owner@example.com',
      'Hidden board title',
      'fireflies',
      'Confidential transcript',
      'Executive summary',
      'Hidden Person',
      'stable-source-id',
    ]) {
      expect(container.innerHTML).not.toContain(privateValue)
    }
  })

  it('renders readable, pending, and cooldown copies with exact visible state copy', () => {
    const event = {
      ...eventFixture('available', '2026-09-20T12:00:00.000Z'),
      restrictedRecordings: [
        { ordinal: 1, requestTarget: null, requestState: 'pending', availableAt: null },
        { ordinal: 2, requestTarget: null, requestState: 'cooldown', availableAt: '2026-09-27T12:00:00.000Z' },
      ],
    } as DiscoveredEvent

    render(<MemoryRouter><EventCard event={event} /></MemoryRouter>)

    expect(screen.getAllByText('Permitted customer call').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Open recording' })).toHaveAttribute('href', '/call/readable-id')
    expect(screen.getByText('Request sent')).toBeInTheDocument()
    expect(screen.getByText(/^Available /)).toBeInTheDocument()
  })

  it('submits only the opaque action and refetches after success without rendering it', async () => {
    const onRequestSettled = vi.fn()
    const event = eventFixture('needs_action', '2026-09-20T12:00:00.000Z') as DiscoveredEvent
    const { container } = render(
      <MemoryRouter><EventCard event={event} onRequestSettled={onRequestSettled} /></MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Request access to recording 1/ }))

    await waitFor(() => expect(eventState.requestAccess).toHaveBeenCalledWith('restricted-id'))
    expect(onRequestSettled).toHaveBeenCalledWith('needs_action-event', 1)
    expect(container.innerHTML).not.toContain('restricted-id')
  })

  it('provides accessible loading, pagination, empty, and blocking-error states', () => {
    const { rerender } = render(<MemoryRouter><EventListLoading /></MemoryRouter>)
    expect(screen.getByLabelText('Loading events')).toHaveAttribute('aria-busy', 'true')

    rerender(<MemoryRouter><EventPaginationLoading /></MemoryRouter>)
    expect(screen.getByRole('status', { name: 'Loading more events' })).toHaveAttribute('aria-busy', 'true')

    rerender(<MemoryRouter><EventListEmpty /></MemoryRouter>)
    expect(screen.getByText('No events found yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage verified emails' })).toHaveAttribute('href', '/settings/account')

    rerender(<MemoryRouter><EventListError onRetry={vi.fn()} /></MemoryRouter>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("We couldn't load your events.")
    expect(alert).toHaveTextContent('Check your connection and try again.')
  })
})

describe('Events page approved UX and privacy contract (Wave 0 RED)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventState.requestAccess.mockResolvedValue(undefined)
    eventState.requestVariables = undefined
    eventState.requestPending = false
    eventState.requestSuccess = false
    eventState.requestError = false
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
