import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { queryKeys } from '@/lib/query-config'
import { useBankContext } from '@/hooks/useBankContext'
import { toast } from 'sonner'
import type { VaultEntry } from '@/types/bank'

/**
 * useVaultAssignment - Manage recording <-> vault assignments
 *
 * Provides queries and mutations for adding/removing recordings from vaults.
 * Uses Tanstack Query with optimistic updates for snappy UX.
 *
 * Supports two modes:
 * - UUID recording ID (from recordings table) - used directly
 * - Numeric legacy recording ID (from fathom_calls) - resolved to UUID first
 *
 * @param recordingId - UUID recording ID, or null to disable
 * @param legacyRecordingId - Numeric fathom_calls recording_id, used to resolve UUID if recordingId not provided
 */
export function useVaultAssignment(
  recordingId: string | null,
  legacyRecordingId?: number | null,
) {
  const queryClient = useQueryClient()
  const { vaults, personalVault, activeBankId } = useBankContext()

  // Resolve UUID from legacy recording ID if needed
  const { data: resolvedRecordingId } = useQuery({
    queryKey: ['recording-uuid-lookup', legacyRecordingId, activeBankId],
    queryFn: async (): Promise<string | null> => {
      if (!legacyRecordingId || !activeBankId) return null

      const { data, error } = await supabase
        .from('recordings')
        .select('id')
        .eq('legacy_recording_id', legacyRecordingId)
        .eq('bank_id', activeBankId)
        .maybeSingle()

      if (error) throw error
      return data?.id || null
    },
    enabled: !recordingId && !!legacyRecordingId && !!activeBankId,
    staleTime: 10 * 60 * 1000, // 10 minutes - UUIDs don't change
  })

  // Use provided recordingId or resolved one
  const effectiveRecordingId = recordingId || resolvedRecordingId || null

  // Query: Get which vaults this recording is in
  const {
    data: recordingVaultEntries = [],
    isLoading: entriesLoading,
  } = useQuery({
    queryKey: queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
    queryFn: async (): Promise<VaultEntry[]> => {
      if (!effectiveRecordingId) return []

      const { data, error } = await supabase
        .from('vault_entries')
        .select('*')
        .eq('recording_id', effectiveRecordingId)

      if (error) throw error
      return (data || []) as VaultEntry[]
    },
    enabled: !!effectiveRecordingId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const isLoading = entriesLoading || (!recordingId && !!legacyRecordingId && !resolvedRecordingId)

  // Derived: Set of vault IDs this recording is in
  const assignedVaultIds = new Set(recordingVaultEntries.map((ve) => ve.vault_id))

  // Mutation: Add recording to a vault
  const addToVault = useMutation({
    mutationFn: async ({ vaultId }: { vaultId: string }) => {
      if (!effectiveRecordingId) throw new Error('No recording ID')

      const { data, error } = await supabase
        .from('vault_entries')
        .insert({
          vault_id: vaultId,
          recording_id: effectiveRecordingId,
        })
        .select()
        .single()

      if (error) throw error
      return data as VaultEntry
    },
    onMutate: async ({ vaultId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
      })

      // Snapshot previous value
      const previous = queryClient.getQueryData<VaultEntry[]>(
        queryKeys.vaultEntries.byRecording(effectiveRecordingId || '')
      )

      // Optimistically add the entry
      queryClient.setQueryData<VaultEntry[]>(
        queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
        (old = []) => [
          ...old,
          {
            id: `temp-${vaultId}`,
            vault_id: vaultId,
            recording_id: effectiveRecordingId || '',
            folder_id: null,
            local_tags: [],
            scores: null,
            notes: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      toast.error('Failed to add recording to vault')
    },
    onSettled: (_data, _error, { vaultId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
      })
      // Also invalidate vault recordings so VaultDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.recordings(vaultId),
      })
    },
    onSuccess: (_data, { vaultId }) => {
      const vault = vaults.find((v) => v.id === vaultId)
      toast.success(`Added to ${vault?.name || 'vault'}`)
    },
  })

  // Mutation: Remove recording from a vault
  const removeFromVault = useMutation({
    mutationFn: async ({ vaultId }: { vaultId: string }) => {
      if (!effectiveRecordingId) throw new Error('No recording ID')

      const { error } = await supabase
        .from('vault_entries')
        .delete()
        .eq('vault_id', vaultId)
        .eq('recording_id', effectiveRecordingId)

      if (error) throw error
    },
    onMutate: async ({ vaultId }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
      })

      const previous = queryClient.getQueryData<VaultEntry[]>(
        queryKeys.vaultEntries.byRecording(effectiveRecordingId || '')
      )

      // Optimistically remove the entry
      queryClient.setQueryData<VaultEntry[]>(
        queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
        (old = []) => old.filter((ve) => ve.vault_id !== vaultId)
      )

      return { previous }
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
          context.previous
        )
      }
      toast.error('Failed to remove recording from vault')
    },
    onSettled: (_data, _error, { vaultId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaultEntries.byRecording(effectiveRecordingId || ''),
      })
      // Also invalidate vault recordings so VaultDetailPane refreshes
      queryClient.invalidateQueries({
        queryKey: queryKeys.vaults.recordings(vaultId),
      })
    },
    onSuccess: (_data, { vaultId }) => {
      const vault = vaults.find((v) => v.id === vaultId)
      toast.success(`Removed from ${vault?.name || 'vault'}`)
    },
  })

  // Toggle: Add or remove based on current state
  const toggleVault = (vaultId: string) => {
    // Don't allow removing from personal vault
    if (personalVault && vaultId === personalVault.id) {
      toast.error('Recordings cannot be removed from your personal vault')
      return
    }

    if (assignedVaultIds.has(vaultId)) {
      removeFromVault.mutate({ vaultId })
    } else {
      addToVault.mutate({ vaultId })
    }
  }

  return {
    // Data
    recordingVaultEntries,
    assignedVaultIds,
    effectiveRecordingId,
    isLoading,

    // Mutations
    addToVault: addToVault.mutate,
    removeFromVault: removeFromVault.mutate,
    toggleVault,

    // Mutation states
    isAdding: addToVault.isPending,
    isRemoving: removeFromVault.isPending,
  }
}
