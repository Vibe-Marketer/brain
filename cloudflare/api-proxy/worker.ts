/**
 * api.callvaultai.com — public API proxy.
 *
 * Routes:
 *   /                                       → mcp-server edge function (mcp.callvaultai.com only)
 *   /w/{workspace_uuid}                     → workspace-scoped mcp-server (mcp.callvaultai.com only)
 *   /mcp                                    → mcp-server edge function
 *   /mcp-register                           → mcp-oauth-register edge function
 *   /.well-known/oauth-protected-resource   → mcp-oauth-metadata?doc=protected-resource
 *   /.well-known/oauth-authorization-server → mcp-oauth-metadata?doc=authorization-server
 *   /.well-known/openid-configuration       → mcp-oauth-metadata?doc=openid-configuration
 *   /fireflies-webhook                      → fireflies-webhook edge function
 *   /auth/v1/*                              → Supabase Auth (transparent proxy)
 *   /v1/*                                  → callvault-api Edge Function (REST API)
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

// Headers we strip from the inbound request before forwarding.
// ISC-39: x-forwarded-for must be stripped here so attacker-supplied XFF chains
//   are removed before we rebuild a fresh value from CF-Connecting-IP below.
// ISC-43: x-forwarded-host must be stripped to prevent host-header injection.
const STRIP_REQUEST_HEADERS = [
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cf-worker",
  "x-forwarded-for",
  "x-forwarded-host",
];

// Allowlisted query params for /auth/v1/oauth/authorize — only these are
// forwarded to Supabase Auth to prevent redirect_to injection (ISC-41/42).
const OAUTH_ALLOWLISTED_PARAMS = [
  "client_id",
  "redirect_uri",
  "response_type",
  "code_challenge",
  "code_challenge_method",
  "state",
  "scope",
];

// Headers we strip from the outbound response. Supabase sets a few internal
// headers that aren't useful to MCP clients.
const STRIP_RESPONSE_HEADERS = ["x-sb-edge-region", "x-sb-gateway-version"];

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Resolve the target Supabase URL.
    let route = resolveTarget(url);
    if (!route) {
      return new Response("Not Found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // ISC-41/42: Filter query params on /auth/v1/oauth/authorize routes.
    // Only allowlisted OAuth params are forwarded; stripping anything else
    // (including redirect_to) prevents open-redirect / parameter injection
    // against Supabase Auth.
    if (url.pathname === "/auth/v1/oauth/authorize") {
      const filteredSearch = new URLSearchParams();
      for (const param of OAUTH_ALLOWLISTED_PARAMS) {
        const val = url.searchParams.get(param);
        if (val !== null) filteredSearch.set(param, val);
      }
      const filteredSearchStr = filteredSearch.toString();
      const separator = filteredSearchStr ? "?" : "";
      route = {
        target: `${SUPABASE_BASE}/auth/v1/oauth/authorize${separator}${filteredSearchStr}`,
        publicPath: route.publicPath,
      };
    }

    // Build the forwarded request: copy method/body, strip headers, point
    // at the target URL.
    const forwardHeaders = new Headers(request.headers);

    // ISC-39/ISC-40: Strip the inbound x-forwarded-for FIRST (removes any
    // attacker-supplied XFF chain), then rebuild it fresh from CF-Connecting-IP
    // (Cloudflare's authoritative client IP). This prevents IP-allowlist/rate-
    // limit bypass via a spoofed X-Forwarded-For header.
    // ISC-43: x-forwarded-host is also in STRIP_REQUEST_HEADERS to prevent
    // host-header injection.
    const realIp = request.headers.get("CF-Connecting-IP");
    for (const h of STRIP_REQUEST_HEADERS) forwardHeaders.delete(h);
    // After stripping, set a fresh, authoritative x-forwarded-for from CF-Connecting-IP.
    if (realIp) forwardHeaders.set("x-forwarded-for", realIp);

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
    forwardHeaders.set("x-callvault-public-path", route.publicPath);

    forwardHeaders.set("host", new URL(route.target).host);

    const forwarded = new Request(route.target, {
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
      console.error(`[api-proxy] upstream fetch failed: ${route.target} — ${message}`);

      // /mcp is a JSON-RPC endpoint → return a JSON-RPC error envelope so MCP
      // clients can parse it. /.well-known/* is plain JSON.
      const isJsonRpc = isMcpJsonRpcRoute(url);
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

    // ISC-123: Signal backward-compat deprecation on legacy MCP routes.
    // mcp.callvaultai.com (root / and /w/{uuid}) and api.callvaultai.com/mcp
    // are the legacy endpoints; the canonical per-workspace URL is
    // /mcp/w/{workspace_uuid} via api.callvaultai.com.
    if (isDeprecatedMcpRoute(url)) {
      responseHeaders.set("Deprecation", "true");
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

type ResolvedRoute = {
  target: string;
  publicPath: string;
};

function resolveTarget(url: URL): ResolvedRoute | null {
  // Canonical root MCP endpoint: https://mcp.callvaultai.com
  if (url.hostname === "mcp.callvaultai.com" && url.pathname === "/") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${url.search}`,
      publicPath: "/",
    };
  }

  // Canonical workspace MCP endpoint: https://mcp.callvaultai.com/w/{workspace_uuid}
  const rootWorkspaceMatch = url.pathname.match(/^\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (url.hostname === "mcp.callvaultai.com" && rootWorkspaceMatch) {
    const workspacePath = `/w/${rootWorkspaceMatch[1].toLowerCase()}`;
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${workspacePath}${url.search}`,
      publicPath: workspacePath,
    };
  }

  // /mcp and /mcp/* (including /mcp/w/{workspace_uuid}) → mcp-server function
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
    const tail = url.pathname.slice(4); // strip "/mcp"
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-server${tail}${url.search}`,
      publicPath: url.pathname,
    };
  }

  // /mcp-register → mcp-oauth-register function (RFC 7591 Dynamic Client Registration).
  // Advertised by mcp-oauth-metadata's registration_endpoint so MCP clients
  // (Claude Desktop, Cursor, ChatGPT, Perplexity) can register dynamically
  // without preconfigured client IDs.
  if (url.pathname === "/mcp-register") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-register${url.search}`,
      publicPath: url.pathname,
    };
  }

  // /.well-known/oauth-protected-resource → mcp-oauth-metadata?doc=protected-resource
  // /.well-known/oauth-authorization-server → mcp-oauth-metadata?doc=authorization-server
  if (url.pathname === "/.well-known/oauth-protected-resource") {
    const defaultResourcePath = url.hostname === "mcp.callvaultai.com" ? "/" : "/mcp";
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(defaultResourcePath)}`,
      publicPath: url.pathname,
    };
  }
  const rootWorkspaceProtectedResourceMatch = url.pathname.match(/^\/\.well-known\/oauth-protected-resource\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (rootWorkspaceProtectedResourceMatch) {
    const workspacePath = `/w/${rootWorkspaceProtectedResourceMatch[1].toLowerCase()}`;
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(workspacePath)}`,
      publicPath: url.pathname,
    };
  }
  if (url.pathname === "/.well-known/oauth-protected-resource/mcp") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent("/mcp")}`,
      publicPath: url.pathname,
    };
  }
  const workspaceProtectedResourceMatch = url.pathname.match(/^\/\.well-known\/oauth-protected-resource\/mcp\/w\/([0-9a-fA-F-]{36})(?:\/)?$/);
  if (workspaceProtectedResourceMatch) {
    const workspacePath = `/mcp/w/${workspaceProtectedResourceMatch[1].toLowerCase()}`;
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource&resource_path=${encodeURIComponent(workspacePath)}`,
      publicPath: url.pathname,
    };
  }
  if (url.pathname.startsWith("/.well-known/oauth-protected-resource/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=protected-resource`,
      publicPath: url.pathname,
    };
  }
  if (url.pathname === "/.well-known/oauth-authorization-server") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`,
      publicPath: url.pathname,
    };
  }
  if (url.pathname.startsWith("/.well-known/oauth-authorization-server/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=authorization-server`,
      publicPath: url.pathname,
    };
  }

  // OIDC Discovery 1.0 — enables ChatGPT and other clients to detect OIDC support
  if (url.pathname === "/.well-known/openid-configuration") {
    return {
      target: `${SUPABASE_BASE}/functions/v1/mcp-oauth-metadata?doc=openid-configuration`,
      publicPath: url.pathname,
    };
  }

  // /auth/v1/* → Supabase Auth (transparent proxy)
  // Enables vanity-domain auth URLs (api.callvaultai.com/auth/v1/oauth/authorize)
  // so MCP clients never see the raw Supabase project ref.
  if (url.pathname.startsWith("/auth/v1/")) {
    return {
      target: `${SUPABASE_BASE}${url.pathname}${url.search}`,
      publicPath: url.pathname,
    };
  }

  // /v1/* → callvault-api Edge Function (public REST API)
  // The callvault-api function strips the leading /functions/v1/callvault-api
  // prefix internally, so we forward the /v1/... path directly.
  // Must come AFTER /auth/v1/* to avoid catching auth routes.
  if (url.pathname === "/v1" || url.pathname.startsWith("/v1/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1/callvault-api${url.pathname}${url.search}`,
      publicPath: url.pathname,
    };
  }

  // /fireflies-webhook and /fireflies-webhook/:token → fireflies-webhook edge function
  if (url.pathname === "/fireflies-webhook" || url.pathname.startsWith("/fireflies-webhook/")) {
    return {
      target: `${SUPABASE_BASE}/functions/v1${url.pathname}${url.search}`,
      publicPath: url.pathname,
    };
  }

  // Logo — proxied from the Vercel-hosted public/ directory so op_logo_uri
  // in the OIDC discovery doc resolves on the api.callvaultai.com domain.
  if (url.pathname === "/logo.png") {
    return {
      target: "https://app.callvaultai.com/logo.png",
      publicPath: url.pathname,
    };
  }

  return null;
}

function isMcpJsonRpcRoute(url: URL): boolean {
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) return true;
  if (url.hostname !== "mcp.callvaultai.com") return false;
  if (url.pathname === "/") return true;
  return /^\/w\/[0-9a-fA-F-]{36}(?:\/)?$/.test(url.pathname);
}

// ISC-123: Returns true for legacy MCP endpoints that should carry a
// Deprecation: true response header as a backward-compat signal.
// Legacy: mcp.callvaultai.com (all paths) and api.callvaultai.com/mcp routes.
function isDeprecatedMcpRoute(url: URL): boolean {
  if (url.hostname === "mcp.callvaultai.com") return true;
  if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) return true;
  return false;
}
