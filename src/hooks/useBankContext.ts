import { useEffect, useCallback } from 'react'
import { useOrgContext } from '@/hooks/useOrgContext'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import type { BankWithMembership, VaultWithMembership, BankRole, VaultRole } from '@/types/bank'
import type { OrganizationWithRole } from '@/services/organizations.service'


/**
 * MIGRATION WRAPPER
 * This overrides V1's useBankContext and points it directly to the new
 * orgContextStore and useOrgContext from Phase 16 V2 architecture.
 *
 * This prevents breaking 100+ components while they are systematically
 * updated to use useOrgContext natively.
 */
export function useBankContext() {
  const {
    activeOrgId,
    activeWorkspaceId,
    organizations,
    isLoading: orgsLoading,
    isInitialized,
    switchOrg,
    switchWorkspace,
    reset,
    isPersonalOrg,
  } = useOrgContext()

  // Fetch workspaces for the active bank (org)
  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId)

  // Map Organizations to Banks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const banks: BankWithMembership[] = (organizations || []).map((org: any) => ({
    ...org,
    membership: {
      id: org.membershipId,
      bank_id: org.id,
      user_id: '',
      role: org.membershipRole as BankRole,
      created_at: org.created_at,
    },
    // The member count might be missing unless organizations fetches it, default to 1
    member_count: org.member_count || 1,
  }))

  // Map Workspaces to Vaults
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vaults: VaultWithMembership[] = (workspaces || []).map((ws: any) => ({
    ...ws,
    bank_id: ws.bank_id,
    vault_type: ws.vault_type,
    default_sharelink_ttl_days: ws.default_sharelink_ttl_days,
    membership: {
      id: ws.membershipId,
      vault_id: ws.id,
      user_id: '',
      role: ws.membershipRole as VaultRole,
      created_at: ws.created_at,
    },
  }))

  const activeBank = banks.find((b) => b.id === activeOrgId) || null
  const activeVault = vaults.find((v) => v.id === activeWorkspaceId) || null
  const personalVault = vaults.find((v) => v.vault_type === 'personal') || null

  const switchBank = useCallback((bankId: string) => switchOrg(bankId), [switchOrg])
  const switchVault = useCallback((vaultId: string | null) => switchWorkspace(vaultId || ''), [switchWorkspace])

  return {
    // State
    activeBankId: activeOrgId,
    activeVaultId: activeWorkspaceId,
    activeBank,
    activeVault,
    personalVault,
    banks,
    vaults,

    // Loading
    isLoading: orgsLoading || workspacesLoading,
    isInitialized,
    error: null,

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
