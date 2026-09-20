import { RiCalendarEventLine } from '@remixicon/react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

function EventCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5" aria-hidden="true">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-5 rounded-lg border border-border/60 p-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-11 w-full sm:w-36" />
      </div>
    </div>
  )
}

export function EventListLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading events">
      <EventCardSkeleton />
      <EventCardSkeleton />
      <EventCardSkeleton />
    </div>
  )
}

export function EventPaginationLoading() {
  return (
    <div role="status" aria-label="Loading more events" aria-live="polite" aria-busy="true">
      <EventCardSkeleton />
      <span className="sr-only">Loading more events</span>
    </div>
  )
}

export function EventListEmpty() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <RiCalendarEventLine className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="font-display text-lg font-extrabold">No events found yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We'll show events here when they match one of your verified emails.
      </p>
      <Button asChild variant="hollow" className="mt-5 min-h-11">
        <Link to="/settings/account">Manage verified emails</Link>
      </Button>
    </div>
  )
}

export function EventListError({ onRetry, isRetrying = false }: {
  onRetry: () => void
  isRetrying?: boolean
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center" role="alert">
      <h2 className="font-display text-lg font-extrabold">We couldn't load your events.</h2>
      <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
      <Button
        type="button"
        variant="hollow"
        className="mt-5 min-h-11"
        disabled={isRetrying}
        onClick={onRetry}
      >
        Try again
      </Button>
    </div>
  )
}

export function EventNoLongerAvailable() {
  return (
    <p className="rounded-lg border border-border/60 bg-card px-4 py-3 text-sm" role="status" aria-live="polite">
      This event is no longer available.
    </p>
  )
}

