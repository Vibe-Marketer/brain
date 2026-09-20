import { useEffect, useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { RiLoader4Line } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useRequestRecordingAccess } from '@/hooks/useRecordingAccess'
import type { DiscoveredEvent, RestrictedEventRecording } from '@/types/event-discovery'

interface EventCardProps {
  event: DiscoveredEvent
  shouldRestoreFocus?: boolean
  onFocusRestored?: () => void
  onRequestSettled?: (eventId: string, ordinal: number) => Promise<void> | void
}

function eventDate(value: string): Date {
  return new Date(value)
}

function longDate(value: string): string {
  const date = eventDate(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function dateAndTime(value: string): string {
  const date = eventDate(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function cooldownCopy(value: string): string {
  const date = eventDate(value)
  if (Number.isNaN(date.getTime())) return 'Available later'
  return `Available ${date.toLocaleDateString()}`
}

function RestrictedAction({
  copy,
  startsAt,
  eventId,
  request,
  onRequestSettled,
}: {
  copy: RestrictedEventRecording
  startsAt: string
  eventId: string
  request: ReturnType<typeof useRequestRecordingAccess>
  onRequestSettled?: EventCardProps['onRequestSettled']
}) {
  if (copy.requestState === 'pending') {
    return <span className="text-sm font-medium text-muted-foreground">Request sent</span>
  }

  if (copy.requestState === 'cooldown') {
    return <span className="text-sm font-medium text-muted-foreground">{cooldownCopy(copy.availableAt)}</span>
  }

  if (!copy.requestTarget) {
    return <span className="text-sm text-muted-foreground">This event is no longer available.</span>
  }

  const isCurrent = request.variables === copy.requestTarget
  const isSending = request.isPending && isCurrent
  const isSent = request.isSuccess && isCurrent
  const failed = request.isError && isCurrent

  if (isSent) {
    return (
      <span className="text-sm font-medium text-muted-foreground" role="status" aria-live="polite">
        Request sent
      </span>
    )
  }

  const requestAccess = async () => {
    try {
      await request.mutateAsync(copy.requestTarget)
      await onRequestSettled?.(eventId, copy.ordinal)
    } catch {
      // The shared mutation owns generic logging and toast copy. This row adds
      // only the approved visible retry message and never exposes its handle.
    }
  }

  return (
    <div className="w-full space-y-1 sm:w-auto">
      <Button
        type="button"
        variant="hollow"
        size="sm"
        className="min-h-11 w-full sm:w-auto"
        aria-label={isSending
          ? `Sending request for recording ${copy.ordinal} from ${longDate(startsAt)}`
          : `Request access to recording ${copy.ordinal} from ${longDate(startsAt)}`}
        disabled={isSending}
        onClick={() => void requestAccess()}
      >
        {isSending ? <RiLoader4Line className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        {isSending ? 'Sending…' : 'Request access'}
      </Button>
      {failed ? (
        <p className="text-xs text-destructive" role="alert">Couldn't send your request. Try again.</p>
      ) : null}
    </div>
  )
}

export function EventCard({
  event,
  shouldRestoreFocus = false,
  onFocusRestored,
  onRequestSettled,
}: EventCardProps) {
  const headingId = useId()
  const cardRef = useRef<HTMLElement>(null)
  const request = useRequestRecordingAccess(event.eventId)
  const hasReadableCopy = event.readableRecordings.length > 0
  const heading = hasReadableCopy ? event.heading : `Event on ${longDate(event.startsAt)}`

  useEffect(() => {
    if (!shouldRestoreFocus || !cardRef.current) return
    cardRef.current.focus()
    onFocusRestored?.()
  }, [onFocusRestored, shouldRestoreFocus])

  const connectionCopy = event.connection.verifiedEmailCount > 1
    ? `Connected through ${event.connection.verifiedEmailCount} verified emails`
    : `Connected through ${event.connection.verifiedEmail}`

  return (
    <article ref={cardRef} tabIndex={shouldRestoreFocus ? -1 : undefined} aria-labelledby={headingId}>
      <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle id={headingId} className="line-clamp-2 text-lg font-extrabold leading-snug">
            {heading}
          </CardTitle>
          <time className="text-sm text-muted-foreground" dateTime={event.startsAt}>
            {dateAndTime(event.startsAt)}
          </time>
          <p className="text-sm text-muted-foreground">{connectionCopy}</p>
        </CardHeader>

        <CardContent className="space-y-4 p-5 pt-2">
          {event.readableRecordings.length > 0 ? (
            <div className="space-y-2">
              {event.readableRecordings.map((recording, index) => (
                <div
                  key={recording.recordingId}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold">{index === 0 ? event.heading : `Recording ${index + 1}`}</p>
                    {recording.recordingStartedAt ? (
                      <time className="text-xs text-muted-foreground" dateTime={recording.recordingStartedAt}>
                        {dateAndTime(recording.recordingStartedAt)}
                      </time>
                    ) : null}
                  </div>
                  <Button asChild variant="hollow" size="sm" className="min-h-11 w-full sm:w-auto">
                    <Link to={`/call/${encodeURIComponent(recording.recordingId)}`}>Open recording</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {event.restrictedRecordings.length > 0 ? (
            <section aria-label="Other recordings" className="space-y-2">
              <p className="text-sm font-semibold tabular-nums">
                {event.restrictedRecordings.length} other {event.restrictedRecordings.length === 1 ? 'recording' : 'recordings'}
              </p>
              {event.restrictedRecordings.map((copy) => (
                <div
                  key={copy.ordinal}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-sm font-semibold">Recording {copy.ordinal}</p>
                  <RestrictedAction
                    copy={copy}
                    startsAt={event.startsAt}
                    eventId={event.eventId}
                    request={request}
                    onRequestSettled={onRequestSettled}
                  />
                </div>
              ))}
            </section>
          ) : null}
        </CardContent>
      </Card>
    </article>
  )
}

