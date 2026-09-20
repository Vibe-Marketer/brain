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
/**
 * Zoom webhook HMAC-SHA256. Zoom signs `v0:{timestamp}:{body}` and sends
 * `x-zm-signature: v0=<hex>` — hex, not base64, and not the GitHub
 * `sha256=` prefix Fireflies uses.
 */
export async function computeZoomWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
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
    encoder.encode(`v0:${timestamp}:${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `v0=${hex}`;
}

export async function verifyZoomWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const expected = await computeZoomWebhookSignature(secret, timestamp, rawBody);
  return timingSafeEqualString(expected, signature);
}

/** Zoom URL-validation challenge: HMAC-SHA256(plainToken) as lowercase hex. */
export async function generateZoomChallengeResponse(
  plainToken: string,
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
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(plainToken));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
