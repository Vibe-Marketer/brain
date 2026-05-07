/**
 * mcp-tool-categories.ts (CANONICAL — supabase/functions/_shared)
 *
 * Phase 23 (D-05, D-06, D-12): single source of truth for the tool→category map
 * used by mcp-server enforcement (D-07) and by the frontend Permissions panel
 * (Plan 23-02). Frontend mirror lives at `src/lib/mcp-tool-categories.ts` and
 * MUST stay in sync with this file (manual sync — codegen is overkill for v1
 * per D-05 / 23-DISCUSSION-LOG.md "Claude's Discretion").
 *
 * To add a new tool:
 *   1. Add it to TOOL_CATEGORIES with the appropriate category.
 *   2. Add a one-line description to TOOL_DESCRIPTIONS (used in the UI).
 *   3. Mirror both edits to src/lib/mcp-tool-categories.ts.
 */

export type ToolCategory = 'read' | 'write' | 'admin' | 'ai';

/**
 * Canonical tool name → category. Locked content per 23-CONTEXT.md D-06.
 *
 * Server enforcement (mcp-server/index.ts) reads this map. If a tool name is
 * NOT a key in this map, server rejects the call (per D-08, fail-closed).
 *
 * Frontend rendering (MCPTab.tsx, Plan 23-02) reads this map to enumerate
 * tools grouped by category in the per-token Permissions panel.
 */
export const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // ── read (17 tools) ───────────────────────────────────────────────────────
  search_calls: 'read',
  list_calls: 'read',
  get_transcript: 'read',
  get_recording_context: 'read',
  list_workspaces: 'read',
  list_contacts: 'read',
  get_contact: 'read',
  get_contact_calls: 'read',
  list_folders: 'read',
  get_folder_calls: 'read',
  list_tags: 'read',
  get_tagged_calls: 'read',
  list_speakers: 'read',
  get_speaker_calls: 'read',
  get_action_items: 'read',
  get_call_notes: 'read',
  list_shared_calls: 'read',

  // ── write (12 tools) ──────────────────────────────────────────────────────
  rename_call: 'write',
  delete_call: 'write',
  move_calls_to_workspace: 'write',
  copy_calls_to_organization: 'write',
  add_call_to_folder: 'write',
  remove_call_from_folder: 'write',
  tag_call: 'write',
  untag_call: 'write',
  create_note: 'write',
  create_share_link: 'write',
  revoke_share_link: 'write',
  import_youtube_video: 'write',

  // ── admin (8 tools) ───────────────────────────────────────────────────────
  create_folder: 'admin',
  rename_folder: 'admin',
  delete_folder: 'admin',
  create_tag: 'admin',
  rename_tag: 'admin',
  delete_tag: 'admin',
  create_organization: 'admin',
  create_workspace: 'admin',

  // ── ai (4 tools — Phase 22; map entries pre-staged) ───────────────────────
  extract_action_items: 'ai',
  ask_call: 'ai',
  get_sentiment: 'ai',
  get_coaching_notes: 'ai',
};

/**
 * One-line user-facing description per tool. Used in the per-token
 * Permissions panel (Plan 23-02) — replaces the stale hardcoded list at
 * MCPTab.tsx:629-648.
 *
 * Wording rules: present-tense verb ("Search calls…", "Move calls…"), no
 * `callvault/` prefix (removed in Phase 20 commit b98c8b94), one short
 * sentence each.
 */
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  // read
  search_calls: 'Search calls by keyword across titles, transcripts, and tags.',
  list_calls: 'List recent calls with pagination.',
  get_transcript: 'Retrieve the full transcript for a specific call.',
  get_recording_context: 'Get metadata, AI summary, speakers, and tags for a call.',
  list_workspaces: 'Enumerate workspaces accessible to the token.',
  list_contacts: 'List contacts (people who appeared in calls).',
  get_contact: 'Get a single contact by ID.',
  get_contact_calls: 'List calls a specific contact participated in.',
  list_folders: 'List folders in a workspace.',
  get_folder_calls: 'List calls inside a folder.',
  list_tags: 'List tags in a workspace.',
  get_tagged_calls: 'List calls bearing a specific tag.',
  list_speakers: 'List speakers extracted from call audio.',
  get_speaker_calls: 'List calls a specific speaker appeared in.',
  get_action_items: 'Get action items already extracted from a call.',
  get_call_notes: 'Get user-authored notes for a call.',
  list_shared_calls: 'List calls shared via share-link.',

  // write
  rename_call: 'Rename a call.',
  delete_call: 'Delete a call.',
  move_calls_to_workspace: 'Move one or more calls into a different workspace.',
  copy_calls_to_organization: 'Copy calls into a different organization.',
  add_call_to_folder: 'Add a call to a folder.',
  remove_call_from_folder: 'Remove a call from a folder.',
  tag_call: 'Apply a tag to a call.',
  untag_call: 'Remove a tag from a call.',
  create_note: 'Create a note on a call.',
  create_share_link: 'Generate a share link for a call.',
  revoke_share_link: 'Revoke an existing share link.',
  import_youtube_video: 'Import a recording from a YouTube URL.',

  // admin
  create_folder: 'Create a new folder in a workspace.',
  rename_folder: 'Rename a folder.',
  delete_folder: 'Delete a folder.',
  create_tag: 'Create a new tag in a workspace.',
  rename_tag: 'Rename a tag.',
  delete_tag: 'Delete a tag.',
  create_organization: 'Create a new organization.',
  create_workspace: 'Create a new workspace in an organization.',

  // ai
  extract_action_items: 'LLM-extract structured action items from a call transcript.',
  ask_call: 'Q&A: ask a natural-language question about a specific call.',
  get_sentiment: 'LLM-derive sentiment summary for a call.',
  get_coaching_notes: 'LLM-generate coaching feedback for a call.',
};

/**
 * Per-category descriptions shown above the toggle row in the Permissions
 * panel. Verbatim from 23-CONTEXT.md D-12.
 */
export const TOOL_CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  read: 'Search calls, view transcripts, list contacts/folders/tags. Safe — only retrieves existing data.',
  write: 'Add notes, apply tags, organize calls into folders, share calls. Modifies your data but preserves originals.',
  ai: 'LLM-powered analysis (action items, sentiment, coaching, Q&A). Counts toward your AI usage quota.',
  admin: 'Create/rename/delete folders, tags, workspaces, organizations. Destructive — only enable for trusted clients.',
};
