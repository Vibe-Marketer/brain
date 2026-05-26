/**
 * OAuth return-to storage helpers.
 *
 * When a user clicks "Connect <provider>" we hand off to the provider's OAuth
 * page and need to remember where to send them after the callback completes.
 * We store the return path in localStorage, keyed by the OAuth `state` value
 * when one is supplied (per-flow isolation) and falling back to a single
 * shared key when it isn't.
 *
 * Both helpers refuse to write anything that isn't a same-origin path under
 * one of the allowed app routes (`/import`, `/settings`, `/setup`), so a
 * compromised or stale `returnTo` cannot be used to redirect off-origin.
 */

const STORAGE_KEY = "oauthReturnTo";
const ALLOWED_ROUTES = ["/import", "/settings", "/setup"] as const;

/**
 * Validates a candidate return URL against the same-origin + allow-list rules
 * and returns the canonical `pathname + search + hash` string when it passes,
 * or `null` when it doesn't (URL parse failure, cross-origin, or route not on
 * the allow list).
 */
export function normalizeLocalReturnTo(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const allowedRoute = ALLOWED_ROUTES.some(
      (route) => url.pathname === route || url.pathname.startsWith(`${route}/`),
    );
    if (!allowedRoute) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Persists the return-to path for an in-flight OAuth flow. When `state` is
 * present the path is namespaced under `oauthReturnTo:<state>` so concurrent
 * OAuth flows in different tabs don't clobber each other. When `state` is
 * missing we fall back to the bare `oauthReturnTo` key for backwards
 * compatibility with adapters that don't surface state.
 */
export function storeOAuthReturnTo(
  state: string | undefined,
  returnTo: string,
): void {
  const safeReturnTo = normalizeLocalReturnTo(returnTo);
  if (!safeReturnTo) return;
  if (state) {
    localStorage.setItem(`${STORAGE_KEY}:${state}`, safeReturnTo);
    return;
  }
  localStorage.setItem(STORAGE_KEY, safeReturnTo);
}
