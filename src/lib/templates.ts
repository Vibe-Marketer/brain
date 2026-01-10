/**
 * Template CRUD Functions
 *
 * Provides database operations for templates.
 * Uses authenticated Supabase client with RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import type {
  Template,
  TemplateInput,
  TemplateFilters,
  TemplateVariable,
} from "@/types/content-library";

/**
 * Error class for template operations
 */
export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

/**
 * Result type for template operations
 */
export interface TemplateResult<T> {
  data: T | null;
  error: TemplateError | null;
}

/**
 * Fetch templates with optional filters
 *
 * @param filters - Optional filters for content_type, is_shared, and search
 * @param includeShared - Whether to include shared team templates (default: true)
 * @returns Array of templates matching filters
 *
 * @example
 * // Fetch all templates (personal + shared team templates)
 * const { data, error } = await fetchTemplates();
 *
 * // Fetch only personal templates
 * const { data, error } = await fetchTemplates({}, false);
 *
 * // Fetch with filters
 * const { data, error } = await fetchTemplates({ content_type: 'email' });
 */
export async function fetchTemplates(
  filters?: TemplateFilters,
  includeShared: boolean = true
): Promise<TemplateResult<Template[]>> {
  try {
    const user = await requireUser();

    let query = supabase
      .from("templates")
      .select("*")
      .order("created_at", { ascending: false });

    // RLS handles user/team access, but we can filter for personal templates only
    if (!includeShared) {
      query = query.eq("user_id", user.id);
    }

    // Apply content_type filter
    if (filters?.content_type) {
      query = query.eq("content_type", filters.content_type);
    }

    // Apply is_shared filter
    if (filters?.is_shared !== undefined) {
      query = query.eq("is_shared", filters.is_shared);
    }

    // Apply search filter (searches name and description)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching templates", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to fetch templates",
          error.code,
          error
        ),
      };
    }

    // Parse variables from JSONB to TemplateVariable array
    const templates = (data || []).map((template) => ({
      ...template,
      variables: parseVariables(template.variables),
    })) as Template[];

    return {
      data: templates,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching templates", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to fetch templates",
        undefined,
        err
      ),
    };
  }
}

/**
 * Fetch user's personal templates only
 *
 * @param filters - Optional filters
 * @returns Array of user's personal templates
 */
export async function fetchPersonalTemplates(
  filters?: TemplateFilters
): Promise<TemplateResult<Template[]>> {
  return fetchTemplates(filters, false);
}

/**
 * Fetch shared team templates only
 *
 * @param filters - Optional filters
 * @returns Array of shared team templates
 */
export async function fetchSharedTemplates(
  filters?: TemplateFilters
): Promise<TemplateResult<Template[]>> {
  try {
    const user = await requireUser();

    let query = supabase
      .from("templates")
      .select("*")
      .eq("is_shared", true)
      .neq("user_id", user.id) // Exclude user's own templates
      .order("created_at", { ascending: false });

    // Apply content_type filter
    if (filters?.content_type) {
      query = query.eq("content_type", filters.content_type);
    }

    // Apply search filter
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching shared templates", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to fetch shared templates",
          error.code,
          error
        ),
      };
    }

    const templates = (data || []).map((template) => ({
      ...template,
      variables: parseVariables(template.variables),
    })) as Template[];

    return {
      data: templates,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching shared templates", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to fetch shared templates",
        undefined,
        err
      ),
    };
  }
}

/**
 * Save a new template
 *
 * @param input - Template to save (name, template_content, content_type, etc.)
 * @returns The created template
 *
 * @example
 * const { data, error } = await saveTemplate({
 *   name: 'Follow-up Email',
 *   description: 'Template for post-meeting follow-ups',
 *   template_content: 'Hi {{firstName}}, thank you for meeting with us...',
 *   content_type: 'email',
 *   is_shared: false
 * });
 */
