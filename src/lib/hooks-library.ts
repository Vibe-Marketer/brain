/**
 * Hooks Library CRUD Functions
 *
 * Provides database operations for hooks library items.
 * Uses authenticated Supabase client with RLS policies.
 */

import { supabase } from "@/integrations/supabase/client";
import { requireUser } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import type {
  Hook,
  HookInput,
  HookFilters,
  HookStatus,
} from "@/types/content-hub";

/**
 * Error class for hooks library operations
 */
export class HooksLibraryError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "HooksLibraryError";
  }
}

/**
 * Result type for hooks library operations
 */
export interface HooksLibraryResult<T> {
  data: T | null;
  error: HooksLibraryError | null;
}

/**
 * Fetch hooks with optional filters
 *
 * @param filters - Optional filters for emotion_category, virality_score, status, is_starred, and search
 * @returns Array of hooks matching filters
 *
 * @example
 * // Fetch all hooks
 * const { data, error } = await fetchHooks();
 *
 * // Fetch starred hooks only
 * const { data, error } = await fetchHooks({ is_starred: true });
 *
 * // Fetch with emotion category filter
 * const { data, error } = await fetchHooks({ emotion_category: 'anger_outrage' });
 */
export async function fetchHooks(
  filters?: HookFilters
): Promise<HooksLibraryResult<Hook[]>> {
  try {
    const user = await requireUser();

    let query = supabase
      .from("hooks")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply emotion_category filter
    if (filters?.emotion_category) {
      query = query.eq("emotion_category", filters.emotion_category);
    }

    // Apply virality_score range filters
    if (filters?.virality_score_min !== undefined && filters?.virality_score_min !== null) {
      query = query.gte("virality_score", filters.virality_score_min);
    }
    if (filters?.virality_score_max !== undefined && filters?.virality_score_max !== null) {
      query = query.lte("virality_score", filters.virality_score_max);
    }

    // Apply topic_hint filter
    if (filters?.topic_hint) {
      query = query.ilike("topic_hint", `%${filters.topic_hint}%`);
    }

    // Apply is_starred filter
    if (filters?.is_starred !== undefined && filters?.is_starred !== null) {
      query = query.eq("is_starred", filters.is_starred);
    }

    // Apply status filter
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    // Apply search filter (searches hook_text)
    if (filters?.search && filters.search.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      query = query.ilike("hook_text", searchTerm);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("Error fetching hooks", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to fetch hooks",
          error.code,
          error
        ),
      };
    }

    return {
      data: (data || []) as Hook[],
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching hooks", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to fetch hooks",
        undefined,
        err
      ),
    };
  }
}

/**
 * Create a new hook
 *
 * @param input - Hook data to create
 * @returns The created hook
 *
 * @example
 * const { data, error } = await createHook({
 *   hook_text: 'Are you still manually...',
 *   emotion_category: 'anger_outrage',
 *   virality_score: 4
 * });
 */
export async function createHook(
  input: HookInput
): Promise<HooksLibraryResult<Hook>> {
  try {
    const user = await requireUser();

    // Validate required fields
    if (!input.hook_text?.trim()) {
      return {
        data: null,
        error: new HooksLibraryError("Hook text is required"),
      };
    }

    // Validate hook_text length (reasonable limit)
    if (input.hook_text.length > 1000) {
      return {
        data: null,
        error: new HooksLibraryError("Hook text must be 1000 characters or less"),
      };
    }

    // Validate virality_score range if provided
    if (input.virality_score !== undefined && input.virality_score !== null) {
      if (input.virality_score < 1 || input.virality_score > 5) {
        return {
          data: null,
          error: new HooksLibraryError("Virality score must be between 1 and 5"),
        };
      }
    }

    const { data, error } = await supabase
      .from("hooks")
      .insert({
        user_id: user.id,
        recording_id: input.recording_id || null,
        hook_text: input.hook_text.trim(),
        insight_ids: input.insight_ids || [],
        emotion_category: input.emotion_category || null,
        virality_score: input.virality_score || null,
        topic_hint: input.topic_hint || null,
        is_starred: input.is_starred || false,
        status: input.status || "generated",
      })
      .select()
      .single();

    if (error) {
      logger.error("Error creating hook", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to create hook",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as Hook,
      error: null,
    };
  } catch (err) {
    logger.error("Error creating hook", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to create hook",
        undefined,
        err
      ),
    };
  }
}

