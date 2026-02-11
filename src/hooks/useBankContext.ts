import { useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useBankContextStore, BANK_CONTEXT_UPDATED_KEY } from '@/stores/bankContextStore'
import type { Bank, BankWithMembership, Vault, VaultWithMembership, BankRole, VaultRole } from '@/types/bank'

const QUERY_KEY = 'bankContext'
// Type-safe supabase client wrapper for tables not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

/**
 * useBankContext hook
 *
 * Provides bank/vault context for the current user:
 * - Fetches user's banks with memberships
 * - Fetches vaults for the active bank
 * - Auto-selects personal bank on initialization
 * - Supports cross-tab sync via localStorage
 *
 * @pattern Follows useActiveTeam/useTeamContext for consistency
 */
export function useBankContext() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const {
    activeBankId,
    activeVaultId,
    isLoading: storeLoading,
    isInitialized,
    error,
    setActiveBank,
    setActiveVault,
    initialize,
    setLoading,
    setError,
    reset,
  } = useBankContextStore()

  // Fetch user's banks with memberships
  const { data: banks, isLoading: banksLoading } = useQuery({
    queryKey: [QUERY_KEY, 'banks', user?.id],
    queryFn: async (): Promise<BankWithMembership[]> => {
      if (!user) return []

      // Query bank_memberships joined with banks
      // Note: This relies on the banks and bank_memberships tables created in 09-02
      const { data: memberships, error } = await db
        .from('bank_memberships')
        .select(`
          id,
          role,
          created_at,
          bank:banks (
            id,
            name,
            type,
            cross_bank_default,
            logo_url,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Transform to BankWithMembership format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const baseBanks = (memberships || []).map((m: any) => ({
        ...m.bank,
        membership: {
          id: m.id,
          bank_id: m.bank.id,
          user_id: user.id,
          role: m.role as BankRole,
          created_at: m.created_at,
        },
      })) as BankWithMembership[]

      if (baseBanks.length === 0) return []

      const banksWithCounts = await Promise.all(
        baseBanks.map(async (bank) => {
          try {
            const { count } = await db
              .from('bank_memberships')
              .select('*', { count: 'exact', head: true })
              .eq('bank_id', bank.id)

            return {
              ...bank,
              member_count: count ?? 1,
            }
          } catch (error) {
            console.error('[useBankContext] Failed to load bank member count:', error)
            return {
              ...bank,
              member_count: 1,
            }
          }
        })
      )

      return banksWithCounts
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch vaults for active bank
  const { data: vaults, isLoading: vaultsLoading } = useQuery({
    queryKey: [QUERY_KEY, 'vaults', activeBankId, user?.id],
    queryFn: async (): Promise<VaultWithMembership[]> => {
      if (!user || !activeBankId) return []

      // Query vault_memberships joined with vaults
      // Note: This relies on the vaults and vault_memberships tables created in 09-03
      const { data: memberships, error } = await db
        .from('vault_memberships')
        .select(`
          id,
          role,
          created_at,
          vault:vaults (
            id,
            bank_id,
            name,
            vault_type,
            default_sharelink_ttl_days,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Filter to only vaults in the active bank and transform
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (memberships || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((m: any) => m.vault && m.vault.bank_id === activeBankId)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => ({
          ...m.vault,
          membership: {
            id: m.id,
            vault_id: m.vault.id,
            user_id: user.id,
            role: m.role as VaultRole,
            created_at: m.created_at,
          },
        })) as VaultWithMembership[]
    },
    enabled: !!user && !!activeBankId,
    staleTime: 5 * 60 * 1000,
  })

  // Track whether we're currently creating a bank to prevent duplicate calls
  const isCreatingBankRef = useRef(false)

  // Initialize on first load
  useEffect(() => {
    if (!user || banksLoading || isInitialized) return

    if (banks && banks.length > 0) {
      // Find personal bank or use first bank
      const personalBank = banks.find((b) => b.type === 'personal')
      const defaultBank = personalBank || banks[0]

      initialize(defaultBank.id, null)
    } else if (banks && !isCreatingBankRef.current) {
      // User has no banks - auto-create personal bank via RPC
      // This handles legacy users who signed up before the bank/vault system
      isCreatingBankRef.current = true
      setLoading(true)

      supabase
        .rpc('ensure_personal_bank', { p_user_id: user.id })
        .then(({ error: rpcError }) => {
          if (rpcError) {
            console.error('[useBankContext] Failed to create personal bank:', rpcError)
            setError('Failed to initialize bank')
          } else {
            // Invalidate banks query to re-fetch with the newly created bank
            queryClient.invalidateQueries({ queryKey: [QUERY_KEY, 'banks', user.id] })
          }
          isCreatingBankRef.current = false
        })
    }
  }, [user, banks, banksLoading, isInitialized, initialize, setError, setLoading, queryClient])

  // Cross-tab sync via storage event
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === BANK_CONTEXT_UPDATED_KEY) {
        // Another tab changed bank context - invalidate queries
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY] })
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [queryClient])

  // Get active bank object
  const activeBank = banks?.find((b) => b.id === activeBankId) || null

  // Get active vault object
  const activeVault = vaults?.find((v) => v.id === activeVaultId) || null

  // Get personal vault in active bank (the default vault for the user)
  const personalVault = vaults?.find((v) => v.vault_type === 'personal') || null

  // Actions
  const switchBank = useCallback(
    (bankId: string) => {
      setActiveBank(bankId)
    },
    [setActiveBank]
  )

  const switchVault = useCallback(
    (vaultId: string | null) => {
      setActiveVault(vaultId)
    },
    [setActiveVault]
  )

  return {
    // State
    activeBankId,
    activeVaultId,
    activeBank,
    activeVault,
    personalVault,
    banks: banks || [],
    vaults: vaults || [],

    // Loading
    isLoading: storeLoading || banksLoading || vaultsLoading,
    isInitialized,
    error,

    // Actions
    switchBank,
    switchVault,
    reset,

    // Helpers
    isPersonalBank: activeBank?.type === 'personal',
    isBusinessBank: activeBank?.type === 'business',
    bankRole: activeBank?.membership.role || null,
    vaultRole: activeVault?.membership.role || null,
  }
}
