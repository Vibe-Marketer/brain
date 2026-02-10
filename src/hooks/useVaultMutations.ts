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
  defaultShareLinkTtlDays?: number
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
          ...(input.defaultShareLinkTtlDays !== undefined && {
            default_sharelink_ttl_days: input.defaultShareLinkTtlDays,
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
          const { error: folderError } = await supabase.from('folders').insert({
            vault_id: vault.id,
            user_id: user.id,
            name: folder.name,
            visibility: folder.visibility,
          })

          if (folderError) throw folderError
        }
      }

      return {
        ...vault,
        member_count: 1,
        user_role: 'vault_owner',
      } as VaultWithMeta
    },
    onMutate: async (input) => {
      if (!user) return

      const listKey = [...queryKeys.vaults.list(), input.bankId, user.id]

      await queryClient.cancelQueries({ queryKey: queryKeys.vaults.list() })

      const previousList = queryClient.getQueryData<VaultWithMeta[]>(listKey)
      const now = new Date().toISOString()
      const tempId = `temp-${Date.now()}`

      const optimisticVault: VaultWithMeta = {
        id: tempId,
        bank_id: input.bankId,
        name: input.name.trim(),
        vault_type: input.vaultType,
        default_sharelink_ttl_days: input.defaultShareLinkTtlDays ?? 7,
        created_at: now,
        updated_at: now,
        member_count: 1,
        user_role: 'vault_owner',
      }

      queryClient.setQueryData<VaultWithMeta[]>(listKey, (old = []) => [
        optimisticVault,
        ...old,
      ])

      return { previousList, listKey, tempId }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousList && context.listKey) {
        queryClient.setQueryData(context.listKey, context.previousList)
      }
      toast.error(`Failed to create vault: ${error.message}`)
    },
    onSuccess: (vault, variables, context) => {
      if (context?.listKey && context.tempId) {
        queryClient.setQueryData<VaultWithMeta[]>(context.listKey, (old = []) =>
          old.map((item) =>
            item.id === context.tempId
              ? {
                  ...vault,
                  member_count: 1,
                  user_role: 'vault_owner',
                }
              : item
          )
        )
      }
      toast.success(`Vault '${variables.name.trim()}' created`)
    },
    onSettled: () => {
      // Invalidate vault queries for this bank
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
    },
  })
}

// ─── Update Vault ───────────────────────────────────────────────────

export interface UpdateVaultInput {
  vaultId: string
  name?: string
  defaultShareLinkTtlDays?: number
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
      if (input.defaultShareLinkTtlDays !== undefined) {
        updates.default_sharelink_ttl_days = input.defaultShareLinkTtlDays
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

      // Snapshot previous values for rollback
      const previousDetail = queryClient.getQueryData(
        queryKeys.vaults.detail(input.vaultId)
      )
      const previousLists = queryClient.getQueriesData<VaultWithMeta[]>({
        queryKey: queryKeys.vaults.list(),
      })

      const nextName = input.name?.trim()
      const nextTtl = input.defaultShareLinkTtlDays

      // Optimistically update the detail cache
      queryClient.setQueryData(
        queryKeys.vaults.detail(input.vaultId),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (old: any) => {
          if (!old) return old
          return {
            ...old,
            ...(nextName !== undefined ? { name: nextName } : {}),
            ...(nextTtl !== undefined ? { default_sharelink_ttl_days: nextTtl } : {}),
          }
        }
      )

      // Optimistically update all list caches
      queryClient.setQueriesData<VaultWithMeta[]>(
        { queryKey: queryKeys.vaults.list() },
        (old) => {
          if (!old) return old
          return old.map((vault) =>
            vault.id === input.vaultId
              ? {
                  ...vault,
                  ...(nextName !== undefined ? { name: nextName } : {}),
                  ...(nextTtl !== undefined ? { default_sharelink_ttl_days: nextTtl } : {}),
                }
              : vault
          )
        }
      )

      return { previousDetail, previousLists }
    },
    onError: (_err, input, context) => {
      // Rollback optimistic update
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.vaults.detail(input.vaultId),
          context.previousDetail
        )
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
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
      toast.success('Vault updated')
    },
  })
}

// ─── Delete Vault ───────────────────────────────────────────────────

export interface DeleteVaultInput {
  vaultId: string
  transferRecordingsToVaultId?: string
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
      if (
        input.transferRecordingsToVaultId &&
        input.transferRecordingsToVaultId !== input.vaultId
      ) {
        const { error: transferError } = await db
          .from('vault_entries')
          .update({ vault_id: input.transferRecordingsToVaultId })
          .eq('vault_id', input.vaultId)

        if (transferError) throw transferError
      }

      const { error } = await db
        .from('vaults')
        .delete()
        .eq('id', input.vaultId)

      if (error) throw error
      return { vaultId: input.vaultId }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.vaults.list() })
      await queryClient.cancelQueries({
        queryKey: queryKeys.vaults.detail(input.vaultId),
      })

      const previousDetail = queryClient.getQueryData(
        queryKeys.vaults.detail(input.vaultId)
      )
      const previousLists = queryClient.getQueriesData<VaultWithMeta[]>({
        queryKey: queryKeys.vaults.list(),
      })

      queryClient.setQueriesData<VaultWithMeta[]>(
        { queryKey: queryKeys.vaults.list() },
        (old) => old?.filter((vault) => vault.id !== input.vaultId) || old
      )
      queryClient.setQueryData(queryKeys.vaults.detail(input.vaultId), null)

      return { previousDetail, previousLists }
    },
    onSuccess: (_data, variables) => {
      // Invalidate all vault-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaultEntries.all })
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
      toast.success('Vault deleted')
    },
    onError: (error: Error, input, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(
          queryKeys.vaults.detail(input.vaultId),
          context.previousDetail
        )
      }
      if (context?.previousLists) {
        for (const [key, data] of context.previousLists) {
          queryClient.setQueryData(key, data)
        }
      }
      toast.error(`Failed to delete vault: ${error.message}`)
    },
  })
}
