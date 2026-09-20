import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RiCalendarEventLine } from '@remixicon/react'

import { EventCard } from '@/components/events/EventCard'
import {
  EventListEmpty,
  EventListError,
  EventListLoading,
  EventNoLongerAvailable,
  EventPaginationLoading,
} from '@/components/events/EventListStates'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { useDiscoveredEvents } from '@/hooks/useEventDiscovery'
import type { DiscoveredEvent, EventDiscoveryGroup } from '@/types/event-discovery'

const GROUPS: ReadonlyArray<{ id: EventDiscoveryGroup; label: string }> = [
  { id: 'needs_action', label: 'Needs your action' },
  { id: 'available', label: 'Available to you' },
  { id: 'waiting', label: 'Waiting for access' },
]

function locationFocusTarget(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const candidate = (value as { focusEventId?: unknown }).focusEventId
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

export function Events() {
  const location = useLocation()
  const discovery = useDiscoveredEvents()
  const notificationTarget = useMemo(
    () => locationFocusTarget(location.state),
    [location.state],
  )
  const [focusTarget, setFocusTarget] = useState<string | null>(notificationTarget)

  const events = useMemo(
    () => discovery.data?.pages.flatMap((page) => page.items) ?? [],
    [discovery.data?.pages],
  )
  const targetIsLoaded = focusTarget
    ? events.some((event) => event.eventId === focusTarget)
    : false

  useEffect(() => {
    if (
      !focusTarget
      || targetIsLoaded
      || !discovery.hasNextPage
      || discovery.isFetchingNextPage
    ) return
    void discovery.fetchNextPage()
  }, [
    discovery.fetchNextPage,
    discovery.hasNextPage,
    discovery.isFetchingNextPage,
    focusTarget,
    targetIsLoaded,
  ])

  const refetchAfterRequest = useCallback(async (eventId: string) => {
    await discovery.refetch()
    setFocusTarget(eventId)
  }, [discovery.refetch])

  const clearRestoredFocus = useCallback(() => setFocusTarget(null), [])
  const targetIsUnavailable = Boolean(
    focusTarget
    && !targetIsLoaded
    && !discovery.hasNextPage
    && !discovery.isFetchingNextPage,
  )

  const content = (() => {
    if (discovery.isLoading && events.length === 0) return <EventListLoading />
    if (discovery.isError && events.length === 0) {
      return (
        <EventListError
          onRetry={() => void discovery.refetch()}
          isRetrying={discovery.isFetching}
        />
      )
    }
    if (events.length === 0) return <EventListEmpty />

    return (
      <div className="space-y-8">
        {targetIsUnavailable ? <EventNoLongerAvailable /> : null}
        {GROUPS.map((group) => {
          const groupEvents = events.filter((event) => event.group === group.id)
          if (groupEvents.length === 0) return null
          return (
            <section key={group.id} aria-labelledby={`events-group-${group.id}`}>
              <h2
                id={`events-group-${group.id}`}
                className="mb-3 font-display text-sm font-extrabold uppercase tracking-wide text-muted-foreground"
              >
                {group.label}
              </h2>
              <ul className="space-y-4" role="list">
                {groupEvents.map((event: DiscoveredEvent) => (
                  <li key={event.eventId}>
                    <EventCard
                      event={event}
                      shouldRestoreFocus={focusTarget === event.eventId}
                      onFocusRestored={clearRestoredFocus}
                      onRequestSettled={refetchAfterRequest}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

        {discovery.isFetchingNextPage ? <EventPaginationLoading /> : null}
        {discovery.hasNextPage ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="hollow"
              className="min-h-11 w-full sm:w-auto"
              disabled={discovery.isFetchingNextPage}
              onClick={() => void discovery.fetchNextPage()}
            >
              Load more events
            </Button>
          </div>
        ) : null}
      </div>
    )
  })()

  return (
    <AppShell config={{ showDetailPane: false }}>
      <div className="flex h-full flex-col overflow-y-auto">
        <header className="flex min-h-[72px] flex-shrink-0 items-center gap-3 border-b border-border/60 bg-card/50 px-4 py-3 sm:px-6">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-border bg-card" aria-hidden="true">
            <RiCalendarEventLine className="h-5 w-5 text-vibe-orange" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-base font-extrabold uppercase tracking-wide">EVENTS</h1>
            <p className="text-sm text-muted-foreground">Events connected to your verified emails.</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
          {content}
        </main>
      </div>
    </AppShell>
  )
}

export default Events

