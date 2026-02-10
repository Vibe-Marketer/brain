/**
 * Bank/Vault type definitions for CallVault
 *
 * Bank: Top-level tenant container (personal vs business)
 * Vault: Collaboration container within a bank (personal, team, coach, community, client)
 *
 * @see docs/planning/CallVault-Final-Spaces.md
 */

// Bank types
export type BankType = 'personal' | 'business'
export type BankRole = 'bank_owner' | 'bank_admin' | 'bank_member'

// Vault types - personal + team fully implemented, others schema only
export type VaultType = 'personal' | 'team' | 'coach' | 'community' | 'client'
export type VaultRole = 'vault_owner' | 'vault_admin' | 'manager' | 'member' | 'guest'

// Folder visibility within vaults
export type FolderVisibility = 'all_members' | 'managers_only' | 'owner_only'

/**
 * Bank - Top-level tenant container
 * Each user has exactly one personal bank, and can belong to multiple business banks
 */
export interface Bank {
  id: string
  name: string
  type: BankType
  cross_bank_default: 'copy_only' | 'copy_and_remove'
  logo_url?: string | null
  created_at: string
  updated_at: string
}

/**
 * BankMembership - User's membership in a bank with role
 */
export interface BankMembership {
  id: string
  bank_id: string
  user_id: string
  role: BankRole
  created_at: string
}

/**
 * Vault - Collaboration container within a bank
 * Personal vaults are 1:1 with users, team vaults enable collaboration
 */
export interface Vault {
  id: string
  bank_id: string
  name: string
  vault_type: VaultType
  default_sharelink_ttl_days: number
  created_at: string
  updated_at: string
}

/**
 * VaultMembership - User's membership in a vault with role
 */
export interface VaultMembership {
  id: string
  vault_id: string
  user_id: string
  role: VaultRole
  created_at: string
}

/**
 * Bank with its membership info (for the current user)
 * Used in UI for bank list/switcher
 */
export interface BankWithMembership extends Bank {
  membership: BankMembership
  vaults?: Vault[]
  member_count?: number
}

/**
 * Vault with its membership info (for the current user)
 * Used in UI for vault list/switcher
 */
export interface VaultWithMembership extends Vault {
  membership: VaultMembership
}

/**
 * Recording - Base call object (migrated from fathom_calls)
 * Owned by a bank, can appear in multiple vaults via VaultEntry
 */
export interface Recording {
  id: string
  legacy_recording_id?: number | null
  bank_id: string
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
}

/**
 * VaultEntry - Recording's presence in a vault with local context
 * Same recording can appear in multiple vaults with different local metadata
 */
export interface VaultEntry {
  id: string
  vault_id: string
  recording_id: string
  folder_id?: string | null
  local_tags: string[]
  scores?: Record<string, unknown> | null
  notes?: string | null
  created_at: string
  updated_at: string
}
