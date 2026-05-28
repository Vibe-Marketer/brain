import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicCorsHeaders } from '../_shared/cors.ts';
import { authenticateMcpRequest } from './auth.ts';
import { enforceCategoryGate, enforcePlanGate } from './gating.ts';
import {
  mcpAccepted,
  mcpError,
  mcpJsonResult,
  mcpOk,
  parseWorkspaceIdFromMcpPath,
  resolveOriginHost,
  unauthorizedResponse,
} from './protocol.ts';
import { buildToolDefinitions, getToolModule } from './tools/registry.ts';
import { TOOL_CATEGORIES } from '../_shared/mcp-tool-categories.ts';
import type { JsonRpcRequest, McpToken, SupabaseClient } from './tools/_types.ts';

/**
 * MCP SERVER — Model Context Protocol endpoint for CallVault
 *
 * service-role required: token scoping is the access-control boundary (hex
 * tokens from mcp_tokens table OR Supabase OAuth JWT), not RLS. Verified
 * via token metadata before any data access.
 *
 * Implements JSON-RPC 2.0 over HTTP for the MCP protocol.
 * Authentication: Bearer token from mcp_tokens table (NOT a Supabase JWT).
 * Exempt from `_shared/auth.ts authenticateRequest()` — uses custom MCP OAuth
 * (Phase 37 SEC-02A exempt list).
 *
 * Each token is scoped to either a single workspace or an entire organization.
 * Access control is enforced via token scoping — we use the service role key
 * to query data and verify ownership through the token metadata.
 *
 * Tools exposed (17 read + 19 write = 36 total):
 *
 * READ:
 *   tools/list                     — enumerate available tools
 *   search_calls         — full-text + semantic search
 *   get_transcript       — full transcript for a recording
 *   list_calls           — paginated call list
 *   get_recording_context — metadata + summary + speakers + tags
 *   list_workspaces      — workspaces visible to this token
 *   list_contacts        — list contacts with optional search
 *   get_contact          — contact details + call history
 *   get_contact_calls    — calls involving a specific contact
 *   list_folders         — list folders in org/workspace
 *   get_folder_calls     — calls in a specific folder
 *   list_tags            — list all tags (personal + org-level)
 *   get_tagged_calls     — calls with a specific tag
 *   list_speakers        — known speakers across calls
 *   get_speaker_calls    — calls a speaker appeared in
 *   get_action_items     — AI-extracted action items from a call
 *   get_call_notes       — notes attached to a recording
 *   list_shared_calls    — calls shared with the user
 *
 * WRITE:
 *   create_note          — attach a note to a recording
 *   rename_call          — update a recording's title
 *   move_calls_to_workspace — move recordings between workspaces
 *   delete_call          — permanently delete a recording
 *   copy_calls_to_organization — copy recordings to another org
 *   create_folder        — create a personal folder
 *   rename_folder        — rename a folder
 *   delete_folder        — delete a folder
 *   add_call_to_folder   — add recording to folder
 *   remove_call_from_folder — remove recording from folder
 *   create_tag           — create a personal tag
 *   rename_tag           — rename a tag
 *   delete_tag           — delete a tag
 *   tag_call             — apply tag to recording
 *   untag_call           — remove tag from recording
 *   create_share_link    — create a share link for a call
 *   revoke_share_link    — revoke a share link
 *   import_youtube_video — import a YouTube video
 *   create_organization  — create a new org
 *   create_workspace     — create workspace in org
 *
 * MCP response envelope:
 *   { id, result: { content: [{ type: "text", text: "..." }] } }
 *
 * Error envelope:
 *   { id, error: { code, message } }
 */

// ─── Helpers: org boundary ────────────────────────────────────────────────────

