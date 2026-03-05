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

// Re-export type so consumers don't need a separate import
export type { OrganizationMembershipRow }
