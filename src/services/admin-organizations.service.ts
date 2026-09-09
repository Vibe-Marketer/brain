import { supabase } from '@/integrations/supabase/client'

/**
 * Admin Organizations Service — pure async wrapper for the Admin Center's
 * Organizations section (Phase 36-05). Platform-ADMIN-only surface for
 * listing every organization on the platform (not just ones the operator
 * personally belongs to) plus the has_role(ADMIN)-gated merge/unclaim edge
 * functions from Phase 36-04.
 *
 * Security: listAllOrganizations relies on the admin-read-all RLS policy
 * added alongside this plan (migration 20260909000000, mirroring the
 * already-live user_profiles."Admins can view all profiles" pattern) —
 * without it, a platform admin who isn't a member of every organization
 * would only ever see the organizations they personally belong to.
 * mergeOrganizations/unclaimOrganizationDomain route through edge functions
 * that independently re-verify has_role server-side (Plan 04) — this
 * service never trusts client-side gating as an authority boundary, only
 * as UX convenience (see 36-05-PLAN.md threat model T-36-18).
 */

export interface AdminOrganizationDomain {
  id: string
  domain: string
  claimed_at: string
}

export interface AdminOrganizationAlias {
  id: string
  alias: string
}

export interface AdminOrganization {
  id: string
  name: string
  type: string
  created_at: string
  /** Set once this org has been merged into another (canonical) org via
   * merge_organizations_atomic — non-null means this row is a "loser" and
   * should be shown as merged rather than offered a live "Merge into…"
   * action (WR-01, 36-REVIEW.md). */
  canonical_organization_id: string | null
  /** Timestamp of the merge, paired with canonical_organization_id above. */
  merged_at: string | null
  domains: AdminOrganizationDomain[]
  aliases: AdminOrganizationAlias[]
}

/** Thrown by mergeOrganizations/unclaimOrganizationDomain with the edge
 * function's own error message + machine-readable `code`, mirroring
 * IdentityAliasError/OrganizationIdentityError's extraction shape. */
export class AdminOrganizationsError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'AdminOrganizationsError'
    this.code = code
  }
}

/** Extracts the edge function's JSON error body (status + { error, code })
 * from a supabase.functions.invoke FunctionsHttpError. Falls back to a
 * generic message if the body can't be parsed (e.g. a network failure
 * before the function even ran). */
async function toAdminOrganizationsError(
  error: unknown,
  fallbackMessage: string,
): Promise<AdminOrganizationsError> {
  const context = (error as { context?: Response })?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body?.error) {
        return new AdminOrganizationsError(body.error, body.code ?? 'UNKNOWN_ERROR')
      }
    } catch {
      // Body wasn't JSON — fall through to the generic message below.
    }
  }
  const message = error instanceof Error ? error.message : fallbackMessage
  return new AdminOrganizationsError(message, 'UNKNOWN_ERROR')
}

/**
 * Lists every organization on the platform with its claimed domains and
 * aliases, for the Admin Center's Organizations table. Three parallel
 * reads (organizations + organization_domains + organization_aliases),
 * joined client-side — this runs under the operator's ADMIN JWT relying on
 * the admin-read-all RLS policy, not a member-scoped read.
 */
export async function listAllOrganizations(): Promise<AdminOrganization[]> {
  const [orgsResult, domainsResult, aliasesResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, type, created_at, canonical_organization_id, merged_at')
      .order('created_at', { ascending: false }),
    supabase.from('organization_domains').select('id, organization_id, domain, claimed_at'),
    supabase.from('organization_aliases').select('id, organization_id, alias'),
  ])

  if (orgsResult.error) {
    throw new Error(`Failed to fetch organizations: ${orgsResult.error.message}`)
  }
  if (domainsResult.error) {
    throw new Error(`Failed to fetch organization domains: ${domainsResult.error.message}`)
  }
  if (aliasesResult.error) {
    throw new Error(`Failed to fetch organization aliases: ${aliasesResult.error.message}`)
  }

  const domainsByOrg = new Map<string, AdminOrganizationDomain[]>()
  for (const d of domainsResult.data ?? []) {
    const list = domainsByOrg.get(d.organization_id) ?? []
    list.push({ id: d.id, domain: d.domain, claimed_at: d.claimed_at })
    domainsByOrg.set(d.organization_id, list)
  }

  const aliasesByOrg = new Map<string, AdminOrganizationAlias[]>()
  for (const a of aliasesResult.data ?? []) {
    const list = aliasesByOrg.get(a.organization_id) ?? []
    list.push({ id: a.id, alias: a.alias })
    aliasesByOrg.set(a.organization_id, list)
  }

  return (orgsResult.data ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type,
    created_at: o.created_at,
    canonical_organization_id: o.canonical_organization_id,
    merged_at: o.merged_at,
    domains: domainsByOrg.get(o.id) ?? [],
    aliases: aliasesByOrg.get(o.id) ?? [],
  }))
}

/**
 * Merges the losing organization into the winning organization via the
 * has_role(ADMIN)-gated merge-organizations edge function (Phase 36-04).
 * Pointer-only (canonical_organization_id) and reversible — see
 * MergeOrganizationsDialog's copy.
 */
export async function mergeOrganizations(
  losingOrganizationId: string,
  winningOrganizationId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('merge-organizations', {
    body: {
      losing_organization_id: losingOrganizationId,
      winning_organization_id: winningOrganizationId,
    },
  })

  if (error) {
    throw await toAdminOrganizationsError(error, 'Failed to merge organizations.')
  }
}

/**
 * Unclaims a domain via the has_role(ADMIN)-gated
 * unclaim-organization-domain edge function (Phase 36-04). The domain can
 * be re-claimed later by any organization with a verified email on it.
 */
export async function unclaimOrganizationDomain(domainId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('unclaim-organization-domain', {
    body: { domain_id: domainId },
  })

  if (error) {
    throw await toAdminOrganizationsError(error, 'Failed to unclaim domain.')
  }
}
