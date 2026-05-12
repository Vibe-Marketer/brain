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
 * CANONICAL URL: After the v2.2 MCP debug session (2026-05-12, see
 * `.planning/debug/mcp-auth-and-tool-schema.md`), the MCP server has exactly one
 * public surface: `https://api.callvaultai.com/mcp`. All discovery documents
 * advertise that resource URI regardless of inbound host. The previous Phase 26
 * "host-aware" branch for `app.callvaultai.com` was dead code in production
 * (Vercel's rewrite path stripped the original host so it never fired) AND was
 * the root cause of the RFC 8707 audience-binding error that broke Claude Code.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://vltmrnjsubfzrgrtdqey.supabase.co';

// Single canonical MCP surface. No host-aware branching — the Cloudflare Worker
// at api.callvaultai.com handles all MCP and OAuth traffic.
const CANONICAL_RESOURCE = 'https://api.callvaultai.com/mcp';
const CANONICAL_ORIGIN = 'https://api.callvaultai.com';

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

  // RFC 9728: OAuth Protected Resource Metadata
  // authorization_servers points to CANONICAL_ORIGIN so Claude fetches OUR discovery doc
  // (we need to control the registration_endpoint to proxy through our apikey injector).
  const protectedResource = {
    resource: CANONICAL_RESOURCE,
    authorization_servers: [CANONICAL_ORIGIN],
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
    issuer: CANONICAL_ORIGIN,
    authorization_endpoint: `${CANONICAL_ORIGIN}/auth/v1/oauth/authorize`,
    token_endpoint: `${CANONICAL_ORIGIN}/auth/v1/oauth/token`,
    registration_endpoint: `${CANONICAL_ORIGIN}/mcp-register`,
    jwks_uri: `${CANONICAL_ORIGIN}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${CANONICAL_ORIGIN}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    service_documentation: `${CANONICAL_ORIGIN}/settings/mcp`,
  };

  // OpenID Connect Discovery 1.0: OIDC Provider Metadata
  // Superset of the authorization-server metadata with OIDC-specific fields.
  // Enables ChatGPT and other MCP clients to detect OIDC support and display
  // the CallVault logo via op_logo_uri.
  const openidConfiguration = {
    issuer: CANONICAL_ORIGIN,
    authorization_endpoint: `${CANONICAL_ORIGIN}/auth/v1/oauth/authorize`,
    token_endpoint: `${CANONICAL_ORIGIN}/auth/v1/oauth/token`,
    registration_endpoint: `${CANONICAL_ORIGIN}/mcp-register`,
    jwks_uri: `${CANONICAL_ORIGIN}/auth/v1/.well-known/jwks.json`,
    userinfo_endpoint: `${CANONICAL_ORIGIN}/auth/v1/user`,
    scopes_supported: ['openid', 'email', 'profile', 'phone'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    op_logo_uri: `${CANONICAL_ORIGIN}/logo.png`,
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
