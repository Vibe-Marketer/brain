import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicCorsHeaders } from '../_shared/cors.ts';
import { authenticateMcpRequest } from './auth.ts';
import { enforceCategoryGate, enforcePlanGate } from './gating.ts';
import {
  mcpError,
  mcpJsonResult,
  mcpOk,
  resolveOriginHost,
  unauthorizedResponse,
} from './protocol.ts';
import { buildToolDefinitions, getToolModule } from './tools/registry.ts';
import type { JsonRpcRequest, SupabaseClient } from './tools/_types.ts';

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── Authenticate via Bearer token (hex token OR OAuth JWT) ──────────────────
  // Critical: token VALIDATION happens BEFORE method dispatch (including
  // initialize and tools/list). See auth.ts for the custom MCP auth boundary.
  const authResult = await authenticateMcpRequest(
    req,
    id,
    corsHeaders,
    originHost,
    supabase,
    supabaseUrl,
    serviceKey,
  );
  if (!authResult.ok) return authResult.response;
  const { mcpToken } = authResult;

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
    return mcpJsonResult(id, { tools: buildToolDefinitions(TOOLS) });
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
    switch (toolName) {
      // initialize and tools/list are handled pre-auth above


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
