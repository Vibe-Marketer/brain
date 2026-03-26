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
  ai_generated_title?: string | null
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
      type MembershipWithWorkspace = (typeof memberships)[number]
      const orgWorkspaces = (memberships || []).filter((m: MembershipWithWorkspace) => {
        const ws = m.workspace as Record<string, unknown> | null
        return ws && ws.organization_id === orgId
      })

      // For each workspace, get member count
      const workspaceIds = orgWorkspaces
        .map((m) => (m.workspace as Record<string, unknown> | null)?.id as string | undefined)
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
      return orgWorkspaces.map((m) => {
        const ws = m.workspace as Record<string, unknown>
        return {
          ...ws,
          member_count: memberCounts[ws.id as string] || 0,
          user_role: m.role as WorkspaceRole,
          organization_id: ws.organization_id,
          workspace_type: ws.workspace_type,
        }
      }) as WorkspaceWithMeta[]
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
      type EntryWithRecording = (typeof entries)[number]
      return (entries || [])
        .filter((e: EntryWithRecording) => e.recording)
        .map((e: EntryWithRecording) => {
          const rec = e.recording as Record<string, unknown>
          return {
            ...rec,
            organization_id: rec.organization_id,
            workspace_entry: {
              id: e.id,
              local_tags: e.local_tags,
              scores: e.scores,
              notes: e.notes,
              folder_id: e.folder_id,
            },
          }
        }) as WorkspaceRecording[]
    },
    enabled: !!user && !!workspaceId,
    staleTime: 1 * 60 * 1000, // 1 minute — paginated data should refresh more frequently
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

      // Fetch memberships with user profiles in a single JOIN query
      const { data: memberships, error: memberError } = await supabase
        .from('workspace_memberships')
        .select(`id, user_id, role, created_at, user_profiles(user_id, email, display_name, avatar_url)`)
        .eq('workspace_id', workspaceId)

      if (memberError) throw memberError
      if (!memberships || memberships.length === 0) return []

      // Transform joined data and sort by role hierarchy
      const members: WorkspaceMember[] = memberships.map((m) => {
        const profile = m.user_profiles as unknown as { user_id: string; email: string | null; display_name: string | null; avatar_url: string | null } | null
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
  // Extract metadata fields from source_metadata (stored during sync)
  const meta = (recording.source_metadata ?? {}) as Record<string, unknown>;
  const invitees = Array.isArray(meta.calendar_invitees) ? meta.calendar_invitees : null;

  const result: Meeting = {
    // Use legacy_recording_id for TranscriptTable compatibility (it expects number | string)
    recording_id: recording.legacy_recording_id ?? recording.id,
    // Always expose the canonical UUID so detail queries can target UUID-keyed tables
    // (call_tag_assignments, call_participants) regardless of recording_id type.
    canonical_uuid: recording.id,
    title: recording.title,
    summary: recording.summary || (meta.summary as string) || null,
    created_at: recording.created_at,
    recording_start_time: recording.recording_start_time || null,
    recording_end_time: recording.recording_end_time || null,
    url: (meta.fathom_url as string) || null,
    share_url: (meta.fathom_share_url as string) || null,
    recorded_by_name: (meta.recorded_by_name as string) || null,
    recorded_by_email: (meta.recorded_by_email as string) || null,
    calendar_invitees: invitees,
    synced: true,
    user_id: recording.owner_user_id,
    synced_at: recording.synced_at || undefined,
    auto_tags: recording.global_tags || null,
    source_metadata: recording.source_metadata || null,
    // AI-generated subtitle (Fathom calls only — stored in fathom_raw_calls, joined by RPC)
    ai_generated_title: recording.ai_generated_title || null,
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
  };

  // Only include full_transcript when it was actually fetched (not undefined from omitted SELECT).
  // TranscriptTableRow checks 'full_transcript' in call to decide whether to show NO TRANSCRIPT badge.
  if (recording.full_transcript !== undefined) {
    result.full_transcript = recording.full_transcript || null;
  }

  return result;
}
