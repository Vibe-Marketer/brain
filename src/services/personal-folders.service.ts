import { supabase } from '@/integrations/supabase/client'
import { isTableMissing } from '@/lib/supabase-errors'

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

// TODO: personal_folders table migration is pending — remove this stub when table exists
export async function getPersonalFolders(_organizationId: string): Promise<PersonalFolder[]> {
  return []
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

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal folders are not available yet — migration pending')
    throw new Error(`Failed to create personal folder: ${error.message}`)
  }

  return data as PersonalFolder
}

export async function updatePersonalFolder(folderId: string, name: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folders')
    .update({ name })
    .eq('id', folderId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal folders are not available yet — migration pending')
    throw new Error(`Failed to update personal folder: ${error.message}`)
  }
}

export async function deletePersonalFolder(folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal folders are not available yet — migration pending')
    throw new Error(`Failed to delete personal folder: ${error.message}`)
  }
}

// TODO: personal_folders table migration is pending — remove this stub when table exists
export async function getPersonalFolderAssignments(_organizationId: string): Promise<Record<string, string[]>> {
  return {}
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

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal folders are not available yet — migration pending')
    throw new Error(`Failed to assign call to personal folder: ${error.message}`)
  }
}

export async function removeCallFromPersonalFolder(recordingId: string, folderId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_folder_recordings')
    .delete()
    .eq('recording_id', recordingId)
    .eq('folder_id', folderId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal folders are not available yet — migration pending')
    throw new Error(`Failed to remove call from personal folder: ${error.message}`)
  }
}

export async function moveCallToPersonalFolder(recordingId: string, fromFolderId: string, toFolderId: string): Promise<void> {
  await removeCallFromPersonalFolder(recordingId, fromFolderId)
  await assignCallToPersonalFolder(recordingId, toFolderId)
}
