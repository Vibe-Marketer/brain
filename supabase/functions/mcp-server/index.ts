import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject, generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { enforceMcpAiUsage } from '../_shared/track-ai-usage-inline.ts';
import { TOOL_CATEGORIES, type ToolCategory } from '../_shared/mcp-tool-categories.ts';

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc?: string;
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpToken {
  id: string;
  user_id: string;
  org_id: string | null;
  workspace_id: string | null;
  scope: 'workspace' | 'organization';
  name: string;
  enabled_categories: ToolCategory[] | null;
}

interface McpContent {
  type: 'text';
  text: string;
}

interface McpResult {
  content: McpContent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mcpOk(id: string | number | null, data: unknown): Response {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return Response.json({
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
    } satisfies McpResult,
  });
}

/** Return structured JSON directly as result (for initialize, tools/list — NOT tool calls) */
function mcpJsonResult(id: string | number | null, result: unknown): Response {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function mcpError(
  id: string | number | null,
  code: number,
  message: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}

/**
 * RFC 9728 / MCP 2025-06-18 §authorization compliant 401 response.
 * Always carries WWW-Authenticate so spec-strict clients (Perplexity, ChatGPT,
 * Claude) can discover the OAuth flow and retry with a valid bearer token.
 *
 * Use for: missing Authorization header, malformed Authorization header,
 * presented token rejected by Supabase Auth or by the mcp_tokens table lookup,
 * GET/HEAD probes (where the HTTP-layer answer for an unauth'd request is 401,
 * NOT 405 "method not allowed" — auth failure takes priority).
 */
function unauthorizedResponse(
  id: string | number | null,
  corsHeaders: Record<string, string>,
  host: string,
  message = 'Authorization required',
): Response {
  const resourceMetadataUrl = buildResourceMetadataUrl(host);
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32001, message } }),
    {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer realm="callvault", resource_metadata="${resourceMetadataUrl}"`,
      },
    },
  );
}

/**
 * Server-side plan tier check — ports deriveTier() from useSubscription.ts.
 * Returns true if the subscription is PRO+ and active/trialing.
 */
const POLAR_PRODUCT_TIERS: Record<string, 'pro' | 'team'> = {
  '30020903-fa8f-4534-9cf1-6e9fba26584c': 'pro',
  '9ff62255-446c-41fe-a84d-c04aed23725c': 'pro',
  '88f3f07e-afa3-4cb1-ac9d-d2429a1ce1b7': 'team',
  '6a1bcf14-86b4-4ec9-bcbe-660bb714b19f': 'team',
};

function isPaidTier(
  productId: string | null,
  status: string | null,
  periodEnd: string | null,
): boolean {
  if (!productId || !status) return false;

  // Pro trial: only active if trialing and not expired
  if (productId === 'pro-trial') {
    if (status !== 'trialing') return false;
    if (periodEnd && new Date(periodEnd) < new Date()) return false;
    return true;
  }

  return Boolean(POLAR_PRODUCT_TIERS[productId])
    && (status === 'active' || status === 'trialing');
}

// Host-aware MCP surface (v2.2 — see .planning/debug/mcp-auth-and-tool-schema.md
// AND .planning/debug/resolved/mcp-perplexity-still-failing-after-fixes.md).
//
// As of 2026-05-13 we expose TWO hostnames that route to the same worker /
// function stack: api.callvaultai.com (original, used by Claude Code) and
// mcp.callvaultai.com (added to bypass Perplexity's cached failure of the
// api.* host). The Cloudflare Worker forwards the original hostname in
// X-Forwarded-Host so every advertised URL (WWW-Authenticate resource_metadata,
// well-known docs, OAuth endpoints) can reflect the host the client actually hit.
//
// PATH-SUFFIXED per RFC 9728 §3.1: "inserting the well-known URI string into
// the protected resource's resource identifier between the host component and
// the path and/or query components, if any." For our resource
// https://<host>/mcp the conformant well-known URL is
// https://<host>/.well-known/oauth-protected-resource/mcp — with the /mcp path
// appended. Notion and Linear (sampled production MCP servers) both emit the
// path-suffixed form. The Cloudflare Worker routes BOTH forms to the same
// metadata function, so the un-suffixed URL remains served for any cached or
// back-compat clients.
const ALLOWED_HOSTS = new Set(['api.callvaultai.com', 'mcp.callvaultai.com']);
const FALLBACK_HOST = 'api.callvaultai.com';

function resolveOriginHost(req: Request): string {
  // Prefer X-Callvault-Host (custom header — Supabase's CDN strips the
  // standard X-Forwarded-Host before it reaches the function). Fall back to
  // X-Forwarded-Host just in case the function is ever invoked from a runtime
  // that doesn't strip it.
  const headerValue =
    req.headers.get('x-callvault-host') ?? req.headers.get('x-forwarded-host');
  const fwd = headerValue?.split(',')[0]?.trim();
  if (fwd && ALLOWED_HOSTS.has(fwd)) return fwd;
  return FALLBACK_HOST;
}

function buildResourceMetadataUrl(host: string): string {
  return `https://${host}/.well-known/oauth-protected-resource/mcp`;
}

// ─── Helpers: org boundary ────────────────────────────────────────────────────

