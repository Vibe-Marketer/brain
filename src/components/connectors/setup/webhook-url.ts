export function buildWebhookUrl({
  destinationPath,
  pathToken,
}: {
  destinationPath: string;
  pathToken?: string | null;
}) {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : "";
  const apiBase = getPublicWebhookBaseUrl() || functionsBase;
  const cleanPath = destinationPath.replace(/^\/+|\/+$/g, "");
  const cleanToken = pathToken?.replace(/^\/+|\/+$/g, "");
  return [apiBase, cleanPath, cleanToken].filter(Boolean).join("/");
}

function getPublicWebhookBaseUrl(): string {
  const configured =
    cleanBaseUrl(import.meta.env.VITE_PUBLIC_WEBHOOK_BASE_URL as string | undefined) ||
    cleanBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);

  if (configured) {
    return configured.endsWith("/api") ? configured : `${configured}/api`;
  }

  if (
    typeof window !== "undefined" &&
    !isLocalhost(window.location.hostname)
  ) {
    return `${window.location.origin.replace(/\/+$/, "")}/api`;
  }

  return "";
}

function cleanBaseUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}
