/**
 * Guard for navigation- / unmount-cancelled fetch aborts.
 *
 * Returns `true` ONLY when BOTH conditions hold:
 *   1. The supplied AbortSignal was aborted by our own code — i.e. a component
 *      cleanup / superseding navigation called `controller.abort()`, so
 *      `signal.aborted === true`.
 *   2. The error is an AbortError: a DOMException/Error named "AbortError", or a
 *      supabase-js-wrapped fetch rejection whose message is the name-prefixed
 *      form "AbortError: ...". (postgrest-js builds the returned error message as
 *      `${fetchError.name}: ${fetchError.message}`, so an aborted fetch surfaces
 *      as a message beginning with "AbortError".)
 *
 * This is deliberately NOT a broad abort/network catch-all. It will not match
 * real network or security failures such as "TypeError: Failed to fetch" — those
 * must still be logged, even if they happen to arrive after the signal aborted.
 * The `signal.aborted` gate ensures we only ever swallow an abort that WE caused.
 */
export function isNavigationAbort(
  error: unknown,
  signal?: AbortSignal | null,
): boolean {
  // Only swallow aborts that we triggered ourselves (navigation / unmount).
  if (!signal?.aborted) return false;
  return isAbortError(error);
}

/**
 * True when `error` is an aborted-fetch rejection — a DOMException/Error named
 * "AbortError", or a supabase-js-wrapped rejection whose message begins
 * "AbortError". Unlike {@link isNavigationAbort} this does NOT require a signal:
 * any abort surfacing through a fetch is a cancellation, never a real failure.
 * Used by the debug-panel network interceptor to keep cancelled requests
 * (React Query supersession, navigation, unmount) out of the error log.
 */
export function isAbortError(error: unknown): boolean {
  if (error == null) return false;

  // Native abort: DOMException / Error whose name is exactly "AbortError".
  if (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return true;
  }

  if (typeof error === "object") {
    const e = error as { name?: unknown; message?: unknown };
    if (e.name === "AbortError") return true;
    // supabase-js wraps a rejected fetch as { message: `${err.name}: ${err.message}` },
    // so an aborted request surfaces with a message beginning "AbortError".
    if (typeof e.message === "string" && /^AbortError\b/.test(e.message)) {
      return true;
    }
  }

  return false;
}
