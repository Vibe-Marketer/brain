// Generated schemas
export const schemas = [
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
