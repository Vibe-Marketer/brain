import { RiLoader4Line } from '@remixicon/react'

import { Button } from '@/components/ui/button'
import { useDiscoverableRecordingCopies, useRequestRecordingAccess } from '@/hooks/useRecordingAccess'
import type { DiscoverableRecordingCopy } from '@/types/recording-access'

interface OtherRecordingCopiesProps {
  eventId: string
  recordingId: string
}

function cooldownLabel(value: string | null): string {
  if (!value) return 'Available later'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Available later'
  return `Available ${date.toLocaleDateString()}`
}

function CopyAction({
  copy,
  isSending,
  failed,
  onRequest,
}: {
  copy: DiscoverableRecordingCopy
  isSending: boolean
  failed: boolean
  onRequest: () => void
}) {
  if (copy.requestState === 'pending') {
    return <span className="text-xs font-medium text-muted-foreground">Request sent</span>
  }
  if (copy.requestState === 'cooldown') {
    return (
      <Button type="button" variant="hollow" size="sm" className="min-h-11 w-full sm:w-auto" disabled>
        {cooldownLabel(copy.cooldownUntil)}
      </Button>
    )
  }
  return (
    <div className="w-full space-y-1 sm:w-auto">
      <Button
        type="button"
        variant="hollow"
        size="sm"
        className="min-h-11 w-full sm:w-auto"
        aria-label={isSending
          ? `Sending request for recording ${copy.ordinal}`
          : `Request access to recording ${copy.ordinal}`}
        disabled={isSending}
        onClick={onRequest}
      >
        {isSending ? <RiLoader4Line className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSending ? 'Sending…' : 'Request access'}
      </Button>
      {failed ? <p className="text-xs text-destructive">Couldn't send your request. Try again.</p> : null}
    </div>
  )
}

export function OtherRecordingCopies({ eventId, recordingId: _recordingId }: OtherRecordingCopiesProps) {
  const discovery = useDiscoverableRecordingCopies(eventId)
  const request = useRequestRecordingAccess(eventId)

  if (discovery.isError) {
    return <p className="text-sm text-muted-foreground">Couldn't load other recordings. Try again.</p>
  }
  if (discovery.isLoading || !discovery.data?.eligible || discovery.data.copies.length === 0) {
    return null
  }

  return (
    <section
      aria-labelledby="other-recording-copies-heading"
      aria-label="Other recordings from this meeting"
      className="space-y-3 border-t border-border/40 pt-6"
    >
      <h3 id="other-recording-copies-heading" className="font-display text-sm font-extrabold uppercase">
        Other recordings from this meeting
      </h3>
      <div className="space-y-2">
        {discovery.data.copies.map((copy) => {
          const isCurrentRequest = request.variables === copy.requestTarget
          return (
            <div
              key={copy.ordinal}
              className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Recording {copy.ordinal}</p>
                <p className="text-xs text-muted-foreground">Another recording from this meeting.</p>
              </div>
              <CopyAction
                copy={copy}
                isSending={request.isPending && isCurrentRequest}
                failed={request.isError && isCurrentRequest}
                onRequest={() => request.mutate(copy.requestTarget)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
