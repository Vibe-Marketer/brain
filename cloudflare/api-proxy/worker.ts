/**
 * api.callvaultai.com — public API proxy.
 *
 * Routes:
 *   /mcp                                    → mcp-server edge function
 *   /mcp-register                           → mcp-oauth-register edge function
 *   /.well-known/oauth-protected-resource   → mcp-oauth-metadata?doc=protected-resource
 *   /.well-known/oauth-authorization-server → mcp-oauth-metadata?doc=authorization-server
 *   /.well-known/openid-configuration       → mcp-oauth-metadata?doc=openid-configuration
 *   /fireflies-webhook                      → fireflies-webhook edge function
 *   /auth/v1/*                              → Supabase Auth (transparent proxy)
 *   /logo.png                               → app.callvaultai.com/logo.png (proxy)
 *
 * Anything else returns 404 — `api.callvaultai.com` is API-only by design.
 *
 * What this proxy does:
 *   - Routes /mcp, /mcp-register, and /.well-known/* paths to their corresponding
 *     Supabase Edge Functions, rewriting Host so Supabase accepts the request.
 *   - Strips Cloudflare-internal request headers (CF-Connecting-IP, CF-Ray, …)
 *     and Supabase-internal response headers (X-Sb-Edge-Region, …).
 *   - Forwards X-Forwarded-Host / -Proto / -For so upstream functions can
 *     generate host-aware responses (OAuth metadata, WWW-Authenticate) and
 *     log real client IPs for abuse detection / audit.
 *   - Returns a structured 502 JSON envelope on upstream fetch errors instead
 *     of Cloudflare's generic HTML error page (JSON-RPC envelope for /mcp paths,
 *     plain JSON for /.well-known/*).
 *
 * Why not just use Vercel rewrites on app.callvaultai.com?
 *   API routes deserve their own routing layer, isolated from the React app.
 *   This keeps `app.callvaultai.com` for users and `api.callvaultai.com` for
 *   machines (MCP clients, future webhooks, partner REST API). As of the v2.2
 *   MCP debug session (.planning/debug/mcp-auth-and-tool-schema.md), this is
 *   the SOLE public surface for MCP — the legacy /api/mcp rewrites on
 *   app.callvaultai.com have been removed.
 */

const SUPABASE_BASE = "https://vltmrnjsubfzrgrtdqey.supabase.co";

// Headers we strip from the inbound request before forwarding. The proxy adds
// nothing of its own, so this is just defensive — Cloudflare's CF-* headers
// don't need to reach Supabase.
const STRIP_REQUEST_HEADERS = ["cf-connecting-ip", "cf-ipcountry", "cf-ray", "cf-visitor", "cf-worker"];

