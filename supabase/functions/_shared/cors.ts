// Default allowed origins — used when ALLOWED_ORIGINS env var is not set.
// Includes production domains and common local dev ports.
const DEFAULT_ORIGINS = [
  'https://app.callvaultai.com',
  'https://test.callvaultai.com',
  'https://brain-sable-kappa.vercel.app',
  'http://localhost:3001',
  'http://localhost:8080',
  'http://localhost:5173',
];

const rawOrigins = Deno.env.get('ALLOWED_ORIGINS')
  ?.split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = rawOrigins && rawOrigins.length > 0 ? rawOrigins : DEFAULT_ORIGINS;

// Static default headers for imports that don't have access to the request origin.
// Prefer getCorsHeaders(requestOrigin) in handlers where the request is available.
export const corsHeaders = getCorsHeaders();

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  // Default to first allowed origin (never wildcard)
  let origin = allowedOrigins[0];

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    // Echo back the request origin if it's in our allow list
    origin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

/**
 * PUBLIC CORS — wildcard Access-Control-Allow-Origin for endpoints that serve
 * world-readable content (OAuth/OIDC discovery docs, public DCR endpoint, the
 * MCP JSON-RPC endpoint itself). Use ONLY for endpoints where:
 *
 *   (a) the response body contains NO auth-protected content (auth is enforced
 *       at the bearer-token layer, not the CORS layer), AND
 *   (b) the spec mandates world-readable discovery (RFC 9728 §3, RFC 8414 §3,
 *       OIDC Discovery 1.0 §4, RFC 7591 §3).
 *
 * Why this matters: browser-based MCP clients (Perplexity at www.perplexity.ai,
 * ChatGPT at chat.openai.com, future web wallets, etc.) call our discovery /
 * registration / MCP endpoints from inside the browser. If we return
 * `Access-Control-Allow-Origin: https://app.callvaultai.com`, the browser
 * blocks them from reading the response body and they bail with generic
 * "registration failed" / "DCR_CLIENT_SECRET_REQUIRED" errors that look like
 * server bugs but are really browser-enforced CORS rejections.
 *
 * Notion, Linear, GitHub, and every other production MCP server set `*` on
 * these endpoints for exactly this reason.
 *
 * Credentials note: `Access-Control-Allow-Origin: *` is incompatible with
 * `credentials: include` on the client side — but MCP clients send the bearer
 * token via the `Authorization: Bearer <token>` header (not cookies), which
 * works fine with `*`. The browser allows `Authorization` headers on no-cors-
 * compatible cross-origin requests as long as the header is in the
 * Allow-Headers list (which it is, below).
 *
 * Do NOT use this on endpoints that read/write user data via Supabase session
 * cookies — keep those locked to the allowlisted app origins.
 *
 * See: .planning/debug/resolved/mcp-cors-blocking-browser-clients.md
 */
export function getPublicCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // Expose WWW-Authenticate so browser JS can read it from the 401 response
    // and extract the resource_metadata URL for RFC 9728 discovery. Without
    // this, browsers hide every non-CORS-safelisted response header from JS,
    // which would silently break the OAuth-discovery dance for web clients
    // (Perplexity, ChatGPT web).
    'Access-Control-Expose-Headers': 'WWW-Authenticate',
    // Vary: Origin is irrelevant when serving the same `*` to all origins, but
    // including it is harmless and keeps any downstream cache consistent.
    'Vary': 'Origin',
  };
}
