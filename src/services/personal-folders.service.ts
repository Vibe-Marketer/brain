import { supabase } from '@/integrations/supabase/client'

export interface PersonalFolder {
  id: string
  user_id: string
  organization_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface PersonalFolderRecording {
  folder_id: string
  recording_id: string
  created_at: string
}

export async function getPersonalFolders(organizationId: string): Promise<PersonalFolder[]> {
  const { data, error } = await (supabase as any)
    .from('personal_folders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch personal folders: ${error.message}`)
  
  return data as PersonalFolder[]
}

export async function createPersonalFolder(organizationId: string, name: string): Promise<PersonalFolder> {
  const { data: userResponse } = await supabase.auth.getUser()
  const userId = userResponse.user?.id

  if (!userId) throw new Error('User not authenticated')

  const { data, error } = await (supabase as any)
    .from('personal_folders')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create personal folder: ${error.message}`)

  return data as PersonalFolder
}

export async function updatePersonalFolder(folderId: string, name: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folders')
    .update({ name })
    .eq('id', folderId)

  if (error) throw new Error(`Failed to update personal folder: ${error.message}`)
}

export async function deletePersonalFolder(folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folders')
    .delete()
    .eq('id', folderId)

  if (error) throw new Error(`Failed to delete personal folder: ${error.message}`)
}

export async function getPersonalFolderAssignments(organizationId: string): Promise<Record<string, string[]>> {
  // Fetch folder IDs for this org
  const { data: folders, error: foldersError } = await (supabase as any)
    .from('personal_folders')
    .select('id')
    .eq('organization_id', organizationId)

  if (foldersError) throw new Error(`Failed to fetch folders for assignments: ${foldersError.message}`)
  
  const folderIds = (folders ?? []).map((f) => f.id)
  
  if (folderIds.length === 0) return {}

  // Fetch recordings linked to those folders
  const { data, error } = await (supabase as any)
    .from('personal_folder_recordings')
    .select('recording_id, folder_id')
    .in('folder_id', folderIds)

  if (error) throw new Error(`Failed to fetch personal folder assignments: ${error.message}`)

  const assignments: Record<string, string[]> = {}
  ;(data ?? []).forEach((row) => {
    const callId = String(row.recording_id)
    if (!assignments[callId]) {
      assignments[callId] = []
    }
    assignments[callId].push(row.folder_id)
  })

  return assignments
}

export async function assignCallToPersonalFolder(recordingId: string, folderId: string): Promise<void> {
  const { data: userResponse } = await supabase.auth.getUser()
  const userId = userResponse.user?.id

  if (!userId) throw new Error('User not authenticated')

  const { error } = await (supabase as any)
    .from('personal_folder_recordings')
    .upsert({
      recording_id: recordingId,
      folder_id: folderId,
      user_id: userId,
    }, { onConflict: 'folder_id,recording_id' })

  if (error) throw new Error(`Failed to assign call to personal folder: ${error.message}`)
}

export async function removeCallFromPersonalFolder(recordingId: string, folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folder_recordings')
    .delete()
    .eq('recording_id', recordingId)
    .eq('folder_id', folderId)

  if (error) throw new Error(`Failed to remove call from personal folder: ${error.message}`)
}

export async function moveCallToPersonalFolder(recordingId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  await removeCallFromPersonalFolder(recordingId, fromFolderId)
  await assignCallToPersonalFolder(recordingId, toFolderId)
}
