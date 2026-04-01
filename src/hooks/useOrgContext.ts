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
 * If no personal org exists, falls back to the first org in the list.
 *
 * LOCKED DECISION: switchOrg calls store.setActiveOrg which resets
 * activeWorkspaceId to null (clean slate per org).
 */
export function useOrgContext() {
  const navigate = useNavigate()

  const {
    activeOrgId,
    activeWorkspaceId,
    activeFolderId,
    isInitialized,
    setActiveOrg,
    setActiveWorkspace,
    setActiveFolder,
    setActiveWorkspaceAndFolder,
    initialize,
    reset,
  } = useOrgContextStore()

  const { data: organizations, isLoading: orgsLoading } = useOrganizations()
  
  // Also fetch workspaces for the active (or proposed) org to handle auto-init
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces(activeOrgId)

  // Auto-initialize: if no activeOrgId set yet, pick personal org or first org
  useEffect(() => {
    if (isInitialized) return
    if (orgsLoading || !organizations || organizations.length === 0) return

    const personalOrg = organizations.find((org) => isPersonalOrg(org))
    const defaultOrg = personalOrg ?? organizations[0]
    
    // Initialize with org only — no default workspace.
    // null activeWorkspaceId = "All Calls" (every recording in the org).
    // User explicitly picks a workspace from the sidebar to filter.
    initialize(defaultOrg.id)
  }, [organizations, orgsLoading, isInitialized, initialize, workspaces, workspacesLoading])

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
    activeFolderId,
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
    reset,

    // Helpers
    isPersonalOrg: activeOrg ? isPersonalOrg(activeOrg as Organization) : false,
    activeOrgRole: activeOrg?.membershipRole ?? null,
  }
}