// Headers we strip from the outbound response. Supabase sets a few internal
// headers that aren't useful to MCP clients.
const STRIP_RESPONSE_HEADERS = ["x-sb-edge-region", "x-sb-gateway-version"];

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Resolve the target Supabase URL.
    const target = resolveTarget(url);
    if (!target) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Build the forwarded request: copy method/body, strip CF headers, point
    // at the target URL.
    const forwardHeaders = new Headers(request.headers);

    // Preserve the real client IP for upstream abuse detection / audit logs.
    // CF-Connecting-IP is Cloudflare's authoritative client IP. Append to any
    // existing X-Forwarded-For chain (RFC 7239 standard reverse-proxy pattern).
    const clientIp = forwardHeaders.get("cf-connecting-ip");
    if (clientIp) {
      const existingXff = forwardHeaders.get("x-forwarded-for");
      forwardHeaders.set("x-forwarded-for", existingXff ? `${existingXff}, ${clientIp}` : clientIp);
    }

    for (const h of STRIP_REQUEST_HEADERS) forwardHeaders.delete(h);

    // Tell the upstream which public host the client originally hit. Without this,
    // the upstream sees Host: <project>.supabase.co (because we rewrite Host below)
    // and can't generate host-aware responses (OAuth metadata, WWW-Authenticate, etc).
    //
    // NOTE: Supabase's CDN (Cloudflare in front of Supabase) STRIPS the standard
    // `X-Forwarded-Host` header before it reaches the Edge Function (verified
    // 2026-05-13 — the header arrives as "(none)" inside the function regardless
    // of what we set here). To work around that we ALSO set a custom-named header
    // `X-Callvault-Host` which Supabase doesn't strip. Both Supabase functions
    // (mcp-server, mcp-oauth-metadata) read this header to make their advertised
    // URLs host-aware.
    forwardHeaders.set("x-forwarded-host", url.hostname);
    forwardHeaders.set("x-forwarded-proto", url.protocol.replace(":", ""));
    forwardHeaders.set("x-callvault-host", url.hostname);

    forwardHeaders.set("host", new URL(target).host);

    const forwarded = new Request(target, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "manual",
    });

    let upstream: Response;
    try {
      upstream = await fetch(forwarded);
    } catch (err) {
      // NEVER log the request body or Authorization header. URL + error message only.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[api-proxy] upstream fetch failed: ${target} — ${message}`);

      // /mcp is a JSON-RPC endpoint → return a JSON-RPC error envelope so MCP
      // clients can parse it. /.well-known/* is plain JSON.
      const isJsonRpc = url.pathname === "/mcp" || url.pathname.startsWith("/mcp/");
      const errorBody = isJsonRpc
        ? {
            jsonrpc: "2.0",
            error: {
              code: -32603, // JSON-RPC internal error
              message: "Upstream proxy error",
              data: { upstream_status: 502 },
            },
            id: null,
          }
        : { error: "Upstream proxy error", upstream_status: 502 };

      return new Response(JSON.stringify(errorBody), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Pass response through, stripping internal headers.
    const responseHeaders = new Headers(upstream.headers);
    for (const h of STRIP_RESPONSE_HEADERS) responseHeaders.delete(h);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function resolveTarget(url: URL): string | null {
  // /mcp and /mcp/* → mcp-server function
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const tail = url.pathname.slice(4); // strip "/mcp"
    return `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`;
  }

  // /mcp-register → mcp-oauth-register function (RFC 7591 Dynamic Client Registration).
  // Advertised by mcp-oauth-metadata's registration_endpoint so MCP clients
  // (Claude Desktop, Cursor, ChatGPT, Perplexity) can register dynamically
  // without preconfigured client IDs.
  if (url.pathname === "/mcp-register") {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-register${url.search}`;
  }

  // /.well-known/oauth-protected-resource → mcp-oauth-metadata?doc=protected-resource
  // /.well-known/oauth-authorization-server → mcp-oauth-metadata?doc=authorization-server
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource`;
  }
  if (url.pathname.startsWith("/.well-known/oauth-protected-resource/")) {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource`;
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`;
  }
  if (url.pathname.startsWith("/.well-known/oauth-authorization-server/")) {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`;
  }

  // OIDC Discovery 1.0 — enables ChatGPT and other clients to detect OIDC support
  if (url.pathname === "/.well-known/openid-configuration") {
    return `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=openid-configuration`;
  }

  // /auth/v1/* → Supabase Auth (transparent proxy)
  // Enables vanity-domain auth URLs (api.callvaultai.com/auth/v1/oauth/authorize)
  // so MCP clients never see the raw Supabase project ref.
  if (url.pathname.startsWith("/auth/v1/")) {
    return `${SUPABASE_BASE}${url.pathname}${url.search}`;
  }
  // /fireflies-webhook and /fireflies-webhook/:token → fireflies-webhook edge function
  if (url.pathname === "/fireflies-webhook" || url.pathname.startsWith("/fireflies-webhook/")) {
    return `${SUPABASE_BASE}/functions/v1${url.pathname}${url.search}`;
  }

  // Logo — proxied from the Vercel-hosted public/ directory so op_logo_uri
  // in the OIDC discovery doc resolves on the api.callvaultai.com domain.
  if (url.pathname === "/logo.png") {
    return "https://app.callvaultai.com/logo.png";
  }

  return null;
}
