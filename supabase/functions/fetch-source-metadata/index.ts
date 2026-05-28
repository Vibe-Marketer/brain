import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { authenticateRequest } from "../_shared/auth.ts";
import {
  mergeLoomMetadata,
  normalizeSupportedSourceUrl,
  parseGenericSourceMetadataHtml,
  parseLoomMetadataHtml,
} from "../_shared/loom-metadata.ts";

const MAX_HTML_BYTES = 1_000_000;
const FETCH_TIMEOUT_MS = 2500;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const authResult = await authenticateRequest(
    req,
    supabase as Parameters<typeof authenticateRequest>[1],
    corsHeaders,
  );
  if (authResult instanceof Response) return authResult;

  const body = await req.json().catch(() => ({}));
  const sourceUrl = typeof body?.source_url === "string" ? body.source_url : "";
  const normalized = normalizeSupportedSourceUrl(sourceUrl);
  if (!normalized) {
    return json({ error: "Unsupported source URL" }, 400, corsHeaders);
  }

  const [oembedResult, htmlResult] = await Promise.allSettled([
    normalized.oembedUrl ? fetchJson(normalized.oembedUrl) : Promise.resolve(null),
    fetchHtml(normalized.url),
  ]);

  const oembed = oembedResult.status === "fulfilled" ? oembedResult.value : null;
  const html = htmlResult.status === "fulfilled" ? htmlResult.value : "";
  const htmlMetadata = html
    ? normalized.sourceApp === "loom"
      ? parseLoomMetadataHtml(html, normalized.url, normalized.shareToken)
      : parseGenericSourceMetadataHtml(
          html,
          normalized.url,
          normalized.shareToken,
          normalized.providerName,
          normalized.sourceApp,
        )
    : {};
  const metadata = normalized.sourceApp === "loom"
    ? mergeLoomMetadata(normalized.url, normalized.shareToken, oembed, htmlMetadata)
    : {
        source_url: normalized.url,
        share_token: normalized.shareToken,
        source_app: normalized.sourceApp,
        provider_name: normalized.providerName,
        ...htmlMetadata,
      };

  if (!metadata.title && !metadata.thumbnail_url && !metadata.description) {
    return json({ error: "Source metadata unavailable" }, 422, corsHeaders);
  }

  return json({ success: true, data: metadata }, 200, {
    ...corsHeaders,
    "Cache-Control": "private, max-age=300",
  });
});

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "CallVaultBot/1.0 (+https://callvaultai.com)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`oEmbed HTTP ${res.status}`);
  return await res.json() as Record<string, unknown>;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "Accept": "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; CallVaultBot/1.0; +https://callvaultai.com)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Source page HTTP ${res.status}`);
  const contentLength = Number.parseInt(res.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_HTML_BYTES) throw new Error("Source page too large");
  const html = await res.text();
  return html.slice(0, MAX_HTML_BYTES);
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
