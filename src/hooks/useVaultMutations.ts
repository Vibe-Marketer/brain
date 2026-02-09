/**
 * useVaultMutations - Mutation hooks for vault CRUD operations
 *
 * Provides useCreateVault, useUpdateVault, and useDeleteVault hooks
 * with optimistic updates, toast notifications, and query invalidation.
 *
 * @pattern tanstack-query-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import { toast } from 'sonner'
import type { VaultType } from '@/types/bank'
import type { VaultWithMeta } from '@/hooks/useVaults'

// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Create Vault ───────────────────────────────────────────────────

export interface CreateVaultInput {
  bankId: string
  name: string
  vaultType: VaultType
  defaultSharelinkTtlDays?: number
}

/**
 * useCreateVault - Creates a new vault with owner membership and default folders
 *
 * Follows the VaultManagement.tsx pattern: creates vault, adds creator as vault_owner,
 * and creates default folders for team vaults.
 */
export function useCreateVault() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateVaultInput) => {
      if (!user) throw new Error('Not authenticated')

      // Create vault
      const { data: vault, error: vaultError } = await db
        .from('vaults')
        .insert({
          bank_id: input.bankId,
          name: input.name.trim(),
          vault_type: input.vaultType,
          ...(input.defaultSharelinkTtlDays !== undefined && {
            default_sharelink_ttl_days: input.defaultSharelinkTtlDays,
          }),
        })
        .select()
        .single()

      if (vaultError) throw vaultError

      // Create vault membership for creator as owner
      const { error: membershipError } = await db
        .from('vault_memberships')
        .insert({
          vault_id: vault.id,
          user_id: user.id,
          role: 'vault_owner',
        })

      if (membershipError) throw membershipError

      // Create default folders for team vaults (per CONTEXT.md)
      if (input.vaultType === 'team') {
        const defaultFolders = [
          { name: 'Hall of Fame', visibility: 'all_members' },
          { name: 'Manager Reviews', visibility: 'managers_only' },
        ]

        for (const folder of defaultFolders) {
          await supabase.from('folders').insert({
            vault_id: vault.id,
            user_id: user.id,
            name: folder.name,
            visibility: folder.visibility,
          })
        }
      }

      return vault
    },
    onSuccess: (_data, variables) => {
      // Invalidate vault queries for this bank
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
      toast.success('Vault created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create vault: ${error.message}`)
    },
  })
}

// ─── Update Vault ───────────────────────────────────────────────────

export interface UpdateVaultInput {
  vaultId: string
  name?: string
  defaultSharelinkTtlDays?: number
}

/**
 * useUpdateVault - Updates vault name and/or settings
 *
 * Optimistically updates the vault name in the list, rolling back on error.
 */
export function useUpdateVault() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateVaultInput) => {
      const updates: Record<string, unknown> = {}
      if (input.name !== undefined) updates.name = input.name.trim()
      if (input.defaultSharelinkTtlDays !== undefined) {
        updates.default_sharelink_ttl_days = input.defaultSharelinkTtlDays
      }

      const { data, error } = await db
        .from('vaults')
        .update(updates)
        .eq('id', input.vaultId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.vaults.list() })
      await queryClient.cancelQueries({
        queryKey: queryKeys.vaults.detail(input.vaultId),
      })

      // Snapshot previous value for rollback
      const previousDetail = queryClient.getQueryData(
        queryKeys.vaults.detail(input.vaultId)
      )

      // Optimistically update the detail cache
      if (input.name !== undefined) {
        queryClient.setQueryData(
          queryKeys.vaults.detail(input.vaultId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (old: any) => (old ? { ...old, name: input.name!.trim() } : old)
        )
      }

      return { previousDetail }
    },
    onError: (_err, input, context) => {
      // Rollback optimistic update
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.vaults.detail(input.vaultId),
          context.previousDetail
        )
      }
      toast.error('Failed to update vault')
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.detail(input.vaultId),
      })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
    },
    onSuccess: () => {
      toast.success('Vault updated successfully')
    },
  })
}

// ─── Delete Vault ───────────────────────────────────────────────────

export interface DeleteVaultInput {
  vaultId: string
  vaultName: string
}

/**
 * useDeleteVault - Deletes a vault and its memberships/entries
 *
 * The database cascades deletions via foreign keys.
 * Invalidates all relevant queries after deletion.
 */
export function useDeleteVault() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: DeleteVaultInput) => {
      const { error } = await db
        .from('vaults')
        .delete()
        .eq('id', input.vaultId)

      if (error) throw error
      return { vaultId: input.vaultId }
    },
    onSuccess: (_data, variables) => {
      // Invalidate all vault-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.all })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
      toast.success(`Vault "${variables.vaultName}" deleted`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete vault: ${error.message}`)
    },
  })
}
