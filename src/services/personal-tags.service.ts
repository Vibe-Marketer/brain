import { supabase } from '@/integrations/supabase/client'
import { isTableMissing } from '@/lib/supabase-errors'

export interface PersonalTag {
  id: string
  user_id: string
  organization_id: string
  name: string
  color: string | null
  created_at: string
  updated_at: string
}

export async function getPersonalTags(organizationId: string): Promise<PersonalTag[]> {
  const { data, error } = await (supabase as any)
    .from('personal_tags')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    if (isTableMissing(error)) return []
    throw new Error(`Failed to fetch personal tags: ${error.message}`)
  }

  return data as PersonalTag[]
}

export async function createPersonalTag(organizationId: string, name: string, color?: string): Promise<PersonalTag> {
  const { data: userResponse } = await supabase.auth.getUser()
  const userId = userResponse.user?.id

  if (!userId) throw new Error('User not authenticated')

  const { data, error } = await (supabase as any)
    .from('personal_tags')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name,
      color,
    })
    .select()
    .single()

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal tags are not available yet — migration pending')
    throw new Error(`Failed to create personal tag: ${error.message}`)
  }

  return data as PersonalTag
}

export async function updatePersonalTag(tagId: string, updates: Partial<{ name: string, color: string | null }>): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_tags')
    .update(updates)
    .eq('id', tagId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal tags are not available yet — migration pending')
    throw new Error(`Failed to update personal tag: ${error.message}`)
  }
}

export async function deletePersonalTag(tagId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_tags')
    .delete()
    .eq('id', tagId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal tags are not available yet — migration pending')
    throw new Error(`Failed to delete personal tag: ${error.message}`)
  }
}

export async function getPersonalTagAssignments(organizationId: string): Promise<Record<string, string[]>> {
  const { data: tags, error: tagsError } = await (supabase as any)
    .from('personal_tags')
    .select('id')
    .eq('organization_id', organizationId)

  if (tagsError) {
    if (isTableMissing(tagsError)) return {}
    throw new Error(`Failed to fetch tags for assignments: ${tagsError.message}`)
  }
  
  const tagIds = (tags ?? []).map((t) => t.id)
  
  if (tagIds.length === 0) return {}

  const { data, error } = await (supabase as any)
    .from('personal_tag_recordings')
    .select('recording_id, tag_id')
    .in('tag_id', tagIds)

  if (error) {
    if (isTableMissing(error)) return {}
    throw new Error(`Failed to fetch personal tag assignments: ${error.message}`)
  }

  const assignments: Record<string, string[]> = {}
  ;(data ?? []).forEach((row) => {
    const callId = String(row.recording_id)
    if (!assignments[callId]) {
      assignments[callId] = []
    }
    assignments[callId].push(row.tag_id)
  })

  return assignments
}

export async function assignTagToRecording(recordingId: string, tagId: string): Promise<void> {
  const { data: userResponse } = await supabase.auth.getUser()
  const userId = userResponse.user?.id

  if (!userId) throw new Error('User not authenticated')

  const { error } = await (supabase as any)
    .from('personal_tag_recordings')
    .upsert({
      recording_id: recordingId,
      tag_id: tagId,
      user_id: userId,
    }, { onConflict: 'tag_id,recording_id' })

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal tags are not available yet — migration pending')
    throw new Error(`Failed to assign tag to recording: ${error.message}`)
  }
}

export async function removeTagFromRecording(recordingId: string, tagId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('personal_tag_recordings')
    .delete()
    .eq('recording_id', recordingId)
    .eq('tag_id', tagId)

  if (error) {
    if (isTableMissing(error)) throw new Error('Personal tags are not available yet — migration pending')
    throw new Error(`Failed to remove tag from recording: ${error.message}`)
  }
}
