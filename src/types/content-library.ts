/**
 * Content Library and Template type definitions
 * Fields match Supabase schema (snake_case)
 */

/**
 * Valid content types for library items
 */
export type ContentType = 'email' | 'social' | 'testimonial' | 'insight' | 'other';

/**
 * Metadata structure for content library items
 */
export interface ContentMetadata {
  source?: string; // e.g., "meeting_summary", "follow_up_email"
  meeting_id?: string | number;
  generated_at?: string;
  [key: string]: unknown; // Allow additional metadata fields
}

/**
 * Content library item - matches content_library table
 */
export interface ContentLibraryItem {
  id: string;
  user_id: string;
  team_id: string | null;
  content_type: ContentType;
  title: string;
  content: string;
  tags: string[];
  metadata: ContentMetadata;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating new content library items
 */
export interface ContentLibraryInput {
  content_type: ContentType;
  title: string;
  content: string;
  tags?: string[];
  metadata?: ContentMetadata;
  team_id?: string | null;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  required: boolean;
  defaultValue?: string;
}

/**
 * Template - matches templates table
 */
export interface Template {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  description: string | null;
  template_content: string;
  variables: TemplateVariable[];
  content_type: ContentType;
  is_shared: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating new templates
 */
export interface TemplateInput {
  name: string;
  description?: string | null;
  template_content: string;
  variables?: TemplateVariable[];
  content_type: ContentType;
  is_shared?: boolean;
  team_id?: string | null;
}

/**
 * Filter options for content library queries
 */
export interface ContentLibraryFilters {
  content_type?: ContentType;
  tags?: string[];
  search?: string;
}

/**
 * Filter options for template queries
 */
export interface TemplateFilters {
  content_type?: ContentType;
  is_shared?: boolean;
  search?: string;
}

/**
 * Variable values for template interpolation
 */
export type TemplateVariableValues = Record<string, string>;

/**
 * Result of template interpolation with validation info
 */
export interface TemplateInterpolationResult {
  content: string;
  missingVariables: string[];
  hasWarnings: boolean;
}
