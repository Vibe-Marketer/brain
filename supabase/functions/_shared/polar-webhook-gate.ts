/** HTTP-level Polar webhook gates, before signature verification. */
export function polarWebhookHttpGate(
  method: string,
  secret: string | undefined,
): { status: number; error: string } | null {
  if (method !== "POST") {
    return { status: 405, error: "Method not allowed" };
  }
  if (!secret) {
    return { status: 500, error: "Webhook secret not configured" };
  }
  return null;
}
