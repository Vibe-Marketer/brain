/**
 * Organization/Workspace type definitions for CallVault
 *
 * organization: Top-level tenant container (personal vs business)
 * workspace: Collaboration container within an organization (personal, team, coach, community, client)
 *
 * @see docs/planning/CallVault-Final-Spaces.md
 */

// Organization types (formerly Organization)
export type OrganizationType = 'personal' | 'business'
export type OrganizationRole = 'organization_owner' | 'organization_admin' | 'organization_member' | 'bank_owner' | 'bank_admin' | 'bank_member'

// Workspace types - personal + team fully implemented, youtube for video intelligence, others schema only
export type WorkspaceType = 'personal' | 'team' | 'coach' | 'community' | 'client' | 'youtube'
export type WorkspaceRole = 'workspace_owner' | 'workspace_admin' | 'manager' | 'member' | 'guest'

// Folder visibility within workspaces
export type FolderVisibility = 'all_members' | 'managers_only' | 'owner_only'

/**
 * Organization - Top-level tenant container (formerly Organization)
 * Each user has exactly one personal organization, and can belong to multiple business organizations
 */
export interface Organization {
  id: string
  name: string
  type: OrganizationType
  cross_organization_default: 'copy_only' | 'copy_and_remove'
  logo_url?: string | null
  created_at: string
  updated_at: string
  // Legacy
  cross_bank_default?: 'copy_only' | 'copy_and_remove'
}

/**
 * OrganizationMembership - User's membership in an organization with role
 */
export interface OrganizationMembership {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  created_at: string
  // Legacy
  bank_id?: string
}

/**
 * Workspace - Collaboration container within an organization
 * Personal workspaces are 1:1 with users, team workspaces enable collaboration
 */
export interface Workspace {
  id: string
  organization_id: string
  name: string
  workspace_type: WorkspaceType // formerly vault_type
  default_sharelink_ttl_days: number
  is_default?: boolean
  created_at: string
  updated_at: string
  // Legacy
  bank_id?: string
  vault_type?: WorkspaceType
}

/**
 * WorkspaceMembership - User's membership in a workspace with role
 */
export interface WorkspaceMembership {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
  // Legacy
  vault_id?: string
}

/**
 * Organization with its membership info (for the current user)
 * Used in UI for organization list/switcher
 */
export interface OrganizationWithMembership extends Organization {
  membership: OrganizationMembership
  workspaces?: Workspace[]
  member_count?: number
  // Legacy
  vaults?: Workspace[]
}

/**
 * Workspace with its membership info (for the current user)
 * Used in UI for workspace list/switcher
 */
export interface WorkspaceWithMembership extends Workspace {
  membership: WorkspaceMembership
}

/**
 * Recording - Base call object (migrated from fathom_calls)
 * Owned by an organization, can appear in multiple workspaces via WorkspaceEntry
 */
export interface Recording {
  id: string
  legacy_recording_id?: number | null
  organization_id: string
  owner_user_id: string
  title: string
  audio_url?: string | null
  full_transcript?: string | null
  summary?: string | null
  global_tags: string[]
  source_app?: string | null
  source_metadata?: Record<string, unknown> | null
  duration?: number | null
  recording_start_time?: string | null
  recording_end_time?: string | null
  created_at: string
  synced_at?: string | null
  // Legacy
  bank_id?: string
}

/**
 * WorkspaceEntry - Recording's presence in a workspace with local context
 * Same recording can appear in multiple workspaces with different local metadata
 */
export interface WorkspaceEntry {
  id: string
  workspace_id: string
  recording_id: string
  folder_id?: string | null
  local_tags: string[]
  scores?: Record<string, unknown> | null
  notes?: string | null
  created_at: string
  updated_at: string
}

// Legacy aliases for backward compatibility (progressive migration)

export type Vault = Workspace
export type VaultWithMembership = WorkspaceWithMembership
export type WorkspaceWithMeta = Workspace & { member_count: number; user_role: WorkspaceRole | null }
