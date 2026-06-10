/**
 * callvault-api Edge Function — Canonical REST API entry point
 *
 * Routes:
 *   GET /v1/workspaces                  — list workspaces visible to the token
 *   GET /v1/calls                       — list calls (workspace/org scoped)
 *   GET /v1/calls/{id}                  — get single call with transcript + participants
 *   GET /v1/contacts                    — list contacts (user-scoped)
 *   GET /v1/speakers                    — list speakers (org/workspace scoped)
 *
 * Auth: Bearer <api_token> where token_source = 'api'
 * All responses: { data, pagination } or { error: { code, message } }
 *
 * Security (T-06.2-04, T-06.2-05, T-06.2-06):
 * - Only api-source tokens accepted; MCP and legacy non-api tokens return 403
 * - All resource queries are scoped through token org/workspace context
 * - Response helpers enforce REST envelope — no MCP protocol leakage
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateApiToken } from './auth.ts';
import { corsHeaders, jsonError } from './responses.ts';
import { handleListWorkspaces } from './routes/workspaces.ts';
import { handleListCalls, handleGetCall } from './routes/calls.ts';
import { handleListContacts } from './routes/contacts.ts';
import { handleListSpeakers } from './routes/speakers.ts';

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only GET requests are supported for read-only REST API
  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported');
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate — enforces token_source = 'api', revocation, 401/403 boundaries
    const authResult = await authenticateApiToken(req, supabase);
    if (authResult instanceof Response) return authResult;
    const tokenCtx = authResult;

    // Route dispatch: strip Supabase function prefix to normalize the path
    // Supabase wraps as /functions/v1/callvault-api/v1/...
    const url = new URL(req.url);
    const rawPath = url.pathname;
    const stripped = rawPath.replace(/^\/(functions\/v1\/)?callvault-api/, '');

    // GET /v1/workspaces
    if (stripped === '/v1/workspaces' || stripped === '/v1/workspaces/') {
      return await handleListWorkspaces(req, supabase, tokenCtx);
    }

    // GET /v1/calls/{id} — must test before /v1/calls to avoid prefix clash
    const callDetailMatch = stripped.match(
      /^\/v1\/calls\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/)?$/i,
    );
    if (callDetailMatch) {
      return await handleGetCall(callDetailMatch[1], req, supabase, tokenCtx);
    }

    // GET /v1/calls
    if (stripped === '/v1/calls' || stripped === '/v1/calls/') {
      return await handleListCalls(req, supabase, tokenCtx);
    }

    // GET /v1/contacts
    if (stripped === '/v1/contacts' || stripped === '/v1/contacts/') {
      return await handleListContacts(req, supabase, tokenCtx);
    }

    // GET /v1/speakers
    if (stripped === '/v1/speakers' || stripped === '/v1/speakers/') {
      return await handleListSpeakers(req, supabase, tokenCtx);
    }

    return jsonError(404, 'NOT_FOUND', `Route not found: ${stripped}`);
  } catch (error) {
    console.error('callvault-api: unhandled error', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonError(500, 'INTERNAL_ERROR', message);
  }
});
