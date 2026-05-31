function cleanBaseUrl(value: string | null | undefined): string | null {
  const cleaned = value?.trim().replace(/\/+$/, "");
  return cleaned || null;
}

export function getPublicWebhookBaseUrl(): string {
  const configured =
    cleanBaseUrl(Deno.env.get("PUBLIC_WEBHOOK_BASE_URL")) ||
    cleanBaseUrl(Deno.env.get("WEBHOOK_BASE_URL")) ||
    cleanBaseUrl(Deno.env.get("APP_URL"));

  if (configured) {
    return configured.endsWith("/api") ? configured : `${configured}/api`;
  }

  const supabaseUrl = cleanBaseUrl(Deno.env.get("SUPABASE_URL"));
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required to build webhook URLs.");
  }
  return `${supabaseUrl}/functions/v1`;
}

export function buildPublicWebhookUrl(
  destinationPath: string,
  pathToken?: string | null,
): string {
  const cleanPath = destinationPath.replace(/^\/+|\/+$/g, "");
  const cleanToken = pathToken?.replace(/^\/+|\/+$/g, "");
  return [getPublicWebhookBaseUrl(), cleanPath, cleanToken]
    .filter(Boolean)
    .join("/");
}
