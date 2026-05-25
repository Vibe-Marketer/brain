export function buildWebhookUrl({
  destinationPath,
  pathToken,
}: {
  destinationPath: string;
  pathToken?: string | null;
}) {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
    ?.replace(/\/+$/, "");
  const functionsBase = supabaseUrl ? `${supabaseUrl}/functions/v1` : "";
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
      /\/+$/,
      "",
    ) || functionsBase;
  const cleanPath = destinationPath.replace(/^\/+|\/+$/g, "");
  const cleanToken = pathToken?.replace(/^\/+|\/+$/g, "");
  return [apiBase, cleanPath, cleanToken].filter(Boolean).join("/");
}
