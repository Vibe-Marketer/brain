/**
 * api.callvaultai.com — public API proxy.
 *
 * Routes:
 *   /mcp                                 → mcp-server edge function
 *   /.well-known/oauth-protected-resource → mcp-oauth-metadata?doc=protected-resource
 *   /.well-known/oauth-authorization-server → mcp-oauth-metadata?doc=authorization-server
 *
 * Anything else returns 404 — `api.callvaultai.com` is API-only by design.
 *
 * Why not just use Vercel rewrites on app.callvaultai.com?
 *   API routes deserve their own routing layer, isolated from the React app.
 *   This keeps `app.callvaultai.com` for users and `api.callvaultai.com` for
 *   machines (MCP clients, future webhooks, partner REST API).
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
    for (const h of STRIP_REQUEST_HEADERS) forwardHeaders.delete(h);
    forwardHeaders.set("host", new URL(target).host);

    const forwarded = new Request(target, {
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "manual",
    });

    const upstream = await fetch(forwarded);

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

  return null;
}