/**
 * Batch create multiple hooks (for Agent 3)
 *
 * @param inputs - Array of hook data to create
 * @returns Array of created hooks
 *
 * @example
 * const { data, error } = await batchCreateHooks([
 *   { hook_text: 'Hook 1...', emotion_category: 'anger_outrage' },
 *   { hook_text: 'Hook 2...', emotion_category: 'awe_surprise' }
 * ]);
 */
export async function batchCreateHooks(
  inputs: HookInput[]
): Promise<HooksLibraryResult<Hook[]>> {
  try {
    const user = await requireUser();

    if (!inputs || inputs.length === 0) {
      return {
        data: [],
        error: null,
      };
    }

    // Validate all inputs
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (!input.hook_text?.trim()) {
        return {
          data: null,
          error: new HooksLibraryError(`Hook text is required for hook at index ${i}`),
        };
      }
      if (input.hook_text.length > 1000) {
        return {
          data: null,
          error: new HooksLibraryError(`Hook text must be 1000 characters or less for hook at index ${i}`),
        };
      }
      if (input.virality_score !== undefined && input.virality_score !== null) {
        if (input.virality_score < 1 || input.virality_score > 5) {
          return {
            data: null,
            error: new HooksLibraryError(`Virality score must be between 1 and 5 for hook at index ${i}`),
          };
        }
      }
    }

    // Prepare batch insert data
    const insertData = inputs.map((input) => ({
      user_id: user.id,
      recording_id: input.recording_id || null,
      hook_text: input.hook_text.trim(),
      insight_ids: input.insight_ids || [],
      emotion_category: input.emotion_category || null,
      virality_score: input.virality_score || null,
      topic_hint: input.topic_hint || null,
      is_starred: input.is_starred || false,
      status: input.status || "generated",
    }));

    const { data, error } = await supabase
      .from("hooks")
      .insert(insertData)
      .select();

    if (error) {
      logger.error("Error batch creating hooks", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to batch create hooks",
          error.code,
          error
        ),
      };
    }

    return {
      data: (data || []) as Hook[],
      error: null,
    };
  } catch (err) {
    logger.error("Error batch creating hooks", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to batch create hooks",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update an existing hook
 *
 * @param id - Hook ID to update
 * @param updates - Partial updates to apply
 * @returns The updated hook
 *
 * @example
 * const { data, error } = await updateHook('uuid-here', {
 *   hook_text: 'Updated hook text',
 *   status: 'selected'
 * });
 */
export async function updateHook(
  id: string,
  updates: Partial<Omit<Hook, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<HooksLibraryResult<Hook>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new HooksLibraryError("Hook ID is required"),
      };
    }

    // Validate hook_text length if provided
    if (updates.hook_text !== undefined && updates.hook_text.length > 1000) {
      return {
        data: null,
        error: new HooksLibraryError("Hook text must be 1000 characters or less"),
      };
    }

    // Validate virality_score range if provided
    if (updates.virality_score !== undefined && updates.virality_score !== null) {
      if (updates.virality_score < 1 || updates.virality_score > 5) {
        return {
          data: null,
          error: new HooksLibraryError("Virality score must be between 1 and 5"),
        };
      }
    }

    const { data, error } = await supabase
      .from("hooks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating hook", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to update hook",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as Hook,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating hook", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to update hook",
        undefined,
        err
      ),
    };
  }
}

/**
 * Delete a hook
 *
 * @param id - Hook ID to delete
 * @returns Success status
 *
 * @example
 * const { error } = await deleteHook('uuid-here');
 * if (!error) {
 *   console.log('Hook deleted successfully');
 * }
 */
export async function deleteHook(
  id: string
): Promise<HooksLibraryResult<{ success: boolean }>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new HooksLibraryError("Hook ID is required"),
      };
    }

    const { error } = await supabase
      .from("hooks")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("Error deleting hook", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to delete hook",
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
    logger.error("Error deleting hook", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to delete hook",
        undefined,
        err
      ),
    };
  }
}

