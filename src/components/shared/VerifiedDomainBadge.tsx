import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrganizationIdentity } from '@/hooks/useOrganizationIdentity'
import { RiShieldCheckLine } from '@remixicon/react'

interface VerifiedDomainBadgeProps {
  /** organizations.id whose verified domains this badge summarizes. Caller
   * must only mount this component when the org has >=1 verified domain
   * (the section already has the domains list loaded to know that) --
   * mirrors IdentityEvidenceBadge's "only render when resolved" convention.
   * If opened with zero rows regardless, the popover falls back to a
   * "No verified domains" text branch rather than an empty-state render. */
  organizationId: string
}

/**
 * VerifiedDomainBadge — on-demand affordance next to an organization's name
 * showing it has at least one verified email domain (ORG-02). The popover
 * lists EVERY verified domain (zero-one-many E4), not just the first.
 *
 * Reuses organization_domains via useOrganizationIdentity's domains query,
 * gated by the popover's own `open` state so N org badges never fire N
 * queries on mount (T-36-12, mirrors IdentityEvidenceBadge / T-34-05-03).
 */
export function VerifiedDomainBadge({ organizationId }: VerifiedDomainBadgeProps) {
  const [open, setOpen] = useState(false)
  const { domains, isLoadingDomains, domainsError } = useOrganizationIdentity(organizationId, open)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // WR-03 (36-REVIEW.md): idempotent open, not a toggle. onMouseEnter
            // already fires before onClick on any mouse-driven device, so
            // `open` is already true by the time this handler runs — a
            // prev => !prev toggle would immediately re-close the popover the
            // hover just opened. Hover/focus own opening; onMouseLeave/onBlur
            // own closing.
            setOpen(true)
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="View verified domains"
        >
          <RiShieldCheckLine className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-64 p-3">
        {isLoadingDomains && (
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        )}
        {!isLoadingDomains && domainsError && (
          <p className="text-sm text-muted-foreground">Unable to load verified domains.</p>
        )}
        {!isLoadingDomains && !domainsError && (!domains || domains.length === 0) && (
          <p className="text-sm text-muted-foreground">No verified domains.</p>
        )}
        {!isLoadingDomains && !domainsError && domains && domains.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Verified domains</p>
            <ul className="space-y-0.5">
              {domains.map((domain) => (
                <li
                  key={domain.id}
                  className="truncate text-sm text-muted-foreground"
                  title={domain.domain}
                >
                  {domain.domain}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
