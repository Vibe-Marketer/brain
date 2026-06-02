import { create } from 'zustand'

/**
 * localStorage key for persisting and cross-tab syncing org context.
 * When one tab updates, others reload via the 'storage' event.
 */
export const ORG_CONTEXT_STORAGE_KEY = 'callvault-org-context'

/**
 * localStorage key used as a signal for cross-tab change events.
 * We write a timestamp here to trigger storage events in other tabs.
 */
export const ORG_CONTEXT_UPDATED_KEY = 'callvault-org-context-updated'

interface OrgContextState {
  activeOrgId: string | null
  activeWorkspaceId: string | null
  activeWorkspaceMode: 'auto' | 'workspace' | 'all'
  activeFolderId: string | null
  isSharedView: boolean
  isInitialized: boolean

  // Actions
  setActiveOrg: (orgId: string) => void
  setActiveWorkspace: (workspaceId: string | null) => void
  setActiveFolder: (folderId: string | null) => void
  setActiveWorkspaceAndFolder: (workspaceId: string, folderId: string | null) => void
  setSharedView: (isShared: boolean) => void
  initialize: (orgId: string, workspaceId?: string) => void
  reset: () => void
}

/**
 * Load persisted context from localStorage on startup.
 * Returns null values if nothing is stored.
 */
function loadPersistedContext(): {
  activeOrgId: string | null
  activeWorkspaceId: string | null
  activeWorkspaceMode: 'auto' | 'workspace' | 'all'
} {
  if (typeof window === 'undefined') {
    return { activeOrgId: null, activeWorkspaceId: null, activeWorkspaceMode: 'auto' }
  }
  try {
    const raw = localStorage.getItem(ORG_CONTEXT_STORAGE_KEY)
    if (!raw) return { activeOrgId: null, activeWorkspaceId: null, activeWorkspaceMode: 'auto' }
    const parsed = JSON.parse(raw)
    const activeWorkspaceId = parsed.activeWorkspaceId ?? null
    const persistedMode = parsed.activeWorkspaceMode
    const activeWorkspaceMode =
      persistedMode === 'all' || persistedMode === 'workspace' || persistedMode === 'auto'
        ? persistedMode
        : activeWorkspaceId
          ? 'workspace'
          : 'auto'
    return {
      activeOrgId: parsed.activeOrgId ?? null,
      activeWorkspaceId,
      activeWorkspaceMode,
    }
  } catch {
    return { activeOrgId: null, activeWorkspaceId: null, activeWorkspaceMode: 'auto' }
  }
}

/**
 * Persist org/workspace context to localStorage and trigger cross-tab sync signal.
 */
function persistContext(
  activeOrgId: string | null,
  activeWorkspaceId: string | null,
  activeWorkspaceMode: 'auto' | 'workspace' | 'all',
) {
  if (typeof window === 'undefined') return
  localStorage.setItem(
    ORG_CONTEXT_STORAGE_KEY,
    JSON.stringify({ activeOrgId, activeWorkspaceId, activeWorkspaceMode })
  )
  localStorage.setItem(ORG_CONTEXT_UPDATED_KEY, Date.now().toString())
}

const persisted = loadPersistedContext()

/**
 * Org Context Store — tracks which organization, workspace, and folder are active.
 *
 * Uses Zustand v5 double-invocation syntax: create<T>()(...)
 *
 * CRITICAL LOCKED DECISION:
 * setActiveOrg MUST reset activeWorkspaceId and activeFolderId to auto mode.
 * "Switching organizations resets the view to that org's workspace list.
 *  No position memory across orgs — clean slate each time."
 *
 * activeOrgId and activeWorkspaceId are persisted to localStorage for
 * cross-tab sync. activeFolderId is session-only (not persisted).
 */
