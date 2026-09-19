import * as React from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  RiCheckLine,
  RiCloseLine,
  RiLoader4Line,
  RiShieldKeyholeLine,
} from '@remixicon/react'

import { AccessLevelPicker } from '@/components/access/AccessLevelPicker'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useRecordingAccessPolicy,
  useResetRecordingAccessLevel,
  useSetRecordingAccessLevel,
} from '@/hooks/useAccessPolicy'
import { useBreakpointFlags } from '@/hooks/useBreakpoint'
import {
  useApproveRecordingAccessRequest,
  useDenyRecordingAccessRequest,
  useRecordingAccessManagement,
  useRevokeRecordingAccessGrant,
} from '@/hooks/useRecordingAccess'
import { cn } from '@/lib/utils'
import type { RecordingAccessLevel } from '@/types/access-policy'
import type {
  OwnerRecordingAccessRequest,
  RecordingAccessEvidence,
  RecordingAccessGrant,
} from '@/types/recording-access'

const ACCESS_LEVEL_LABELS: Record<RecordingAccessLevel, string> = {
  private: 'Private',
  attendees: 'Attendees',
  invitees: 'Invitees',
  organization: 'Organization',
  link: 'Anyone with link',
  public: 'Public',
}

const COPY_NOTICE = 'This controls your recording only. Other attendees control their own copies.'
const EXISTING_ACCESS_HELPER = 'Existing team, coach, and share-link access remains active.'

export interface RecordingAccessPanelProps {
  recordingId: string
  recordingTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  focusedRequestId?: string | null
  trigger?: React.ReactNode
}

function formatRequestTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : formatDistanceToNow(date, { addSuffix: true })
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : format(date, 'PPp')
}

function formatEvidence(evidence: RecordingAccessEvidence): string {
  const details = [
    evidence.participantRole,
    evidence.participantType,
    evidence.hasConfirmedSpeech ? 'confirmed speech' : null,
    ...evidence.sources,
  ].filter((value): value is string => Boolean(value))

  return details.length > 0 ? details.join(' · ') : 'Verified meeting participant'
}

function PanelSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading access settings">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-4 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function ReviewRequestCard({
  request,
  isMobile,
  isPending,
  onApprove,
  onDeny,
  headingRef,
}: {
  request: OwnerRecordingAccessRequest
  isMobile: boolean
  isPending: boolean
  onApprove: () => void
  onDeny: () => void
  headingRef?: React.RefObject<HTMLHeadingElement | null>
}) {
  const localHeadingRef = React.useRef<HTMLHeadingElement>(null)

  const values = [
    ['Requester', request.name],
    ['Verified email', request.verifiedEmail],
    ['Meeting', request.meetingTitle],
    ['Meeting date', formatDate(request.meetingDate)],
    ['Verified participant evidence', formatEvidence(request.evidence)],
  ] as const

  return (
    <div className="mt-3 space-y-3 rounded-md bg-muted/60 p-4">
      <h4 ref={headingRef ?? localHeadingRef} tabIndex={-1} className="text-sm font-semibold text-foreground">
        Review access request
      </h4>
      <dl className="space-y-3">
        {values.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                'mt-1 text-sm font-semibold text-foreground',
                label === 'Meeting' && 'line-clamp-2',
                label === 'Verified email' && 'truncate',
              )}
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          className={cn(isMobile && 'min-h-11')}
          onClick={onApprove}
        >
          {isPending ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiCheckLine className="h-4 w-4" />}
          Approve access
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={isPending}
          className={cn('text-destructive', isMobile && 'min-h-11')}
          onClick={onDeny}
        >
          <RiCloseLine className="h-4 w-4" />
          Deny request
        </Button>
      </div>
    </div>
  )
}