/**
 * Toggle the is_starred status of a hook
 *
 * @param id - Hook ID to toggle star
 * @returns The updated hook
 *
 * @example
 * const { data, error } = await toggleHookStar('uuid-here');
 * console.log(`Hook is now ${data?.is_starred ? 'starred' : 'unstarred'}`);
 */
export async function toggleHookStar(
  id: string
): Promise<HooksLibraryResult<Hook>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new HooksLibraryError("Hook ID is required"),
      };
    }

    // First get current is_starred status
    const { data: current, error: fetchError } = await supabase
      .from("hooks")
      .select("is_starred")
      .eq("id", id)
      .single();

    if (fetchError) {
      logger.error("Error fetching hook for star toggle", fetchError);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to fetch hook",
          fetchError.code,
          fetchError
        ),
      };
    }

    // Toggle is_starred
    const newStarred = !current?.is_starred;

    const { data, error } = await supabase
      .from("hooks")
      .update({ is_starred: newStarred })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error toggling hook star", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to toggle hook star",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as Hook,
      error: null,
    };
  } catch (err) {
    logger.error("Error toggling hook star", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to toggle hook star",
        undefined,
        err
      ),
    };
  }
}

/**
 * Update the status of a hook
 *
 * @param id - Hook ID to update status
 * @param status - New status ('generated' | 'selected' | 'archived')
 * @returns The updated hook
 *
 * @example
 * const { data, error } = await updateHookStatus('uuid-here', 'selected');
 */
export async function updateHookStatus(
  id: string,
  status: HookStatus
): Promise<HooksLibraryResult<Hook>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new HooksLibraryError("Hook ID is required"),
      };
    }

    if (!status) {
      return {
        data: null,
        error: new HooksLibraryError("Status is required"),
      };
    }

    // Validate status value
    const validStatuses: HookStatus[] = ["generated", "selected", "archived"];
    if (!validStatuses.includes(status)) {
      return {
        data: null,
        error: new HooksLibraryError(
          `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        ),
      };
    }

    const { data, error } = await supabase
      .from("hooks")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Error updating hook status", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to update hook status",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as Hook,
      error: null,
    };
  } catch (err) {
    logger.error("Error updating hook status", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to update hook status",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get a single hook by ID
 *
 * @param id - Hook ID
 * @returns The hook
 *
 * @example
 * const { data, error } = await getHookById('uuid-here');
 */
export async function getHookById(
  id: string
): Promise<HooksLibraryResult<Hook>> {
  try {
    if (!id) {
      return {
        data: null,
        error: new HooksLibraryError("Hook ID is required"),
      };
    }

    const { data, error } = await supabase
      .from("hooks")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      logger.error("Error fetching hook", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to fetch hook",
          error.code,
          error
        ),
      };
    }

    return {
      data: data as Hook,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching hook", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to fetch hook",
        undefined,
        err
      ),
    };
  }
}

/**
 * Get all unique topic hints used across hooks
 *
 * @returns Array of unique topic hints
 *
 * @example
 * const { data: topics, error } = await getAllTopicHints();
 * // topics: ['pricing', 'onboarding', 'pain-points', ...]
 */
export async function getAllTopicHints(): Promise<HooksLibraryResult<string[]>> {
  try {
    const user = await requireUser();

    // Fetch all hooks and extract unique topic_hints
    const { data, error } = await supabase
      .from("hooks")
      .select("topic_hint")
      .not("topic_hint", "is", null);

    if (error) {
      logger.error("Error fetching topic hints", error);
      return {
        data: null,
        error: new HooksLibraryError(
          "Failed to fetch topic hints",
          error.code,
          error
        ),
      };
    }

    // Extract unique topic hints
    const topicHints = new Set<string>();
    (data || []).forEach((item) => {
      if (item.topic_hint) {
        topicHints.add(item.topic_hint);
      }
    });

    return {
      data: Array.from(topicHints).sort(),
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching topic hints", err);
    return {
      data: null,
      error: new HooksLibraryError(
        err instanceof Error ? err.message : "Failed to fetch topic hints",
        undefined,
        err
      ),
    };
  }
}