async function fetchOrgWorkspaceIds(
  supabase: ReturnType<typeof createClient>,
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

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'search_calls',
    description: 'Search calls by keyword across titles, transcripts, summaries, tags, and participants.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of matching calls with ID, title, date, relevance score, and summary for each result, separated by ---. Returns a "No calls found" message if no matches.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_calls',
    description: 'List calls accessible to this token with optional workspace scoping and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: { type: 'string', description: 'Filter to a specific workspace (UUID)' },
        limit: { type: 'number', description: 'Page size (default 20, max 100)' },
        offset: { type: 'number', description: 'Pagination offset (default 0)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of calls with ID, title, date, duration, source, and summary for each, separated by ---. Returns "No calls found." if empty.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_transcript',
    description: 'Retrieve the full transcript text for a specific call recording.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Full transcript text prefixed with a markdown header containing the recording title and date.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_recording_context',
    description: 'Get rich context for a call: metadata, AI summary, speakers, and tags.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with sections: Metadata (date, duration, source, recording ID), Summary, Speakers (name and role), Tags, and Auto-tags.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_workspaces',
    description: 'List workspaces accessible to this token (org-scoped tokens see all org workspaces).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of workspaces with ID, name, and type for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_contacts',
    description: 'List contacts with optional search by name or email.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter contacts by name or email (partial match)' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of contacts with ID, name, email, type, last seen date, and notes for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_contact',
    description: 'Get a contact\'s details including their recent call history.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact UUID' },
      },
      required: ['contact_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with sections: Details (email, type, last seen, created, health tracking, tags, notes) and Recent Calls (recording IDs with dates).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_contact_calls',
    description: 'List all calls involving a specific contact.',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string', description: 'Contact UUID' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
      required: ['contact_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_folders',
    description: 'List personal folders accessible in the org/workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of folders with ID and name for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_folder_calls',
    description: 'List calls in a specific personal folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder UUID' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
      required: ['folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Folder name header followed by a formatted list of calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_tags',
    description: 'List all tags (personal tags scoped to the user/org).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of tags with ID, name, and optional color for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_tagged_calls',
    description: 'Get calls that have a specific tag applied.',
    inputSchema: {
      type: 'object',
      properties: {
        tag_id: { type: 'string', description: 'Tag UUID (provide either tag_id or tag_name)' },
        tag_name: { type: 'string', description: 'Tag name to search for (provide either tag_id or tag_name)' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of tagged calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_speakers',
    description: 'List known speakers (participants) across calls.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter by speaker name or email' },
        limit: { type: 'number', description: 'Max results (default 50, max 200)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Deduplicated list of speakers with name, email, and participant type for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_speaker_calls',
    description: 'Get all calls a specific speaker appeared in.',
    inputSchema: {
      type: 'object',
      properties: {
        speaker_name: { type: 'string', description: 'Speaker name to search for' },
        speaker_email: { type: 'string', description: 'Speaker email to search for' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Speaker name header followed by a formatted list of calls with ID, title, date, duration, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_action_items',
    description: 'Get AI-extracted action items from a call recording. Parses the summary and source metadata for action items, decisions, and follow-ups.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with title header and numbered action items extracted from source metadata, plus the summary section if available.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'extract_action_items',
    description:
      'Extract action items from a call recording using AI. Read-through cache: returns Fathom-pre-extracted items if present, otherwise the cached LLM result, otherwise calls the LLM and caches the result. Costs one AI action against the monthly quota only when the LLM is invoked.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with title header and numbered action items, each with optional owner and due date. Source indicated as Fathom, cached, or extracted.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'ask_call',
    description:
      'Ask a free-form question about a call recording, grounded in the transcript. Returns the model\'s plain-text answer prefixed with the question. Costs one AI action against the monthly quota for every call (no caching — every question is unique).',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        question: {
          type: 'string',
          description: 'The question to ask. Max 500 characters. Will be answered using the transcript content only.',
        },
      },
      required: ['recording_id', 'question'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Q&A format: "Q: <question>" followed by "A: <answer>" grounded in the transcript.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_sentiment',
    description:
      'Analyze the sentiment of a call recording. Returns overall sentiment (positive/neutral/negative/mixed), per-speaker talk ratios, and notable key moments. Read-through cache: subsequent calls return the cached result instantly. Costs one AI action against the monthly quota only when the LLM is invoked.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with Overall sentiment, Talk Ratio per speaker with percentages, and Key Moments with timestamps, sentiment labels, and transcript snippets.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_coaching_notes',
    description:
      'Generate sales coaching notes for a call recording: strengths, improvements, and specific examples with concrete observations and suggestions. Read-through cache: subsequent calls return the cached result instantly. Costs one AI action against the monthly quota only when the LLM is invoked.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with sections: Strengths (numbered list), Areas for Improvement (numbered list), and Specific Examples (numbered with topic, observation, and suggestion for each).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'get_call_notes',
    description: 'List user-authored notes attached to a recording. Returns notes from all workspaces the token can see, newest first, including author and timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Markdown document with recording title header and notes listed newest first, each with author display name, timestamp, and content, separated by ---.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_shared_calls',
    description: 'List calls that have been shared with the token owner via share links.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Formatted list of shared calls with ID, title, call date, duration, shared date, and summary for each, separated by ---.' },
      },
      required: ['text'],
    },
  },

  // ── Write Tools ──────────────────────────────────────────────────────────────

  // Recording Management
  {
    name: 'rename_call',
    description: 'Rename a call recording by updating its title.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        title: { type: 'string', description: 'New title for the recording' },
      },
      required: ['recording_id', 'title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Renamed call to: <new title>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'move_calls_to_workspace',
    description: 'Move one or more recordings to a different workspace within the same organization.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_ids: { type: 'array', items: { type: 'string' }, description: 'Array of recording UUIDs to move' },
        target_workspace_id: { type: 'string', description: 'Target workspace UUID' },
      },
      required: ['recording_ids', 'target_workspace_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Moved N of M call(s) to workspace <name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'delete_call',
    description: 'Permanently delete a call recording and all associated data.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID to delete' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Call deleted successfully".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'copy_calls_to_organization',
    description: 'Copy recordings to another organization. The original recordings remain in place.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_ids: { type: 'array', items: { type: 'string' }, description: 'Array of recording UUIDs to copy' },
        target_org_id: { type: 'string', description: 'Target organization UUID' },
      },
      required: ['recording_ids', 'target_org_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Copied N of M call(s) to target organization", with error details if any copies failed.' },
      },
      required: ['text'],
    },
  },

  // Folder Management
  {
    name: 'create_folder',
    description: 'Create a new personal folder for organizing calls.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Folder name' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created folder <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'rename_folder',
    description: 'Rename an existing personal folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder UUID' },
        name: { type: 'string', description: 'New folder name' },
      },
      required: ['folder_id', 'name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Renamed folder to: <new name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'delete_folder',
    description: 'Delete a personal folder. Recordings in the folder are NOT deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        folder_id: { type: 'string', description: 'Folder UUID to delete' },
      },
      required: ['folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Deleted folder <name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'add_call_to_folder',
    description: 'Add a recording to a personal folder.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        folder_id: { type: 'string', description: 'Folder UUID' },
      },
      required: ['recording_id', 'folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Added call to folder <name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'remove_call_from_folder',
    description: 'Remove a recording from a personal folder (does not delete the recording).',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        folder_id: { type: 'string', description: 'Folder UUID' },
      },
      required: ['recording_id', 'folder_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Removed call from folder <name>".' },
      },
      required: ['text'],
    },
  },

  // Tag Management
  {
    name: 'create_tag',
    description: 'Create a new personal tag for labeling calls.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name' },
        color: { type: 'string', description: 'Optional color (hex or name)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created tag <name> (ID: <uuid>)" with optional color info.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'rename_tag',
    description: 'Rename an existing personal tag.',
    inputSchema: {
      type: 'object',
      properties: {
        tag_id: { type: 'string', description: 'Tag UUID' },
        name: { type: 'string', description: 'New tag name' },
      },
      required: ['tag_id', 'name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Renamed tag to: <new name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'delete_tag',
    description: 'Delete a personal tag. Removes the tag from all recordings.',
    inputSchema: {
      type: 'object',
      properties: {
        tag_id: { type: 'string', description: 'Tag UUID to delete' },
      },
      required: ['tag_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Deleted tag <name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'tag_call',
    description: 'Apply a personal tag to a recording.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        tag_id: { type: 'string', description: 'Tag UUID' },
      },
      required: ['recording_id', 'tag_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Tagged call with <tag name>".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'untag_call',
    description: 'Remove a personal tag from a recording.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        tag_id: { type: 'string', description: 'Tag UUID' },
      },
      required: ['recording_id', 'tag_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Removed tag <name> from call".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'create_note',
    description: 'Attach a note to a call recording. Returns a confirmation string with the recording title and note length.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID to attach the note to' },
        content: { type: 'string', description: 'Note content (max 10,000 characters; trimmed; must be non-empty)' },
        workspace_id: { type: 'string', description: 'Workspace UUID. Required when called by an organization-scoped token; ignored when called by a workspace-scoped token (auto-resolved).' },
      },
      required: ['recording_id', 'content'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created note on <title> (<N> chars)".' },
      },
      required: ['text'],
    },
  },

  // Share Links
  {
    name: 'create_share_link',
    description: 'Create a share link for a call recording, optionally restricted to a specific email.',
    inputSchema: {
      type: 'object',
      properties: {
        recording_id: { type: 'string', description: 'Recording UUID' },
        recipient_email: { type: 'string', description: 'Optional email to restrict access to' },
        expires_in_days: { type: 'number', description: 'Days until expiration (default 30)' },
      },
      required: ['recording_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Share link details including URL, expiration date, optional recipient restriction, and link ID.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'revoke_share_link',
    description: 'Revoke an active share link so it can no longer be used.',
    inputSchema: {
      type: 'object',
      properties: {
        share_link_id: { type: 'string', description: 'Share link UUID to revoke' },
      },
      required: ['share_link_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Share link revoked".' },
      },
      required: ['text'],
    },
  },

  // Import
  {
    name: 'import_youtube_video',
    description: 'Import a YouTube video as a call recording with transcript.',
    inputSchema: {
      type: 'object',
      properties: {
        youtube_url: { type: 'string', description: 'Full YouTube video URL' },
        workspace_id: { type: 'string', description: 'Workspace UUID to import into' },
      },
      required: ['youtube_url', 'workspace_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "YouTube video imported successfully" with the new recording ID.' },
      },
      required: ['text'],
    },
  },

  // Organization Management
  {
    name: 'create_organization',
    description: 'Create a new organization and become its owner.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Organization name' },
        type: { type: 'string', description: 'Organization type: "business" or "personal" (default: business)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created organization <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  },
  {
    name: 'create_workspace',
    description: 'Create a new workspace within the current organization.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Workspace name' },
        workspace_type: { type: 'string', description: 'Workspace type: "team", "personal", or "youtube" (default: team)' },
      },
      required: ['name'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Confirmation message: "Created workspace <name> (ID: <uuid>)".' },
      },
      required: ['text'],
    },
  },
];

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Resolve the public host the client originally hit (set by the Cloudflare
  // Worker proxy via X-Forwarded-Host). All advertised URLs in WWW-Authenticate
  // reflect this host so the client's discovery follow-up lands on the same
  // hostname they reached us on (api.callvaultai.com OR mcp.callvaultai.com).
  const originHost = resolveOriginHost(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Non-POST methods (GET, HEAD, PUT, DELETE) are not used by the MCP protocol
  // — but spec-strict clients (Perplexity) probe with GET first to test for
  // OAuth enforcement. Returning 405 here hides the WWW-Authenticate hint they
  // need to discover the OAuth flow, so we treat any non-POST/non-OPTIONS as
  // an unauthenticated probe and return 401 + WWW-Authenticate. The body is
  // a JSON-RPC error envelope (null id) for consistency with the POST path.
  if (req.method !== 'POST') {
    return unauthorizedResponse(null, corsHeaders, originHost, 'Authorization required (MCP requires POST with bearer token)');
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
  // RFC 9728 + MCP 2025-06-18 authorization spec: an OAuth-protected MCP
  // resource MUST return 401 + WWW-Authenticate on ANY request that lacks a
  // VALID bearer token — not just one without an Authorization header.
  //
  // Critical: token VALIDATION happens BEFORE method dispatch (including
  // initialize and tools/list). A previous iteration only checked for the
  // *presence* of an Authorization header before those two methods, which let
  // ANY string ("Bearer fake", "Bearer 000...", etc.) reach the protocol
  // handlers. Spec-strict clients (Perplexity) detect that 'invalid bearer
  // returns 200' as 'this server doesn't actually enforce OAuth', skip
  // discovery, and bail with misleading errors like:
  //   [API_CLIENTS_ERROR] Dynamic client registration did not return a client_secret
  //
  // See .planning/debug/resolved/mcp-server-bypassable-auth.md.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return unauthorizedResponse(id, corsHeaders, originHost);
  }

  const rawToken = authHeader.replace('Bearer ', '').trim();
  if (!rawToken) {
    return unauthorizedResponse(id, corsHeaders, originHost);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Detect token type: hex tokens are 64-char hex strings; JWTs have dots.
  const isHexToken = /^[0-9a-f]{64}$/.test(rawToken);

  let mcpToken: McpToken;

  if (isHexToken) {
    // ── Hex token auth (existing flow) ──────────────────────────────────────
    const { data: tokenRow, error: tokenError } = await supabase
      .from('mcp_tokens')
      .select('id, user_id, org_id, workspace_id, scope, name, enabled_categories')
      .eq('token', rawToken)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      // Invalid hex token → 401 + WWW-Authenticate (not 200/JSON-RPC-error).
      // The OAuth-discovery contract requires HTTP 401 for any unauthorized
      // request, regardless of method, so spec-strict clients can start the
      // OAuth dance from the WWW-Authenticate hint.
      return unauthorizedResponse(id, corsHeaders, originHost, 'Invalid MCP token');
    }

    mcpToken = tokenRow as McpToken;

    // Update last_used_at asynchronously (fire-and-forget)
    supabase
      .from('mcp_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', mcpToken.id)
      .then(() => {/* no-op */});
  } else {
    // ── OAuth JWT auth (new flow) ───────────────────────────────────────────
    // Create an anon client to validate the JWT via Supabase Auth API.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey;
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: { user: jwtUser }, error: jwtError } = await authClient.auth.getUser(rawToken);

    if (jwtError || !jwtUser) {
      // Invalid JWT → 401 + WWW-Authenticate (was previously 200/JSON-RPC-error
      // via mcpError, which let bypassable bearers reach initialize/tools/list).
      return unauthorizedResponse(id, corsHeaders, originHost, 'Invalid token');
    }

    // Look up the org binding set during OAuth consent.
    const { data: binding } = await supabase
      .from('mcp_oauth_org_bindings')
      .select('org_id')
      .eq('user_id', jwtUser.id)
      .maybeSingle();

    if (!binding) {
      // Token is valid but the user hasn't bound an org yet via /oauth/consent.
      // 403 would be more semantically correct ("authenticated but not
      // authorized for any org"), but MCP clients handle 401 + this message
      // by surfacing the consent URL to the user, which is what we want here.
      return unauthorizedResponse(
        id,
        corsHeaders,
        originHost,
        'No organization selected. Please re-authorize at https://app.callvaultai.com/settings/mcp',
      );
    }

    // Construct a synthetic McpToken for the rest of the handler.
    mcpToken = {
      id: `oauth-${jwtUser.id}`,
      user_id: jwtUser.id,
      org_id: binding.org_id,
      workspace_id: null,
      scope: 'organization',
      name: 'OAuth',
      enabled_categories: null,
    };
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
    return mcpJsonResult(id, { tools: TOOLS });
  }

  // ── Plan gating: enforce paid-tier requirement (D-01/D-02) ──────────────
  // Plan gating enforced — trial-provisioning migration 20260430123000 grants every signup a 7-day pro-trial.
  {
    const { data: ownerProfile } = await supabase
      .from('user_profiles')
      .select('subscription_status, product_id, current_period_end')
      .eq('user_id', mcpToken.user_id)
      .maybeSingle();

    const paid = isPaidTier(
      ownerProfile?.product_id ?? null,
      ownerProfile?.subscription_status ?? null,
      ownerProfile?.current_period_end ?? null,
    );
    if (!paid) {
      console.warn(`mcp-server: user ${mcpToken.user_id} has no active paid plan (product_id=${ownerProfile?.product_id})`);
      return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings', corsHeaders);
    }
  }

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
  if (
    mcpToken.enabled_categories !== null &&
    method === 'tools/call'
  ) {
    const category = TOOL_CATEGORIES[toolName];
    if (!category) {
      // D-08: unknown tool name → reject as if disabled.
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is not recognized. The MCP token's category whitelist does not cover unknown tools — contact CallVault support if this is a server-side bug.`,
        corsHeaders,
      );
    }
    if (!mcpToken.enabled_categories.includes(category)) {
      return mcpError(
        id,
        -32001,
        `Tool '${toolName}' is disabled for this token. Enable the '${category}' category in Settings > Integrations.`,
        corsHeaders,
      );
    }
  }

  try {
    switch (toolName) {
      // initialize and tools/list are handled pre-auth above

      case 'search_calls': {
        const query = typeof params.query === 'string' ? params.query.trim() : '';
        if (!query) return mcpError(id, -32602, 'query is required', corsHeaders);

        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 50) : 10;

        if (mcpToken.scope === 'workspace') {
          // Workspace-scoped: delegate to global_search with workspace filter (unchanged)
          const rpcParams: Record<string, unknown> = {
            query_text: query,
            filter_user_id: mcpToken.user_id,
            filter_workspace_id: mcpToken.workspace_id,
            filter_date_start: null,
            filter_date_end: null,
            filter_source_apps: null,
            filter_tag_ids: null,
            filter_folder_ids: null,
            match_count: limit,
          };

          const { data: rows, error: searchError } = await supabase.rpc('global_search', rpcParams);

          if (searchError) {
            console.error('mcp-server search_calls error:', searchError);
            return mcpError(id, -32603, `Search failed: ${searchError.message}`, corsHeaders);
          }

          const calls = (rows ?? []).filter((r: { entity_type: string }) => r.entity_type === 'call');

          return mcpOk(
            id,
            calls.length === 0
              ? `No calls found for query: "${query}"`
              : calls
                  .map(
                    (c: {
                      entity_id: string;
                      title: string;
                      subtitle: string;
                      relevance_score: number;
                      metadata: Record<string, unknown>;
                    }) =>
                      `ID: ${c.entity_id}\nTitle: ${c.title}\nDate: ${c.subtitle}\nRelevance: ${Math.round(c.relevance_score * 100)}%\n${c.metadata?.summary ? `Summary: ${c.metadata.summary}` : ''}`,
                  )
                  .join('\n\n---\n\n'),
          );
        }

        // Org-scoped: two-step query to enforce org boundary — do NOT use global_search
        const { ids: orgWorkspaceIds, error: wsLookupError } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
        if (wsLookupError || !orgWorkspaceIds) {
          return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
        }
        if (orgWorkspaceIds.length === 0) {
          return mcpOk(id, `No calls found for query: "${query}"`);
        }

        // Escape ILIKE special characters: backslash first, then % and _
        const escapedQuery = query.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
        const ilikePattern = `%${escapedQuery}%`;

        // Use server-side join to avoid URL length issues with large recording ID lists.
        // Search title and summary separately (avoids OR-filter comma-parsing issues), then merge.
        type EntrySearchRow = {
          recordings: { id: string; title: string | null; recording_start_time: string | null; summary: string | null };
        };
        const [{ data: titleRows, error: titleError }, { data: summaryRows, error: summaryError }] =
          await Promise.all([
            supabase
              .from('workspace_entries')
              .select('recordings!inner(id, title, recording_start_time, summary)')
              .in('workspace_id', orgWorkspaceIds)
              .filter('recordings.title', 'ilike', ilikePattern)
              .limit(limit),
            supabase
              .from('workspace_entries')
              .select('recordings!inner(id, title, recording_start_time, summary)')
              .in('workspace_id', orgWorkspaceIds)
              .filter('recordings.summary', 'ilike', ilikePattern)
              .limit(limit),
          ]);

        if (titleError) {
          console.error('mcp-server search_calls error:', titleError);
          return mcpError(id, -32603, `Search failed: ${titleError.message}`, corsHeaders);
        }
        if (summaryError) {
          console.error('mcp-server search_calls error:', summaryError);
          return mcpError(id, -32603, `Search failed: ${summaryError.message}`, corsHeaders);
        }

        type SearchRow = { id: string; title: string | null; recording_start_time: string | null; summary: string | null };
        const seen = new Set<string>();
        const calls: SearchRow[] = [];
        for (const row of [...(titleRows ?? []), ...(summaryRows ?? [])] as EntrySearchRow[]) {
          const rec = row.recordings;
          if (rec && !seen.has(rec.id)) {
            seen.add(rec.id);
            calls.push(rec);
            if (calls.length >= limit) break;
          }
        }

        return mcpOk(
          id,
          calls.length === 0
            ? `No calls found for query: "${query}"`
            : calls
                .map((c) => {
                  const date = c.recording_start_time
                    ? new Date(c.recording_start_time).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Unknown date';
                  return `ID: ${c.id}\nTitle: ${c.title || 'Untitled'}\nDate: ${date}${c.summary ? `\nSummary: ${c.summary}` : ''}`;
                })
                .join('\n\n---\n\n'),
        );
      }

      case 'list_calls': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
        const offset = typeof params.offset === 'number' ? Math.max(0, params.offset) : 0;

        // Determine which workspace IDs are in scope
        let workspaceIds: string[] | null = null;

        if (mcpToken.scope === 'workspace') {
          workspaceIds = [mcpToken.workspace_id!];
        } else if (typeof params.workspace_id === 'string' && params.workspace_id) {
          // Org-scoped token requesting a specific workspace — verify it belongs to the org
          const { data: wsCheck } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', params.workspace_id)
            .eq('organization_id', mcpToken.org_id!)
            .maybeSingle();
          if (!wsCheck) return mcpError(id, -32602, 'workspace_id not found in this organization', corsHeaders);
          workspaceIds = [params.workspace_id as string];
        }

        // Build query through workspace_entries → recordings join
        let query = supabase
          .from('workspace_entries')
          .select(`
            recording_id,
            recordings (
              id,
              title,
              recording_start_time,
              duration,
              source_app,
              summary
            )
          `);

        if (workspaceIds) {
          query = query.in('workspace_id', workspaceIds);
        } else {
          // Org-scoped: filter to workspaces in the org
          const { data: orgWs } = await supabase
            .from('workspaces')
            .select('id')
            .eq('organization_id', mcpToken.org_id!);
          const ids = (orgWs ?? []).map((w: { id: string }) => w.id);
          if (ids.length === 0) return mcpOk(id, 'No workspaces found in this organization.');
          query = query.in('workspace_id', ids);
        }

        const { data: entries, error: listError } = await query
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (listError) {
          console.error('mcp-server list_calls error:', listError);
          return mcpError(id, -32603, `Failed to list calls: ${listError.message}`, corsHeaders);
        }

        type EntryRow = {
          recording_id: string;
          recordings: {
            id: string;
            title: string | null;
            recording_start_time: string | null;
            duration: number | null;
            source_app: string | null;
            summary: string | null;
          } | null;
        };

        const calls = (entries ?? [] as EntryRow[]).filter((e: EntryRow) => e.recordings);
        if (calls.length === 0) return mcpOk(id, 'No calls found.');

        return mcpOk(
          id,
          calls
            .map((e: EntryRow) => {
              const r = e.recordings!;
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}\nSource: ${r.source_app || 'unknown'}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      case 'get_transcript': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify access: workspace-scoped tokens check workspace_id directly;
        // org-scoped tokens verify the recording is in a workspace belonging to this org.
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
        } else {
          const { ids: orgWorkspaceIds, error: wsLookupError } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsLookupError || !orgWorkspaceIds) {
            return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          }
          if (orgWorkspaceIds.length === 0) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWorkspaceIds)
            .maybeSingle();
          if (!access) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
        }

        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, recording_start_time')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        if (!recording.full_transcript) {
          return mcpOk(id, `No transcript available for: ${recording.title || recordingId}`);
        }

        const date = recording.recording_start_time
          ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : 'Unknown date';

        return mcpOk(
          id,
          `# Transcript: ${recording.title || 'Untitled'}\nDate: ${date}\n\n${recording.full_transcript}`,
        );
      }

      case 'get_recording_context': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify access: workspace-scoped tokens check workspace_id directly;
        // org-scoped tokens verify the recording is in a workspace belonging to this org.
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
        } else {
          const { ids: orgWorkspaceIds, error: wsLookupError } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsLookupError || !orgWorkspaceIds) {
            return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          }
          if (orgWorkspaceIds.length === 0) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWorkspaceIds)
            .maybeSingle();
          if (!access) {
            return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          }
        }

        // Fetch core recording info
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, summary, recording_start_time, recording_end_time, duration, source_app, global_tags, source_metadata')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        // Fetch speakers (call_participants)
        const { data: participants } = await supabase
          .from('call_participants')
          .select('name, email, role')
          .eq('recording_id', recordingId)
          .order('name');

        // Fetch tags (call_tag_assignments)
        const { data: tagAssignments } = await supabase
          .from('call_tag_assignments')
          .select('tag:personal_tags(name, color)')
          .eq('recording_id', recordingId);

        // Build context document
        const date = recording.recording_start_time
          ? new Date(recording.recording_start_time).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : 'Unknown date';

        const durationStr = recording.duration
          ? `${Math.floor(recording.duration / 3600) > 0 ? `${Math.floor(recording.duration / 3600)}h ` : ''}${Math.floor((recording.duration % 3600) / 60)}m ${recording.duration % 60}s`
          : 'Unknown';

        const speakersStr =
          participants && participants.length > 0
            ? participants
                .map((p: { name: string | null; email: string | null; role: string | null }) =>
                  `  - ${p.name || p.email || 'Unknown'}${p.role ? ` (${p.role})` : ''}`,
                )
                .join('\n')
            : '  - No participant data';

        type TagAssignment = { tag: { name: string; color: string | null } | null };
        const tagsStr =
          tagAssignments && tagAssignments.length > 0
            ? (tagAssignments as TagAssignment[])
                .filter((t) => t.tag)
                .map((t) => `  - ${t.tag!.name}`)
                .join('\n')
            : '  - No tags';

        const globalTagsStr =
          recording.global_tags && Array.isArray(recording.global_tags) && recording.global_tags.length > 0
            ? (recording.global_tags as string[]).join(', ')
            : null;

        const context = [
          `# ${recording.title || 'Untitled Call'}`,
          ``,
          `## Metadata`,
          `- **Date**: ${date}`,
          `- **Duration**: ${durationStr}`,
          `- **Source**: ${recording.source_app || 'unknown'}`,
          `- **Recording ID**: ${recording.id}`,
          ``,
          `## Summary`,
          recording.summary || 'No summary available.',
          ``,
          `## Speakers`,
          speakersStr,
          ``,
          `## Tags`,
          tagsStr,
          globalTagsStr ? `\n## Auto-tags\n${globalTagsStr}` : '',
        ]
          .filter((line) => line !== null)
          .join('\n');

        return mcpOk(id, context);
      }

      case 'list_workspaces': {
        let workspacesQuery = supabase
          .from('workspaces')
          .select('id, name, workspace_type, created_at')
          .order('name');

        if (mcpToken.scope === 'workspace') {
          // Token is scoped to a single workspace
          workspacesQuery = workspacesQuery.eq('id', mcpToken.workspace_id!);
        } else {
          // Org-scoped: return all workspaces in the org that this user belongs to
          workspacesQuery = workspacesQuery
            .eq('organization_id', mcpToken.org_id!)
            .in(
              'id',
              // Sub-filter to workspaces the user is a member of
              (
                await supabase
                  .from('workspace_memberships')
                  .select('workspace_id')
                  .eq('user_id', mcpToken.user_id)
              ).data?.map((m: { workspace_id: string }) => m.workspace_id) ?? [],
            );
        }

        const { data: workspaces, error: wsError } = await workspacesQuery;

        if (wsError) {
          return mcpError(id, -32603, `Failed to list workspaces: ${wsError.message}`, corsHeaders);
        }

        if (!workspaces || workspaces.length === 0) {
          return mcpOk(id, 'No workspaces found.');
        }

        type WsRow = { id: string; name: string; workspace_type: string | null; created_at: string };
        return mcpOk(
          id,
          (workspaces as WsRow[])
            .map((w) => `ID: ${w.id}\nName: ${w.name}\nType: ${w.workspace_type || 'standard'}`)
            .join('\n\n---\n\n'),
        );
      }

      // ── Contacts ─────────────────────────────────────────────────────────────

      case 'list_contacts': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;
        const search = typeof params.search === 'string' ? params.search.trim() : '';

        let query = supabase
          .from('contacts')
          .select('id, name, email, contact_type, last_seen_at, track_health, notes')
          .eq('user_id', mcpToken.user_id)
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (search) {
          const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const pattern = `%${escaped}%`;
          query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
        }

        const { data: contacts, error: contactsError } = await query;

        if (contactsError) {
          return mcpError(id, -32603, `Failed to list contacts: ${contactsError.message}`, corsHeaders);
        }

        if (!contacts || contacts.length === 0) {
          return mcpOk(id, search ? `No contacts found matching "${search}".` : 'No contacts found.');
        }

        type ContactRow = { id: string; name: string | null; email: string; contact_type: string | null; last_seen_at: string | null; track_health: boolean; notes: string | null };
        return mcpOk(
          id,
          (contacts as ContactRow[])
            .map((c) => {
              const lastSeen = c.last_seen_at
                ? new Date(c.last_seen_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Never';
              return `ID: ${c.id}\nName: ${c.name || 'Unknown'}\nEmail: ${c.email}\nType: ${c.contact_type || 'other'}\nLast seen: ${lastSeen}${c.notes ? `\nNotes: ${c.notes}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      case 'get_contact': {
        const contactId = typeof params.contact_id === 'string' ? params.contact_id.trim() : '';
        if (!contactId) return mcpError(id, -32602, 'contact_id is required', corsHeaders);

        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('id, name, email, contact_type, last_seen_at, track_health, health_alert_threshold_days, notes, tags, created_at')
          .eq('id', contactId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (contactError || !contact) {
          return mcpError(id, -32001, 'Contact not found or not accessible', corsHeaders);
        }

        // Fetch recent call appearances
        const { data: appearances } = await supabase
          .from('contact_call_appearances')
          .select('recording_id, appeared_at')
          .eq('contact_id', contactId)
          .eq('user_id', mcpToken.user_id)
          .order('appeared_at', { ascending: false })
          .limit(10);

        const lastSeen = contact.last_seen_at
          ? new Date(contact.last_seen_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : 'Never';
        const created = new Date(contact.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const callCount = appearances?.length ?? 0;

        const context = [
          `# Contact: ${contact.name || contact.email}`,
          ``,
          `## Details`,
          `- **Email**: ${contact.email}`,
          `- **Type**: ${contact.contact_type || 'other'}`,
          `- **Last seen**: ${lastSeen}`,
          `- **Created**: ${created}`,
          `- **Health tracking**: ${contact.track_health ? 'Enabled' : 'Disabled'}`,
          contact.health_alert_threshold_days ? `- **Alert threshold**: ${contact.health_alert_threshold_days} days` : '',
          contact.tags && contact.tags.length > 0 ? `- **Tags**: ${contact.tags.join(', ')}` : '',
          contact.notes ? `\n## Notes\n${contact.notes}` : '',
          ``,
          `## Recent Calls (${callCount})`,
          callCount > 0
            ? (appearances ?? []).map((a: { recording_id: string; appeared_at: string | null }) => {
                const date = a.appeared_at ? new Date(a.appeared_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown';
                return `  - Recording ${a.recording_id} (${date})`;
              }).join('\n')
            : '  No call history found.',
        ].filter(Boolean).join('\n');

        return mcpOk(id, context);
      }

      case 'get_contact_calls': {
        const contactId = typeof params.contact_id === 'string' ? params.contact_id.trim() : '';
        if (!contactId) return mcpError(id, -32602, 'contact_id is required', corsHeaders);
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

        // Verify contact belongs to user
        const { data: contactCheck } = await supabase
          .from('contacts')
          .select('id')
          .eq('id', contactId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!contactCheck) {
          return mcpError(id, -32001, 'Contact not found or not accessible', corsHeaders);
        }

        // Get recording IDs from appearances
        const { data: appearances, error: appError } = await supabase
          .from('contact_call_appearances')
          .select('recording_id, appeared_at')
          .eq('contact_id', contactId)
          .eq('user_id', mcpToken.user_id)
          .order('appeared_at', { ascending: false })
          .limit(limit);

        if (appError) {
          return mcpError(id, -32603, `Failed to fetch contact calls: ${appError.message}`, corsHeaders);
        }

        if (!appearances || appearances.length === 0) {
          return mcpOk(id, 'No calls found for this contact.');
        }

        // The recording_id in contact_call_appearances is BIGINT (legacy)
        // Look up recordings by legacy_recording_id
        const recIds = appearances.map((a: { recording_id: number }) => a.recording_id);
        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, legacy_recording_id, title, recording_start_time, duration, summary')
          .in('legacy_recording_id', recIds);

        type RecRow = { id: string; legacy_recording_id: number; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null };
        const recMap = new Map((recordings ?? []).map((r: RecRow) => [r.legacy_recording_id, r]));

        return mcpOk(
          id,
          appearances
            .map((a: { recording_id: number; appeared_at: string | null }) => {
              const rec = recMap.get(a.recording_id) as RecRow | undefined;
              const date = a.appeared_at ? new Date(a.appeared_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown date';
              if (rec) {
                const duration = rec.duration ? `${Math.round(rec.duration / 60)}m` : 'Unknown duration';
                return `ID: ${rec.id}\nTitle: ${rec.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${rec.summary ? `\nSummary: ${rec.summary}` : ''}`;
              }
              return `Legacy Recording ID: ${a.recording_id}\nDate: ${date}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      // ── Folders ──────────────────────────────────────────────────────────────

      case 'list_folders': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;

        let query = supabase
          .from('personal_folders')
          .select('id, name, created_at, organization_id')
          .eq('user_id', mcpToken.user_id)
          .order('name')
          .limit(limit);

        if (mcpToken.scope === 'workspace') {
          // For workspace-scoped, filter by the org that owns the workspace
          const { data: ws } = await supabase
            .from('workspaces')
            .select('organization_id')
            .eq('id', mcpToken.workspace_id!)
            .maybeSingle();
          if (ws) query = query.eq('organization_id', ws.organization_id);
        } else if (mcpToken.org_id) {
          query = query.eq('organization_id', mcpToken.org_id);
        }

        const { data: folders, error: foldersError } = await query;

        if (foldersError) {
          return mcpError(id, -32603, `Failed to list folders: ${foldersError.message}`, corsHeaders);
        }

        if (!folders || folders.length === 0) {
          return mcpOk(id, 'No folders found.');
        }

        type FolderRow = { id: string; name: string; created_at: string };
        return mcpOk(
          id,
          (folders as FolderRow[])
            .map((f) => `ID: ${f.id}\nName: ${f.name}`)
            .join('\n\n---\n\n'),
        );
      }

      case 'get_folder_calls': {
        const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
        if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

        // Verify folder belongs to user
        const { data: folderCheck } = await supabase
          .from('personal_folders')
          .select('id, name')
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!folderCheck) {
          return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);
        }

        // Get recordings via junction table
        const { data: folderRecs, error: frError } = await supabase
          .from('personal_folder_recordings')
          .select('recording_id, recordings(id, title, recording_start_time, duration, summary)')
          .eq('folder_id', folderId)
          .eq('user_id', mcpToken.user_id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (frError) {
          return mcpError(id, -32603, `Failed to fetch folder calls: ${frError.message}`, corsHeaders);
        }

        if (!folderRecs || folderRecs.length === 0) {
          return mcpOk(id, `No calls found in folder "${folderCheck.name}".`);
        }

        type FolderRecRow = { recording_id: string; recordings: { id: string; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null } | null };
        return mcpOk(
          id,
          `# Folder: ${folderCheck.name}\n\n` +
          (folderRecs as FolderRecRow[])
            .filter((fr) => fr.recordings)
            .map((fr) => {
              const r = fr.recordings!;
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      // ── Tags ─────────────────────────────────────────────────────────────────

      case 'list_tags': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;

        let query = supabase
          .from('personal_tags')
          .select('id, name, color, created_at, organization_id')
          .eq('user_id', mcpToken.user_id)
          .order('name')
          .limit(limit);

        if (mcpToken.scope === 'workspace') {
          const { data: ws } = await supabase
            .from('workspaces')
            .select('organization_id')
            .eq('id', mcpToken.workspace_id!)
            .maybeSingle();
          if (ws) query = query.eq('organization_id', ws.organization_id);
        } else if (mcpToken.org_id) {
          query = query.eq('organization_id', mcpToken.org_id);
        }

        const { data: tags, error: tagsError } = await query;

        if (tagsError) {
          return mcpError(id, -32603, `Failed to list tags: ${tagsError.message}`, corsHeaders);
        }

        if (!tags || tags.length === 0) {
          return mcpOk(id, 'No tags found.');
        }

        type TagRow = { id: string; name: string; color: string | null };
        return mcpOk(
          id,
          (tags as TagRow[])
            .map((t) => `ID: ${t.id}\nName: ${t.name}${t.color ? `\nColor: ${t.color}` : ''}`)
            .join('\n\n---\n\n'),
        );
      }

      case 'get_tagged_calls': {
        const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
        const tagName = typeof params.tag_name === 'string' ? params.tag_name.trim() : '';
        if (!tagId && !tagName) return mcpError(id, -32602, 'tag_id or tag_name is required', corsHeaders);
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

        // Resolve tag ID
        let resolvedTagId = tagId;
        if (!resolvedTagId && tagName) {
          let tagQuery = supabase
            .from('personal_tags')
            .select('id')
            .eq('user_id', mcpToken.user_id)
            .ilike('name', tagName)
            .limit(1)
            .maybeSingle();

          if (mcpToken.org_id) {
            tagQuery = supabase
              .from('personal_tags')
              .select('id')
              .eq('user_id', mcpToken.user_id)
              .eq('organization_id', mcpToken.org_id)
              .ilike('name', tagName)
              .limit(1)
              .maybeSingle();
          }

          const { data: tagRow } = await tagQuery;
          if (!tagRow) return mcpOk(id, `No tag found with name "${tagName}".`);
          resolvedTagId = tagRow.id;
        }

        // Get recordings via junction table
        const { data: tagRecs, error: trError } = await supabase
          .from('personal_tag_recordings')
          .select('recording_id, recordings(id, title, recording_start_time, duration, summary)')
          .eq('tag_id', resolvedTagId)
          .eq('user_id', mcpToken.user_id)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (trError) {
          return mcpError(id, -32603, `Failed to fetch tagged calls: ${trError.message}`, corsHeaders);
        }

        if (!tagRecs || tagRecs.length === 0) {
          return mcpOk(id, 'No calls found with this tag.');
        }

        type TagRecRow = { recording_id: string; recordings: { id: string; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null } | null };
        return mcpOk(
          id,
          (tagRecs as TagRecRow[])
            .filter((tr) => tr.recordings)
            .map((tr) => {
              const r = tr.recordings!;
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      // ── Speakers ─────────────────────────────────────────────────────────────

      case 'list_speakers': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 200) : 50;
        const search = typeof params.search === 'string' ? params.search.trim() : '';

        // Get workspace IDs for boundary enforcement
        let wsIds: string[];
        if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
        if (wsIds.length === 0) return mcpOk(id, 'No speakers found.');

        // Get org IDs from workspaces for call_participants filtering
        const { data: wsOrgs } = await supabase
          .from('workspaces')
          .select('organization_id')
          .in('id', wsIds);
        const orgIds = [...new Set((wsOrgs ?? []).map((w: { organization_id: string }) => w.organization_id))];
        if (orgIds.length === 0) return mcpOk(id, 'No speakers found.');

        let query = supabase
          .from('call_participants')
          .select('name, email, participant_type')
          .in('organization_id', orgIds)
          .not('name', 'is', null)
          .order('name')
          .limit(limit);

        if (search) {
          const escaped = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          const pattern = `%${escaped}%`;
          query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
        }

        const { data: speakers, error: speakersError } = await query;

        if (speakersError) {
          return mcpError(id, -32603, `Failed to list speakers: ${speakersError.message}`, corsHeaders);
        }

        if (!speakers || speakers.length === 0) {
          return mcpOk(id, search ? `No speakers found matching "${search}".` : 'No speakers found.');
        }

        // Deduplicate by name+email
        type SpeakerRow = { name: string | null; email: string | null; participant_type: string };
        const seen = new Set<string>();
        const unique: SpeakerRow[] = [];
        for (const s of speakers as SpeakerRow[]) {
          const key = `${(s.name || '').toLowerCase()}|${(s.email || '').toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(s);
          }
        }

        return mcpOk(
          id,
          unique
            .map((s) => `Name: ${s.name || 'Unknown'}${s.email ? `\nEmail: ${s.email}` : ''}\nType: ${s.participant_type}`)
            .join('\n\n---\n\n'),
        );
      }

      case 'get_speaker_calls': {
        const speakerName = typeof params.speaker_name === 'string' ? params.speaker_name.trim() : '';
        const speakerEmail = typeof params.speaker_email === 'string' ? params.speaker_email.trim() : '';
        if (!speakerName && !speakerEmail) return mcpError(id, -32602, 'speaker_name or speaker_email is required', corsHeaders);
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

        // Get workspace IDs for boundary
        let wsIds: string[];
        if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
        if (wsIds.length === 0) return mcpOk(id, 'No calls found for this speaker.');

        const { data: wsOrgs } = await supabase
          .from('workspaces')
          .select('organization_id')
          .in('id', wsIds);
        const orgIds = [...new Set((wsOrgs ?? []).map((w: { organization_id: string }) => w.organization_id))];

        // Find recording IDs for this speaker
        let partQuery = supabase
          .from('call_participants')
          .select('recording_id')
          .in('organization_id', orgIds)
          .limit(limit);

        if (speakerEmail) {
          partQuery = partQuery.ilike('email', speakerEmail.toLowerCase());
        } else {
          const escaped = speakerName.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
          partQuery = partQuery.ilike('name', `%${escaped}%`);
        }

        const { data: partRows, error: partError } = await partQuery;

        if (partError) {
          return mcpError(id, -32603, `Failed to fetch speaker calls: ${partError.message}`, corsHeaders);
        }

        if (!partRows || partRows.length === 0) {
          return mcpOk(id, `No calls found for speaker "${speakerName || speakerEmail}".`);
        }

        const recIds = [...new Set(partRows.map((p: { recording_id: string }) => p.recording_id))];

        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, title, recording_start_time, duration, summary')
          .in('id', recIds)
          .order('recording_start_time', { ascending: false })
          .limit(limit);

        if (!recordings || recordings.length === 0) {
          return mcpOk(id, `No calls found for speaker "${speakerName || speakerEmail}".`);
        }

        type RecRow = { id: string; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null };
        return mcpOk(
          id,
          `# Calls with ${speakerName || speakerEmail}\n\n` +
          (recordings as RecRow[])
            .map((r) => {
              const date = r.recording_start_time
                ? new Date(r.recording_start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown date';
              const duration = r.duration ? `${Math.round(r.duration / 60)}m` : 'Unknown duration';
              return `ID: ${r.id}\nTitle: ${r.title || 'Untitled'}\nDate: ${date}\nDuration: ${duration}${r.summary ? `\nSummary: ${r.summary}` : ''}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      // ── AI Features ──────────────────────────────────────────────────────────

      case 'get_action_items': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify access
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, summary, source_metadata')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        // Extract action items from source_metadata (Fathom/Zoom may store them)
        const meta = recording.source_metadata as Record<string, unknown> | null;
        const metaActionItems = meta?.action_items as string[] | undefined;

        // Build output
        const sections: string[] = [`# Action Items: ${recording.title || 'Untitled'}`];

        if (metaActionItems && metaActionItems.length > 0) {
          sections.push('', '## Extracted Action Items');
          metaActionItems.forEach((item: string, i: number) => {
            sections.push(`${i + 1}. ${item}`);
          });
        }

        if (recording.summary) {
          sections.push('', '## Summary (may contain additional action items)');
          sections.push(recording.summary);
        }

        if (!metaActionItems?.length && !recording.summary) {
          sections.push('', 'No action items or summary available for this recording.');
        }

        return mcpOk(id, sections.join('\n'));
      }

      case 'extract_action_items': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // ── Org/workspace boundary (D-16: copy verbatim from get_action_items) ──
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // ── Fetch the recording (need transcript + metadata + caches) ──
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, source_metadata, action_items_cache')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        type ActionItem = { owner: string | null; action: string; due_date: string | null };

        // ── D-04 Tier 1: Fathom pre-extracted items (no LLM, no cost) ──
        const meta = recording.source_metadata as Record<string, unknown> | null;
        const fathomItems = meta?.action_items as string[] | undefined;
        if (fathomItems && Array.isArray(fathomItems) && fathomItems.length > 0) {
          const lines = [`# Action Items: ${recording.title || 'Untitled'} (source: Fathom)`];
          fathomItems.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
          return mcpOk(id, lines.join('\n'));
        }

        // ── D-04 Tier 2: cached LLM result (no LLM, no cost) ──
        // Treat empty cache as a valid result (model concluded "no action items").
        const cached = recording.action_items_cache as { items?: ActionItem[] } | null;
        if (cached && Array.isArray(cached.items)) {
          const lines = [`# Action Items: ${recording.title || 'Untitled'} (cached)`];
          if (cached.items.length === 0) {
            lines.push('', 'No action items found in this transcript.');
          } else {
            cached.items.forEach((it, i) => {
              const owner = it.owner ? `${it.owner}: ` : '';
              const due = it.due_date ? ` (due ${it.due_date})` : '';
              lines.push(`${i + 1}. ${owner}${it.action}${due}`);
            });
          }
          return mcpOk(id, lines.join('\n'));
        }

        // ── D-04 Tier 3: LLM extraction ──
        // Validate transcript before paying for an LLM call.
        const transcript = recording.full_transcript || '';
        if (!transcript.trim()) {
          return mcpError(id, -32602, 'No transcript available for this recording', corsHeaders);
        }

        // OPENROUTER_API_KEY must be set on the function. If missing, fail fast.
        const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!openrouterApiKey) {
          return mcpError(id, -32603, 'AI provider not configured', corsHeaders);
        }

        // ── Cost gate (D-10): MUST run BEFORE OpenRouter ──
        const gate = await enforceMcpAiUsage({
          supabase,
          userId: mcpToken.user_id,
          orgId: mcpToken.org_id,
          actionType: 'mcp_action_items',
          recordingId,
        });
        if (!gate.allowed) {
          return mcpError(id, -32001, gate.reason, corsHeaders);
        }

        // Truncate transcript per the existing summarize-call convention (15k char budget).
        const limitedTranscript =
          transcript.length > 15000
            ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for extraction...]'
            : transcript;

        const ActionItemsSchema = z.object({
          items: z.array(
            z.object({
              owner: z
                .string()
                .nullable()
                .describe(
                  'Person responsible — speaker name from the transcript when explicit, otherwise null.',
                ),
              action: z.string().describe('What needs to be done — concise, imperative, one sentence.'),
              due_date: z
                .string()
                .nullable()
                .describe(
                  'Due date in ISO 8601 format (YYYY-MM-DD) when the transcript mentions a specific date or relative date that resolves to one; otherwise null.',
                ),
            }),
          ),
        });

        const openrouter = createOpenRouter({
          apiKey: openrouterApiKey,
          headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
        });

        const prompt = `Extract concrete action items from this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Rules:
- Only include items the transcript clearly identifies as actions, decisions, or follow-ups someone agreed to do.
- Owner: use the speaker name from the transcript when explicit. If multiple speakers agree to it, pick the one who committed. If unclear, set owner to null.
- Action: one short imperative sentence (e.g., "Send the proposal by Friday").
- Due date: ISO 8601 format (YYYY-MM-DD) only when explicitly mentioned. Convert relative dates ("next Friday") only if the meeting date is also mentioned. Otherwise set due_date to null.
- Do NOT invent items not in the transcript.
- If there are no action items, return { "items": [] }.

Transcript:
${limitedTranscript}`;

        let llmItems: ActionItem[];
        try {
          const result = await generateObject({
            model: openrouter('openai/gpt-5-nano'),
            schema: ActionItemsSchema,
            prompt,
          });
          llmItems = result.object.items;
        } catch (err) {
          console.error('extract_action_items: LLM call failed:', err);
          return mcpError(
            id,
            -32603,
            'Failed to extract action items from this recording',
            corsHeaders,
          );
        }

        // Best-effort cache write (mirrors summarize-call: log on failure, return result anyway).
        const { error: cacheError } = await supabase
          .from('recordings')
          .update({ action_items_cache: { items: llmItems } })
          .eq('id', recordingId);
        if (cacheError) {
          console.error('extract_action_items: cache write failed:', cacheError);
        }

        // Format response
        const lines = [`# Action Items: ${recording.title || 'Untitled'} (extracted)`];
        if (llmItems.length === 0) {
          lines.push('', 'No action items found in this transcript.');
        } else {
          llmItems.forEach((it, i) => {
            const owner = it.owner ? `${it.owner}: ` : '';
            const due = it.due_date ? ` (due ${it.due_date})` : '';
            lines.push(`${i + 1}. ${owner}${it.action}${due}`);
          });
        }
        return mcpOk(id, lines.join('\n'));
      }

      case 'ask_call': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        const question = typeof params.question === 'string' ? params.question.trim() : '';
        if (!question) return mcpError(id, -32602, 'question is required', corsHeaders);
        if (question.length > 500) {
          return mcpError(id, -32602, 'question must be 500 characters or fewer', corsHeaders);
        }

        // ── Org/workspace boundary (D-16: copy verbatim from get_action_items) ──
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // ── Fetch the recording (transcript only — no cache lookup, D-03) ──
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        const transcript = recording.full_transcript || '';
        if (!transcript.trim()) {
          return mcpError(id, -32602, 'No transcript available for this recording', corsHeaders);
        }

        const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!openrouterApiKey) {
          return mcpError(id, -32603, 'AI provider not configured', corsHeaders);
        }

        // ── Cost gate (D-10): MUST run BEFORE OpenRouter ──
        const gate = await enforceMcpAiUsage({
          supabase,
          userId: mcpToken.user_id,
          orgId: mcpToken.org_id,
          actionType: 'mcp_ask_call',
          recordingId,
        });
        if (!gate.allowed) {
          return mcpError(id, -32001, gate.reason, corsHeaders);
        }

        const limitedTranscript =
          transcript.length > 15000
            ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for Q&A...]'
            : transcript;

        const openrouter = createOpenRouter({
          apiKey: openrouterApiKey,
          headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
        });

        const systemPrompt =
          'You are answering a question about a call recording. Quote the transcript directly when possible. ' +
          'If the question cannot be answered from the transcript alone, say so explicitly. Do not speculate beyond what the transcript supports.';

        let answer: string;
        try {
          const result = await generateText({
            model: openrouter('openai/gpt-5-nano'),
            system: systemPrompt,
            prompt: `Meeting Title: ${recording.title || 'Unknown'}

Transcript:
${limitedTranscript}

Question: ${question}

Answer:`,
            maxTokens: 800,
          });
          answer = result.text;
        } catch (err) {
          console.error('ask_call: LLM call failed:', err);
          return mcpError(id, -32603, 'Failed to answer question', corsHeaders);
        }

        return mcpOk(id, `Q: ${question}\nA: ${answer}`);
      }

      case 'get_sentiment': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // ── Org/workspace boundary (D-16: copy verbatim from get_action_items) ──
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // ── Fetch the recording (transcript + cache) ──
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, sentiment_cache')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        type SentimentResult = {
          overall: 'positive' | 'neutral' | 'negative' | 'mixed';
          talk_ratio: Array<{ speaker_name: string; percentage: number }>;
          key_moments: Array<{ timestamp: string; sentiment: string; snippet: string }>;
        };

        const formatSentiment = (data: SentimentResult, source: 'cached' | 'analyzed') => {
          const lines = [`# Sentiment: ${recording.title || 'Untitled'} (${source})`];
          lines.push('', `**Overall:** ${data.overall}`);

          if (data.talk_ratio.length > 0) {
            lines.push('', '## Talk Ratio');
            data.talk_ratio.forEach((r) => {
              lines.push(`- ${r.speaker_name}: ${r.percentage}%`);
            });
          }

          if (data.key_moments.length > 0) {
            lines.push('', '## Key Moments');
            data.key_moments.forEach((m, i) => {
              lines.push(`${i + 1}. [${m.timestamp}] (${m.sentiment}) "${m.snippet}"`);
            });
          }

          return lines.join('\n');
        };

        // ── Tier 1: cached LLM result (no LLM, no cost) ──
        // sentiment_cache may have been populated by older code paths with a different shape;
        // validate the expected shape before trusting the cache.
        const cached = recording.sentiment_cache as SentimentResult | null;
        if (
          cached &&
          typeof cached === 'object' &&
          typeof cached.overall === 'string' &&
          ['positive', 'neutral', 'negative', 'mixed'].includes(cached.overall) &&
          Array.isArray(cached.talk_ratio) &&
          Array.isArray(cached.key_moments)
        ) {
          return mcpOk(id, formatSentiment(cached, 'cached'));
        }

        // ── Tier 2: LLM extraction ──
        const transcript = recording.full_transcript || '';
        if (!transcript.trim()) {
          return mcpError(id, -32602, 'No transcript available for this recording', corsHeaders);
        }

        const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!openrouterApiKey) {
          return mcpError(id, -32603, 'AI provider not configured', corsHeaders);
        }

        // ── Cost gate (D-10): MUST run BEFORE OpenRouter ──
        const gate = await enforceMcpAiUsage({
          supabase,
          userId: mcpToken.user_id,
          orgId: mcpToken.org_id,
          actionType: 'mcp_sentiment',
          recordingId,
        });
        if (!gate.allowed) {
          return mcpError(id, -32001, gate.reason, corsHeaders);
        }

        const limitedTranscript =
          transcript.length > 15000
            ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for sentiment analysis...]'
            : transcript;

        const SentimentSchema = z.object({
          overall: z
            .enum(['positive', 'neutral', 'negative', 'mixed'])
            .describe('Overall tone of the conversation across all speakers.'),
          talk_ratio: z
            .array(
              z.object({
                speaker_name: z.string().describe('Speaker name as it appears in the transcript.'),
                percentage: z
                  .number()
                  .min(0)
                  .max(100)
                  .describe('Approximate share of speaking time, 0-100. All percentages should sum to ~100.'),
              }),
            )
            .describe('Per-speaker share of speaking time (best-effort estimate from transcript content).'),
          key_moments: z
            .array(
              z.object({
                timestamp: z
                  .string()
                  .describe('Approximate timestamp from the transcript in MM:SS or HH:MM:SS form, or empty string if not present.'),
                sentiment: z.string().describe('Short sentiment label for this moment (e.g., "tense", "celebratory", "frustrated").'),
                snippet: z.string().describe('Direct quote (5-30 words) from the transcript at this moment.'),
              }),
            )
            .describe('2-5 notable moments where sentiment shifts or peaks.'),
        });

        const openrouter = createOpenRouter({
          apiKey: openrouterApiKey,
          headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
        });

        const prompt = `Analyze the sentiment of this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Required output:
1. Overall sentiment across the conversation: positive | neutral | negative | mixed
2. Per-speaker talk ratio (estimate from text length; total ~100%)
3. 2-5 key moments where sentiment is notable, with approximate timestamps if present in the transcript

Be factual. Use direct quotes for snippets. Do not invent moments not in the transcript.

Transcript:
${limitedTranscript}`;

        let llmResult: SentimentResult;
        try {
          const result = await generateObject({
            model: openrouter('openai/gpt-5-nano'),
            schema: SentimentSchema,
            prompt,
          });
          llmResult = result.object;
        } catch (err) {
          console.error('get_sentiment: LLM call failed:', err);
          return mcpError(id, -32603, 'Failed to analyze sentiment for this recording', corsHeaders);
        }

        // Best-effort cache write
        const { error: cacheError } = await supabase
          .from('recordings')
          .update({ sentiment_cache: llmResult })
          .eq('id', recordingId);
        if (cacheError) {
          console.error('get_sentiment: cache write failed:', cacheError);
        }

        return mcpOk(id, formatSentiment(llmResult, 'analyzed'));
      }

      case 'get_coaching_notes': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // ── Org/workspace boundary (D-16: copy verbatim from get_action_items) ──
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // ── Fetch the recording (transcript + cache) ──
        const { data: recording, error: recError } = await supabase
          .from('recordings')
          .select('id, title, full_transcript, coaching_cache')
          .eq('id', recordingId)
          .maybeSingle();

        if (recError || !recording) {
          return mcpError(id, -32603, 'Failed to fetch recording', corsHeaders);
        }

        type CoachingNotes = {
          strengths: string[];
          improvements: string[];
          specific_examples: Array<{ topic: string; observation: string; suggestion: string }>;
        };

        const formatCoaching = (data: CoachingNotes, source: 'cached' | 'analyzed') => {
          const lines = [`# Coaching Notes: ${recording.title || 'Untitled'} (${source})`];

          if (data.strengths.length > 0) {
            lines.push('', '## Strengths');
            data.strengths.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
          }

          if (data.improvements.length > 0) {
            lines.push('', '## Areas for Improvement');
            data.improvements.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
          }

          if (data.specific_examples.length > 0) {
            lines.push('', '## Specific Examples');
            data.specific_examples.forEach((ex, i) => {
              lines.push(`${i + 1}. **${ex.topic}**`);
              lines.push(`   - Observation: ${ex.observation}`);
              lines.push(`   - Suggestion: ${ex.suggestion}`);
            });
          }

          if (
            data.strengths.length === 0 &&
            data.improvements.length === 0 &&
            data.specific_examples.length === 0
          ) {
            lines.push('', 'No coaching notes generated for this recording.');
          }

          return lines.join('\n');
        };

        // ── Tier 1: cached LLM result (no LLM, no cost) ──
        const cached = recording.coaching_cache as CoachingNotes | null;
        if (
          cached &&
          typeof cached === 'object' &&
          Array.isArray(cached.strengths) &&
          Array.isArray(cached.improvements) &&
          Array.isArray(cached.specific_examples)
        ) {
          return mcpOk(id, formatCoaching(cached, 'cached'));
        }

        // ── Tier 2: LLM extraction ──
        const transcript = recording.full_transcript || '';
        if (!transcript.trim()) {
          return mcpError(id, -32602, 'No transcript available for this recording', corsHeaders);
        }

        const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
        if (!openrouterApiKey) {
          return mcpError(id, -32603, 'AI provider not configured', corsHeaders);
        }

        // ── Cost gate (D-10): MUST run BEFORE OpenRouter ──
        const gate = await enforceMcpAiUsage({
          supabase,
          userId: mcpToken.user_id,
          orgId: mcpToken.org_id,
          actionType: 'mcp_coaching',
          recordingId,
        });
        if (!gate.allowed) {
          return mcpError(id, -32001, gate.reason, corsHeaders);
        }

        const limitedTranscript =
          transcript.length > 15000
            ? transcript.substring(0, 15000) + '\n\n[Transcript truncated for coaching analysis...]'
            : transcript;

        const CoachingSchema = z.object({
          strengths: z
            .array(z.string())
            .describe(
              'What the salesperson / lead speaker did well. 2-5 items. Each item is one sentence, factual, references the conversation.',
            ),
          improvements: z
            .array(z.string())
            .describe(
              'Areas the salesperson / lead speaker could improve. 2-5 items. Each item is one sentence, actionable, references the conversation.',
            ),
          specific_examples: z
            .array(
              z.object({
                topic: z.string().describe('Short label for the topic / situation (e.g., "Pricing objection", "Discovery question").'),
                observation: z.string().describe('What happened in the call regarding this topic. One sentence with a brief paraphrase.'),
                suggestion: z.string().describe('Concrete suggestion for the next call. One sentence, imperative, actionable.'),
              }),
            )
            .describe('2-5 specific moments worth coaching on. Pull from real moments in the transcript; do not invent.'),
        });

        const openrouter = createOpenRouter({
          apiKey: openrouterApiKey,
          headers: { 'HTTP-Referer': 'https://app.callvaultai.com', 'X-Title': 'CallVault' },
        });

        const prompt = `Generate sales coaching notes for this call transcript.

Meeting Title: ${recording.title || 'Unknown'}

Required output:
1. Strengths — 2 to 5 things the salesperson / lead speaker did well. Be specific and reference actual moments.
2. Areas for Improvement — 2 to 5 actionable things the salesperson could do differently next time.
3. Specific Examples — 2 to 5 concrete moments from the call worth coaching on, each with a topic label, what was observed, and a suggestion for the next call.

Be factual. Reference actual content from the transcript. Do not invent moments. If the call doesn't appear to be sales-oriented (internal meeting, podcast, etc.), still produce general communication coaching notes — every conversation has communication patterns worth noting.

Transcript:
${limitedTranscript}`;

        let llmResult: CoachingNotes;
        try {
          const result = await generateObject({
            model: openrouter('openai/gpt-5-nano'),
            schema: CoachingSchema,
            prompt,
          });
          llmResult = result.object;
        } catch (err) {
          console.error('get_coaching_notes: LLM call failed:', err);
          return mcpError(
            id,
            -32603,
            'Failed to generate coaching notes for this recording',
            corsHeaders,
          );
        }

        // Best-effort cache write
        const { error: cacheError } = await supabase
          .from('recordings')
          .update({ coaching_cache: llmResult })
          .eq('id', recordingId);
        if (cacheError) {
          console.error('get_coaching_notes: cache write failed:', cacheError);
        }

        return mcpOk(id, formatCoaching(llmResult, 'analyzed'));
      }

      case 'get_call_notes': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Build workspace boundary
        let wsIds: string[];
        if (mcpToken.scope === 'workspace') {
          wsIds = [mcpToken.workspace_id!];
        } else {
          const { ids, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !ids) return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          wsIds = ids;
        }
        if (wsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);

        // Cap response size to bound payload + author-resolution work.
        const NOTE_LIMIT = 50;

        // Fetch notes from the new call_notes table (newest first).
        const { data: notes, error: notesError } = await supabase
          .from('call_notes')
          .select('id, content, user_id, created_at')
          .eq('recording_id', recordingId)
          .in('workspace_id', wsIds)
          .order('created_at', { ascending: false })
          .limit(NOTE_LIMIT);

        if (notesError) {
          return mcpError(id, -32603, `Failed to fetch notes: ${notesError.message}`, corsHeaders);
        }

        // Resolve recording title for the header line
        const { data: rec } = await supabase
          .from('recordings')
          .select('title')
          .eq('id', recordingId)
          .maybeSingle();

        type NoteRow = { id: string; content: string; user_id: string; created_at: string };
        const noteRows = (notes ?? []) as NoteRow[];

        if (noteRows.length === 0) {
          return mcpOk(id, `No notes found for: ${rec?.title || recordingId}`);
        }

        // Resolve author display labels via a single batched user_profiles
        // query. Never include emails — they are PII and this output is
        // consumed by external MCP clients.
        const authorIds = Array.from(new Set(noteRows.map((n) => n.user_id)));
        const redact = (uid: string) => `User ${uid.slice(0, 8)}`;
        const authorLabel = new Map<string, string>();
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', authorIds);
        for (const p of (profiles ?? []) as { user_id: string; display_name: string | null }[]) {
          if (p.display_name && p.display_name.trim()) authorLabel.set(p.user_id, p.display_name.trim());
        }
        for (const uid of authorIds) {
          if (!authorLabel.has(uid)) authorLabel.set(uid, redact(uid));
        }

        return mcpOk(
          id,
          `# Notes: ${rec?.title || 'Untitled'}\n\n` +
          noteRows
            .map((n) => `## ${authorLabel.get(n.user_id) || redact(n.user_id)} — ${n.created_at}\n${n.content}`)
            .join('\n\n---\n\n'),
        );
      }

      // ── Sharing ──────────────────────────────────────────────────────────────

      case 'list_shared_calls': {
        const limit = typeof params.limit === 'number' ? Math.min(Math.max(1, params.limit), 100) : 20;

        // Get the user's email for looking up shares
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(mcpToken.user_id);
        if (!authUser?.email) {
          return mcpOk(id, 'No shared calls found (unable to resolve user email).');
        }

        const { data: shareLinks, error: shareError } = await supabase
          .from('call_share_links')
          .select('call_recording_id, user_id, created_at, expires_at')
          .eq('status', 'active')
          .ilike('recipient_email', authUser.email.toLowerCase())
          .order('created_at', { ascending: false })
          .limit(limit);

        if (shareError) {
          return mcpError(id, -32603, `Failed to list shared calls: ${shareError.message}`, corsHeaders);
        }

        if (!shareLinks || shareLinks.length === 0) {
          return mcpOk(id, 'No calls have been shared with you.');
        }

        // Filter out expired links
        const now = new Date();
        type ShareRow = { call_recording_id: number; user_id: string; created_at: string; expires_at: string | null };
        const activeLinks = (shareLinks as ShareRow[]).filter((s) => !s.expires_at || new Date(s.expires_at) > now);

        if (activeLinks.length === 0) {
          return mcpOk(id, 'No active shared calls found (all links have expired).');
        }

        // Look up recording details via legacy_recording_id
        const recIds = activeLinks.map((s) => s.call_recording_id);
        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, legacy_recording_id, title, recording_start_time, duration, summary')
          .in('legacy_recording_id', recIds);

        type RecRow = { id: string; legacy_recording_id: number; title: string | null; recording_start_time: string | null; duration: number | null; summary: string | null };
        const recMap = new Map((recordings ?? []).map((r: RecRow) => [r.legacy_recording_id, r]));

        return mcpOk(
          id,
          `# Calls Shared With You\n\n` +
          activeLinks
            .map((s) => {
              const rec = recMap.get(s.call_recording_id) as RecRow | undefined;
              const sharedDate = new Date(s.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
              if (rec) {
                const callDate = rec.recording_start_time
                  ? new Date(rec.recording_start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : 'Unknown date';
                const duration = rec.duration ? `${Math.round(rec.duration / 60)}m` : 'Unknown duration';
                return `ID: ${rec.id}\nTitle: ${rec.title || 'Untitled'}\nCall Date: ${callDate}\nDuration: ${duration}\nShared: ${sharedDate}${rec.summary ? `\nSummary: ${rec.summary}` : ''}`;
              }
              return `Legacy Recording ID: ${s.call_recording_id}\nShared: ${sharedDate}`;
            })
            .join('\n\n---\n\n'),
        );
      }

      // ══════════════════════════════════════════════════════════════════════
      // WRITE TOOLS
      // ══════════════════════════════════════════════════════════════════════

      // ── Recording Management ─────────────────────────────────────────────

      case 'rename_call': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const title = typeof params.title === 'string' ? params.title.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!title) return mcpError(id, -32602, 'title is required', corsHeaders);

        // Verify access via workspace_entries
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        const { error: updateError } = await supabase
          .from('recordings')
          .update({ title })
          .eq('id', recordingId);

        if (updateError) {
          console.error('mcp-server rename_call error:', updateError);
          return mcpError(id, -32603, `Failed to rename call: ${updateError.message}`, corsHeaders);
        }

        return mcpOk(id, `Renamed call to: ${title}`);
      }

      case 'move_calls_to_workspace': {
        const recordingIds = Array.isArray(params.recording_ids) ? params.recording_ids as string[] : [];
        const targetWsId = typeof params.target_workspace_id === 'string' ? params.target_workspace_id.trim() : '';
        if (recordingIds.length === 0) return mcpError(id, -32602, 'recording_ids is required (non-empty array)', corsHeaders);
        if (!targetWsId) return mcpError(id, -32602, 'target_workspace_id is required', corsHeaders);

        // Verify target workspace belongs to the same org
        const { data: targetWs } = await supabase
          .from('workspaces')
          .select('id, organization_id, name')
          .eq('id', targetWsId)
          .maybeSingle();

        if (!targetWs) return mcpError(id, -32602, 'Target workspace not found', corsHeaders);

        const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );

        if (targetWs.organization_id !== orgId) {
          return mcpError(id, -32001, 'Target workspace is not in the same organization', corsHeaders);
        }

        // Update workspace_entries for each recording
        let moved = 0;
        for (const recId of recordingIds) {
          const { error: moveErr } = await supabase
            .from('workspace_entries')
            .update({ workspace_id: targetWsId })
            .eq('recording_id', recId);
          if (!moveErr) moved++;
        }

        return mcpOk(id, `Moved ${moved} of ${recordingIds.length} call(s) to workspace "${targetWs.name}"`);
      }

      case 'delete_call': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);

        // Verify access
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // Use the delete_recording RPC which handles cascading cleanup
        const { data: deleteResult, error: deleteError } = await supabase
          .rpc('delete_recording', { p_recording_id: recordingId });

        if (deleteError) {
          console.error('mcp-server delete_call error:', deleteError);
          return mcpError(id, -32603, `Failed to delete call: ${deleteError.message}`, corsHeaders);
        }

        // delete_recording returns JSONB with success or error info
        const result = deleteResult as Record<string, unknown> | null;
        if (result?.error) {
          return mcpError(id, -32603, `Failed to delete call: ${result.error}`, corsHeaders);
        }

        return mcpOk(id, `Call deleted successfully`);
      }

      case 'copy_calls_to_organization': {
        const recordingIds = Array.isArray(params.recording_ids) ? params.recording_ids as string[] : [];
        const targetOrgId = typeof params.target_org_id === 'string' ? params.target_org_id.trim() : '';
        if (recordingIds.length === 0) return mcpError(id, -32602, 'recording_ids is required (non-empty array)', corsHeaders);
        if (!targetOrgId) return mcpError(id, -32602, 'target_org_id is required', corsHeaders);

        // Verify user has membership in target org
        const { data: targetMembership } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('organization_id', targetOrgId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!targetMembership) {
          return mcpError(id, -32001, 'You do not have access to the target organization', corsHeaders);
        }

        let copied = 0;
        const errors: string[] = [];
        for (const recId of recordingIds) {
          const { data: newId, error: copyErr } = await supabase
            .rpc('copy_recording_to_organization', {
              p_recording_id: recId,
              p_target_org_id: targetOrgId,
            });

          if (copyErr) {
            errors.push(`${recId}: ${copyErr.message}`);
          } else if (newId) {
            copied++;
          }
        }

        const msg = `Copied ${copied} of ${recordingIds.length} call(s) to target organization`;
        if (errors.length > 0) {
          return mcpOk(id, `${msg}\n\nErrors:\n${errors.join('\n')}`);
        }
        return mcpOk(id, msg);
      }

      // ── Folder Management ────────────────────────────────────────────────

      case 'create_folder': {
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
        if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);

        const { data: folder, error: createErr } = await supabase
          .from('personal_folders')
          .insert({
            user_id: mcpToken.user_id,
            organization_id: orgId,
            name,
          })
          .select('id, name')
          .single();

        if (createErr) {
          console.error('mcp-server create_folder error:', createErr);
          return mcpError(id, -32603, `Failed to create folder: ${createErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Created folder "${folder.name}" (ID: ${folder.id})`);
      }

      case 'rename_folder': {
        const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        const { data: existing } = await supabase
          .from('personal_folders')
          .select('id')
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!existing) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

        const { error: updateErr } = await supabase
          .from('personal_folders')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id);

        if (updateErr) {
          console.error('mcp-server rename_folder error:', updateErr);
          return mcpError(id, -32603, `Failed to rename folder: ${updateErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Renamed folder to: ${name}`);
      }

      case 'delete_folder': {
        const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
        if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);

        const { data: existing } = await supabase
          .from('personal_folders')
          .select('id, name')
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!existing) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

        const { error: deleteErr } = await supabase
          .from('personal_folders')
          .delete()
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id);

        if (deleteErr) {
          console.error('mcp-server delete_folder error:', deleteErr);
          return mcpError(id, -32603, `Failed to delete folder: ${deleteErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Deleted folder "${existing.name}"`);
      }

      case 'add_call_to_folder': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);

        // Verify folder belongs to user
        const { data: folderCheck } = await supabase
          .from('personal_folders')
          .select('id, name')
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!folderCheck) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

        // Verify recording access
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        const { error: insertErr } = await supabase
          .from('personal_folder_recordings')
          .upsert({
            user_id: mcpToken.user_id,
            folder_id: folderId,
            recording_id: recordingId,
          }, { onConflict: 'folder_id,recording_id' });

        if (insertErr) {
          console.error('mcp-server add_call_to_folder error:', insertErr);
          return mcpError(id, -32603, `Failed to add call to folder: ${insertErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Added call to folder "${folderCheck.name}"`);
      }

      case 'remove_call_from_folder': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const folderId = typeof params.folder_id === 'string' ? params.folder_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!folderId) return mcpError(id, -32602, 'folder_id is required', corsHeaders);

        // Verify folder belongs to user
        const { data: folderCheck } = await supabase
          .from('personal_folders')
          .select('id, name')
          .eq('id', folderId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!folderCheck) return mcpError(id, -32001, 'Folder not found or not accessible', corsHeaders);

        const { error: deleteErr } = await supabase
          .from('personal_folder_recordings')
          .delete()
          .eq('folder_id', folderId)
          .eq('recording_id', recordingId)
          .eq('user_id', mcpToken.user_id);

        if (deleteErr) {
          console.error('mcp-server remove_call_from_folder error:', deleteErr);
          return mcpError(id, -32603, `Failed to remove call from folder: ${deleteErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Removed call from folder "${folderCheck.name}"`);
      }

      // ── Tag Management ───────────────────────────────────────────────────

      case 'create_tag': {
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        const color = typeof params.color === 'string' ? params.color.trim() : null;
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
        if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);

        const insertData: Record<string, unknown> = {
          user_id: mcpToken.user_id,
          organization_id: orgId,
          name,
        };
        if (color) insertData.color = color;

        const { data: tag, error: createErr } = await supabase
          .from('personal_tags')
          .insert(insertData)
          .select('id, name, color')
          .single();

        if (createErr) {
          console.error('mcp-server create_tag error:', createErr);
          return mcpError(id, -32603, `Failed to create tag: ${createErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Created tag "${tag.name}" (ID: ${tag.id})${tag.color ? ` with color ${tag.color}` : ''}`);
      }

      case 'rename_tag': {
        const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        const { data: existing } = await supabase
          .from('personal_tags')
          .select('id')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!existing) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

        const { error: updateErr } = await supabase
          .from('personal_tags')
          .update({ name, updated_at: new Date().toISOString() })
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id);

        if (updateErr) {
          console.error('mcp-server rename_tag error:', updateErr);
          return mcpError(id, -32603, `Failed to rename tag: ${updateErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Renamed tag to: ${name}`);
      }

      case 'delete_tag': {
        const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
        if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);

        const { data: existing } = await supabase
          .from('personal_tags')
          .select('id, name')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!existing) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

        const { error: deleteErr } = await supabase
          .from('personal_tags')
          .delete()
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id);

        if (deleteErr) {
          console.error('mcp-server delete_tag error:', deleteErr);
          return mcpError(id, -32603, `Failed to delete tag: ${deleteErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Deleted tag "${existing.name}"`);
      }

      case 'tag_call': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);

        // Verify tag belongs to user
        const { data: tagCheck } = await supabase
          .from('personal_tags')
          .select('id, name')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!tagCheck) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

        // Verify recording access
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        const { error: insertErr } = await supabase
          .from('personal_tag_recordings')
          .upsert({
            user_id: mcpToken.user_id,
            tag_id: tagId,
            recording_id: recordingId,
          }, { onConflict: 'tag_id,recording_id' });

        if (insertErr) {
          console.error('mcp-server tag_call error:', insertErr);
          return mcpError(id, -32603, `Failed to tag call: ${insertErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Tagged call with "${tagCheck.name}"`);
      }

      case 'untag_call': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const tagId = typeof params.tag_id === 'string' ? params.tag_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!tagId) return mcpError(id, -32602, 'tag_id is required', corsHeaders);

        // Verify tag belongs to user
        const { data: tagCheck } = await supabase
          .from('personal_tags')
          .select('id, name')
          .eq('id', tagId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!tagCheck) return mcpError(id, -32001, 'Tag not found or not accessible', corsHeaders);

        const { error: deleteErr } = await supabase
          .from('personal_tag_recordings')
          .delete()
          .eq('tag_id', tagId)
          .eq('recording_id', recordingId)
          .eq('user_id', mcpToken.user_id);

        if (deleteErr) {
          console.error('mcp-server untag_call error:', deleteErr);
          return mcpError(id, -32603, `Failed to untag call: ${deleteErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Removed tag "${tagCheck.name}" from call`);
      }

      case 'create_note': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        const rawContent = typeof params.content === 'string' ? params.content : '';
        const content = rawContent.trim();
        const explicitWorkspaceId =
          typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';

        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        if (!content) return mcpError(id, -32602, 'content is required and cannot be empty', corsHeaders);
        if (content.length > 10_000) {
          return mcpError(id, -32602, 'content exceeds 10,000 character limit', corsHeaders);
        }

        // Resolve target workspace_id based on token scope.
        let targetWorkspaceId: string;
        if (mcpToken.scope === 'workspace') {
          // Workspace-scoped tokens auto-resolve; explicit workspace_id is ignored
          // (per D-11) — but if supplied, it must match for clarity.
          targetWorkspaceId = mcpToken.workspace_id!;
          if (explicitWorkspaceId && explicitWorkspaceId !== targetWorkspaceId) {
            return mcpError(
              id,
              -32602,
              'workspace_id does not match the workspace this token is scoped to',
              corsHeaders,
            );
          }
        } else {
          // Org-scoped tokens MUST supply workspace_id (per D-11) and it must be in the org.
          if (!explicitWorkspaceId) {
            return mcpError(
              id,
              -32602,
              'workspace_id is required for organization-scoped tokens',
              corsHeaders,
            );
          }
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(
            supabase,
            mcpToken.org_id!,
          );
          if (wsErr || !orgWsIds || orgWsIds.length === 0) {
            return mcpError(id, -32603, 'Failed to resolve organization workspaces', corsHeaders);
          }
          if (!orgWsIds.includes(explicitWorkspaceId)) {
            return mcpError(id, -32001, 'workspace_id is not in this organization', corsHeaders);
          }
          targetWorkspaceId = explicitWorkspaceId;
        }

        // Verify the recording is in the target workspace.
        const { data: entry } = await supabase
          .from('workspace_entries')
          .select('recording_id')
          .eq('recording_id', recordingId)
          .eq('workspace_id', targetWorkspaceId)
          .maybeSingle();
        if (!entry) {
          return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // Insert the note.
        const { error: insertError } = await supabase
          .from('call_notes')
          .insert({
            recording_id: recordingId,
            workspace_id: targetWorkspaceId,
            user_id: mcpToken.user_id,
            content,
          });

        if (insertError) {
          console.error('mcp-server create_note error:', insertError);
          return mcpError(id, -32603, `Failed to create note: ${insertError.message}`, corsHeaders);
        }

        // Resolve title for the confirmation string (per D-04 / D-13).
        const { data: rec } = await supabase
          .from('recordings')
          .select('title')
          .eq('id', recordingId)
          .maybeSingle();

        return mcpOk(
          id,
          `Created note on "${rec?.title || 'Untitled'}" (${content.length} chars)`,
        );
      }

      // ── Share Links ──────────────────────────────────────────────────────

      case 'create_share_link': {
        const recordingId = typeof params.recording_id === 'string' ? params.recording_id.trim() : '';
        if (!recordingId) return mcpError(id, -32602, 'recording_id is required', corsHeaders);
        const recipientEmail = typeof params.recipient_email === 'string' ? params.recipient_email.trim() : null;
        const expiresInDays = typeof params.expires_in_days === 'number' ? Math.max(1, params.expires_in_days) : 30;

        // Verify recording access
        if (mcpToken.scope === 'workspace') {
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .eq('workspace_id', mcpToken.workspace_id!)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        } else {
          const { ids: orgWsIds, error: wsErr } = await fetchOrgWorkspaceIds(supabase, mcpToken.org_id!);
          if (wsErr || !orgWsIds || orgWsIds.length === 0) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
          const { data: access } = await supabase
            .from('workspace_entries')
            .select('recording_id')
            .eq('recording_id', recordingId)
            .in('workspace_id', orgWsIds)
            .maybeSingle();
          if (!access) return mcpError(id, -32001, 'Recording not found or not accessible', corsHeaders);
        }

        // Look up the legacy recording_id (BIGINT) needed for call_share_links FK
        const { data: rec } = await supabase
          .from('recordings')
          .select('legacy_recording_id')
          .eq('id', recordingId)
          .maybeSingle();

        if (!rec?.legacy_recording_id) {
          return mcpError(id, -32603, 'Recording does not have a legacy ID required for share links', corsHeaders);
        }

        // Generate a share token (32 hex chars)
        const tokenArray = new Uint8Array(16);
        crypto.getRandomValues(tokenArray);
        const shareToken = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const insertData: Record<string, unknown> = {
          call_recording_id: rec.legacy_recording_id,
          user_id: mcpToken.user_id,
          created_by_user_id: mcpToken.user_id,
          share_token: shareToken,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        };
        if (recipientEmail) insertData.recipient_email = recipientEmail;

        const { data: shareLink, error: shareErr } = await supabase
          .from('call_share_links')
          .insert(insertData)
          .select('id, share_token')
          .single();

        if (shareErr) {
          console.error('mcp-server create_share_link error:', shareErr);
          return mcpError(id, -32603, `Failed to create share link: ${shareErr.message}`, corsHeaders);
        }

        const shareUrl = `https://app.callvaultai.com/shared/${shareLink.share_token}`;
        return mcpOk(id, `Share link created:\nURL: ${shareUrl}\nExpires: ${expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${recipientEmail ? `\nRestricted to: ${recipientEmail}` : ''}\nLink ID: ${shareLink.id}`);
      }

      case 'revoke_share_link': {
        const shareLinkId = typeof params.share_link_id === 'string' ? params.share_link_id.trim() : '';
        if (!shareLinkId) return mcpError(id, -32602, 'share_link_id is required', corsHeaders);

        // Verify ownership
        const { data: existing } = await supabase
          .from('call_share_links')
          .select('id')
          .eq('id', shareLinkId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();
        if (!existing) return mcpError(id, -32001, 'Share link not found or not accessible', corsHeaders);

        const { error: revokeErr } = await supabase
          .from('call_share_links')
          .update({ status: 'revoked', revoked_at: new Date().toISOString() })
          .eq('id', shareLinkId)
          .eq('user_id', mcpToken.user_id);

        if (revokeErr) {
          console.error('mcp-server revoke_share_link error:', revokeErr);
          return mcpError(id, -32603, `Failed to revoke share link: ${revokeErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Share link revoked`);
      }

      // ── Import ───────────────────────────────────────────────────────────

      case 'import_youtube_video': {
        const youtubeUrl = typeof params.youtube_url === 'string' ? params.youtube_url.trim() : '';
        const workspaceId = typeof params.workspace_id === 'string' ? params.workspace_id.trim() : '';
        if (!youtubeUrl) return mcpError(id, -32602, 'youtube_url is required', corsHeaders);
        if (!workspaceId) return mcpError(id, -32602, 'workspace_id is required', corsHeaders);

        // Verify workspace access
        if (mcpToken.scope === 'workspace' && workspaceId !== mcpToken.workspace_id) {
          return mcpError(id, -32001, 'Workspace not accessible with this token', corsHeaders);
        } else if (mcpToken.scope === 'organization') {
          const { data: wsCheck } = await supabase
            .from('workspaces')
            .select('id')
            .eq('id', workspaceId)
            .eq('organization_id', mcpToken.org_id!)
            .maybeSingle();
          if (!wsCheck) return mcpError(id, -32001, 'Workspace not found in this organization', corsHeaders);
        }

        // Call the youtube-import edge function internally
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        try {
          const importResp = await fetch(`${supabaseUrl}/functions/v1/youtube-import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              youtube_url: youtubeUrl,
              workspace_id: workspaceId,
              user_id: mcpToken.user_id,
              organization_id: mcpToken.org_id,
            }),
          });

          if (!importResp.ok) {
            const errBody = await importResp.text();
            return mcpError(id, -32603, `YouTube import failed: ${errBody}`, corsHeaders);
          }

          const importResult = await importResp.json();
          return mcpOk(id, `YouTube video imported successfully${importResult.recording_id ? ` (Recording ID: ${importResult.recording_id})` : ''}`);
        } catch (fetchErr) {
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown error';
          return mcpError(id, -32603, `YouTube import failed: ${msg}`, corsHeaders);
        }
      }

      // ── Organization Management ──────────────────────────────────────────

      case 'create_organization': {
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        // Create the organization
        const orgType = typeof params.type === 'string' ? params.type.trim() : 'business';
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .insert({ name, type: orgType })
          .select('id, name')
          .single();

        if (orgErr) {
          console.error('mcp-server create_organization error:', orgErr);
          return mcpError(id, -32603, `Failed to create organization: ${orgErr.message}`, corsHeaders);
        }

        // Add the user as organization_owner
        const { error: memErr } = await supabase
          .from('organization_memberships')
          .insert({
            organization_id: org.id,
            user_id: mcpToken.user_id,
            role: 'organization_owner',
          });

        if (memErr) {
          console.error('mcp-server create_organization membership error:', memErr);
          // Org was created but membership failed — try to clean up
          await supabase.from('organizations').delete().eq('id', org.id);
          return mcpError(id, -32603, `Failed to create organization membership: ${memErr.message}`, corsHeaders);
        }

        return mcpOk(id, `Created organization "${org.name}" (ID: ${org.id})`);
      }

      case 'create_workspace': {
        const name = typeof params.name === 'string' ? params.name.trim() : '';
        const workspaceType = typeof params.workspace_type === 'string' ? params.workspace_type.trim() : 'team';
        if (!name) return mcpError(id, -32602, 'name is required', corsHeaders);

        const orgId = mcpToken.org_id ?? (
          mcpToken.scope === 'workspace'
            ? (await supabase.from('workspaces').select('organization_id').eq('id', mcpToken.workspace_id!).maybeSingle()).data?.organization_id
            : null
        );
        if (!orgId) return mcpError(id, -32603, 'Could not determine organization', corsHeaders);

        // Verify user has membership in the org
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('role')
          .eq('organization_id', orgId)
          .eq('user_id', mcpToken.user_id)
          .maybeSingle();

        if (!membership) {
          return mcpError(id, -32001, 'You do not have access to this organization', corsHeaders);
        }

        // Create workspace
        const { data: ws, error: wsErr } = await supabase
          .from('workspaces')
          .insert({
            name,
            organization_id: orgId,
            workspace_type: workspaceType,
          })
          .select('id, name')
          .single();

        if (wsErr) {
          console.error('mcp-server create_workspace error:', wsErr);
          return mcpError(id, -32603, `Failed to create workspace: ${wsErr.message}`, corsHeaders);
        }

        // Add user as workspace member
        const { error: wmErr } = await supabase
          .from('workspace_memberships')
          .insert({
            workspace_id: ws.id,
            user_id: mcpToken.user_id,
            role: 'owner',
          });

        if (wmErr) {
          console.error('mcp-server create_workspace membership error:', wmErr);
          // Workspace created but membership failed
        }

        return mcpOk(id, `Created workspace "${ws.name}" (ID: ${ws.id})`);
      }

      default: {
        return mcpError(id, -32601, `Method not found: ${method}`, corsHeaders);
      }
    }
  } catch (err) {
    console.error('mcp-server unhandled error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return mcpError(id, -32603, message, corsHeaders);
  }
});
