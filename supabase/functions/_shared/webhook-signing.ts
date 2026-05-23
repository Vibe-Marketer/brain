/**
 * Webhook signing helpers — HMAC-SHA256 signature compute + constant-time compare.
 *
 * Extracted from fireflies-webhook so the primitives are testable in isolation
 * and reusable by any future webhook handler that uses the GitHub-style
 * `X-Hub-Signature: sha256=<hex>` header convention.
 */

/**
 * Compute the GitHub-style HMAC-SHA256 signature for a raw request body.
 * Returns the value formatted exactly as it appears in the `X-Hub-Signature`
 * header: `sha256=<lowercase-hex>`.
 */
export async function computeHmacSha256Signature(
  rawBody: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256=${hex}`;
}

/**
 * Constant-time string comparison. Returns true iff `a` and `b` are equal.
 * Short-circuits on length mismatch — only the *length* of the expected
 * signature is leaked, which is constant (always 71 chars for `sha256=<64 hex>`),
 * so no exploitable timing channel.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
