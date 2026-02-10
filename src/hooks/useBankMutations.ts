/**
 * useBankMutations - Mutation hooks for bank operations
 *
 * Provides useCreateBusinessBank hook for creating business banks
 * with auto-created default vault, membership, and bank context switch.
 *
 * @pattern tanstack-query-mutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useBankContext } from '@/hooks/useBankContext'
import { queryKeys } from '@/lib/query-config'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Create Business Bank ───────────────────────────────────────────

export interface CreateBusinessBankInput {
  name: string
  crossBankDefault?: 'copy_only' | 'copy_and_remove'
  logoUrl?: string
  defaultVaultName?: string
}

/**
 * useCreateBusinessBank - Creates a business bank with owner membership and default vault
 *
 * Flow:
 * 1. Create bank record (type='business')
 * 2. Create bank_membership for creator as 'bank_owner'
 * 3. Create default vault in the bank
 * 4. Create vault_membership for creator as 'vault_owner' on default vault
 * 5. Invalidate queries, auto-switch to new bank, navigate to /vaults
 */
export function useCreateBusinessBank() {
  const { user } = useAuth()
  const { switchBank } = useBankContext()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: CreateBusinessBankInput) => {
      if (!user) throw new Error('Not authenticated')

      const bankName = input.name.trim()
      if (bankName.length < 3 || bankName.length > 50) {
        throw new Error('Organization name must be between 3 and 50 characters')
      }

      const { data: createResult, error: createError } = await db
        .rpc('create_business_bank', {
          p_name: bankName,
          p_cross_bank_default: input.crossBankDefault || 'copy_only',
          p_logo_url: input.logoUrl || null,
          p_default_vault_name: input.defaultVaultName || null,
        })
        .single()

      if (createError) throw createError
      if (!createResult?.bank_id) {
        throw new Error('Business bank creation did not return a bank id')
      }

      const { data: bank, error: bankError } = await db
        .from('banks')
        .select('*')
        .eq('id', createResult.bank_id)
        .single()

      if (bankError) throw bankError

      return { bank, vault: { id: createResult.vault_id } }
    },
    onSuccess: (data, variables) => {
      // Invalidate bank context queries to pick up new bank
      queryClient.invalidateQueries({ queryKey: ['bankContext'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.vaults.list() })

      // Auto-switch to the new bank
      switchBank(data.bank.id)

      // Navigate to /vaults so user sees the new bank's default vault
      navigate('/vaults')

      toast.success(`Business bank "${variables.name}" created`, {
        description: "You're now viewing it",
      })
    },
    onError: (error: Error) => {
      toast.error(`Failed to create business bank: ${error.message}`)
    },
  })
}
