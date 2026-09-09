import { useMemo, useState } from 'react'
import {
  RiBuilding4Line,
  RiCloseLine,
  RiLoader2Line,
  RiShieldCheckLine,
} from '@remixicon/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useOrganizationIdentity } from '@/hooks/useOrganizationIdentity'
import { useIdentityAliases } from '@/hooks/useIdentityAliases'
import { OrganizationIdentityError } from '@/services/organization-identity.service'
import { VerifiedDomainBadge } from '@/components/shared/VerifiedDomainBadge'

interface OrganizationIdentitySectionProps {
  organizationId: string
  organizationName: string
  /** Gates the add-alias/claim-domain controls. Real authority is
   * server-side (is_organization_admin_or_owner inside each RPC) -- this is
   * convenience-only UI gating (T-36-11). Viewing the lists is not gated. */
  canManage: boolean
}

/** Maps a thrown OrganizationIdentityError's `.code` from the claim RPC to
 * the exact UI-SPEC Copywriting Contract string. This mapping lives here
 * (not the service) because the RPC returns no message field at all --
 * this component owns the user-facing copy. */
function claimErrorCopy(code: string, domain: string): string {
  switch (code) {
    case 'CONFLICT':
      return 'This domain is already claimed by another organization.'
    case 'NO_VERIFIED_EMAIL':
      return `You need a verified email on this domain to claim it. Add and verify an email ending in @${domain} in Account settings, then try again.`
    case 'BLOCKLISTED':
      return `${domain} is a shared email provider and can't be claimed as an organization domain.`
    case 'FORBIDDEN':
      return 'You do not have permission to claim a domain for this organization.'
    default:
      return 'Failed to claim domain. Try again.'
  }
}

function IdentityEmptyState({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
        <RiBuilding4Line size={24} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{heading}</p>
        <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function IdentitySkeletonRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-8 w-full" />
    </div>
  )
}

/**
 * OrganizationIdentitySection — self-serve aliases + verified-domain claim
 * (ORG-01/ORG-02), rendered inside OrganizationsTab's existing per-org Card.
 *
 * Structurally mirrors AccountTab's "Verified Emails" section (grid header +
 * content column, toggle-to-form with distinct loading labels) but nested in
 * a Card rather than as a top-level page section.
 */
