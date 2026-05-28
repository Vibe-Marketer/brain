import { getRecordingContextTool } from './read/get_recording_context.ts';
import { getTranscriptTool } from './read/get_transcript.ts';
import { listCallsTool } from './read/list_calls.ts';
import { listWorkspacesTool } from './read/list_workspaces.ts';
import { searchCallsTool } from './read/search_calls.ts';
import type { ToolModule } from './_types.ts';

const EXTRACTED_TOOLS: ToolModule[] = [
  searchCallsTool,
  listCallsTool,
  getTranscriptTool,
  getRecordingContextTool,
  listWorkspacesTool,
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
