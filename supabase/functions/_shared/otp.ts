/**
 * Shared OTP helpers for the email-alias-verification flow (Phase 34, Plan 03,
 * IDENT-03).
 *
 * generateCode() draws from crypto.getRandomValues() (CSPRNG) -- never
 * Math.random(), which is not cryptographically secure and would make the
 * 6-digit code predictable/brute-forceable in practice (T-34-03-01).
 *
 * hashCode() is used so identity_alias_verifications.code_hash stores only a
 * SHA-256 digest at rest -- the plaintext code exists only in transit (the
 * Resend email) and the recipient's inbox, never in the database
 * (T-34-03-03).
 */

/** Generate a 6-digit numeric OTP code using a cryptographically secure RNG. */
export function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(arr[0] % 1_000_000).padStart(6, '0');
}

/** SHA-256 hash a code, returning a 64-char lowercase hex digest. */
export async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
