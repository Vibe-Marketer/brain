/**
 * Content Items CRUD Functions
 *
 * Provides database operations for content items (posts and emails).
 * Uses authenticated Supabase client with RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import type {
  ContentItem,
  ContentItemInput,
  ContentItemFilters,
  ContentItemType,
  ContentItemStatus,
} from "@/types/content-hub";

/**
 * Error class for content items operations
 */
export class ContentItemsError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContentItemsError";
  }
}

/**
 * Result type for content items operations
 */
export interface ContentItemsResult<T> {
  data: T | null;
  error: ContentItemsError | null;
}

/**
 * Fetch content items with optional filters
 *
 * @param filters - Optional filters for content_type, status, and search
 * @returns Array of content items matching filters
 *
 * @example
 * // Fetch all items
 * const { data, error } = await fetchContentItems();
 *
 * // Fetch posts only
 * const { data, error } = await fetchContentItems({ content_type: 'post' });
 *
 * // Fetch drafts only
 * const { data, error } = await fetchContentItems({ status: 'draft' });
 */
export async function fetchContentItems(
  filters?: ContentItemFilters,
  bankId?: string | null
): Promise<ContentItemsResult<ContentItem[]>> {
  try {
    const user = await requireUser();
    if (!bankId) return { data: [], error: null };

    let query = supabase
      .from("content_items")
      .select("*")
      .eq("bank_id", bankId)
      .order("created_at", { ascending: false });

    // Apply content_type filter
    if (filters?.content_type) {
      query = query.eq("content_type", filters.content_type);
    }

    // Apply status filter
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    // Apply search filter (searches content_text and email_subject)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.or(`content_text.ilike.${searchTerm},email_subject.ilike.${searchTerm}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching content items", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to fetch content items",
          error.code,
          error
        ),
      };
    }

    return {
      data: (data || []) as ContentItem[],
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching content items", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to fetch content items",
        undefined,
        err
      ),
    };
  }
}

/**
 * Fetch only posts with optional filters
 *
 * @param filters - Optional filters for status and search
 * @returns Array of post content items
 *
 * @example
 * const { data, error } = await fetchPosts();
 * const { data, error } = await fetchPosts({ status: 'draft' });
 */
export async function fetchPosts(
  filters?: Omit<ContentItemFilters, "content_type">,
  bankId?: string | null
): Promise<ContentItemsResult<ContentItem[]>> {
  return fetchContentItems({ ...filters, content_type: "post" }, bankId);
}

/**
 * Fetch only emails with optional filters
 *
 * @param filters - Optional filters for status and search
 * @returns Array of email content items
 *
 * @example
 * const { data, error } = await fetchEmails();
 * const { data, error } = await fetchEmails({ status: 'used' });
 */
export async function fetchEmails(
  filters?: Omit<ContentItemFilters, "content_type">,
  bankId?: string | null
): Promise<ContentItemsResult<ContentItem[]>> {
  return fetchContentItems({ ...filters, content_type: "email" }, bankId);
}

/**
 * Create a new content item
 *
 * @param input - Content item data (content_type, content_text, optional hook_id, email_subject, status)
 * @returns The created content item
 *
 * @example
 * const { data, error } = await createContentItem({
 *   content_type: 'post',
 *   content_text: 'This is my social post...',
 *   hook_id: 'hook-uuid-here'
 * });
 */