export const useOrgContextStore = create<OrgContextState>()((set) => ({
  activeOrgId: persisted.activeOrgId,
  activeWorkspaceId: persisted.activeWorkspaceId,
  activeWorkspaceMode: persisted.activeWorkspaceMode,
  activeFolderId: null,
  isSharedView: false,
  isInitialized: false,

  /**
   * Switch to a different organization.
   * LOCKED: resets activeWorkspaceId and activeFolderId to auto mode (clean slate).
   */
  setActiveOrg: (orgId: string) => {
    set({
      activeOrgId: orgId,
      activeWorkspaceId: null,
      activeWorkspaceMode: 'auto',
      activeFolderId: null,
      isSharedView: false,
    })
    persistContext(orgId, null, 'auto')
  },

  /**
   * Switch to a different workspace within the current organization.
   * Resets activeFolderId to null (folder context is workspace-specific).
   * Also clears isSharedView since we're entering a real workspace.
   */
  setActiveWorkspace: (workspaceId: string | null) => {
    set((state) => {
      const activeWorkspaceMode = workspaceId ? 'workspace' : 'all'
      persistContext(state.activeOrgId, workspaceId, activeWorkspaceMode)
      return { activeWorkspaceId: workspaceId, activeWorkspaceMode, activeFolderId: null, isSharedView: false }
    })
  },

  /** Set or clear the active folder within the current workspace. */
  setActiveFolder: (folderId: string | null) => {
    set({ activeFolderId: folderId })
  },

  /**
   * Set workspace and folder atomically — used when clicking a folder in the sidebar.
   * Unlike calling setActiveWorkspace + setActiveFolder sequentially,
   * this does NOT clear activeFolderId (setActiveWorkspace resets it to null).
   */
  setActiveWorkspaceAndFolder: (workspaceId: string, folderId: string | null) => {
    set((state) => {
      persistContext(state.activeOrgId, workspaceId, 'workspace')
      return { activeWorkspaceId: workspaceId, activeWorkspaceMode: 'workspace', activeFolderId: folderId, isSharedView: false }
    })
  },

  /**
   * Enter or exit the "Shared With Me" virtual workspace view.
   * When entering, clears activeWorkspaceId and activeFolderId so
   * TranscriptsTab knows to query shared calls instead of workspace recordings.
   */
  setSharedView: (isShared: boolean) => {
    set((state) => {
      if (isShared) {
        persistContext(state.activeOrgId, null, 'all')
        return { isSharedView: true, activeWorkspaceId: null, activeWorkspaceMode: 'all', activeFolderId: null }
      }
      return { isSharedView: false }
    })
  },

  /**
   * Initialize the store from resolved data (called by useOrgContext on first load).
   * Persists to localStorage for next session.
   */
  initialize: (orgId: string, workspaceId?: string) => {
    set((state) => {
      const wsId = workspaceId ?? state.activeWorkspaceId
      const activeWorkspaceMode = workspaceId ? 'workspace' : state.activeWorkspaceMode
      persistContext(orgId, wsId, activeWorkspaceMode)
      return { activeOrgId: orgId, activeWorkspaceId: wsId, activeWorkspaceMode, isInitialized: true }
    })
  },

  /** Reset for logout — clears all context and localStorage. */
  reset: () => {
    set({
      activeOrgId: null,
      activeWorkspaceId: null,
      activeWorkspaceMode: 'auto',
      activeFolderId: null,
      isSharedView: false,
      isInitialized: false,
    })
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ORG_CONTEXT_STORAGE_KEY)
      localStorage.setItem(ORG_CONTEXT_UPDATED_KEY, Date.now().toString())
    }
  },
}))

/**
 * Cross-tab synchronization via localStorage storage events.
 * When one tab updates org context, this fires in all OTHER tabs.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event: StorageEvent) => {
    if (event.key === ORG_CONTEXT_UPDATED_KEY) {
      // Another tab changed org context — reload from localStorage.
      // Reset activeFolderId to null to avoid stale folder context across tabs.
      const { activeOrgId, activeWorkspaceId, activeWorkspaceMode } = loadPersistedContext()
      useOrgContextStore.setState({ activeOrgId, activeWorkspaceId, activeWorkspaceMode, activeFolderId: null })
    }
  })
}
