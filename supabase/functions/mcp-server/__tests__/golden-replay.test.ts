import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOL_CATEGORIES, type ToolCategory } from '../../_shared/mcp-tool-categories';
import fixture from './fixtures/golden-replay.json';

type Fixture = {
  name: string;
  method: string;
  tool?: string;
  category?: ToolCategory;
  expected: {
    kind: 'protocol-json' | 'tool-text';
    contentType?: 'text';
    toolsCount?: number;
    serverInfoName?: string;
    resultKeys?: string[];
  };
};

const SOURCE_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/index.ts');
const INDEX_TS = readFileSync(SOURCE_PATH, 'utf8');
const PROTOCOL_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/protocol.ts'),
  'utf8',
);
const DEFINITIONS_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/tools/definitions.ts'),
  'utf8',
);
const FIXTURES = fixture.fixtures as Fixture[];
const EXTRACTED_TOOL_PATHS: Record<string, string> = {
  search_calls: 'supabase/functions/mcp-server/tools/read/search_calls.ts',
  list_calls: 'supabase/functions/mcp-server/tools/read/list_calls.ts',
  get_transcript: 'supabase/functions/mcp-server/tools/read/get_transcript.ts',
  get_recording_context: 'supabase/functions/mcp-server/tools/read/get_recording_context.ts',
  list_workspaces: 'supabase/functions/mcp-server/tools/read/list_workspaces.ts',
  list_contacts: 'supabase/functions/mcp-server/tools/read/list_contacts.ts',
  get_contact: 'supabase/functions/mcp-server/tools/read/get_contact.ts',
  get_contact_calls: 'supabase/functions/mcp-server/tools/read/get_contact_calls.ts',
  list_folders: 'supabase/functions/mcp-server/tools/read/list_folders.ts',
  get_folder_calls: 'supabase/functions/mcp-server/tools/read/get_folder_calls.ts',
  list_tags: 'supabase/functions/mcp-server/tools/read/list_tags.ts',
  get_tagged_calls: 'supabase/functions/mcp-server/tools/read/get_tagged_calls.ts',
  list_speakers: 'supabase/functions/mcp-server/tools/read/list_speakers.ts',
  get_speaker_calls: 'supabase/functions/mcp-server/tools/read/get_speaker_calls.ts',
  get_action_items: 'supabase/functions/mcp-server/tools/read/get_action_items.ts',
  get_call_notes: 'supabase/functions/mcp-server/tools/read/get_call_notes.ts',
  list_shared_calls: 'supabase/functions/mcp-server/tools/read/list_shared_calls.ts',
  create_note: 'supabase/functions/mcp-server/tools/write/create_note.ts',
  create_folder: 'supabase/functions/mcp-server/tools/admin/create_folder.ts',
  ask_call: 'supabase/functions/mcp-server/tools/ai/ask_call.ts',
};

function handlerSource(toolName: string): string {
  const start = INDEX_TS.indexOf(`case '${toolName}':`);
  if (start !== -1) {
    const nextCase = INDEX_TS.indexOf(`\n      case '`, start + 1);
    return INDEX_TS.slice(start, nextCase === -1 ? INDEX_TS.length : nextCase);
  }

  const extractedPath = EXTRACTED_TOOL_PATHS[toolName];
  if (!extractedPath) {
    throw new Error(`handler for ${toolName} not found in mcp-server/index.ts or extracted map`);
  }

  return readFileSync(resolve(process.cwd(), extractedPath), 'utf8');
}

function toolsDefinitionBlock(): string {
  const start = DEFINITIONS_TS.indexOf('export const TOOL_DEFINITIONS = [');
  const end = DEFINITIONS_TS.indexOf('\n];', start);
  if (start === -1 || end === -1) {
    throw new Error('TOOL_DEFINITIONS block not found in tools/definitions.ts');
  }
  return DEFINITIONS_TS.slice(start, end);
}

describe('MCP golden replay fixtures', () => {

  it('formats structured transcript segments in read tools without returning JSON payloads', () => {
    for (const toolName of ['get_transcript', 'get_recording_context']) {
      const source = handlerSource(toolName);
      expect(source).toContain('transcript_segments');
      expect(source).toContain('formatTranscriptSegments');
      expect(source).toMatch(/return\s+mcpOk\s*\(\s*id,/);
      expect(source).not.toMatch(/return\s+mcpOk\s*\(\s*id,\s*\{/);
    }
  });
});
