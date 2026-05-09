import { getCorsHeaders } from '../_shared/cors.ts';

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
 * HOST-AWARE (Phase 26 Breakpoint fix #1): The metadata returned matches the host
 * that served the request. A client fetching api.callvaultai.com/.well-known/* gets
 * a resource URI of api.callvaultai.com/mcp; a client fetching app.callvaultai.com
 * gets app.callvaultai.com/api/mcp. Without this, OAuth on the vanity domain
 * bounces clients cross-host (RFC 8707 audience-binding violation).
 *
 * Host detection priority: x-forwarded-host (set by Cloudflare Worker / Vercel)
 * → host header → fallback to api.callvaultai.com.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://vltmrnjsubfzrgrtdqey.supabase.co';

// Map the inbound host to (resource URI, base origin). Per Phase 26 Breakpoint
// fix #1: the metadata MUST advertise the resource URI matching the host that
// served the request, or MCP clients doing OAuth against api.callvaultai.com
// get bounced to app.callvaultai.com (RFC 8707 audience binding).
function resolveResourceContext(req: Request): { resource: string; baseOrigin: string } {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const hostHeader = req.headers.get('host');
  // Vercel sets x-forwarded-host. Cloudflare Worker sets it explicitly (Phase 26).
  // Direct supabase URLs / unknown hosts fall through to the api.callvaultai.com default.
  const host = (forwardedHost || hostHeader || '').toLowerCase().split(':')[0];

  if (host === 'app.callvaultai.com') {
    // Back-compat for tokens / clients still pointing at the old URL.
    return {
      resource: 'https://app.callvaultai.com/api/mcp',
      baseOrigin: 'https://app.callvaultai.com',
    };
  }

  // api.callvaultai.com (Phase 26 vanity), preview deploys, raw supabase URL,
  // localhost — all canonicalize to the api.callvaultai.com vanity domain.
  return {
    resource: 'https://api.callvaultai.com/mcp',
    baseOrigin: 'https://api.callvaultai.com',
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Determine which document to serve. Vercel rewrites pass ?doc= query param
  // since the original path is stripped during proxying.
  const url = new URL(req.url);
  const doc = url.searchParams.get('doc') || 'authorization-server';

  const { resource, baseOrigin } = resolveResourceContext(req);

  // RFC 9728: OAuth Protected Resource Metadata
  // authorization_servers points to baseOrigin so Claude fetches OUR discovery doc
  // (we need to control the registration_endpoint to proxy through our apikey injector)
  const protectedResource = {
    resource,
    authorization_servers: [baseOrigin],
    bearer_methods_supported: ['header'],
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
  };

  // RFC 8414: OAuth Authorization Server Metadata
  // Mirrors Supabase's own discovery but with registration proxied through us
  // (Supabase requires apikey header on registration which MCP clients don't send).
  //
  // NOTE: registration_endpoint is intentionally pinned to app.callvaultai.com
  // regardless of the inbound host — the Cloudflare Worker does not yet route
  // /mcp-register on api.callvaultai.com. Tracked as Phase 26 follow-up.
  // A broken registration endpoint is worse than a cross-host one: the cross-host
  // call still succeeds today; an api.callvaultai.com/mcp-register 404 would not.
  // Auth endpoints use the vanity domain when served from api.callvaultai.com
  // (the Cloudflare Worker proxies /auth/v1/* to Supabase transparently), but
  // fall back to the raw Supabase URL for app.callvaultai.com or other hosts.
  const authBase = baseOrigin === 'https://api.callvaultai.com' ? baseOrigin : SUPABASE_URL;

  const authorizationServer = {
    issuer: baseOrigin,
    authorization_endpoint: `${authBase}/auth/v1/oauth/authorize`,
    token_endpoint: `${authBase}/auth/v1/oauth/token`,
    registration_endpoint: 'https://app.callvaultai.com/api/mcp-register',
    jwks_uri: `${authBase}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${authBase}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    service_documentation: `${baseOrigin}/settings/mcp`,
  };

  // OpenID Connect Discovery 1.0: OIDC Provider Metadata
  // Superset of the authorization-server metadata with OIDC-specific fields.
  // Enables ChatGPT and other MCP clients to detect OIDC support and display
  // the CallVault logo via op_logo_uri.
  const openidConfiguration = {
    issuer: baseOrigin,
    authorization_endpoint: `${authBase}/auth/v1/oauth/authorize`,
    token_endpoint: `${authBase}/auth/v1/oauth/token`,
    registration_endpoint: 'https://app.callvaultai.com/api/mcp-register',
    jwks_uri: `${authBase}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${authBase}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    op_logo_uri: `${baseOrigin}/logo.png`,
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
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
