import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/types/supabase'
import type { Organization } from '@/types/workspace'

type OrganizationMembershipRow = Database['public']['Tables']['organization_memberships']['Row']

/**
 * Organization with the caller's membership role attached.
 * Used by useOrganizations to determine ownership/admin status.
 */
export interface OrganizationWithRole extends Organization {
  membershipRole: string
  membershipId: string
}

/**
 * Fetches all organizations for the given user.
 *
 * Queries: organizations table via organization_memberships join.
 * Returns: Organization[] with membership role attached.
 *
 * Note: All Supabase queries use supabase.from('organizations').
 */
export async function getOrganizations(userId: string): Promise<OrganizationWithRole[]> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select(`
      id,
      role,
      org:organizations (
        id,
        name,
        type,
        cross_org_default,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to fetch organizations: ${error.message}`)
  }

  // Transform membership rows to OrganizationWithRole[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    ...row.org,
    membershipRole: row.role as string,
    membershipId: row.id as string,
  })) as OrganizationWithRole[]
}

/**
 * Fetches a single organization by ID.
 * Returns null if not found or not accessible to current user.
 */
export async function getOrganizationById(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, type, cross_org_default, created_at, updated_at')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch organization ${orgId}: ${error.message}`)
  }

  return data
}

/**
 * Creates a new organization for the given user.
 * Inserts into organizations with type='business', then creates organization_membership as organization_owner.
 * Returns the newly created organization.
 */
export async function createOrganization(
  userId: string,
  name: string
): Promise<Organization> {
  // 1. Insert the organization
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert({ name, type: 'business' })
    .select('id, name, type, cross_org_default, created_at, updated_at')
    .single()

  if (orgError || !organization) {
    throw new Error(`Failed to create organization: ${orgError?.message ?? 'Unknown error'}`)
  }

  // 2. Create membership as organization_owner
  const { error: memberError } = await supabase
    .from('organization_memberships')
    .insert({ organization_id: organization.id, user_id: userId, role: 'organization_owner' })

  if (memberError) {
    throw new Error(`Organization created but failed to set membership: ${memberError.message}`)
  }

  return organization as Organization
}

/**
 * Helper: returns true if the organization is the user's personal org.
 * Personal orgs have type === 'personal'.
 *
 * Important: identify personal org by type field, never by name.
 */
export function isPersonalOrg(org: Organization): boolean {
  return org.type === 'personal'
}

// ─── Organization Member Types ──────────────────────────────────────

export type OrganizationRole = 'organization_owner' | 'organization_admin' | 'member'

export interface OrganizationMember {
  id: string
  user_id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: OrganizationRole
  created_at: string
}

// ─── Organization Member Queries ────────────────────────────────────

/**
 * Fetches all members of an organization with their profile info.
 * RLS ensures only org members can see this data.
 */
export async function getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('organization_memberships')
    .select(`
      id,
      user_id,
      role,
      created_at,
      profiles:user_profiles!user_id (
        email,
        display_name,
        avatar_url
      )
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch organization members: ${error.message}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((m: any) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role as OrganizationRole,
    created_at: m.created_at,
    email: m.profiles?.email || '',
    display_name: m.profiles?.display_name || '',
    avatar_url: m.profiles?.avatar_url || null,
  }))
}

// ─── Organization Member Mutations ──────────────────────────────────

/**
 * Updates a member's role within an organization.
 * RLS enforces that only admins/owners can perform this action.
 */
export async function updateOrganizationMemberRole(
  membershipId: string,
  newRole: OrganizationRole
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('organization_memberships')
    .update({ role: newRole })
    .eq('id', membershipId)

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`)
  }
}

/**
 * Removes a member from an organization.
 * RLS enforces that only admins/owners can perform this action.
 * Cascading deletes handle workspace memberships via DB constraints.
 */
export async function removeOrganizationMember(membershipId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('organization_memberships')
    .delete()
    .eq('id', membershipId)

  if (error) {
    throw new Error(`Failed to remove organization member: ${error.message}`)
  }
}

// Re-export type so consumers don't need a separate import
export type { OrganizationMembershipRow }
