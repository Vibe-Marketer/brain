import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createOpenRouter } from 'https://esm.sh/@openrouter/ai-sdk-provider@1.2.8';
import { generateObject, generateText } from 'https://esm.sh/ai@5.0.102';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getPublicCorsHeaders } from '../_shared/cors.ts';
import { enforceMcpAiUsage } from '../_shared/track-ai-usage-inline.ts';
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

      // ── AI Features ──────────────────────────────────────────────────────────

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

        // ── D-04 Tier 1: source-provided pre-extracted items (no LLM, no cost) ──
        const meta = recording.source_metadata as Record<string, unknown> | null;
        const sourceItems = meta?.action_items as string[] | undefined;
        if (sourceItems && Array.isArray(sourceItems) && sourceItems.length > 0) {
          const sourceName = typeof meta?.source_app === 'string' ? meta.source_app : 'source';
          const lines = [`# Action Items: ${recording.title || 'Untitled'} (source: ${sourceName})`];
          sourceItems.forEach((item, i) => lines.push(`${i + 1}. ${item}`));
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

      // ══════════════════════════════════════════════════════════════════════
      // WRITE TOOLS
      // ══════════════════════════════════════════════════════════════════════

      // ── Recording Management ─────────────────────────────────────────────

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

      // ── Share Links ──────────────────────────────────────────────────────

      // ── Import ───────────────────────────────────────────────────────────

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
