/**
 * useWorkspaces - Tanstack Query hooks for workspace data
 *
 * Provides hooks for fetching workspace lists, details, and recordings.
 * All queries filter by organization context and user membership.
 *
 * @pattern tanstack-query-hooks
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { queryKeys } from '@/lib/query-config'
import type { Workspace, WorkspaceRole, WorkspaceEntry, Recording, WorkspaceWithMeta } from '@/types/workspace'
import type { Meeting } from '@/types'

/** Workspace detail with full membership list */
export interface WorkspaceDetail extends Workspace {
  member_count: number
  user_role: WorkspaceRole | null
  memberships: Array<{
    id: string
    user_id: string
    role: WorkspaceRole
    created_at: string
  }>
}

/** Recording with workspace-specific metadata from workspace_entries */
export interface WorkspaceRecording extends Recording {
  workspace_entry: Pick<WorkspaceEntry, 'id' | 'local_tags' | 'scores' | 'notes' | 'folder_id'>
}

/** Workspace member with user profile info */
export interface WorkspaceMember {
  id: string
  user_id: string
  role: WorkspaceRole
  created_at: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
}

/** Role hierarchy for sorting (lower = higher rank) */
const ROLE_ORDER: Record<WorkspaceRole, number> = {
  workspace_owner: 0,
  workspace_admin: 1,
  manager: 2,
  member: 3,
  guest: 4,
}

/**
 * @param orgId - The organization ID to filter workspaces by. Pass null to disable query.
 */
export function useWorkspaces(orgId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.workspaces.list(orgId || undefined),
    queryFn: async (): Promise<WorkspaceWithMeta[]> => {
      if (!user || !orgId) return []

      // Query workspace memberships for this user
      const { data: memberships, error: queryError } = await supabase
        .from('workspace_memberships')
        .select(`
          id,
          role,
          created_at,
          workspace:workspaces (
            id,
            organization_id:organization_id,
            name,
            workspace_type:workspace_type,
            default_sharelink_ttl_days,
            is_default,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id)

      if (queryError) throw queryError

      // Filter to only workspaces in the specified organization
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orgWorkspaces = (memberships || []).filter((m: any) => m.workspace && m.workspace.organization_id === orgId)

      // For each workspace, get member count
      const workspaceIds = orgWorkspaces
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((m: any) => m.workspace?.id)
        .filter(Boolean) as string[]

      // Get member counts in a single query
      let memberCounts: Record<string, number> = {}
      if (workspaceIds.length > 0) {
        const { data: countData, error: countError } = await supabase
          .from('workspace_memberships')
          .select('workspace_id')
          .in('workspace_id', workspaceIds)

        if (!countError && countData) {
          memberCounts = countData.reduce((acc: Record<string, number>, row) => {
            acc[row.workspace_id] = (acc[row.workspace_id] || 0) + 1
            return acc
          }, {})
        }
      }

      // Transform to WorkspaceWithMeta format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return orgWorkspaces.map((m: any) => ({
        ...m.workspace,
        member_count: memberCounts[m.workspace.id] || 0,
        user_role: m.role as WorkspaceRole,
        // Legacy fields for backward compatibility
        organization_id: m.workspace.organization_id,
        workspace_type: m.workspace.workspace_type,
      })) as WorkspaceWithMeta[]
    },
    enabled: !!user && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    workspaces: data || [],
    isLoading,
    error,
  }
}

/**
 * useWorkspaceDetail - Returns detailed workspace info with membership list
 *
 * @param workspaceId - The workspace ID to fetch. Pass null to disable query.
 */
export function useWorkspaceDetail(workspaceId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.workspaces.detail(workspaceId || ''),
    queryFn: async (): Promise<WorkspaceDetail | null> => {
      if (!user || !workspaceId) return null

      // Fetch workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, organization_id:organization_id, name, workspace_type:workspace_type, default_sharelink_ttl_days, is_default, created_at, updated_at')
        .eq('id', workspaceId)
        .maybeSingle()

      if (workspaceError) throw workspaceError
      if (!workspace) return null

      // Fetch memberships for this workspace
      const { data: memberships, error: memberError } = await supabase
        .from('workspace_memberships')
        .select('id, user_id, role, created_at')
        .eq('workspace_id', workspaceId)

      if (memberError) throw memberError

      // Find user's role
      const userMembership = (memberships || []).find(
        (m) => m.user_id === user.id
      )

      return {
        ...workspace,
        member_count: memberships?.length || 0,
        user_role: (userMembership?.role as WorkspaceRole) || null,
        // Legacy fields
        organization_id: workspace.organization_id,
        workspace_type: workspace.workspace_type,
        memberships: (memberships || []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role as WorkspaceRole,
          created_at: m.created_at,
        })),
      } as WorkspaceDetail
    },
    enabled: !!user && !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    workspace: data || null,
    isLoading,
    error,
  }
}

/**
 * useWorkspaceRecordings - Returns recordings in a workspace with workspace-specific metadata
 *
 * @param workspaceId - The workspace ID to fetch recordings for. Pass null to disable query.
 * @param options - Optional pagination params
 */
 export function useWorkspaceRecordings(
  workspaceId: string | null,
  options?: { limit?: number; offset?: number; folderId?: string | null }
) {
  const { user } = useAuth()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  const folderId = options?.folderId

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.workspaces.recordings(workspaceId || ''), limit, offset, folderId],
    queryFn: async (): Promise<WorkspaceRecording[]> => {
      if (!user || !workspaceId) return []

      // Fetch workspace_entries joined with recordings
      let query = supabase
        .from('workspace_entries')
        .select(`
          id,
          local_tags,
          scores,
          notes,
          folder_id,
          recording:recordings (
            id,
            legacy_recording_id,
            organization_id:organization_id,
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
        .eq('workspace_id', workspaceId)

      // Filter by folder if specified
      if (folderId) {
        query = query.eq('folder_id', folderId)
      } else if (folderId === null) {
        // Specifically requesting recordings NOT in a folder (top-level)
        query = query.is('folder_id', null)
      }

      const { data: entries, error: queryError } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (queryError) throw queryError

      // Transform to WorkspaceRecording format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (entries || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((e: any) => e.recording)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((e: any) => ({
          ...e.recording,
          organization_id: e.recording.organization_id,
          workspace_entry: {
            id: e.id,
            local_tags: e.local_tags,
            scores: e.scores,
            notes: e.notes,
            folder_id: e.folder_id,
          },
        })) as WorkspaceRecording[]
    },
    enabled: !!user && !!workspaceId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    recordings: data || [],
    isLoading,
    error,
  }
}

