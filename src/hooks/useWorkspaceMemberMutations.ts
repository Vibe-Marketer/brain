/**
 * useWorkspaceMemberMutations - Mutation hooks for workspace member management
 *
 * Provides:
 * - useGenerateWorkspaceInvite: Generate/retrieve shareable invite link
 * - useChangeRole: Change a member's workspace role
 * - useRemoveMember: Remove a member from workspace
 * - useLeaveWorkspace: Current user leaves workspace
 *
 * Follows the same pattern as useTeamHierarchy.generateTeamInvite.
 *
 * @pattern tanstack-query-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import { toast } from 'sonner'
import type { WorkspaceRole } from '@/types/workspace'

// Role hierarchy for permission checks (lower = more powerful)
const ROLE_POWER: Record<WorkspaceRole, number> = {
  workspace_owner: 0,
  workspace_admin: 1,
  manager: 2,
  member: 3,
  guest: 4,
}

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  workspace_owner: 'Owner',
  workspace_admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
  guest: 'Guest',
}

/**
 * Generates a cryptographically secure 32-character URL-safe token
 * (Same implementation as useTeamHierarchy)
 */
function generateInviteToken(): string {
  const array = new Uint8Array(24)
  crypto.getRandomValues(array)
  const base64 = btoa(String.fromCharCode(...array))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Calculates invite expiration date (7 days from now)
 */
function getInviteExpiration(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString()
}

/**
 * useGenerateWorkspaceInvite - Generate or retrieve existing valid invite link
 *
 * Permission: workspace_owner or workspace_admin only
 * Returns existing valid token if one exists, otherwise generates a new one.
 */
export function useGenerateWorkspaceInvite(workspaceId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (options?: { force?: boolean }): Promise<{
      invite_token: string
      invite_url: string
      invite_expires_at: string
    }> => {
      if (!workspaceId) throw new Error('Workspace ID is required')
      if (!user) throw new Error('Not authenticated')

      // Permission check: must be workspace_owner or workspace_admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('workspace_memberships')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .maybeSingle()

      const currentRole = membership?.role as WorkspaceRole | undefined
      if (currentRole !== 'workspace_owner' && currentRole !== 'workspace_admin') {
        throw new Error('Only workspace owners and admins can generate invite links')
      }

      // Check if workspace already has a valid invite token
      // Preferred path: SECURITY DEFINER RPC handles permissions and token generation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('generate_workspace_invite', {
        p_workspace_id: workspaceId,
        p_force: !!options?.force,
      })

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        const row = rpcData[0] as { invite_token: string; invite_expires_at: string }
        return {
          invite_token: row.invite_token,
          invite_url: `${window.location.origin}/join/workspace/${row.invite_token}`,
          invite_expires_at: row.invite_expires_at,
        }
      }

      // Generate new token and store on workspaces table
      const inviteToken = generateInviteToken()
      const inviteExpiresAt = getInviteExpiration()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('workspaces')
        .update({
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        })
        .eq('id', workspaceId)

      if (updateError) {
        const message = updateError?.message || ''
        if (message.includes('row-level security')) {
          throw new Error('You do not have permission to generate invite links for this workspace.')
        }
        if (message.includes('invite_token') || message.includes('invite_expires_at')) {
          throw new Error('Workspace invite schema is not fully deployed yet. Please run the latest Supabase migrations and try again.')
        }
        throw updateError
      }

      const inviteUrl = `${window.location.origin}/join/workspace/${inviteToken}`
      return { invite_token: inviteToken, invite_url: inviteUrl, invite_expires_at: inviteExpiresAt }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate invite link')
    },
  })
}

/**
 * useChangeRole - Change a member's role in the workspace
 *
 * Permission rules:
 * - Changer must be workspace_owner or workspace_admin
 * - Cannot change workspace_owner's role (only owner can transfer ownership)
 * - New role cannot exceed changer's role (admin can't promote to owner)
 */
export function useChangeRole(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      membershipId,
      userId: _targetUserId,
      newRole,
      currentUserRole,
      targetRole,
      isLastAdmin,
    }: {
      membershipId: string
      userId: string
      newRole: WorkspaceRole
      currentUserRole: WorkspaceRole
      targetRole: WorkspaceRole
      isLastAdmin: boolean
    }) => {
      // Permission check: must be owner or admin
      if (currentUserRole !== 'workspace_owner' && currentUserRole !== 'workspace_admin') {
        throw new Error('Only workspace owners and admins can change roles')
      }

      // Cannot change workspace_owner role via this action
      if (targetRole === 'workspace_owner') {
        throw new Error('Cannot change the workspace owner role')
      }

      if (targetRole === 'workspace_admin' && isLastAdmin && newRole !== 'workspace_admin') {
        throw new Error('Cannot demote the last admin')
      }

      // Cannot promote beyond own role
      if (ROLE_POWER[newRole] < ROLE_POWER[currentUserRole]) {
        throw new Error('Cannot assign a role higher than your own')
      }

      // Update the membership
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('workspace_memberships')
        .update({ role: newRole })
        .eq('id', membershipId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      toast.success(`Role changed to ${ROLE_LABELS[variables.newRole]}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change role')
    },
  })
}

/**
 * useRemoveMember - Remove a member from the workspace
 *
 * Permission rules:
 * - Remover must be workspace_owner or workspace_admin
 * - Cannot remove workspace_owner
 * - Recordings stay in workspace (NOT removed)
 */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      membershipId,
      targetRole,
      currentUserRole,
    }: {
      membershipId: string
      targetRole: WorkspaceRole
      currentUserRole: WorkspaceRole
    }) => {
      if (currentUserRole !== 'workspace_owner' && currentUserRole !== 'workspace_admin') {
        throw new Error('Only workspace owners and admins can remove members')
      }

      // Cannot remove workspace_owner
      if (targetRole === 'workspace_owner') {
        throw new Error('Cannot remove the workspace owner')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('workspace_memberships')
        .delete()
        .eq('id', membershipId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.detail(workspaceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member')
    },
  })
}

/**
 * useLeaveWorkspace - Current user removes themselves from workspace
 *
 * Rules:
 * - Cannot leave if you're workspace_owner (must transfer first)
 * - Navigates to /workspaces after leaving
 */
export function useLeaveWorkspace(workspaceId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ membershipId, userRole }: { membershipId: string; userRole: WorkspaceRole }) => {
      if (userRole === 'workspace_owner') {
        throw new Error('Workspace owners cannot leave. Transfer ownership first.')
      }

      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('workspace_memberships')
        .delete()
        .eq('id', membershipId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('You left the workspace')
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all })
      navigate('/workspaces')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave workspace')
    },
  })
}
