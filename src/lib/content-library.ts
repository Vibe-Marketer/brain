/**
 * Content Library CRUD Functions
 *
 * Provides database operations for content library items.
 * Uses authenticated Supabase client with RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import type {
  ContentLibraryItem,
  ContentLibraryInput,
  ContentLibraryFilters,
} from "@/types/content-library";

/**
 * Error class for content library operations
 */
export class ContentLibraryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContentLibraryError";
  }
}

/**
 * Result type for content library operations
 */
export interface ContentLibraryResult<T> {
  data: T | null;
  error: ContentLibraryError | null;
}

/**
 * Fetch content library items with optional filters
 *
 * @param filters - Optional filters for content_type, tags, and search
 * @returns Array of content library items matching filters
 *
 * @example
 * // Fetch all items
 * const { data, error } = await fetchContentItems();
 *
 * // Fetch emails only
 * const { data, error } = await fetchContentItems({ content_type: 'email' });
 *
 * // Fetch with tags
 * const { data, error } = await fetchContentItems({ tags: ['follow-up', 'important'] });
 */
export async function fetchContentItems(
  filters?: ContentLibraryFilters
): Promise<ContentLibraryResult<ContentLibraryItem[]>> {
  try {
    const user = await requireUser();

    let query = supabase
      .from("content_library")
      .select("*")
      .order("created_at", { ascending: false });

    // RLS handles user/team access, but we can add explicit user filter for clarity
    // The RLS policy already ensures users only see their own + team content

    // Apply content_type filter
    if (filters?.content_type) {
      query = query.eq("content_type", filters.content_type);
    }

    // Apply tags filter (items must contain ALL specified tags)
    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains("tags", filters.tags);
    }

    // Apply search filter (searches title and content)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(`title.ilike.${searchTerm},content.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching content library items", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to fetch content library items",
          error.code,
          error
        ),
      };
    }

    return {
      data: (data || []) as ContentLibraryItem[],
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching content library items", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to fetch content library items",
        undefined,
        err
      ),
    };
  }
}

/**
 * Save new content to the library
 *
 * @param input - Content to save (title, content, type, optional tags and metadata)
 * @returns The created content library item
 *
 * @example
 * const { data, error } = await saveContent({
 *   title: 'Follow-up Email Template',
 *   content: 'Thank you for meeting with us...',
 *   content_type: 'email',
 *   tags: ['follow-up', 'sales']
 * });
 */
export async function saveContent(
  input: ContentLibraryInput
): Promise<ContentLibraryResult<ContentLibraryItem>> {
  try {
    const user = await requireUser();

    // Validate required fields
    if (!input.title?.trim()) {
      return {
        data: null,
        error: new ContentLibraryError("Title is required"),
      };
    }

    if (!input.content?.trim()) {
      return {
        data: null,
        error: new ContentLibraryError("Content is required"),
      };
    }

    // Validate content length limits (matching database constraints)
    if (input.title.length > 255) {
      return {
        data: null,
        error: new ContentLibraryError("Title must be 255 characters or less"),
      };
    }

    if (input.content.length > 50000) {
      return {
        data: null,
        error: new ContentLibraryError("Content must be 50,000 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("content_library")
      .insert({
        user_id: user.id,
        content_type: input.content_type,
        title: input.title.trim(),
        content: input.content,
        tags: input.tags || [],
        metadata: input.metadata || {},
        team_id: input.team_id || null,
      })
      .select()
      .single();

    if (error) {
      logger.error("Error saving content to library", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to save content to library",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentLibraryItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error saving content to library", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to save content to library",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update an existing content library item
 *
 * @param id - Content item ID to update
 * @param updates - Partial updates to apply
 * @returns The updated content library item
 *
 * @example
 * const { data, error } = await updateContent('uuid-here', {
 *   title: 'Updated Title',
 *   tags: ['new-tag']
 * });
 */
export async function updateContent(
  id: string,
  updates: Partial<Omit<ContentLibraryItem, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<ContentLibraryResult<ContentLibraryItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentLibraryError("Content ID is required"),
      };
    }

    // Validate title length if provided
    if (updates.title !== undefined && updates.title.length > 255) {
      return {
        data: null,
        error: new ContentLibraryError("Title must be 255 characters or less"),
      };
    }

    // Validate content length if provided
    if (updates.content !== undefined && updates.content.length > 50000) {
      return {
        data: null,
        error: new ContentLibraryError("Content must be 50,000 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("content_library")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating content library item", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to update content library item",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentLibraryItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating content library item", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to update content library item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Delete a content library item
 *
 * @param id - Content item ID to delete
 * @returns Success status
 *
 * @example
 * const { error } = await deleteContent('uuid-here');
 * if (!error) {
 *   console.log('Content deleted successfully');
 * }
 */
export async function deleteContent(
  id: string
): Promise<ContentLibraryResult<{ success: boolean }>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentLibraryError("Content ID is required"),
      };
    }

    const { error } = await supabase
      .from("content_library")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Error deleting content library item", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to delete content library item",
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
    logger.error("Error deleting content library item", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to delete content library item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Increment the usage count for a content library item
 *
 * @param id - Content item ID
 * @returns The updated content library item with incremented usage_count
 *
 * @example
 * // When user copies content to clipboard
 * const { data, error } = await incrementUsageCount('uuid-here');
 * console.log(`Content used ${data?.usage_count} times`);
 */
export async function incrementUsageCount(
  id: string
): Promise<ContentLibraryResult<ContentLibraryItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentLibraryError("Content ID is required"),
      };
    }

    // First get current usage count
    const { data: current, error: fetchError } = await supabase
      .from("content_library")
      .select("usage_count")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error("Error fetching content library item for usage increment", fetchError);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to fetch content library item",
          fetchError.code,
          fetchError
        ),
      };
    }

    // Increment usage count
    const newCount = (current?.usage_count || 0) + 1;

    const { data, error } = await supabase
      .from("content_library")
      .update({ usage_count: newCount })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error incrementing usage count", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to increment usage count",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentLibraryItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error incrementing usage count", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to increment usage count",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get a single content library item by ID
 *
 * @param id - Content item ID
 * @returns The content library item
 *
 * @example
 * const { data, error } = await getContentById('uuid-here');
 */
export async function getContentById(
  id: string
): Promise<ContentLibraryResult<ContentLibraryItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentLibraryError("Content ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("content_library")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching content library item", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to fetch content library item",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentLibraryItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching content library item", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to fetch content library item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get all unique tags used across content library items
 *
 * @returns Array of unique tags
 *
 * @example
 * const { data: tags, error } = await getAllTags();
 * // tags: ['follow-up', 'sales', 'marketing', ...]
 */
export async function getAllTags(): Promise<ContentLibraryResult<string[]>> {
  try {
    const user = await requireUser();

    // Fetch all items and extract unique tags
    // Note: This could be optimized with a database function for large datasets
    const { data, error } = await supabase
      .from("content_library")
      .select("tags");

    if (error) {
      logger.error("Error fetching tags", error);
      return {
        data: null,
        error: new ContentLibraryError(
          "Failed to fetch tags",
          error.code,
          error
        ),
      };
    }

    // Extract unique tags from all items
    const allTags = new Set<string>();
    (data || []).forEach((item) => {
      if (item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => allTags.add(tag));
      }
    });

    return {
      data: Array.from(allTags).sort(),
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching tags", err);
    return {
      data: null,
      error: new ContentLibraryError(
        err instanceof Error ? err.message : "Failed to fetch tags",
        undefined,
        err
      ),
    };
  }
}
