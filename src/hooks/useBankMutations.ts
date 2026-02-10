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

      // 1. Create the business bank
      const { data: bank, error: bankError } = await db
        .from('banks')
        .insert({
          name: bankName,
          type: 'business',
          cross_bank_default: input.crossBankDefault || 'copy_only',
          logo_url: input.logoUrl || null,
        })
        .select()
        .single()

      if (bankError) throw bankError

      // 2. Create bank_membership for creator as bank_owner
      const { error: membershipError } = await db
        .from('bank_memberships')
        .insert({
          bank_id: bank.id,
          user_id: user.id,
          role: 'bank_owner',
        })

      if (membershipError) throw membershipError

      // 3. Create default vault in the bank
      const vaultName = input.defaultVaultName?.trim() || `${bankName}'s Vault`
      const { data: vault, error: vaultError } = await db
        .from('vaults')
        .insert({
          bank_id: bank.id,
          name: vaultName,
          vault_type: 'team',
        })
        .select()
        .single()

      if (vaultError) throw vaultError

      // 4. Create vault_membership for creator as vault_owner
      const { error: vaultMembershipError } = await db
        .from('vault_memberships')
        .insert({
          vault_id: vault.id,
          user_id: user.id,
          role: 'vault_owner',
        })

      if (vaultMembershipError) throw vaultMembershipError

      return { bank, vault }
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
