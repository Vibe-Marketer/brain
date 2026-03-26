/**
 * Canonical Tag type definitions
 *
 * All components and hooks should import Tag from here
 * rather than defining local interfaces.
 */

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
  description?: string | null;
  icon?: string | null;
  is_system?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  organization_id?: string;
  user_id?: string | null;
}

/**
 * Backward-compatible alias — some older code references Category
 * which was renamed to Tag.
 */
export type Category = Tag;
