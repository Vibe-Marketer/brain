import { supabase } from '@/integrations/supabase/client'

/**
 * Contact Folder Service — CRUD and assignment operations for contact folders.
 *
 * Contact folders organize contacts in the People page (separate from
 * call/recording folders in workspaces).
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ContactFolder {
  id: string
  name: string
  organization_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface ContactFolderAssignment {
  id: string
  contact_folder_id: string
  contact_id: string
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// Read Operations
// ─────────────────────────────────────────────────────────────

/**
 * Fetches all contact folders for the given organization.
 * Ordered by name ASC.
 */
export async function getContactFolders(organizationId: string): Promise<ContactFolder[]> {
  const { data, error } = await supabase
    .from('contact_folders')
    .select('id, name, organization_id, user_id, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch contact folders: ${error.message}`)
  }

  return (data ?? []) as ContactFolder[]
}

// ─────────────────────────────────────────────────────────────
// Write Operations
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new contact folder inside the given organization.
 */
export async function createContactFolder(
  organizationId: string,
  userId: string,
  name: string
): Promise<ContactFolder> {
  const { data, error } = await supabase
    .from('contact_folders')
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name,
    })
    .select('id, name, organization_id, user_id, created_at, updated_at')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create contact folder: ${error?.message ?? 'Unknown error'}`)
  }

  return data as ContactFolder
}

/**
 * Deletes a contact folder by ID.
 * CASCADE on contact_folder_assignments handles cleanup.
 */
export async function deleteContactFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_folders')
    .delete()
    .eq('id', folderId)

  if (error) {
    throw new Error(`Failed to delete contact folder: ${error.message}`)
  }
}

// ─────────────────────────────────────────────────────────────
// Assignment Operations
// ─────────────────────────────────────────────────────────────

/**
 * Assigns a contact to a contact folder.
 * Uses upsert to avoid duplicate assignment errors.
 */
export async function assignContactToFolder(
  contactFolderId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('contact_folder_assignments')
    .upsert(
      { contact_folder_id: contactFolderId, contact_id: contactId },
      { onConflict: 'contact_folder_id,contact_id' }
    )

  if (error) {
    throw new Error(`Failed to assign contact to folder: ${error.message}`)
  }
}

/**
 * Removes a contact from a contact folder.
 */
export async function removeContactFromFolder(
  contactFolderId: string,
  contactId: string
): Promise<void> {
  const { error } = await supabase
    .from('contact_folder_assignments')
    .delete()
    .eq('contact_folder_id', contactFolderId)
    .eq('contact_id', contactId)

  if (error) {
    throw new Error(`Failed to remove contact from folder: ${error.message}`)
  }
}
