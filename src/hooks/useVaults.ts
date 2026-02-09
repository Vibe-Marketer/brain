/**
 * useVaults - Tanstack Query hooks for vault data
 *
 * Provides hooks for fetching vault lists, details, and recordings.
 * All queries filter by bank context and user membership.
 *
 * @pattern tanstack-query-hooks
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import type { Vault, VaultMembership, VaultRole, VaultEntry, Recording } from '@/types/bank'
import type { Meeting } from '@/types'

/** Vault with member count and user's role */
export interface VaultWithMeta extends Vault {
  member_count: number
  user_role: VaultRole | null
}

/** Vault detail with full membership list */
export interface VaultDetail extends Vault {
  member_count: number
  user_role: VaultRole | null
  memberships: Array<{
    id: string
    user_id: string
    role: VaultRole
    created_at: string
  }>
}

/** Recording with vault-specific metadata from vault_entries */
export interface VaultRecording extends Recording {
  vault_entry: Pick<VaultEntry, 'id' | 'local_tags' | 'scores' | 'notes' | 'folder_id'>
}

/** Vault member with user profile info */
export interface VaultMember {
  id: string
  user_id: string
  role: VaultRole
  created_at: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

/** Role hierarchy for sorting (lower = higher rank) */
const ROLE_ORDER: Record<VaultRole, number> = {
  vault_owner: 0,
  vault_admin: 1,
  manager: 2,
  member: 3,
  guest: 4,
}

/**
 * useVaults - Returns vaults for a specific bank that the user is a member of
 *
 * @param bankId - The bank ID to filter vaults by. Pass null to disable query.
 */
export function useVaults(bankId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.vaults.list(), bankId, user?.id],
    queryFn: async (): Promise<VaultWithMeta[]> => {
      if (!user || !bankId) return []

      // Query vault_memberships joined with vaults for this user
      const { data: memberships, error: queryError } = await supabase
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

      if (queryError) throw queryError

      // Filter to only vaults in the specified bank
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bankVaults = (memberships || []).filter((m: any) => m.vault && m.vault.bank_id === bankId)

      // For each vault, get member count
      const vaultIds = bankVaults
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => m.vault?.id)
        .filter(Boolean) as string[]

      // Get member counts in a single query
      let memberCounts: Record<string, number> = {}
      if (vaultIds.length > 0) {
        const { data: countData, error: countError } = await supabase
          .from('vault_memberships')
          .select('vault_id')
          .in('vault_id', vaultIds)

        if (!countError && countData) {
          memberCounts = countData.reduce((acc: Record<string, number>, row) => {
            acc[row.vault_id] = (acc[row.vault_id] || 0) + 1
            return acc
          }, {})
        }
      }

      // Transform to VaultWithMeta format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return bankVaults.map((m: any) => ({
        ...m.vault,
        member_count: memberCounts[m.vault.id] || 0,
        user_role: m.role as VaultRole,
      })) as VaultWithMeta[]
    },
    enabled: !!user && !!bankId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    vaults: data || [],
    isLoading,
    error,
  }
}

/**
 * useVaultDetail - Returns detailed vault info with membership list
 *
 * @param vaultId - The vault ID to fetch. Pass null to disable query.
 */
export function useVaultDetail(vaultId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vaults.detail(vaultId || ''),
    queryFn: async (): Promise<VaultDetail | null> => {
      if (!user || !vaultId) return null

      // Fetch vault
      const { data: vault, error: vaultError } = await supabase
        .from('vaults')
        .select('*')
        .eq('id', vaultId)
        .single()

      if (vaultError) throw vaultError
      if (!vault) return null

      // Fetch memberships for this vault
      const { data: memberships, error: memberError } = await supabase
        .from('vault_memberships')
        .select('id, user_id, role, created_at')
        .eq('vault_id', vaultId)

      if (memberError) throw memberError

      // Find user's role
      const userMembership = (memberships || []).find(
        (m) => m.user_id === user.id
      )

      return {
        ...vault,
        member_count: memberships?.length || 0,
        user_role: (userMembership?.role as VaultRole) || null,
        memberships: (memberships || []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role as VaultRole,
          created_at: m.created_at,
        })),
      } as VaultDetail
    },
    enabled: !!user && !!vaultId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    vault: data || null,
    isLoading,
    error,
  }
}

/**
 * useVaultRecordings - Returns recordings in a vault with vault-specific metadata
 *
 * @param vaultId - The vault ID to fetch recordings for. Pass null to disable query.
 * @param options - Optional pagination params
 */
