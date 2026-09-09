import { supabase } from '@/integrations/supabase/client'

/**
 * Organization Identity Service — pure async wrapper over the self-serve
 * organization identity RPCs (Phase 36-01: claim_organization_domain,
 * add_organization_alias, remove_organization_alias) plus the member-scoped
 * reads of organization_domains/organization_aliases.
 *
 * Security: both list reads rely on member-SELECT RLS (is_organization_member)
 * -- a caller only ever sees rows for orgs they belong to (T-36-11). The three
 * mutation RPCs are SECURITY DEFINER and return a JSONB {success, code?}
 * soft-failure contract instead of throwing a raw Postgres error, so every
 * mutation here branches on `data.success === false` rather than only on
 * `error` (36-03-PLAN.md).
 */

export interface OrganizationDomain {
  id: string
  organization_id: string
  domain: string
  claimed_by: string | null
  claimed_at: string
}

export interface OrganizationAlias {
  id: string
  organization_id: string
  alias: string
  created_by: string | null
  created_at: string
}

type RpcOutcome = { success: boolean; code?: string } | null

/** Thrown by claimOrganizationDomain/addOrganizationAlias/removeOrganizationAlias
 * carrying the RPC's machine-readable `code` (FORBIDDEN, BLOCKLISTED,
 * NO_VERIFIED_EMAIL, CONFLICT, NOT_FOUND) so callers can render distinct
 * messages per T-36-10. The `.message` here is a generic fallback (the RPCs
 * return no message field at all) -- UI callers that need the exact
 * UI-SPEC copy map `.code` themselves; see 36-03-PLAN.md Task 2. */
export class OrganizationIdentityError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'OrganizationIdentityError'
    this.code = code
  }
}

function genericMessageForCode(code: string | undefined): string {
  switch (code) {
    case 'FORBIDDEN':
      return 'You do not have permission to do this.'
    case 'BLOCKLISTED':
      return 'This domain cannot be claimed as an organization domain.'
    case 'NO_VERIFIED_EMAIL':
      return 'You need a verified email on this domain to claim it.'
    case 'CONFLICT':
      return 'This is already claimed.'
    case 'NOT_FOUND':
      return 'Not found.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

function assertRpcSuccess(data: RpcOutcome, error: { message: string } | null): void {
  if (error) {
    throw new OrganizationIdentityError(error.message, 'UNKNOWN_ERROR')
  }
  if (!data?.success) {
    const code = data?.code ?? 'UNKNOWN_ERROR'
    throw new OrganizationIdentityError(genericMessageForCode(data?.code), code)
  }
}

/**
 * Lists an organization's confirmed domain claims.
 * RLS scopes this to orgs the caller is a member of (T-36-11).
 */
export async function listOrganizationDomains(organizationId: string): Promise<OrganizationDomain[]> {
  const { data, error } = await supabase
    .from('organization_domains')
    .select('*')
    .eq('organization_id', organizationId)
    .order('claimed_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch organization domains: ${error.message}`)
  }
  return data ?? []
}

/**
 * Lists an organization's display/search aliases.
 * RLS scopes this to orgs the caller is a member of (T-36-11).
 */
export async function listOrganizationAliases(organizationId: string): Promise<OrganizationAlias[]> {
  const { data, error } = await supabase
    .from('organization_aliases')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch organization aliases: ${error.message}`)
  }
  return data ?? []
}

/**
 * Claims a domain for the organization using one of the caller's own
 * currently-verified emails as ownership proof (ORG-02). Requires the
 * caller to be an org admin/owner -- enforced server-side by
 * is_organization_admin_or_owner inside the RPC; client-side gating is
 * convenience only (T-36-11).
 *
 * Throws OrganizationIdentityError with code FORBIDDEN | BLOCKLISTED |
 * NO_VERIFIED_EMAIL | CONFLICT on any non-success outcome.
 */
export async function claimOrganizationDomain(organizationId: string, domain: string): Promise<void> {
  const { data, error } = await supabase.rpc('claim_organization_domain', {
    p_organization_id: organizationId,
    p_domain: domain,
  })

  assertRpcSuccess(data as RpcOutcome, error)
}

/**
 * Adds a display/search alias to the organization. Requires org admin/owner
 * server-side (T-36-11). Throws OrganizationIdentityError with code
 * FORBIDDEN | CONFLICT on any non-success outcome.
 */
export async function addOrganizationAlias(organizationId: string, alias: string): Promise<void> {
  const { data, error } = await supabase.rpc('add_organization_alias', {
    p_organization_id: organizationId,
    p_alias: alias,
  })

  assertRpcSuccess(data as RpcOutcome, error)
}

/**
 * Removes an organization alias by id. Requires org admin/owner of that
 * alias's own organization, server-side (T-36-11). Throws
 * OrganizationIdentityError with code NOT_FOUND | FORBIDDEN on any
 * non-success outcome.
 */
export async function removeOrganizationAlias(aliasId: string): Promise<void> {
  const { data, error } = await supabase.rpc('remove_organization_alias', {
    p_alias_id: aliasId,
  })

  assertRpcSuccess(data as RpcOutcome, error)
}
