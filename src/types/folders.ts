/**
 * Folder type definitions - Single source of truth
 * Fields match Supabase schema (snake_case)
 */

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// Extended type for UI components that need depth calculation
export interface FolderWithDepth extends Folder {
  depth?: number;
}

// For folder assignment records
export interface FolderAssignment {
  folder_id: string;
  call_recording_id: number;
  assigned_at: string;
}