export async function saveTemplate(
  input: TemplateInput
): Promise<TemplateResult<Template>> {
  try {
    const user = await requireUser();

    // Validate required fields
    if (!input.name?.trim()) {
      return {
        data: null,
        error: new TemplateError("Name is required"),
      };
    }

    if (!input.template_content?.trim()) {
      return {
        data: null,
        error: new TemplateError("Template content is required"),
      };
    }

    // Validate length limits (matching database constraints)
    if (input.name.length > 255) {
      return {
        data: null,
        error: new TemplateError("Name must be 255 characters or less"),
      };
    }

    if (input.template_content.length > 50000) {
      return {
        data: null,
        error: new TemplateError("Template content must be 50,000 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("templates")
      .insert({
        user_id: user.id,
        name: input.name.trim(),
        description: input.description || null,
        template_content: input.template_content,
        variables: input.variables || [],
        content_type: input.content_type,
        is_shared: input.is_shared || false,
        team_id: input.team_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error saving template", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to save template",
          error.code,
          error
        ),
      };
    }

    return {
      data: {
        ...data,
        variables: parseVariables(data.variables),
      } as Template,
      error: null,
    };
  } catch (err) {
    logger.error("Error saving template", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to save template",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update an existing template
 *
 * @param id - Template ID to update
 * @param updates - Partial updates to apply
 * @returns The updated template
 *
 * @example
 * const { data, error } = await updateTemplate('uuid-here', {
 *   name: 'Updated Template Name',
 *   is_shared: true
 * });
 */
export async function updateTemplate(
  id: string,
  updates: Partial<Omit<Template, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<TemplateResult<Template>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new TemplateError("Template ID is required"),
      };
    }

    // Validate name length if provided
    if (updates.name !== undefined && updates.name.length > 255) {
      return {
        data: null,
        error: new TemplateError("Name must be 255 characters or less"),
      };
    }

    // Validate template_content length if provided
    if (updates.template_content !== undefined && updates.template_content.length > 50000) {
      return {
        data: null,
        error: new TemplateError("Template content must be 50,000 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating template", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to update template",
          error.code,
          error
        ),
      };
    }

    return {
      data: {
        ...data,
        variables: parseVariables(data.variables),
      } as Template,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating template", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to update template",
        undefined,
        err
      ),
    };
  }
}

/**
 * Delete a template
 *
 * @param id - Template ID to delete
 * @returns Success status
 *
 * @example
 * const { error } = await deleteTemplate('uuid-here');
 * if (!error) {
 *   console.log('Template deleted successfully');
 * }
 */
export async function deleteTemplate(
  id: string
): Promise<TemplateResult<{ success: boolean }>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new TemplateError("Template ID is required"),
      };
    }

    const { error } = await supabase
      .from("templates")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Error deleting template", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to delete template",
          error.code,
          error
        ),
      };
    }

    return {
      data: { success: true },
      error: null,
    };
  } catch (err) {
    logger.error("Error deleting template", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to delete template",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get a single template by ID
 *
 * @param id - Template ID
 * @returns The template
 *
 * @example
 * const { data, error } = await getTemplateById('uuid-here');
 */
export async function getTemplateById(
  id: string
): Promise<TemplateResult<Template>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new TemplateError("Template ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching template", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to fetch template",
          error.code,
          error
        ),
      };
    }

    return {
      data: {
        ...data,
        variables: parseVariables(data.variables),
      } as Template,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching template", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to fetch template",
        undefined,
        err
      ),
    };
  }
}

/**
 * Increment the usage count for a template
 *
 * @param id - Template ID
 * @returns The updated template with incremented usage_count
 *
 * @example
 * // When user applies a template
 * const { data, error } = await incrementTemplateUsageCount('uuid-here');
 * console.log(`Template used ${data?.usage_count} times`);
 */
export async function incrementTemplateUsageCount(
  id: string
): Promise<TemplateResult<Template>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new TemplateError("Template ID is required"),
      };
    }

    // First get current usage count
    const { data: current, error: fetchError } = await supabase
      .from("templates")
      .select("usage_count")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error("Error fetching template for usage increment", fetchError);
      return {
        data: null,
        error: new TemplateError(
          "Failed to fetch template",
          fetchError.code,
          fetchError
        ),
      };
    }

    // Increment usage count
    const newCount = (current?.usage_count || 0) + 1;

    const { data, error } = await supabase
      .from("templates")
      .update({ usage_count: newCount })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error incrementing template usage count", error);
      return {
        data: null,
        error: new TemplateError(
          "Failed to increment usage count",
          error.code,
          error
        ),
      };
    }

    return {
      data: {
        ...data,
        variables: parseVariables(data.variables),
      } as Template,
      error: null,
    };
  } catch (err) {
    logger.error("Error incrementing template usage count", err);
    return {
      data: null,
      error: new TemplateError(
        err instanceof Error ? err.message : "Failed to increment usage count",
        undefined,
        err
      ),
    };
  }
}

/**
 * Parse variables from database JSONB to typed array
 *
 * @param variables - Variables from database (JSON or array)
 * @returns Typed array of TemplateVariable
 */
function parseVariables(variables: unknown): TemplateVariable[] {
  if (!variables) {
    return [];
  }

  if (Array.isArray(variables)) {
    return variables.filter(
      (v): v is TemplateVariable =>
        typeof v === "object" &&
        v !== null &&
        typeof v.name === "string" &&
        typeof v.required === "boolean"
    );
  }

  return [];
}
