import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * MCP OAuth Metadata — serves well-known OAuth discovery documents
 *
 * Handles two RFC endpoints:
 *   /.well-known/oauth-protected-resource  (RFC 9728) — points clients to the auth server
 *   /.well-known/oauth-authorization-server (RFC 8414) — full OAuth 2.1 server metadata
 *
 * These endpoints tell MCP clients (Claude Desktop, Cursor, etc.) how to authenticate.
 * The actual OAuth server is Supabase Auth — we just publish the metadata.
 */

const SUPABASE_URL = 'https://vltmrnjsubfzrgrtdqey.supabase.co';
const APP_URL = 'https://app.callvaultai.com';

// RFC 9728: OAuth Protected Resource Metadata
const PROTECTED_RESOURCE = {
  resource: `${APP_URL}/api/mcp`,
  authorization_servers: [`${SUPABASE_URL}/auth/v1`],
  bearer_methods_supported: ['header'],
  scopes_supported: ['openid', 'email', 'profile'],
};

// RFC 8414: OAuth Authorization Server Metadata
const AUTHORIZATION_SERVER = {
  issuer: `${SUPABASE_URL}/auth/v1`,
  authorization_endpoint: `${SUPABASE_URL}/auth/v1/authorize`,
  token_endpoint: `${SUPABASE_URL}/auth/v1/token`,
  registration_endpoint: `${SUPABASE_URL}/auth/v1/oauth/register`,
  jwks_uri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  scopes_supported: ['openid', 'email', 'profile'],
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'none'],
  service_documentation: `${APP_URL}/settings/mcp`,
};

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

  const isProtectedResource = doc === 'protected-resource';

  const body = isProtectedResource ? PROTECTED_RESOURCE : AUTHORIZATION_SERVER;

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
});
