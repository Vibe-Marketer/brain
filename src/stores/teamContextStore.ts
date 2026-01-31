import { create } from 'zustand';

/**
 * @deprecated Use bankContextStore instead. This store is retained for
 * backward compatibility during Phase 9 migration.
 * 
 * Migration guide:
 * - import { useBankContextStore } from '@/stores/bankContextStore'
 * - activeTeamId → activeBankId (for bank context)
 * - null activeTeamId → personal bank (auto-selected)
 * - Team vaults → use activeVaultId for vault context
 * 
 * TODO: Remove after Phase 9 verification
 */

export const TEAM_CONTEXT_UPDATED_KEY = 'team-context-updated';

interface TeamContextState {
  // State
  activeTeamId: string | null; // null = personal workspace
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  setActiveTeamId: (teamId: string | null) => void;
  initialize: (teamId: string | null) => void;
  setError: (error: string | null) => void;
}

/**
 * Team Context Store
 * Manages which team (or personal workspace) is currently active.
 * - null activeTeamId = Personal workspace (user's own data)
 * - string activeTeamId = Team workspace (team-shared data)
 * 
 * Database persistence handled by useActiveTeam hook.
 */
export const useTeamContextStore = create<TeamContextState>((set) => ({
  // Initial state
  activeTeamId: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Set active team (triggers cross-tab sync via storage event)
  setActiveTeamId: (teamId) => {
    set({ activeTeamId: teamId, error: null });
    // Signal cross-tab sync
    if (typeof window !== 'undefined') {
      localStorage.setItem(TEAM_CONTEXT_UPDATED_KEY, Date.now().toString());
    }
  },

  // Initialize from database (called by useActiveTeam hook)
  initialize: (teamId) => {
    set({ 
      activeTeamId: teamId, 
      isLoading: false, 
      isInitialized: true,
      error: null 
    });
  },

  setError: (error) => {
    set({ error, isLoading: false });
  },
}));

/**
 * Cross-tab synchronization using storage events
 *
 * When one tab updates team context, it sets TEAM_CONTEXT_UPDATED_KEY in localStorage.
 * The 'storage' event fires in all OTHER tabs (not the tab that made the change).
 * This listener signals that the store should reload from database.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === TEAM_CONTEXT_UPDATED_KEY) {
      // Another tab changed team context - will be synced via useActiveTeam
      // The hook will reload from database on next render
    }
  });
}
