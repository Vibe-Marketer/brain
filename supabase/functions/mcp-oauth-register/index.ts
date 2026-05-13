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

    // Filter grant_types to Supabase-supported subset.
    // Supabase Auth's /auth/v1/oauth/clients/register hard-rejects any
    // grant_types entry other than 'authorization_code' or 'refresh_token'
    // with HTTP 400:
    //   {"error_code":"validation_failed","msg":"400: grant_types must
    //    only contain 'authorization_code' and/or 'refresh_token'"}
    // Some MCP clients (Perplexity) include 'client_credentials' for
    // server-to-server validation flows. Forwarding raw produces a 400 that
    // surfaces to the client as 'invalid_client_metadata' / CLIENT_REGISTRATION_FAILED.
    //
    // Same courteous-proxy pattern as the token_endpoint_auth_method remap above:
    // filter to what we support, default to the standard pair if nothing remains.
    const SUPPORTED_GRANT_TYPES = new Set(['authorization_code', 'refresh_token']);
    if (Array.isArray(parsedBody.grant_types)) {
      const original = parsedBody.grant_types as unknown[];
      const filtered = original.filter(
        (g): g is string => typeof g === 'string' && SUPPORTED_GRANT_TYPES.has(g),
      );
      const dropped = original.filter((g) => !(typeof g === 'string' && SUPPORTED_GRANT_TYPES.has(g)));
      if (dropped.length > 0) {
        console.log(
          `mcp-oauth-register: filtering unsupported grant_types ${JSON.stringify(dropped)} (supabase accepts only authorization_code + refresh_token)`,
        );
      }
      // If client asked ONLY for unsupported grants, fall back to the default pair
      // rather than send an empty array (Supabase rejects []).
      parsedBody.grant_types = filtered.length > 0 ? filtered : ['authorization_code', 'refresh_token'];
    }

    // Filter response_types defensively to the OAuth 2.1 / MCP-required subset.
    // Supabase currently accepts 'code' and (per probe 2026-05-13) also
    // tolerates 'token' / 'id_token' in the registration payload, but the
    // MCP spec only allows the authorization-code flow. Stripping non-'code'
    // values matches MCP intent and avoids any future Supabase tightening.
    const SUPPORTED_RESPONSE_TYPES = new Set(['code']);
    if (Array.isArray(parsedBody.response_types)) {
      const original = parsedBody.response_types as unknown[];
      const filtered = original.filter(
        (r): r is string => typeof r === 'string' && SUPPORTED_RESPONSE_TYPES.has(r),
      );
      const dropped = original.filter((r) => !(typeof r === 'string' && SUPPORTED_RESPONSE_TYPES.has(r)));
      if (dropped.length > 0) {
        console.log(
          `mcp-oauth-register: filtering unsupported response_types ${JSON.stringify(dropped)} (MCP allows only "code")`,
        );
      }
      parsedBody.response_types = filtered.length > 0 ? filtered : ['code'];
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

    // Augment the response with RFC 7591 §3.2.1 required/recommended timestamp
    // fields that Supabase Auth does NOT emit today:
    //   - client_secret_expires_at: REQUIRED whenever client_secret is issued
    //     (per RFC 7591 §3.2.1: "REQUIRED if client_secret is issued. Time at
    //     which the client_secret will expire or 0 if it will not expire.")
    //   - client_id_issued_at: RECOMMENDED for any registered client; gives
    //     spec-strict clients the issuance epoch they expect.
    //
    // Without client_secret_expires_at present alongside client_secret, strict
    // RFC 7591 parsers (Perplexity, ChatGPT MCP) bail with errors like
    //   "[API_CLIENTS_ERROR] Dynamic client registration did not return a
    //    client_secret"
    // even though client_secret IS present — they treat the missing required
    // sibling field as a malformed response and surface a generic error.
    //
    // We DO NOT trust Supabase Auth to start emitting these fields itself, so
    // we synthesize them in the proxy. Only added on success (2xx) responses
    // and only when JSON parses cleanly.
    let augmented = data;
    if (response.ok) {
      try {
        const json = JSON.parse(data);
        if (json && typeof json === 'object' && typeof json.client_id === 'string') {
          // client_id_issued_at: derive from created_at if present, else now.
          if (json.client_id_issued_at === undefined || json.client_id_issued_at === null) {
            const createdMs = typeof json.created_at === 'string'
              ? Date.parse(json.created_at)
              : Number.NaN;
            json.client_id_issued_at = Number.isFinite(createdMs)
              ? Math.floor(createdMs / 1000)
              : Math.floor(Date.now() / 1000);
          }
          // client_secret_expires_at: REQUIRED only when a secret was issued.
          // 0 = never expires (per RFC 7591). Omit for public clients.
          if (
            typeof json.client_secret === 'string' &&
            (json.client_secret_expires_at === undefined || json.client_secret_expires_at === null)
          ) {
            json.client_secret_expires_at = 0;
          }
          augmented = JSON.stringify(json);
        }
      } catch (parseErr) {
        // If Supabase returned non-JSON on a 2xx (shouldn't happen), pass
        // through unchanged rather than synthesize a broken envelope.
        console.warn('mcp-oauth-register: response was not parseable JSON, passing through unchanged:', parseErr);
      }
    }

    return new Response(augmented, {
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
