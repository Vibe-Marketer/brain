/** Shared Cloudflare-worker bypass check. Missing or mismatched secret → deny. */
export function internalSecretDenied(
  configured: string | undefined,
  incoming: string | null,
): boolean {
  return !configured || !incoming || incoming !== configured;
}
