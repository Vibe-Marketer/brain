import { create } from 'zustand'

/**
 * Key for cross-tab synchronization via localStorage
 * When organization context changes, we write to this key to trigger storage events in other tabs
 */
export const ORGANIZATION_CONTEXT_UPDATED_KEY = 'organization-context-updated'
export const BANK_CONTEXT_UPDATED_KEY = ORGANIZATION_CONTEXT_UPDATED_KEY // Legacy

interface OrganizationContextState {
  // State
  activeOrganizationId: string | null
  activeWorkspaceId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  setActiveOrganization: (orgId: string) => void
  setActiveWorkspace: (workspaceId: string | null) => void
  initialize: (orgId: string, workspaceId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void

  // Legacy aliases
  activeOrganizationId: string | null
  activeVaultId: string | null
  setActiveOrganization: (bankId: string) => void
  setActiveVault: (vaultId: string | null) => void
}

/**
 * Organization Context Store
 *
 * Manages which organization and workspace are currently active.
 * - activeOrganizationId = which organization the user is viewing (personal or business)
 * - activeWorkspaceId = which workspace within that organization (null = viewing all workspaces)
 *
 * Database persistence and cross-tab sync handled by useOrganizationContext hook.
 */
export const useOrganizationContextStore = create<OrganizationContextState>((set, get) => ({
  // Initial state
  activeOrganizationId: null,
  activeWorkspaceId: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Legacy initial state
  activeOrganizationId: null,
  activeVaultId: null,

  // Set active organization (clears workspace selection, triggers cross-tab sync)
  setActiveOrganization: (orgId) => {
    set({
      activeOrganizationId: orgId,
      activeWorkspaceId: null,
      activeOrganizationId: orgId,
      activeVaultId: null,
      error: null
    })
    // Trigger cross-tab sync
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORGANIZATION_CONTEXT_UPDATED_KEY, Date.now().toString())
    }
  },

  setActiveOrganization: (bankId) => get().setActiveOrganization(bankId),

  // Set active workspace within current organization (triggers cross-tab sync)
  setActiveWorkspace: (workspaceId) => {
    set({
      activeWorkspaceId: workspaceId,
      activeVaultId: workspaceId,
      error: null
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem(ORGANIZATION_CONTEXT_UPDATED_KEY, Date.now().toString())
    }
  },

  setActiveVault: (vaultId) => get().setActiveWorkspace(vaultId),

  // Initialize from database (called by useOrganizationContext hook on mount)
  initialize: (orgId, workspaceId) => {
    set({
      activeOrganizationId: orgId,
      activeWorkspaceId: workspaceId,
      activeOrganizationId: orgId,
      activeVaultId: workspaceId,
      isLoading: false,
      isInitialized: true,
      error: null,
    })
  },

  // Loading state control
  setLoading: (loading) => set({ isLoading: loading }),

  // Error handling
  setError: (error) => set({ error, isLoading: false }),

  // Reset for logout
  reset: () =>
    set({
      activeOrganizationId: null,
      activeWorkspaceId: null,
      activeOrganizationId: null,
      activeVaultId: null,
      isLoading: true,
      isInitialized: false,
      error: null,
    }),
}))

// Legacy export for backward compatibility
export const useOrganizationContextStore = useOrganizationContextStore