export function OrganizationIdentitySection({
  organizationId,
  organizationName,
  canManage,
}: OrganizationIdentitySectionProps) {
  const {
    domains,
    aliases,
    isLoadingDomains,
    isLoadingAliases,
    domainsError,
    aliasesError,
    claimDomain,
    isClaiming,
    addAlias,
    isAddingAlias,
    removeAlias,
  } = useOrganizationIdentity(organizationId)
  const { verifiedEmails } = useIdentityAliases()

  const [showAddAliasForm, setShowAddAliasForm] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [showClaimForm, setShowClaimForm] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState('')
  const [claimErrorMessage, setClaimErrorMessage] = useState<string | null>(null)

  const candidateDomains = useMemo(() => {
    const domainSet = new Set<string>()
    for (const email of verifiedEmails ?? []) {
      const domain = email.value.split('@')[1]?.toLowerCase().trim()
      if (domain) domainSet.add(domain)
    }
    return Array.from(domainSet)
  }, [verifiedEmails])

  const hasVerifiedDomain = (domains?.length ?? 0) > 0

  const resetAddAliasForm = () => {
    setShowAddAliasForm(false)
    setNewAlias('')
  }

  const handleAddAlias = async () => {
    const trimmed = newAlias.trim()
    if (!trimmed) return
    try {
      await addAlias(trimmed)
      resetAddAliasForm()
    } catch {
      // useOrganizationIdentity's onError already toasts.
    }
  }

  const handleRemoveAlias = (aliasId: string) => {
    removeAlias(aliasId).catch(() => {
      // useOrganizationIdentity's onError already toasts.
    })
  }

  const resetClaimForm = () => {
    setShowClaimForm(false)
    setSelectedDomain('')
    setClaimErrorMessage(null)
  }

  const handleClaimDomain = async () => {
    if (!selectedDomain) return
    setClaimErrorMessage(null)
    try {
      await claimDomain(selectedDomain)
      resetClaimForm()
    } catch (err) {
      if (err instanceof OrganizationIdentityError) {
        setClaimErrorMessage(claimErrorCopy(err.code, selectedDomain))
      } else {
        setClaimErrorMessage('Failed to claim domain. Try again.')
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-3">
      <div>
        <h2 className="flex items-center gap-2 font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          <RiShieldCheckLine className="h-4 w-4 shrink-0" />
          {organizationName}
          {hasVerifiedDomain && <VerifiedDomainBadge organizationId={organizationId} />}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage aliases and verify your organization&apos;s email domain
        </p>
      </div>

      <div className="space-y-8 lg:col-span-2">
        {/* ── Aliases ── */}
        <div>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            Aliases
          </h3>

          {isLoadingAliases ? (
            <IdentitySkeletonRows />
          ) : aliasesError ? (
            <p className="text-sm text-destructive">Failed to load aliases.</p>
          ) : (aliases?.length ?? 0) === 0 ? (
            <IdentityEmptyState
              heading="No aliases yet"
              body="Add another name this organization goes by — useful if people search or refer to it differently."
            />
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {(aliases ?? []).map((alias) => (
                <li
                  key={alias.id}
                  className="flex items-center justify-between gap-2 text-sm text-foreground"
                >
                  <span className="truncate" title={alias.alias}>
                    {alias.alias}
                  </span>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove alias"
                      onClick={() => handleRemoveAlias(alias.id)}
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <RiCloseLine className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage &&
            (!showAddAliasForm ? (
              <Button variant="hollow" className="mt-4" onClick={() => setShowAddAliasForm(true)}>
                Add alias
              </Button>
            ) : (
              <div className="mt-4 max-w-md space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-org-alias">Alias</Label>
                  <Input
                    id="new-org-alias"
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    placeholder="Acme Co."
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddAlias} disabled={!newAlias.trim() || isAddingAlias}>
                    {isAddingAlias ? (
                      <>
                        <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
                        Adding…
                      </>
                    ) : (
                      'Add alias'
                    )}
                  </Button>
                  <Button variant="hollow" onClick={resetAddAliasForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
        </div>

        <Separator />

        {/* ── Domain ── */}
        <div>
          <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            Domain
          </h3>

          {isLoadingDomains ? (
            <IdentitySkeletonRows />
          ) : domainsError ? (
            <p className="text-sm text-destructive">Failed to load domain status.</p>
          ) : (domains?.length ?? 0) === 0 ? (
            <IdentityEmptyState
              heading="No verified domain"
              body="Claim your organization's email domain to show a verified badge."
            />
          ) : (
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {(domains ?? []).map((domain) => (
                <li
                  key={domain.id}
                  className="flex items-center justify-between gap-2 text-sm text-foreground"
                >
                  <span className="truncate" title={domain.domain}>
                    {domain.domain}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    Claimed {new Date(domain.claimed_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {canManage &&
            (!showClaimForm ? (
              <Button variant="hollow" className="mt-4" onClick={() => setShowClaimForm(true)}>
                <RiShieldCheckLine className="mr-2 h-4 w-4" />
                Claim domain
              </Button>
            ) : candidateDomains.length === 0 ? (
              <div className="mt-4 max-w-md space-y-3">
                <p className="text-sm text-destructive">
                  You need a verified email to claim a domain. Add and verify an email in Account
                  settings, then try again.
                </p>
                <Button variant="hollow" onClick={() => setShowClaimForm(false)}>
                  Close
                </Button>
              </div>
            ) : (
              <div className="mt-4 max-w-md space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="claim-domain-select">Domain</Label>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger id="claim-domain-select">
                      <SelectValue placeholder="Select a domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidateDomains.map((domain) => (
                        <SelectItem key={domain} value={domain}>
                          {domain}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {claimErrorMessage && (
                  <p className="text-sm text-destructive">{claimErrorMessage}</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleClaimDomain} disabled={!selectedDomain || isClaiming}>
                    {isClaiming ? (
                      <>
                        <RiLoader2Line className="mr-2 h-4 w-4 animate-spin" />
                        Claiming…
                      </>
                    ) : (
                      'Claim domain'
                    )}
                  </Button>
                  <Button variant="hollow" onClick={resetClaimForm}>
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default OrganizationIdentitySection
