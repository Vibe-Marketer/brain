import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useIdentityEvidence } from '@/hooks/useIdentityEvidence'
import { RiShieldCheckLine } from '@remixicon/react'

interface IdentityEvidenceBadgeProps {
  /** identities.id the speaker resolved to. Caller must only render this
   * component when identityId is truthy — unresolved speakers get nothing. */
  identityId: string
}

/**
 * IdentityEvidenceBadge — on-demand confidence/evidence affordance for a
 * resolved speaker label (IDENT-08, "visible on demand").
 *
 * Reads ONLY the redacted get_identity_evidence RPC (alias_type, confidence,
 * evidence) via useIdentityEvidence — never the raw email. Evidence is
 * fetched lazily, only once the popover is opened.
 */
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return 'High'
  if (confidence >= 0.5) return 'Medium'
  return 'Low'
}

export function IdentityEvidenceBadge({ identityId }: IdentityEvidenceBadgeProps) {
  const [open, setOpen] = useState(false)
  const { data, isLoading, error } = useIdentityEvidence(identityId, open)

  const topEvidence =
    data && data.length > 0 ? [...data].sort((a, b) => b.confidence - a.confidence)[0] : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen((prev) => !prev)
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View identity match confidence and evidence"
        >
          <RiShieldCheckLine className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-64 p-3">
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        {!isLoading && error && (
          <p className="text-sm text-muted-foreground">Unable to load match evidence.</p>
        )}
        {!isLoading && !error && !topEvidence && (
          <p className="text-sm text-muted-foreground">No match evidence recorded.</p>
        )}
        {!isLoading && !error && topEvidence && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              Confidence: <span className="tabular-nums">{confidenceLabel(topEvidence.confidence)}</span>
            </p>
            <p className="text-sm text-muted-foreground">{topEvidence.evidence}</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
