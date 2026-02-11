import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Key for cross-tab synchronization via localStorage
 * When bank context changes, we write to this key to trigger storage events in other tabs
 */
export const BANK_CONTEXT_UPDATED_KEY = 'bank-context-updated'

/**
 * localStorage key for persisted bank/vault selection
 */
const PERSISTENCE_KEY = 'callvault-bank-context'

interface BankContextState {
  // State
  activeBankId: string | null
  activeVaultId: string | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  // Actions
  setActiveBank: (bankId: string) => void
  setActiveVault: (vaultId: string | null) => void
  initialize: (bankId: string, vaultId: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

/**
 * Bank Context Store
 *
 * Manages which bank and vault are currently active.
 * - activeBankId = which bank the user is viewing (personal or business)
 * - activeVaultId = which vault within that bank (null = viewing all vaults in bank)
 *
 * Persists activeBankId and activeVaultId to localStorage so the selection
 * survives page refreshes. Cross-tab sync handled via storage events.
 *
 * @pattern Follows teamContextStore for consistency
 */
export const useBankContextStore = create<BankContextState>()(
  persist(
    (set) => ({
      // Initial state
      activeBankId: null,
      activeVaultId: null,
      isLoading: true,
      isInitialized: false,
      error: null,

      // Set active bank (clears vault selection, triggers cross-tab sync)
      setActiveBank: (bankId) => {
        set({ activeBankId: bankId, activeVaultId: null, error: null })
        // Trigger cross-tab sync
        if (typeof window !== 'undefined') {
          localStorage.setItem(BANK_CONTEXT_UPDATED_KEY, Date.now().toString())
        }
      },

      // Set active vault within current bank (triggers cross-tab sync)
      setActiveVault: (vaultId) => {
        set({ activeVaultId: vaultId, error: null })
        if (typeof window !== 'undefined') {
          localStorage.setItem(BANK_CONTEXT_UPDATED_KEY, Date.now().toString())
        }
      },

      // Initialize from database (called by useBankContext hook on mount)
      initialize: (bankId, vaultId) => {
        set({
          activeBankId: bankId,
          activeVaultId: vaultId,
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
          activeBankId: null,
          activeVaultId: null,
          isLoading: true,
          isInitialized: false,
          error: null,
        }),
    }),
    {
      name: PERSISTENCE_KEY,
      // Only persist the bank/vault selection, not loading/error state
      partialize: (state) => ({
        activeBankId: state.activeBankId,
        activeVaultId: state.activeVaultId,
      }),
    }
  )
)