function RequestRow({
  request,
  expanded,
  isMobile,
  isPending,
  onReview,
  onApprove,
  onDeny,
  focusReview,
  reviewHeadingRef,
}: {
  request: OwnerRecordingAccessRequest
  expanded: boolean
  isMobile: boolean
  isPending: boolean
  onReview: () => void
  onApprove: () => void
  onDeny: () => void
  focusReview: boolean
  reviewHeadingRef?: React.RefObject<HTMLHeadingElement | null>
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground" title={request.name}>
            {request.name}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={request.verifiedEmail}>
            {request.verifiedEmail}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatRequestTime(request.requestedAt)}
          </p>
        </div>
        <Button
          type="button"
          variant="hollow"
          size="sm"
          disabled={isPending}
          className={cn('shrink-0', isMobile && 'min-h-11')}
          aria-expanded={expanded}
          onClick={onReview}
        >
          Review request
        </Button>
      </div>
      {expanded ? (
        <ReviewRequestCard
          request={request}
          isMobile={isMobile}
          isPending={isPending}
          onApprove={onApprove}
          onDeny={onDeny}
          headingRef={focusReview ? reviewHeadingRef : undefined}
        />
      ) : null}
    </div>
  )
}

function GrantRow({
  grant,
  isMobile,
  isPending,
  onRevoke,
}: {
  grant: RecordingAccessGrant
  isMobile: boolean
  isPending: boolean
  onRevoke: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground" title={grant.name}>
          {grant.name}
        </p>
        <p className="truncate text-xs text-muted-foreground" title={grant.verifiedEmail}>
          {grant.verifiedEmail}
        </p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          Granted {formatDate(grant.grantedAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="link"
        size="sm"
        disabled={isPending}
        className={cn('shrink-0', isMobile && 'min-h-11')}
        onClick={onRevoke}
      >
        Revoke access
      </Button>
    </div>
  )
}

export function RecordingAccessPanel({
  recordingId,
  recordingTitle,
  open,
  onOpenChange,
  focusedRequestId = null,
  trigger,
}: RecordingAccessPanelProps) {
  const { isMobile } = useBreakpointFlags()
  const policyQuery = useRecordingAccessPolicy(recordingId)
  const managementQuery = useRecordingAccessManagement(recordingId)
  const setPolicy = useSetRecordingAccessLevel(recordingId)
  const resetPolicy = useResetRecordingAccessLevel(recordingId)
  const approveRequest = useApproveRecordingAccessRequest(recordingId)
  const denyRequest = useDenyRecordingAccessRequest(recordingId)
  const revokeGrant = useRevokeRecordingAccessGrant(recordingId)

  const [publicSelection, setPublicSelection] = React.useState<RecordingAccessLevel | null>(null)
  const [expandedRequestId, setExpandedRequestId] = React.useState<string | null>(focusedRequestId)
  const [denyTarget, setDenyTarget] = React.useState<OwnerRecordingAccessRequest | null>(null)
  const [revokeTarget, setRevokeTarget] = React.useState<RecordingAccessGrant | null>(null)
  const [pendingRequestId, setPendingRequestId] = React.useState<string | null>(null)
  const [pendingGrantId, setPendingGrantId] = React.useState<string | null>(null)
  const [liveMessage, setLiveMessage] = React.useState('')
  const focusedReviewHeadingRef = React.useRef<HTMLHeadingElement>(null)

  const restorePublicOptionFocus = React.useCallback(() => {
    window.setTimeout(() => {
      document.getElementById('recording-access-level-picker-public')?.focus()
    }, 0)
  }, [])

  React.useEffect(() => {
    if (focusedRequestId) setExpandedRequestId(focusedRequestId)
  }, [focusedRequestId])

  const retry = () => {
    void policyQuery.refetch()
    void managementQuery.refetch()
  }

  const handlePolicyChange = (nextLevel: RecordingAccessLevel) => {
    if (nextLevel === 'public') {
      setPublicSelection(nextLevel)
      return
    }
    setPolicy.mutate(nextLevel)
  }

  const pendingRequests = managementQuery.data?.requests.filter((request) => request.status === 'pending') ?? []
  const focusedRequest = focusedRequestId
    ? managementQuery.data?.requests.find((request) => request.id === focusedRequestId)
    : undefined

  const focusDeepLinkedReview = React.useCallback(() => {
    window.setTimeout(() => focusedReviewHeadingRef.current?.focus(), 0)
  }, [])

  React.useEffect(() => {
    if (!open || !focusedRequest) return
    focusDeepLinkedReview()
  }, [focusDeepLinkedReview, focusedRequest, open])
  const focusedRequestStatus = focusedRequestId
    ? focusedRequest
      ? focusedRequest.status === 'pending'
        ? null
        : `This request has already been ${focusedRequest.status}.`
      : 'This access request is no longer available.'
    : null

  const isLoading = policyQuery.isLoading || managementQuery.isLoading
  const isError = policyQuery.isError || managementQuery.isError

  const content = (
    <div className="space-y-4 p-4">
      {isMobile ? (
        <DialogTitle className="pr-8 text-base font-semibold">Recording access</DialogTitle>
      ) : (
        <h2 className="text-base font-semibold text-foreground">Recording access</h2>
      )}

      <div className="space-y-2 rounded-md bg-muted/60 p-4">
        <p className="text-sm text-foreground">{COPY_NOTICE}</p>
        <p className="text-xs text-muted-foreground">{EXISTING_ACCESS_HELPER}</p>
      </div>

      {isLoading ? <PanelSkeleton /> : null}

      {isError && !isLoading ? (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm text-foreground">
            Couldn't load access settings. Close this panel and try again.
          </p>
          <Button type="button" variant="hollow" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {!isLoading && !isError && policyQuery.data && managementQuery.data ? (
        <>
          <section aria-labelledby="recording-access-level" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 id="recording-access-level" className="text-sm font-semibold text-foreground">
                Access level
              </h3>
              <Badge variant="outline">
                {policyQuery.data.origin === 'default'
                  ? `Using default: ${ACCESS_LEVEL_LABELS[policyQuery.data.accessLevel]}`
                  : 'Custom'}
              </Badge>
            </div>
            <AccessLevelPicker
              id="recording-access-level-picker"
              label="Choose access level"
              value={policyQuery.data.accessLevel}
              pendingValue={setPolicy.isPending ? policyQuery.data.accessLevel : undefined}
              disabled={setPolicy.isPending || resetPolicy.isPending}
              onValueChange={handlePolicyChange}
            />
            {policyQuery.data.origin === 'custom' ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                disabled={setPolicy.isPending || resetPolicy.isPending}
                className={cn(isMobile && 'min-h-11')}
                onClick={() => resetPolicy.mutate()}
              >
                {resetPolicy.isPending ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : null}
                Reset to default
              </Button>
            ) : null}
          </section>

          <Separator className="bg-border/40" />

          {focusedRequestStatus ? (
            <p className="rounded-md bg-muted/60 p-4 text-sm text-foreground" role="status">
              {focusedRequestStatus}
            </p>
          ) : null}

          <section aria-labelledby="access-requests-heading" className="space-y-3">
            <h3
              id="access-requests-heading"
              className="text-sm font-semibold tabular-nums text-foreground"
            >
              Access requests ({pendingRequests.length})
            </h3>
            {pendingRequests.length === 0 ? (
              <EmptyState title="No pending requests" body="New requests will appear here." />
            ) : (
              <div className="space-y-2">
                {pendingRequests.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    expanded={expandedRequestId === request.id}
                    isMobile={isMobile}
                    isPending={pendingRequestId === request.id && (approveRequest.isPending || denyRequest.isPending)}
                    onReview={() => setExpandedRequestId((current) => current === request.id ? null : request.id)}
                    onApprove={() => {
                      setPendingRequestId(request.id)
                      approveRequest.mutate(request.id, {
                        onSuccess: () => setLiveMessage(`Access approved for ${request.name}.`),
                        onSettled: () => setPendingRequestId(null),
                      })
                    }}
                    onDeny={() => setDenyTarget(request)}
                    focusReview={focusedRequestId === request.id}
                    reviewHeadingRef={focusedReviewHeadingRef}
                  />
                ))}
              </div>
            )}
          </section>

          <Separator className="bg-border/40" />

          <section aria-labelledby="access-grants-heading" className="space-y-3">
            <h3
              id="access-grants-heading"
              className="text-sm font-semibold tabular-nums text-foreground"
            >
              People with access ({managementQuery.data.grants.length})
            </h3>
            {managementQuery.data.grants.length === 0 ? (
              <EmptyState
                title="No individual access grants"
                body="Approved requests will appear here. Share links stay under Share."
              />
            ) : (
              <div className="space-y-2">
                {managementQuery.data.grants.map((grant) => (
                  <GrantRow
                    key={grant.id}
                    grant={grant}
                    isMobile={isMobile}
                    isPending={pendingGrantId === grant.id && revokeGrant.isPending}
                    onRevoke={() => setRevokeTarget(grant)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
    </div>
  )

  return (
    <>
      {isMobile ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
          <DialogContent
            className="max-h-[calc(100vh-16px)] w-[calc(100vw-16px)] max-w-lg overflow-hidden p-0"
            onOpenAutoFocus={(event) => {
              if (focusedRequestId) {
                event.preventDefault()
                focusDeepLinkedReview()
              }
            }}
          >
            <ScrollArea className="max-h-[calc(100vh-16px)]">{content}</ScrollArea>
          </DialogContent>
        </Dialog>
      ) : (
        <Popover open={open} onOpenChange={onOpenChange}>
          {trigger ? <PopoverTrigger asChild>{trigger}</PopoverTrigger> : null}
          <PopoverContent
            aria-label="Recording access"
            align="start"
            className="w-[400px] max-w-[calc(100vw-16px)] p-0"
            onOpenAutoFocus={(event) => {
              if (focusedRequestId) {
                event.preventDefault()
                focusDeepLinkedReview()
              }
            }}
          >
            <ScrollArea className="max-h-[70vh]">{content}</ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      <AlertDialog
        open={publicSelection === 'public'}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPublicSelection(null)
            restorePublicOptionFocus()
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this recording public?</AlertDialogTitle>
            <AlertDialogDescription>
              Anyone can view “{recordingTitle}” without a direct invitation or share link. This affects this recording only.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isMobile && 'flex-col')}>
            <AlertDialogCancel>Keep current access</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                setPolicy.mutate('public', { onSettled: () => setPublicSelection(null) })
              }}
            >
              Make public
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={denyTarget !== null} onOpenChange={(nextOpen) => !nextOpen && setDenyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny this access request?</AlertDialogTitle>
            <AlertDialogDescription>
              {denyTarget?.name} won't get access and cannot request this recording again for 30 days. No private reason will be shared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isMobile && 'flex-col')}>
            <AlertDialogCancel>Keep request</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={denyRequest.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!denyTarget) return
                setPendingRequestId(denyTarget.id)
                denyRequest.mutate(denyTarget.id, {
                  onSuccess: () => setLiveMessage('Access request denied.'),
                  onSettled: () => {
                    setPendingRequestId(null)
                    setDenyTarget(null)
                  },
                })
              }}
            >
              Deny request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeTarget !== null} onOpenChange={(nextOpen) => !nextOpen && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke access for {revokeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.name} will lose access to this recording. This action is logged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isMobile && 'flex-col')}>
            <AlertDialogCancel>Keep access</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              disabled={revokeGrant.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (!revokeTarget) return
                const target = revokeTarget
                setPendingGrantId(target.id)
                revokeGrant.mutate(target.id, {
                  onSuccess: () => setLiveMessage(`Access revoked for ${target.name}.`),
                  onSettled: () => {
                    setPendingGrantId(null)
                    setRevokeTarget(null)
                  },
                })
              }}
            >
              Revoke access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function RecordingAccessTriggerIcon() {
  return <RiShieldKeyholeLine className="h-4 w-4" aria-hidden="true" />
}

export default RecordingAccessPanel
