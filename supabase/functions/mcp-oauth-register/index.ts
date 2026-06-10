import { getPublicCorsHeaders } from '../_shared/cors.ts';

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
  // PUBLIC CORS — RFC 7591 Dynamic Client Registration is, by spec, a public
  // endpoint that any OAuth client can hit. Browser-based MCP clients
  // (Perplexity, ChatGPT web) register from their own origin and need to read
  // the client_id/client_secret response. Locking this to app.callvaultai.com
  // blocks every non-Claude-Desktop client at the registration step.
  // See `.planning/debug/resolved/mcp-cors-blocking-browser-clients.md`.
  const corsHeaders = getPublicCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ISC-1–7: Internal secret gate — before method check and any processing.
  // Blocks direct requests to the Supabase project URL that bypass the Worker.
  const internalSecret = Deno.env.get('CALLVAULT_INTERNAL_SECRET');
  const incomingSecret = req.headers.get('x-callvault-internal-secret');
  if (!internalSecret || !incomingSecret || incomingSecret !== internalSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
    //
    // Two cases need the same treatment — set token_endpoint_auth_method to
    // 'client_secret_post':
    //   (1) Client requested an UNSUPPORTED method (private_key_jwt,
    //       tls_client_auth, self_signed_tls_client_auth). Supabase would
    //       400 on these.
    //   (2) Client did NOT specify a method. Supabase's default in this case
    //       is 'client_secret_basic'.
    //
    // We default both to 'client_secret_post' because some MCP clients have
    // strict DCR response validators that ONLY accept 'none' or
    // 'client_secret_post' — they reject 'client_secret_basic' even though
    // it's the OAuth 2.0 default and (per RFC 7591 §2) one of the allowed
    // values. Documented in kirodotdev/Kiro#3908 with the error text
    // "token_endpoint_auth_method: Input should be 'none' or 'client_secret_post'".
    // Perplexity's custom-connector wizard exhibits matching symptoms.
    //
    // Runtime impact: zero. Supabase Auth's token endpoint accepts BOTH
    // client_secret_basic (HTTP Basic auth header) AND client_secret_post
    // (credentials in form body) for the same client. Switching the
    // ADVERTISED method only changes where the secret travels in the wire
    // format — which is the client's choice anyway.
    //
    // We explicitly preserve client_secret_basic if a client asked for it
    // (probe 4 — they made an informed choice; respect it). Same for 'none'
    // (public clients) and 'client_secret_post'.
    //
    // Full private_key_jwt support (RFC 7523) is filed in v2.2 BACKLOG.
    const SUPPORTED_AUTH_METHODS = ['none', 'client_secret_basic', 'client_secret_post'];
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = {};
    }

    const requestedAuth = parsedBody.token_endpoint_auth_method as string | undefined;
    if (!requestedAuth || !SUPPORTED_AUTH_METHODS.includes(requestedAuth)) {
      const previous = requestedAuth ?? '(unspecified)';
      console.log(
        `mcp-oauth-register: setting token_endpoint_auth_method to "client_secret_post" (was "${previous}") for max client compatibility (Kiro#3908 / Perplexity)`,
      );
      parsedBody.token_endpoint_auth_method = 'client_secret_post';
      // Strip fields specific to unsupported asymmetric auth methods
      // (private_key_jwt's signing alg + jwks_uri).
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
