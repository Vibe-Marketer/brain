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
import { copyCallsToOrganizationTool } from './write/copy_calls_to_organization.ts';
import { deleteCallTool } from './write/delete_call.ts';
import { importYoutubeVideoTool } from './write/import_youtube_video.ts';
import { moveCallsToWorkspaceTool } from './write/move_calls_to_workspace.ts';
import { renameCallTool } from './write/rename_call.ts';
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
  importYoutubeVideoTool,
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

export function buildToolDefinitions(legacyDefinitions: readonly unknown[]): unknown[] {
  return legacyDefinitions.map((definition) => {
    if (!definition || typeof definition !== 'object') return definition;
    const name = (definition as { name?: unknown }).name;
    const module = typeof name === 'string' ? TOOL_MODULES.get(name) : undefined;
    if (!module) return definition;

    return {
      ...definition,
      ...(module.definition && typeof module.definition === 'object' ? module.definition : {}),
    };
  });
}
