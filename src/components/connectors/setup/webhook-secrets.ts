/**
 * Cryptographically random webhook secrets, generated client-side for the
 * connector setup flow. These are previews / placeholders the user can
 * accept or replace before the adapter call mints the real persisted value.
 *
 * Both helpers use `crypto.getRandomValues` (Web Crypto, available in every
 * supported browser) and emit lowercase hex so they survive copy-paste through
 * any input field without surprise re-encoding.
 */

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 128-bit hex signing secret used as the default value for the webhook
 * "signing secret" field. Format: 32 lowercase hex chars.
 */
export function generateWebhookSigningSecret(): string {
  return randomHex(16);
}

/**
 * 128-bit hex path token used to make webhook URLs unguessable per source.
 * Prefixed with `ffwh_` (Fireflies webhook lineage) to mark it as a CallVault
 * generated token; the prefix is preserved verbatim by the backend.
 */
export function generateWebhookPathToken(): string {
  return `ffwh_${randomHex(16)}`;
}
