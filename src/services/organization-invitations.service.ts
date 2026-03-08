import { supabase } from '@/integrations/supabase/client'

export interface OrganizationInvitation {
  id: string
  organization_id: string
  invited_by: string
  email: string
  role: 'organization_owner' | 'organization_admin' | 'member'
  token: string
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
  const { data, error } = await (supabase as any)
    .from('organization_invitations')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch organization invitations: ${error.message}`)

  return data as OrganizationInvitation[]
}

export async function createOrganizationInvitation(
  organizationId: string,
  email: string,
  role: OrganizationInvitation['role']
): Promise<OrganizationInvitation> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  // Generate token and expiry
  const token = crypto.randomUUID()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const { data, error } = await (supabase as any)
    .from('organization_invitations')
    .insert({
      organization_id: organizationId,
      invited_by: userData.user.id,
      email,
      role,
      invite_token: token,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create organization invitation: ${error.message}`)

  return data as OrganizationInvitation
}

export async function revokeOrganizationInvitation(invitationId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('organization_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId)

  if (error) throw new Error(`Failed to revoke invitation: ${error.message}`)
}

export async function getOrganizationInviteDetails(token: string): Promise<OrganizationInviteDetails> {
  // We can query the table directly if the RLS allows it (which it does for pending ones)
  const { data, error } = await (supabase as any)
    .from('organization_invitations')
    .select(`
      role,
      expires_at,
      organization:organizations ( name ),
      inviter:profiles!invited_by ( display_name, email )
    `)
    .eq('invite_token', token)
    .eq('status', 'pending')
    .single()

  if (error || !data) throw new Error('Invitation not found or has expired')

  return {
    organization_name: data.organization.name,
    inviter_name: data.inviter.display_name || data.inviter.email,
    role: data.role,
    expires_at: data.expires_at,
  }
}

export async function acceptOrganizationInvite(token: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  // We should ideally use an RPC for this to ensure atomicity and proper membership creation
  const { error } = await (supabase as any).rpc('accept_organization_invite', {
    p_token: token,
    p_user_id: userData.user.id,
  })

  if (error) throw new Error(`Failed to accept invitation: ${error.message}`)
}

export function getShareableLink(token: string): string {
  return `${window.location.origin}/join/organization/${token}`
}
