import { supabase } from '@/integrations/supabase/client'
import { escapeIlike } from '@/lib/filter-utils'

type TagLike = { id: string }

type ParticipantFilterInput = {
  organizationId: string
  participants?: string[]
  participantSearchTerms?: string[]
}

type TagFilterInput = {
  selectedTagIds?: string[]
  legacyTags: TagLike[]
  personalTags: TagLike[]
}

export function toInclusiveDateToIso(date: Date | undefined): string | null {
  if (!date) return null

  const inclusiveDate = new Date(date)
  if (
    inclusiveDate.getHours() === 0 &&
    inclusiveDate.getMinutes() === 0 &&
    inclusiveDate.getSeconds() === 0
  ) {
    inclusiveDate.setHours(23, 59, 59, 999)
  }

  return inclusiveDate.toISOString()
}

export async function resolveLegacyRecordingIdsToUuids(legacyIds: number[]): Promise<string[]> {
  if (legacyIds.length === 0) return []

  const { data, error } = await supabase
    .from('recordings')
    .select('id')
    .in('fathom_provider_id', legacyIds)

  if (error) throw error

  return (data || []).map((recording) => recording.id)
}

async function getFolderAndChildIds(folderIds: string[]): Promise<string[]> {
  if (folderIds.length === 0) return []

  const { data, error } = await supabase
    .from('folders')
    .select('id')
    .in('parent_id', folderIds)

  if (error) throw error

  return [...folderIds, ...(data || []).map((folder) => folder.id)]
}

export async function getWorkspaceFolderRecordingIds(
  workspaceId: string | null,
  folderId: string
): Promise<string[]> {
  const folderIds = await getFolderAndChildIds([folderId])

  let workspaceEntryIds: string[] = []
  let workspaceQuery = supabase
    .from('workspace_entries')
    .select('recording_id')
    .in('folder_id', folderIds)

  if (workspaceId) {
    workspaceQuery = workspaceQuery.eq('workspace_id', workspaceId)
  }

  const { data: wsEntries, error: wsError } = await workspaceQuery
  if (wsError) throw wsError
  workspaceEntryIds = (wsEntries || []).map((entry) => entry.recording_id)

  const { data: folderAssigns, error: folderError } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', folderIds)

  if (folderError) throw folderError

  const legacyIds = (folderAssigns || []).map((assignment) => assignment.call_recording_id)
  const legacyRecordingIds = await resolveLegacyRecordingIdsToUuids(legacyIds)

  return Array.from(new Set([...workspaceEntryIds, ...legacyRecordingIds]))
}

export async function getRecordingIdsForFolderFilter(folderIds: string[]): Promise<string[]> {
  const allFolderIds = await getFolderAndChildIds(folderIds)
  if (allFolderIds.length === 0) return []

  // Source 1: workspace_entries.folder_id (canonical, UUID-keyed)
  const { data: wsEntries, error: wsError } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .in('folder_id', allFolderIds)
  if (wsError) throw wsError

  // Source 2: folder_assignments (legacy, BIGINT-keyed)
  const { data: legacyAssigns, error: legacyError } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
    .in('folder_id', allFolderIds)
  if (legacyError) throw legacyError

  const legacyIds = (legacyAssigns || []).map((a) => a.call_recording_id)
  const legacyUuids = await resolveLegacyRecordingIdsToUuids(legacyIds)

  return Array.from(new Set([
    ...(wsEntries || []).map((e) => e.recording_id),
    ...legacyUuids,
  ]))
}

export async function getAssignedFolderLegacyRecordingIds(): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')

  if (error) throw error

  return new Set((data || []).map((assignment) => assignment.call_recording_id))
}

export async function getAssignedWorkspaceEntryFolderUuids(): Promise<Set<string>> {
  const { data: wsEntries, error: wsError } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .not('folder_id', 'is', null)
  if (wsError) throw wsError

  const { data: legacyAssigns, error: legacyError } = await supabase
    .from('folder_assignments')
    .select('call_recording_id')
  if (legacyError) throw legacyError

  const legacyIds = (legacyAssigns || []).map((a) => a.call_recording_id)
  const legacyUuids = await resolveLegacyRecordingIdsToUuids(legacyIds)

  return new Set([
    ...(wsEntries || []).map((e) => e.recording_id),
    ...legacyUuids,
  ])
}

export async function findParticipantRecordingIds({
  organizationId,
  participants,
  participantSearchTerms,
}: ParticipantFilterInput): Promise<string[] | null> {
  const hasEmailFilter = !!participants?.length
  const hasNameFilter = !!participantSearchTerms?.length

  if (!hasEmailFilter && !hasNameFilter) return null

  const matchingRecordingIds = new Set<string>()

  if (hasEmailFilter) {
    const { data, error } = await supabase
      .from('call_participants')
      .select('recording_id')
      .eq('organization_id', organizationId)
      .in('email', participants)
      .limit(10000)

    if (error) throw error
    ;(data || []).forEach((participant) => matchingRecordingIds.add(participant.recording_id))
  }

  if (hasNameFilter) {
    for (const term of participantSearchTerms) {
      const escaped = escapeIlike(term)
      const { data, error } = await supabase
        .from('call_participants')
        .select('recording_id')
        .eq('organization_id', organizationId)
        .or(`name.ilike.%${escaped}%,email.ilike.%${escaped}%`)
        .limit(10000)

      if (error) throw error
      ;(data || []).forEach((participant) => matchingRecordingIds.add(participant.recording_id))
    }
  }

  return Array.from(matchingRecordingIds)
}

export async function findRecordingIdsMatchingAllTags({
  selectedTagIds,
  legacyTags,
  personalTags,
}: TagFilterInput): Promise<string[] | null> {
  if (!selectedTagIds?.length) return null

  const recordingTagMap = new Map<string, Set<string>>()

  const addAssignments = (assignments: Array<{ recording_id: string; tag_id: string }> = []) => {
    assignments.forEach((assignment) => {
      if (!recordingTagMap.has(assignment.recording_id)) {
        recordingTagMap.set(assignment.recording_id, new Set())
      }
      recordingTagMap.get(assignment.recording_id)!.add(assignment.tag_id)
    })
  }

  const regularTagIds = selectedTagIds.filter((id) => legacyTags.some((tag) => tag.id === id))
  if (regularTagIds.length > 0) {
    const { data, error } = await supabase
      .from('call_tag_assignments')
      .select('recording_id, tag_id')
      .in('tag_id', regularTagIds)

    if (error) throw error
    addAssignments(data || [])
  }

  const personalTagIds = selectedTagIds.filter((id) => personalTags.some((tag) => tag.id === id))
  if (personalTagIds.length > 0) {
    const { data, error } = await supabase
      .from('personal_tag_recordings')
      .select('recording_id, tag_id')
      .in('tag_id', personalTagIds)

    if (error) throw error
    addAssignments(data || [])
  }

  const selectedTagSet = new Set(selectedTagIds)
  return Array.from(recordingTagMap.entries())
    .filter(([, assignedTags]) => {
      for (const tagId of selectedTagSet) {
        if (!assignedTags.has(tagId)) return false
      }
      return true
    })
    .map(([recordingId]) => recordingId)
}
