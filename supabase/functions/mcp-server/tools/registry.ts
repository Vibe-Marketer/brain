import { TOOL_DEFINITIONS } from './definitions.ts';
import { createFolderTool } from './admin/create_folder.ts';
import { createOrganizationTool } from './admin/create_organization.ts';
import { createTagTool } from './admin/create_tag.ts';
import { createWorkspaceTool } from './admin/create_workspace.ts';
import { deleteFolderTool } from './admin/delete_folder.ts';
import { deleteTagTool } from './admin/delete_tag.ts';
import { renameFolderTool } from './admin/rename_folder.ts';
import { renameTagTool } from './admin/rename_tag.ts';
import { askCallTool } from './ai/ask_call.ts';
import { extractActionItemsTool } from './ai/extract_action_items.ts';
import { getCoachingNotesTool } from './ai/get_coaching_notes.ts';
import { getSentimentTool } from './ai/get_sentiment.ts';
import { getActionItemsTool } from './read/get_action_items.ts';
import { getContactTool } from './read/get_contact.ts';
import { getContactCallsTool } from './read/get_contact_calls.ts';
import { getCallNotesTool } from './read/get_call_notes.ts';
import { getFolderCallsTool } from './read/get_folder_calls.ts';
import { getRecordingContextTool } from './read/get_recording_context.ts';
import { getSpeakerCallsTool } from './read/get_speaker_calls.ts';
import { getTaggedCallsTool } from './read/get_tagged_calls.ts';
import { getTranscriptTool } from './read/get_transcript.ts';
import { listCallsTool } from './read/list_calls.ts';
import { listContactsTool } from './read/list_contacts.ts';
import { listFoldersTool } from './read/list_folders.ts';
import { listSharedCallsTool } from './read/list_shared_calls.ts';
import { listSpeakersTool } from './read/list_speakers.ts';
import { listTagsTool } from './read/list_tags.ts';
import { listWorkspacesTool } from './read/list_workspaces.ts';
import { searchCallsTool } from './read/search_calls.ts';
import { addCallToFolderTool } from './write/add_call_to_folder.ts';
import { appendToTranscriptTool } from './write/append_to_transcript.ts';
import { copyCallsToOrganizationTool } from './write/copy_calls_to_organization.ts';
import { createNoteTool } from './write/create_note.ts';
import { createShareLinkTool } from './write/create_share_link.ts';
import { deleteCallTool } from './write/delete_call.ts';
import { importYoutubeVideoTool } from './write/import_youtube_video.ts';
import { ingestTranscriptTool } from './write/ingest_transcript.ts';
import { moveCallsToWorkspaceTool } from './write/move_calls_to_workspace.ts';
import { renameCallTool } from './write/rename_call.ts';
import { removeCallFromFolderTool } from './write/remove_call_from_folder.ts';
import { revokeShareLinkTool } from './write/revoke_share_link.ts';
import { tagCallTool } from './write/tag_call.ts';
import { untagCallTool } from './write/untag_call.ts';
import { updateCallMetadataTool } from './write/update_call_metadata.ts';
import type { ToolModule } from './_types.ts';

const EXTRACTED_TOOLS: ToolModule[] = [
  searchCallsTool,
  listCallsTool,
  getTranscriptTool,
  getRecordingContextTool,
  listWorkspacesTool,
  listContactsTool,
  getContactTool,
  getContactCallsTool,
  listFoldersTool,
  getFolderCallsTool,
  listTagsTool,
  getTaggedCallsTool,
  listSpeakersTool,
  getSpeakerCallsTool,
  getActionItemsTool,
  getCallNotesTool,
  listSharedCallsTool,
  renameCallTool,
  moveCallsToWorkspaceTool,
  deleteCallTool,
  copyCallsToOrganizationTool,
  addCallToFolderTool,
  appendToTranscriptTool,
  removeCallFromFolderTool,
  tagCallTool,
  untagCallTool,
  updateCallMetadataTool,
  createNoteTool,
  ingestTranscriptTool,
  createShareLinkTool,
  revokeShareLinkTool,
  importYoutubeVideoTool,
  createFolderTool,
  renameFolderTool,
  deleteFolderTool,
  createTagTool,
  renameTagTool,
  deleteTagTool,
  createOrganizationTool,
  createWorkspaceTool,
  extractActionItemsTool,
  askCallTool,
  getSentimentTool,
  getCoachingNotesTool,
];

const TOOL_MODULES = new Map(
  EXTRACTED_TOOLS.map((tool) => {
    const definition = tool.definition as { name?: unknown };
    return [definition.name, tool] as const;
  }).filter((entry): entry is readonly [string, ToolModule] => typeof entry[0] === 'string'),
);

export function getToolModule(toolName: string): ToolModule | undefined {
  return TOOL_MODULES.get(toolName);
}

export function buildToolDefinitions(): unknown[] {
  return TOOL_DEFINITIONS.map((definition) => {
    if (!definition || typeof definition !== 'object') return definition;
    const name = (definition as { name?: unknown }).name;
    const module = typeof name === 'string' ? TOOL_MODULES.get(name) : undefined;
    const mergedDefinition = module
      ? {
        ...definition,
        ...(module.definition && typeof module.definition === 'object' ? module.definition : {}),
      }
      : definition;

    // `outputSchema` is optional MCP metadata. Keep it in source definitions for
    // contract/docs coverage, but omit it from the client-visible tool list to
    // maximize compatibility with strict remote-MCP clients that only accept the
    // baseline name/description/inputSchema shape.
    const { outputSchema: _outputSchema, ...clientVisibleDefinition } =
      mergedDefinition as Record<string, unknown>;
    return clientVisibleDefinition;
  });
}
