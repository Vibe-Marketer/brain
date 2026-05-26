import * as React from "react";

export interface ExclusiveMutationHandle {
  /**
   * Attempts to acquire the lock. Returns a unique mutation token when the
   * lock was idle (caller MUST eventually call `finish(token)`), or `null`
   * when another mutation is already running and the caller should bail out
   * without side effects.
   */
  tryStart: () => symbol | null;
  /**
   * Releases the lock. Returns `true` when the token matched the current
   * holder (the caller can safely reset its own `saving`/`disconnecting`
   * state), or `false` when the token has been superseded (another mutation
   * has already claimed the lock — caller should NOT touch shared state).
   */
  finish: (token: symbol) => boolean;
}

/**
 * Single-flight mutex for React event handlers. Prevents overlapping
 * save / disconnect / OAuth-start handlers from racing each other and
 * stomping shared state (saving=true, lastError, webhookDetails) when a user
 * double-clicks or fires multiple handlers in quick succession.
 *
 * Usage pattern in handlers:
 *
 *   const mutation = lock.tryStart();
 *   if (!mutation) return;            // another mutation in flight
 *   setSaving(true);
 *   try {
 *     await doWork();
 *   } finally {
 *     if (lock.finish(mutation)) setSaving(false);
 *   }
 *
 * The token-based design lets us tell whether we're still the "current"
 * mutation when an async call resolves out of order, which a plain boolean
 * flag cannot express.
 */
export function useExclusiveMutation(): ExclusiveMutationHandle {
  const ref = React.useRef<symbol | null>(null);

  const tryStart = React.useCallback((): symbol | null => {
    if (ref.current) return null;
    const token = Symbol("connector-mutation");
    ref.current = token;
    return token;
  }, []);

  const finish = React.useCallback((token: symbol): boolean => {
    if (ref.current !== token) return false;
    ref.current = null;
    return true;
  }, []);

  return React.useMemo(() => ({ tryStart, finish }), [tryStart, finish]);
}