export function useVaultRecordings(
  vaultId: string | null,
  options?: { limit?: number; offset?: number }
) {
  const { user } = useAuth()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.vaults.recordings(vaultId || ''), limit, offset],
    queryFn: async (): Promise<VaultRecording[]> => {
      if (!user || !vaultId) return []

      // Fetch vault_entries joined with recordings
      const { data: entries, error: queryError } = await supabase
        .from('vault_entries')
        .select(`
          id,
          local_tags,
          scores,
          notes,
          folder_id,
          recording:recordings (
            id,
            legacy_recording_id,
            bank_id,
            owner_user_id,
            title,
            audio_url,
            full_transcript,
            summary,
            global_tags,
            source_app,
            source_metadata,
            duration,
            recording_start_time,
            recording_end_time,
            created_at,
            synced_at
          )
        `)
        .eq('vault_id', vaultId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (queryError) throw queryError

      // Transform to VaultRecording format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (entries || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.recording)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => ({
          ...e.recording,
          vault_entry: {
            id: e.id,
            local_tags: e.local_tags,
            scores: e.scores,
            notes: e.notes,
            folder_id: e.folder_id,
          },
        })) as VaultRecording[]
    },
    enabled: !!user && !!vaultId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    recordings: data || [],
    isLoading,
    error,
  }
}

/**
 * useVaultMembers - Returns members of a vault with user profile info
 *
 * Fetches vault_memberships and resolves user profiles via auth.users metadata.
 * Sorted by role hierarchy: vault_owner first, then vault_admin, manager, member, guest.
 *
 * @param vaultId - The vault ID to fetch members for. Pass null to disable query.
 */
export function useVaultMembers(vaultId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.vaults.members(vaultId || ''),
    queryFn: async (): Promise<VaultMember[]> => {
      if (!user || !vaultId) return []

      // Fetch memberships for this vault
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: memberships, error: memberError } = await (supabase as any)
        .from('vault_memberships')
        .select('id, user_id, role, created_at')
        .eq('vault_id', vaultId)

      if (memberError) throw memberError
      if (!memberships || memberships.length === 0) return []

      // Fetch user profiles for each member
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userIds = memberships.map((m: any) => m.user_id) as string[]

      // Use user_profiles table if available, otherwise fall back to auth metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles, error: profileError } = await (supabase as any)
        .from('user_profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', userIds)

      // Build profile lookup
      const profileMap = new Map<string, { email: string | null; display_name: string | null; avatar_url: string | null }>()
      if (!profileError && profiles) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const p of profiles as any[]) {
          profileMap.set(p.id, {
            email: p.email || null,
            display_name: p.display_name || null,
            avatar_url: p.avatar_url || null,
          })
        }
      }

      // Transform and sort by role hierarchy
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const members: VaultMember[] = memberships.map((m: any) => {
        const profile = profileMap.get(m.user_id)
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as VaultRole,
          created_at: m.created_at,
          email: profile?.email || null,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
        }
      })

      // Sort by role hierarchy
      members.sort((a, b) => {
        const orderA = ROLE_ORDER[a.role] ?? 99
        const orderB = ROLE_ORDER[b.role] ?? 99
        return orderA - orderB
      })

      return members
    },
    enabled: !!user && !!vaultId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    members: data || [],
    isLoading,
    error,
  }
}

/**
 * mapRecordingToMeeting - Adapter function to bridge Recording → Meeting type
 *
 * TranscriptTable uses the Meeting type. Vault recordings use Recording + VaultEntry.
 * This adapter maps vault recording data to the Meeting shape expected by TranscriptTable.
 *
 * @param recording - Recording from vault (may include vault_entry metadata)
 * @returns Meeting-compatible object for TranscriptTable consumption
 */
export function mapRecordingToMeeting(recording: VaultRecording): Meeting {
  return {
    // Use legacy_recording_id for TranscriptTable compatibility (it expects number | string)
    recording_id: recording.legacy_recording_id ?? recording.id,
    title: recording.title,
    full_transcript: recording.full_transcript || null,
    summary: recording.summary || null,
    created_at: recording.created_at,
    recording_start_time: recording.recording_start_time || null,
    recording_end_time: recording.recording_end_time || null,
    // Fields not available on Recording - set sensible defaults
    url: null,
    share_url: null,
    recorded_by_name: null,
    recorded_by_email: null,
    calendar_invitees: null,
    synced: true,
    user_id: recording.owner_user_id,
    synced_at: recording.synced_at || undefined,
    auto_tags: recording.global_tags || null,
    // Source tracking
    source_platform: (recording.source_app as Meeting['source_platform']) || null,
    // Not applicable for vault recordings
    meeting_fingerprint: null,
    is_primary: null,
    merged_from: null,
    fuzzy_match_score: null,
    google_calendar_event_id: null,
    google_drive_file_id: null,
    transcript_source: null,
  }
}