async function fetchOrgWorkspaceIds(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ ids: string[] | null; error: boolean }> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', orgId);

  if (error) {
    console.error('mcp-server org-workspace lookup failed:', error);
    return { ids: null, error: true };
  }

  return { ids: (data ?? []).map((w: { id: string }) => w.id), error: false };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // PUBLIC CORS — the MCP JSON-RPC endpoint is, by design, callable from any
  // origin. Access control happens at the bearer-token layer inside this
  // function; CORS is NOT a security boundary here. Browser-based MCP clients
  // (Perplexity at www.perplexity.ai, ChatGPT web, etc.) call /mcp from their
  // own origin and must be able to read the response (which is either a
  // 401 + WWW-Authenticate discovery hint for unauth'd requests, or a JSON-RPC
  // result with a valid bearer token). Locking this to app.callvaultai.com
  // silently breaks every non-Claude-Desktop client. See
  // `.planning/debug/resolved/mcp-cors-blocking-browser-clients.md`.
  const corsHeaders = getPublicCorsHeaders();

  // Resolve the public host the client originally hit (set by the Cloudflare
  // Worker proxy via X-Forwarded-Host). All advertised URLs in WWW-Authenticate
  // reflect this host so the client's discovery follow-up lands on the same
  // hostname they reached us on (api.callvaultai.com OR mcp.callvaultai.com).
  const originHost = resolveOriginHost(req);
  const requestedWorkspaceId = parseWorkspaceIdFromMcpPath(req);
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Non-POST methods are not used for JSON-RPC, but spec-strict clients
  // (Perplexity, ChatGPT web, etc.) probe with GET. Unauthenticated probes must
  // still return 401 + WWW-Authenticate for OAuth discovery. Authenticated GET
  // probes should not look like auth failure after a successful OAuth connect,
  // and should expose the same filtered tool metadata as tools/list for clients
  // that use GET as their post-connect validation probe.
  if (req.method !== 'POST') {
    const authResult = await authenticateMcpRequest(
      req,
      null,
      corsHeaders,
      originHost,
      requestedWorkspaceId,
      supabase,
      supabaseUrl,
      serviceKey,
    );
    if (!authResult.ok) return authResult.response;

    if (req.method === 'HEAD') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const allTools = buildToolDefinitions();
    const filteredTools = filterToolsForToken(allTools, authResult.mcpToken);

    return new Response(
      JSON.stringify({
        status: 'ok',
        transport: 'streamable-http',
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'callvault',
          title: 'CallVault',
          version: '2.0.0',
        },
        tools: filteredTools,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // Parse JSON-RPC body
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { id = null, method, params = {} } = body;

  // ── Authenticate via Bearer token (hex token OR OAuth JWT) ──────────────────
  // Critical: token VALIDATION happens BEFORE method dispatch (including
  // initialize and tools/list). See auth.ts for the custom MCP auth boundary.
  const authResult = await authenticateMcpRequest(
    req,
    id,
    corsHeaders,
    originHost,
    requestedWorkspaceId,
    supabase,
    supabaseUrl,
    serviceKey,
  );
  if (!authResult.ok) return authResult.response;
  const { mcpToken } = authResult;

  if (method === 'notifications/initialized' && !Object.prototype.hasOwnProperty.call(body, 'id')) {
    return mcpAccepted(corsHeaders);
  }

  // ── Protocol methods (token is now VALIDATED, not just present) ────────────
  // initialize and tools/list return structured JSON (not content text blocks).
  // Hoisted below the validation block above so that any holder of a VALID
  // token (hex or JWT) can introspect server capabilities, but no invalid
  // token can reach these handlers.
  if (method === 'initialize') {
    return mcpJsonResult(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: {
        name: 'callvault',
        title: 'CallVault',
        version: '2.0.0',
      },
      instructions: 'CallVault MCP server — search calls, manage contacts, folders, tags, and more across your organization.',
    });
  }

  if (method === 'tools/list') {
    const allTools = buildToolDefinitions();
    const filteredTools = filterToolsForToken(allTools, mcpToken);
    return mcpJsonResult(id, { tools: filteredTools });
  }

  // ── Plan gating: enforce paid-tier requirement (D-01/D-02) ──────────────
  // Plan gating enforced — trial-provisioning migration 20260430123000 grants every signup a 7-day pro-trial.
  const planGateResponse = await enforcePlanGate(supabase, mcpToken, id, corsHeaders);
  if (planGateResponse) return planGateResponse;

  // ── Route to tool handler ───────────────────────────────────────────────────
  // MCP protocol: clients send method "tools/call" with params.name + params.arguments
  // Unwrap to get the actual tool name and merge arguments into params.
  let toolName = method;
  if (method === 'tools/call') {
    toolName = typeof params.name === 'string' ? params.name : '';
    // Merge arguments into params so handlers can read them directly
    if (params.arguments && typeof params.arguments === 'object') {
      Object.assign(params, params.arguments as Record<string, unknown>);
    }
  }

  // ── Category gating (Phase 23, D-07/D-08) ──────────────────────────────
  // After plan-gating, before dispatch. When a token has explicit
  // enabled_categories, verify the requested tool's category is in the
  // whitelist; otherwise reject with -32001 and name the missing category.
  // Tokens with enabled_categories=null retain legacy full-access (D-13/D-14).
  // Skip the gate for protocol-level methods (initialize, tools/list,
  // notifications/initialized) which are handled pre-auth above and have
  // no entry in TOOL_CATEGORIES.
  const categoryGateResponse = enforceCategoryGate(mcpToken, method, toolName, id, corsHeaders);
  if (categoryGateResponse) return categoryGateResponse;

  const toolModule = getToolModule(toolName);
  if (toolModule) {
    return await toolModule.handler({
      id,
      params,
      supabase,
      mcpToken,
      corsHeaders,
      fetchOrgWorkspaceIds,
    });
  }

  try {
    return mcpError(id, -32601, `Method not found: ${method}`, corsHeaders);
  } catch (err) {
    console.error('mcp-server unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return mcpError(id, -32603, message, corsHeaders);
  }
});

function filterToolsForToken(allTools: unknown[], mcpToken: McpToken): unknown[] {
  if (mcpToken.enabled_categories === null) return allTools;

  return allTools.filter((tool) => {
    const name = typeof tool === 'object' && tool !== null
      ? (tool as { name?: unknown }).name
      : undefined;
    if (typeof name !== 'string') return false;
    const category = TOOL_CATEGORIES[name];
    return category ? mcpToken.enabled_categories.includes(category) : false;
  });
}
