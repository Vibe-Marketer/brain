/**
 * Canonical PKCE (RFC 7636) helper for all OAuth flows.
 *
 * Producing the same verifier + S256 challenge shape every provider expects:
 *   - verifier: 32 random bytes, base64url-encoded (~43 chars), URL-safe.
 *   - challenge: SHA-256(verifier), base64url-encoded.
 *
 * Read.ai and Grain both pin S256 + base64url; this is the single canonical
 * source so we never drift two implementations apart again.
 *
 * `_shared/grain-client.ts` re-exports this for backward compat — `grain-oauth-refresh`
 * and any pre-refactor importers still resolve the same function.
 */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64Url(new Uint8Array(digest)) };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
