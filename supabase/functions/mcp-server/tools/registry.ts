import { getContactTool } from './read/get_contact.ts';
import { getContactCallsTool } from './read/get_contact_calls.ts';
import { getFolderCallsTool } from './read/get_folder_calls.ts';
import { getRecordingContextTool } from './read/get_recording_context.ts';
import { getTaggedCallsTool } from './read/get_tagged_calls.ts';
import { getTranscriptTool } from './read/get_transcript.ts';
import { listCallsTool } from './read/list_calls.ts';
import { listContactsTool } from './read/list_contacts.ts';
import { listFoldersTool } from './read/list_folders.ts';
import { listTagsTool } from './read/list_tags.ts';
import { listWorkspacesTool } from './read/list_workspaces.ts';
import { searchCallsTool } from './read/search_calls.ts';
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