export async function createContentItem(
  input: ContentItemInput,
  bankId?: string | null
): Promise<ContentItemsResult<ContentItem>> {
  try {
    const user = await requireUser();

    if (!bankId) {
      return {
        data: null,
        error: new ContentItemsError("Bank ID is required"),
      };
    }

    // Validate required fields
    if (!input.content_text?.trim()) {
      return {
        data: null,
        error: new ContentItemsError("Content text is required"),
      };
    }

    if (!input.content_type) {
      return {
        data: null,
        error: new ContentItemsError("Content type is required"),
      };
    }

    // Validate content length limits
    if (input.content_text.length > 50000) {
      return {
        data: null,
        error: new ContentItemsError("Content text must be 50,000 characters or less"),
      };
    }

    if (input.email_subject && input.email_subject.length > 255) {
      return {
        data: null,
        error: new ContentItemsError("Email subject must be 255 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("content_items")
      .insert({
        user_id: user.id,
        bank_id: bankId,
        hook_id: input.hook_id || null,
        content_type: input.content_type,
        content_text: input.content_text.trim(),
        email_subject: input.email_subject?.trim() || null,
        status: input.status || "draft",
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating content item", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to create content item",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error creating content item", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to create content item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update an existing content item
 *
 * @param id - Content item ID to update
 * @param updates - Partial updates to apply
 * @returns The updated content item
 *
 * @example
 * const { data, error } = await updateContentItem('uuid-here', {
 *   content_text: 'Updated content...',
 *   status: 'used'
 * });
 */
export async function updateContentItem(
  id: string,
  updates: Partial<Omit<ContentItem, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<ContentItemsResult<ContentItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentItemsError("Content item ID is required"),
      };
    }

    // Validate content_text length if provided
    if (updates.content_text !== undefined && updates.content_text.length > 50000) {
      return {
        data: null,
        error: new ContentItemsError("Content text must be 50,000 characters or less"),
      };
    }

    // Validate email_subject length if provided
    if (updates.email_subject !== undefined && updates.email_subject !== null && updates.email_subject.length > 255) {
      return {
        data: null,
        error: new ContentItemsError("Email subject must be 255 characters or less"),
      };
    }

    const { data, error } = await supabase
      .from("content_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating content item", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to update content item",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating content item", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to update content item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Delete a content item
 *
 * @param id - Content item ID to delete
 * @returns Success status
 *
 * @example
 * const { error } = await deleteContentItem('uuid-here');
 * if (!error) {
 *   console.log('Content item deleted successfully');
 * }
 */
export async function deleteContentItem(
  id: string
): Promise<ContentItemsResult<{ success: boolean }>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentItemsError("Content item ID is required"),
      };
    }

    const { error } = await supabase
      .from("content_items")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Error deleting content item", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to delete content item",
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
    logger.error("Error deleting content item", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to delete content item",
        undefined,
        err
      ),
    };
  }
}

/**
 * Mark a content item as used
 *
 * @param id - Content item ID
 * @returns The updated content item with status 'used' and used_at timestamp
 *
 * @example
 * const { data, error } = await markAsUsed('uuid-here');
 * console.log(`Content used at ${data?.used_at}`);
 */
export async function markAsUsed(
  id: string
): Promise<ContentItemsResult<ContentItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentItemsError("Content item ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("content_items")
      .update({
        status: "used" as ContentItemStatus,
        used_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error marking content item as used", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to mark content item as used",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error marking content item as used", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to mark content item as used",
        undefined,
        err
      ),
    };
  }
}

/**
 * Mark a content item as draft
 *
 * @param id - Content item ID
 * @returns The updated content item with status 'draft' and cleared used_at
 *
 * @example
 * const { data, error } = await markAsDraft('uuid-here');
 */
export async function markAsDraft(
  id: string
): Promise<ContentItemsResult<ContentItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentItemsError("Content item ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("content_items")
      .update({
        status: "draft" as ContentItemStatus,
        used_at: null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error marking content item as draft", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to mark content item as draft",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error marking content item as draft", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to mark content item as draft",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get a single content item by ID
 *
 * @param id - Content item ID
 * @returns The content item
 *
 * @example
 * const { data, error } = await getContentItemById('uuid-here');
 */
export async function getContentItemById(
  id: string
): Promise<ContentItemsResult<ContentItem>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new ContentItemsError("Content item ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("content_items")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching content item", error);
      return {
        data: null,
        error: new ContentItemsError(
          "Failed to fetch content item",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as ContentItem,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching content item", err);
    return {
      data: null,
      error: new ContentItemsError(
        err instanceof Error ? err.message : "Failed to fetch content item",
        undefined,
        err
      ),
    };
  }
}
