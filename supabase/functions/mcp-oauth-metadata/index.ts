import { getPublicCorsHeaders } from '../_shared/cors.ts';

/**
 * MCP OAuth Metadata — serves well-known OAuth / OIDC discovery documents
 *
 * Handles three discovery endpoints:
 *   /.well-known/oauth-protected-resource    (RFC 9728) — points clients to the auth server
 *   /.well-known/oauth-authorization-server   (RFC 8414) — full OAuth 2.1 server metadata
 *   /.well-known/openid-configuration         (OIDC Discovery 1.0) — OIDC provider metadata
 *
 * These endpoints tell MCP clients (Claude Desktop, Cursor, ChatGPT, etc.) how to
 * authenticate. The actual OAuth server is Supabase Auth — we just publish the metadata.
 *
 * HOST-AWARE (v2.2 — 2026-05-13): The MCP server is exposed on TWO hostnames:
 *   - api.callvaultai.com (original, used by Claude Code)
 *   - mcp.callvaultai.com (added to bypass Perplexity's cached failure of api.*)
 * Both route to the same Cloudflare Worker → same Supabase functions. The worker
 * forwards the original hostname via X-Forwarded-Host so every advertised URL
 * (resource, authorization_endpoint, token_endpoint, registration_endpoint,
 * jwks_uri, etc.) reflects the host the client originally hit.
 *
 * The earlier "single canonical URL" comment (Phase 26 dead-code lesson) still
 * applies in spirit: we don't try to be clever based on Vercel hostnames or
 * arbitrary unknown hosts — we only emit URLs for the ALLOWED public surfaces
 * the worker is bound to.
 *
 * See `.planning/debug/resolved/mcp-perplexity-still-failing-after-fixes.md`
 * and `.planning/debug/mcp-auth-and-tool-schema.md`.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://vltmrnjsubfzrgrtdqey.supabase.co';

// The two public hostnames the Cloudflare Worker routes to this stack. Any
// inbound X-Forwarded-Host not in this set falls back to api.callvaultai.com
// (defensive — we never advertise an arbitrary host we don't own).
const ALLOWED_HOSTS = new Set(['api.callvaultai.com', 'mcp.callvaultai.com']);
const FALLBACK_HOST = 'api.callvaultai.com';

function resolveOriginHost(req: Request): string {
  // Prefer X-Callvault-Host (custom header — Supabase's CDN strips the
  // standard X-Forwarded-Host before it reaches the function). Fall back to
  // X-Forwarded-Host just in case the function is ever invoked from a runtime
  // that doesn't strip it (e.g., direct curl + a custom CDN config).
  const headerValue =
    req.headers.get('x-callvault-host') ?? req.headers.get('x-forwarded-host');
  const fwd = headerValue?.split(',')[0]?.trim();
  if (fwd && ALLOWED_HOSTS.has(fwd)) return fwd;
  return FALLBACK_HOST;
}

function resolveProtectedResourcePath(url: URL): string | null {
  const resourcePathParam = url.searchParams.get('resource_path');
  if (resourcePathParam) {
    const normalized = resourcePathParam.startsWith('/')
      ? resourcePathParam
      : `/${resourcePathParam}`;
    const normalizedPath = normalizeProtectedResourcePath(normalized);
    if (normalizedPath) return normalizedPath;
  }

  const rootWorkspaceFromPath = url.pathname.match(/\/mcp-oauth-metadata\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (rootWorkspaceFromPath) return `/w/${rootWorkspaceFromPath[1].toLowerCase()}`;

  const fromPath = url.pathname.match(/\/mcp-oauth-metadata\/mcp\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (fromPath) return `/mcp/w/${fromPath[1].toLowerCase()}`;
  return null;
}

function normalizeProtectedResourcePath(path: string): string | null {
  if (path === '/' || path === '/mcp') return path;

  const rootWorkspaceMatch = path.match(/^\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (rootWorkspaceMatch) return `/w/${rootWorkspaceMatch[1].toLowerCase()}`;

  const legacyWorkspaceMatch = path.match(/^\/mcp\/w\/([0-9a-fA-F-]{36})(?:\/|$)/);
  if (legacyWorkspaceMatch) return `/mcp/w/${legacyWorkspaceMatch[1].toLowerCase()}`;

  return null;
}

Deno.serve(async (req) => {
  // PUBLIC CORS — these endpoints are RFC 9728 / RFC 8414 / OIDC Discovery
  // world-readable discovery documents. Browser-based MCP clients (Perplexity,
  // ChatGPT web, etc.) fetch them from their own origin. Locking these to the
  // app.callvaultai.com allowlist breaks every non-Claude-Desktop client and
  // surfaces as misleading "DCR_CLIENT_SECRET_REQUIRED" errors at the wizard.
  // See `.planning/debug/resolved/mcp-cors-blocking-browser-clients.md`.
  const corsHeaders = getPublicCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Resolve which public host the client originally hit (X-Forwarded-Host set
  // by the Cloudflare Worker proxy). All advertised URLs are built off this host.
  const host = resolveOriginHost(req);
  const canonicalOrigin = `https://${host}`;
  // Determine which document to serve. Vercel rewrites pass ?doc= query param
  // since the original path is stripped during proxying.
  const url = new URL(req.url);
  const doc = url.searchParams.get('doc') || 'authorization-server';
  const protectedResourcePath = resolveProtectedResourcePath(url);
  // Default to the legacy /mcp resource unless the Worker passes an explicit
  // resource_path. This keeps existing clients safe while allowing the root
  // mcp.callvaultai.com endpoint to become canonical after the Worker deploy.
  const defaultResourcePath = '/mcp';
  const canonicalResourcePath = protectedResourcePath ?? defaultResourcePath;
  const canonicalResource = canonicalResourcePath === '/'
    ? canonicalOrigin
    : `${canonicalOrigin}${canonicalResourcePath}`;

  // RFC 9728: OAuth Protected Resource Metadata
  // authorization_servers points to canonicalOrigin so Claude fetches OUR discovery doc
  // (we need to control the registration_endpoint to proxy through our apikey injector).
  const protectedResource = {
    resource: canonicalResource,
    authorization_servers: [canonicalOrigin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
  };

  // RFC 8414: OAuth Authorization Server Metadata
  // Mirrors Supabase's own discovery but with registration proxied through us
  // (Supabase requires apikey header on registration which MCP clients don't send).
  //
  // Auth + registration endpoints all live on the canonical vanity domain — the
  // Cloudflare Worker (cloudflare/api-proxy/worker.ts) proxies /auth/v1/* and
  // /mcp-register transparently to Supabase.
  const authorizationServer = {
    issuer: canonicalOrigin,
    authorization_endpoint: `${canonicalOrigin}/auth/v1/oauth/authorize`,
    token_endpoint: `${canonicalOrigin}/auth/v1/oauth/token`,
    registration_endpoint: `${canonicalOrigin}/mcp-register`,
    jwks_uri: `${canonicalOrigin}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${canonicalOrigin}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    service_documentation: `${canonicalOrigin}/settings/mcp`,
  };

  // OpenID Connect Discovery 1.0: OIDC Provider Metadata
  // Superset of the authorization-server metadata with OIDC-specific fields.
  // Enables ChatGPT and other MCP clients to detect OIDC support and display
  // the CallVault logo via op_logo_uri.
  const openidConfiguration = {
    issuer: canonicalOrigin,
    authorization_endpoint: `${canonicalOrigin}/auth/v1/oauth/authorize`,
    token_endpoint: `${canonicalOrigin}/auth/v1/oauth/token`,
    registration_endpoint: `${canonicalOrigin}/mcp-register`,
    jwks_uri: `${canonicalOrigin}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${canonicalOrigin}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    op_logo_uri: `${canonicalOrigin}/logo.png`,
  };

  let body;
  if (doc === 'protected-resource') {
    body = protectedResource;
  } else if (doc === 'openid-configuration') {
    body = openidConfiguration;
  } else {
    body = authorizationServer;
  }

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      // Short cache so a host change at the worker layer propagates within a
      // few minutes rather than an hour. Discovery docs are small and rarely
      // change, so this tradeoff is fine.
      'Cache-Control': 'public, max-age=60',
      // Vary on the proxy header so any intermediary cache stays scoped per host.
      'Vary': 'X-Callvault-Host',
    },
  });
});
