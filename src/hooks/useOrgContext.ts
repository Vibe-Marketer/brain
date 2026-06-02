import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrgContextStore } from '@/stores/orgContextStore'
import { usePanelStore } from '@/stores/panelStore'
import { useSearchStore } from '@/stores/searchStore'
import { useOrganizations } from '@/hooks/useOrganizations'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { isPersonalOrg } from '@/services/organizations.service'
import type { OrganizationWithRole } from '@/services/organizations.service'
import type { Organization } from '@/types/workspace'

/**
 * useOrgContext — convenience hook combining org context store with live org data.
 *
 * Provides:
 * - activeOrg, organizations list
 * - activeOrgId, activeWorkspaceId, activeFolderId from store
 * - switchOrg, switchWorkspace, switchFolder actions
 * - isPersonalOrg helper for the active org
 *
 * On first load: if no activeOrgId is set, auto-selects the personal org.
 * If no personal org exists, falls back to the first org in the list. When
 * no workspace was explicitly selected, auto-selects the org's default
 * workspace so users do not land in the broad org-wide All Calls view.
 *
 * LOCKED DECISION: switchOrg calls store.setActiveOrg which resets
 * activeWorkspaceId to auto mode (clean slate per org).
 */
export function useOrgContext() {
  const navigate = useNavigate()

  const {
    activeOrgId,
    activeWorkspaceId,
    activeWorkspaceMode,
    activeFolderId,
    isSharedView,
    isInitialized,
    setActiveOrg,
    setActiveWorkspace,
    setActiveFolder,
    setActiveWorkspaceAndFolder,
    setSharedView,
    initialize,
    reset,
  } = useOrgContextStore()

  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  
  // Also fetch workspaces for the active (or proposed) org to handle auto-init
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId)

  // Auto-initialize: restore persisted org if valid, otherwise pick personal org or first org
  useEffect(() => {
    if (isInitialized) return
    if (orgsLoading || !organizations || organizations.length === 0) return

    // If a persisted activeOrgId is already in the store and it's a valid org the
    // user still belongs to, honor it — this preserves the org the user selected
    // before a page refresh or re-login instead of always resetting to personal org.
    if (activeOrgId && organizations.some((org) => org.id === activeOrgId)) {
      initialize(activeOrgId)
      return
    }

    // No valid persisted org — fall back to personal org or first in list.
    const personalOrg = organizations.find((org) => isPersonalOrg(org))
    const defaultOrg = personalOrg ?? organizations[0]

    initialize(defaultOrg.id)
  }, [organizations, orgsLoading, isInitialized, initialize, activeOrgId, workspaces, workspacesLoading])

  useEffect(() => {
    if (!isInitialized || !activeOrgId || activeWorkspaceId || activeWorkspaceMode !== 'auto') {
      return
    }
    if (workspacesLoading || !workspaces || workspaces.length === 0) {
      return
    }

    const defaultWorkspace = workspaces.find((workspace) => workspace.is_default === true) ?? workspaces[0]
    if (defaultWorkspace) {
      setActiveWorkspace(defaultWorkspace.id)
    }
  }, [
    activeOrgId,
    activeWorkspaceId,
    activeWorkspaceMode,
    isInitialized,
    setActiveWorkspace,
    workspaces,
    workspacesLoading,
  ])

  // Derived: find the active org object from the list
  const activeOrg: OrganizationWithRole | null =
    organizations?.find((org) => org.id === activeOrgId) ?? null

  /**
   * Switch to a different organization.
   * D-11/D-12: Resets ALL transient UI state for a clean-slate experience:
   * - org context (workspace, folder) via setActiveOrg
   * - Pane 4 (detail panel) via panelStore.closePanel
   * - Search query via searchStore.resetSearch
   * - Filter/sort state is URL-based — cleared by navigating to '/'
   * Redirects to Calls page after switching.
   */
  const switchOrg = useCallback(
    (orgId: string) => {
      // 1. Reset org context (also resets workspace + folder — locked behavior)
      setActiveOrg(orgId)
      // 2. Close Pane 4 (force close even if pinned during org switch)
      const panelStore = usePanelStore.getState()
      if (panelStore.isPinned) {
        usePanelStore.setState({ isPinned: false })
      }
      panelStore.closePanel()
      // 3. Reset search state
      useSearchStore.getState().resetSearch()
      // 4. Navigate to Calls page — URL-based filters/sort cleared by navigation
      navigate('/')
    },
    [setActiveOrg, navigate]
  )

  /** Switch to a different workspace, or null for "All Calls" (org-wide view). */
  const switchWorkspace = useCallback(
    (workspaceId: string | null) => {
      setActiveWorkspace(workspaceId)
    },
    [setActiveWorkspace]
  )

  /** Set or clear the active folder within the active workspace. */
  const switchFolder = useCallback(
    (folderId: string | null) => {
      setActiveFolder(folderId)
    },
    [setActiveFolder]
  )

  /**
   * Switch to a folder within a specific workspace — sets both atomically.
   * Ensures activeWorkspaceId is set alongside the folder so queries that
   * depend on both (e.g. get_workspace_recordings) have the workspace context.
   */
  const switchToFolder = useCallback(
    (workspaceId: string, folderId: string | null) => {
      setActiveWorkspaceAndFolder(workspaceId, folderId)
    },
    [setActiveWorkspaceAndFolder]
  )

  return {
    // Store state
    activeOrgId,
    activeWorkspaceId,
    activeWorkspaceMode,
    activeFolderId,
    isSharedView,
    isInitialized,

    // Derived data
    activeOrg,
    organizations: organizations ?? [],
    workspaces: workspaces ?? [],

    // Loading state
    isLoading: orgsLoading || (activeOrgId ? workspacesLoading : false),

    // Actions
    switchOrg,
    switchWorkspace,
    switchFolder,
    switchToFolder,
    setSharedView,
    reset,

    // Helpers
    isPersonalOrg: activeOrg ? isPersonalOrg(activeOrg as Organization) : false,
    activeOrgRole: activeOrg?.membershipRole ?? null,
  }
}
