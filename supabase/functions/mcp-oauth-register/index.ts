import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * MCP OAuth Client Registration Proxy
 *
 * Proxies dynamic client registration requests to Supabase Auth,
 * injecting the required apikey header that MCP clients don't know about.
 *
 * MCP clients (Claude Desktop, Cursor) call this endpoint during OAuth setup.
 * Supabase requires the anon key on all auth endpoints.
 */

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) {
    console.error('mcp-oauth-register: SUPABASE_ANON_KEY is not configured');
    return new Response(
      JSON.stringify({ error: 'Service misconfigured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const rawBody = await req.text();

    // Normalize the registration request for Supabase compatibility.
    // Some MCP clients (Perplexity, ChatGPT) request token_endpoint_auth_method
    // values that Supabase doesn't support (private_key_jwt, tls_client_auth,
    // self_signed_tls_client_auth). We remap those to "client_secret_basic"
    // so the response is still a CONFIDENTIAL client with a client_secret.
    //
    // Previously we remapped to "none" (public client) which made Supabase
    // omit client_secret from the response — and spec-strict clients then
    // rejected the registration with errors like:
    //   "[API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret"
    //
    // Full private_key_jwt support (RFC 7523) is filed in v2.2 BACKLOG; until
    // then, client_secret_basic is the safe fallback — it works with every
    // RFC 7591 client we've tested and preserves the confidential-client
    // contract the client asked for.
    const SUPPORTED_AUTH_METHODS = ['none', 'client_secret_basic', 'client_secret_post'];
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = {};
    }

    const requestedAuth = parsedBody.token_endpoint_auth_method as string | undefined;
    if (requestedAuth && !SUPPORTED_AUTH_METHODS.includes(requestedAuth)) {
      console.log(
        `mcp-oauth-register: remapping unsupported token_endpoint_auth_method "${requestedAuth}" → "client_secret_basic" (preserves confidential client + client_secret)`,
      );
      parsedBody.token_endpoint_auth_method = 'client_secret_basic';
      // Strip fields specific to the unsupported auth method (e.g. private_key_jwt fields)
      delete parsedBody.token_endpoint_auth_signing_alg;
      delete parsedBody.jwks_uri;
    }

    const body = JSON.stringify(parsedBody);

    // Forward to Supabase's actual registration endpoint with the apikey
    const response = await fetch(`${supabaseUrl}/auth/v1/oauth/clients/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
      },
      body,
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('mcp-oauth-register error:', err);
    return new Response(
      JSON.stringify({ error: 'Registration proxy failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
