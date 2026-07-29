import { supabase } from '@/integrations/supabase/client'
import { untypedFrom, untypedRpc } from '@/types/db-extensions'

export interface OrganizationInvitation {
  id: string
  organization_id: string
  invited_by: string
  email: string
  role: 'organization_owner' | 'organization_admin' | 'organization_member'
  invite_token: string
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  expires_at: string
  created_at: string
}

export interface OrganizationInviteDetails {
  organization_name: string
  inviter_name: string
  role: string
  expires_at: string
}

export async function getOrganizationInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
  const { data, error } = await untypedFrom(supabase, 'organization_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch organization invitations: ${error.message}`)

  return data as OrganizationInvitation[]
}

/**
 * Checks whether a normalized email already belongs to an organization member.
 * Looks up the user_profiles row for the email, then checks organization_memberships.
 */
async function isEmailAlreadyOrgMember(organizationId: string, normalizedEmail: string): Promise<boolean> {
  const { data: profile, error: profileError } = await untypedFrom(supabase, 'user_profiles')
    .select('user_id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (profileError) {
    throw new Error(`Failed to check existing membership: ${profileError.message}`)
  }
  if (!profile) return false

  const { data: membership, error: membershipError } = await untypedFrom(supabase, 'organization_memberships')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', profile.user_id)
    .maybeSingle()

  if (membershipError) {
    throw new Error(`Failed to check existing membership: ${membershipError.message}`)
  }

  return !!membership
}

export async function createOrganizationInvitation(
  organizationId: string,
  email: string,
  role: OrganizationInvitation['role']
): Promise<OrganizationInvitation> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const normalizedEmail = email.trim().toLowerCase()
  const alreadyMember = await isEmailAlreadyOrgMember(organizationId, normalizedEmail)
  if (alreadyMember) {
    throw new Error(`${normalizedEmail} is already a member of this organization.`)
  }

  // Generate token and expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data, error } = await untypedFrom(supabase, 'organization_invitations')
    .insert({
      organization_id: organizationId,
      invited_by: userData.user.id,
      email: normalizedEmail,
      role,
      invite_token: token,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: existing, error: existingError } = await untypedFrom(supabase, 'organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle()

      if (existingError) throw new Error(`Failed to create organization invitation: ${existingError.message}`)
      if (existing) {
        return resendOrganizationInvitation(existing.id as string, role)
      }
    }

    throw new Error(`Failed to create organization invitation: ${error.message}`)
  }

  return data as OrganizationInvitation
}

function isUniqueViolation(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '23505' ||
    error.message?.includes('duplicate key value violates unique constraint') === true ||
    error.message?.includes('org_invitations_email_org_idx') === true
  )
}

/**
 * Resends (refreshes token + expiry for) an existing pending organization invitation.
 */
export async function resendOrganizationInvitation(
  invitationId: string,
  role: OrganizationInvitation['role']
): Promise<OrganizationInvitation> {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data, error } = await untypedFrom(supabase, 'organization_invitations')
    .update({
      role,
      invite_token: crypto.randomUUID(),
      expires_at: expiresAt.toISOString(),
      status: 'pending',
    })
    .eq('id', invitationId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to resend invitation: ${error.message}`)

  return data as OrganizationInvitation
}

export async function revokeOrganizationInvitation(invitationId: string): Promise<void> {
  const { error } = await untypedFrom(supabase, 'organization_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)

  if (error) throw new Error(`Failed to revoke invitation: ${error.message}`)
}

export async function getOrganizationInviteDetails(token: string): Promise<OrganizationInviteDetails> {
  // Use the SECURITY DEFINER RPC which bypasses RLS and has correct joins
  const { data, error } = await untypedRpc(supabase, 'get_organization_invite_details', {
    p_token: token,
  })

  if (error) throw new Error('Invitation not found or has expired')

  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('Invitation not found or has expired')

  return {
    organization_name: row.organization_name,
    inviter_name: row.inviter_display_name,
    role: row.role,
    expires_at: row.expires_at,
  }
}

export async function acceptOrganizationInvite(token: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  // We should ideally use an RPC for this to ensure atomicity and proper membership creation
  const { error } = await untypedRpc(supabase, 'accept_organization_invite', {
    p_token: token,
    p_user_id: userData.user.id,
  })

  if (error) throw new Error(`Failed to accept invitation: ${error.message}`)
}

export function getShareableLink(token: string): string {
  return `${window.location.origin}/join/org/${token}`
}
