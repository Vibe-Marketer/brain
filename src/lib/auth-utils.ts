import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

/**
 * Safe wrapper for supabase.auth.getUser() that handles network errors gracefully.
 *
 * The raw `supabase.auth.getUser()` call can throw TypeErrors when there are
 * network issues, causing unhandled exceptions. This wrapper catches those
 * errors and returns a consistent result object.
 *
 * @returns Object with user (if authenticated) and error (if any occurred)
 *
 * @example
 * // In a component or hook
 * const { user, error } = await getSafeUser();
 * if (error) {
 *   logger.warn("Auth error", error);
 *   return;
 * }
 * if (!user) return; // Not authenticated
 *
 * // Proceed with user.id, user.email, etc.
 */
export async function getSafeUser(): Promise<{
  user: User | null;
  error: Error | null;
}> {
  try {
    const response = await supabase.auth.getUser();

    // Handle Supabase auth errors (invalid token, expired session, etc.)
    if (response.error) {
      return { user: null, error: response.error };
    }

    return { user: response.data?.user ?? null, error: null };
  } catch (err) {
    // Handle network errors, TypeErrors from failed destructuring, etc.
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to get user (network or auth error)", error);
    return { user: null, error };
  }
}

/**
 * Safe wrapper that throws if user is not authenticated.
 * Use this in mutation functions where authentication is required.
 *
 * @throws Error if user is not authenticated or if there's a network error
 * @returns The authenticated user
 *
 * @example
 * // In a mutation function
 * const user = await requireUser();
 * // If we get here, user is guaranteed to be authenticated
 */
export async function requireUser(): Promise<User> {
  const { user, error } = await getSafeUser();

  if (error) {
    throw new Error(`Authentication error: ${error.message}`);
  }

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user;
}
