/**
 * useVaultMemberMutations - Mutation hooks for vault member management
 *
 * Provides:
 * - useGenerateVaultInvite: Generate/retrieve shareable invite link
 * - useChangeRole: Change a member's vault role
 * - useRemoveMember: Remove a member from vault
 * - useLeaveVault: Current user leaves vault
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
import type { VaultRole } from '@/types/bank'

// Role hierarchy for permission checks (lower = more powerful)
const ROLE_POWER: Record<VaultRole, number> = {
  vault_owner: 0,
  vault_admin: 1,
  manager: 2,
  member: 3,
  guest: 4,
}

const ROLE_LABELS: Record<VaultRole, string> = {
  vault_owner: 'Owner',
  vault_admin: 'Admin',
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
 * useGenerateVaultInvite - Generate or retrieve existing valid invite link
 *
 * Permission: vault_owner or vault_admin only
 * Returns existing valid token if one exists, otherwise generates a new one.
 */
export function useGenerateVaultInvite(vaultId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (options?: { force?: boolean }): Promise<{
      invite_token: string
      invite_url: string
      invite_expires_at: string
    }> => {
      if (!vaultId) throw new Error('Hub ID is required')
      if (!user) throw new Error('Not authenticated')

      // Permission check: must be vault_owner or vault_admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: membership } = await (supabase as any)
        .from('vault_memberships')
        .select('role')
        .eq('vault_id', vaultId)
        .eq('user_id', user.id)
        .maybeSingle()

      const currentRole = membership?.role as VaultRole | undefined
      if (currentRole !== 'vault_owner' && currentRole !== 'vault_admin') {
        throw new Error('Only hub owners and admins can generate invite links')
      }

      // Check if vault already has a valid invite token
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingVault, error: fetchError } = await (supabase as any)
        .from('vaults')
        .select('invite_token, invite_expires_at')
        .eq('id', vaultId)
        .single()

      if (fetchError) throw fetchError

      // If there's an existing valid token, return it
      if (!options?.force && existingVault?.invite_token && existingVault?.invite_expires_at) {
        const expiresAt = new Date(existingVault.invite_expires_at)
        if (expiresAt > new Date()) {
          const inviteUrl = `${window.location.origin}/join/vault/${existingVault.invite_token}`
          return {
            invite_token: existingVault.invite_token,
            invite_url: inviteUrl,
            invite_expires_at: existingVault.invite_expires_at,
          }
        }
      }

      // Generate new token and store on vaults table
      const inviteToken = generateInviteToken()
      const inviteExpiresAt = getInviteExpiration()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('vaults')
        .update({
          invite_token: inviteToken,
          invite_expires_at: inviteExpiresAt,
        })
        .eq('id', vaultId)

      if (updateError) throw updateError

      const inviteUrl = `${window.location.origin}/join/vault/${inviteToken}`
      return { invite_token: inviteToken, invite_url: inviteUrl, invite_expires_at: inviteExpiresAt }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate invite link')
    },
  })
}

/**
 * useChangeRole - Change a member's role in the vault
 *
 * Permission rules:
 * - Changer must be vault_owner or vault_admin
 * - Cannot change vault_owner's role (only owner can transfer ownership)
 * - New role cannot exceed changer's role (admin can't promote to owner)
 */
export function useChangeRole(vaultId: string) {
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
      newRole: VaultRole
      currentUserRole: VaultRole
      targetRole: VaultRole
      isLastAdmin: boolean
    }) => {
      // Permission check: must be owner or admin
      if (currentUserRole !== 'vault_owner' && currentUserRole !== 'vault_admin') {
        throw new Error('Only hub owners and admins can change roles')
      }

      // Cannot change vault_owner role via this action
      if (targetRole === 'vault_owner') {
        throw new Error('Cannot change the hub owner role')
      }

      if (targetRole === 'vault_admin' && isLastAdmin && newRole !== 'vault_admin') {
        throw new Error('Cannot demote the last admin')
      }

      // Cannot promote beyond own role
      if (ROLE_POWER[newRole] < ROLE_POWER[currentUserRole]) {
        throw new Error('Cannot assign a role higher than your own')
      }

      // Update the membership
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('vault_memberships')
        .update({ role: newRole })
        .eq('id', membershipId)

      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      toast.success(`Role changed to ${ROLE_LABELS[variables.newRole]}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.members(vaultId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to change role')
    },
  })
}

/**
 * useRemoveMember - Remove a member from the vault
 *
 * Permission rules:
 * - Remover must be vault_owner or vault_admin
 * - Cannot remove vault_owner
 * - Recordings stay in vault (NOT removed)
 */
export function useRemoveMember(vaultId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      membershipId,
      targetRole,
      currentUserRole,
    }: {
      membershipId: string
      targetRole: VaultRole
      currentUserRole: VaultRole
    }) => {
      if (currentUserRole !== 'vault_owner' && currentUserRole !== 'vault_admin') {
        throw new Error('Only hub owners and admins can remove members')
      }

      // Cannot remove vault_owner
      if (targetRole === 'vault_owner') {
        throw new Error('Cannot remove the hub owner')
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('vault_memberships')
        .delete()
        .eq('id', membershipId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.members(vaultId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.detail(vaultId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member')
    },
  })
}

/**
 * useLeaveVault - Current user removes themselves from vault
 *
 * Rules:
 * - Cannot leave if you're vault_owner (must transfer first)
 * - Navigates to /vaults after leaving
 */
export function useLeaveVault(vaultId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ membershipId, userRole }: { membershipId: string; userRole: VaultRole }) => {
      if (userRole === 'vault_owner') {
        throw new Error('Hub owners cannot leave. Transfer ownership first.')
      }

      if (!user) throw new Error('Not authenticated')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('vault_memberships')
        .delete()
        .eq('id', membershipId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('You left the hub')
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.all })
      navigate('/vaults')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to leave hub')
    },
  })
}
