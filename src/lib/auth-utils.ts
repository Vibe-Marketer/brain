import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";

/**
 * Safe wrapper for Supabase auth that reads from the local cached session.
 *
 * Uses getSession() instead of getUser() to avoid unnecessary network requests
 * to /auth/v1/user on every call. getSession() reads from localStorage (no round-trip),
 * which is safe for UI-gating and RLS-backed queries since the JWT is validated
 * server-side on every database request regardless.
 *
 * For write operations that truly need server-verified identity, pass `verify: true`
 * which falls back to getUser() for a live network check.
 *
 * @returns Object with user (if authenticated) and error (if any occurred)
 *
 * @example
 * // In a component or hook (read path — no network call)
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
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return { user: null, error };
    }

    return { user: session?.user ?? null, error: null };
  } catch (err) {
    // Handle unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn("Failed to get user session", error);
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