/**
 * useWorkspaceMembers - Returns members of a workspace with user profile info
 *
 * Fetches workspace_memberships and resolves user profiles via auth.users metadata.
 * Sorted by role hierarchy: workspace_owner first, then workspace_admin, manager, member, guest.
 *
 * @param workspaceId - The workspace ID to fetch members for. Pass null to disable query.
 */
export function useWorkspaceMembers(workspaceId: string | null) {
  const { user } = useAuth()

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.workspaces.members(workspaceId || ''),
    queryFn: async (): Promise<WorkspaceMember[]> => {
      if (!user || !workspaceId) return []

      // Fetch memberships for this workspace
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: memberships, error: memberError } = await (supabase as any)
        .from('workspace_memberships')
        .select('id, user_id, role, created_at')
        .eq('workspace_id', workspaceId)

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
      const members: WorkspaceMember[] = memberships.map((m: any) => {
        const profile = profileMap.get(m.user_id)
        return {
          id: m.id,
          user_id: m.user_id,
          role: m.role as WorkspaceRole,
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
    enabled: !!user && !!workspaceId,
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
 * TranscriptTable uses the Meeting type. Workspace recordings use Recording + WorkspaceEntry.
 * This adapter maps workspace recording data to the Meeting shape expected by TranscriptTable.
 *
 * @param recording - Recording from workspace (may include workspace_entry metadata)
 * @returns Meeting-compatible object for TranscriptTable consumption
 */
export function mapRecordingToMeeting(recording: WorkspaceRecording): Meeting {
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
    // Not applicable for workspace recordings
    meeting_fingerprint: null,
    is_primary: null,
    merged_from: null,
    fuzzy_match_score: null,
    google_calendar_event_id: null,
    google_drive_file_id: null,
    transcript_source: null,
  }
}
