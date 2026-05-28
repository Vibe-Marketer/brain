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
const FIXTURES = fixture.fixtures as Fixture[];

function caseBlock(toolName: string): string {
  const start = INDEX_TS.indexOf(`case '${toolName}':`);
  if (start === -1) {
    throw new Error(`case block for ${toolName} not found in mcp-server/index.ts`);
  }

  const nextCase = INDEX_TS.indexOf(`\n      case '`, start + 1);
  return INDEX_TS.slice(start, nextCase === -1 ? INDEX_TS.length : nextCase);
}

function toolsDefinitionBlock(): string {
  const start = INDEX_TS.indexOf('const TOOLS = [');
  const end = INDEX_TS.indexOf('\n];', start);
  if (start === -1 || end === -1) {
    throw new Error('const TOOLS block not found in mcp-server/index.ts');
  }
  return INDEX_TS.slice(start, end);
}

describe('MCP golden replay fixtures', () => {
  it('does not import stale prior-run modular files', () => {
    expect(import.meta.url).not.toContain('.planning/forensics/stale-prior-run-2026-05-27');
    expect(INDEX_TS).not.toContain('.planning/forensics/stale-prior-run-2026-05-27');
  });

  it('covers initialize, tools/list, read, write, admin, and ai examples', () => {
    expect(FIXTURES.map((entry) => entry.method)).toEqual(
      expect.arrayContaining(['initialize', 'tools/list', 'tools/call']),
    );
    expect(FIXTURES.map((entry) => entry.category).filter(Boolean)).toEqual(
      expect.arrayContaining(['read', 'write', 'admin', 'ai']),
    );
  });

  it('records protocol methods as structured JSON results', () => {
    const initialize = FIXTURES.find((entry) => entry.method === 'initialize');
    const toolsList = FIXTURES.find((entry) => entry.method === 'tools/list');

    expect(initialize?.expected.kind).toBe('protocol-json');
    expect(toolsList?.expected.kind).toBe('protocol-json');
    expect(INDEX_TS).toMatch(/if\s*\(\s*method\s*===\s*'initialize'\s*\)[\s\S]{1,900}return mcpJsonResult/);
    expect(INDEX_TS).toMatch(/serverInfo:\s*\{[\s\S]{1,160}name:\s*'callvault'/);
    expect(INDEX_TS).toMatch(/if\s*\(\s*method\s*===\s*'tools\/list'\s*\)[\s\S]{1,160}return mcpJsonResult/);
  });

  it('pins the current tools/list count to 41 tools', () => {
    const toolsList = FIXTURES.find((entry) => entry.method === 'tools/list');
    const toolNames = Array.from(toolsDefinitionBlock().matchAll(/name:\s*'([^']+)'/g)).map(
      (match) => match[1],
    );

    expect(toolsList?.expected.toolsCount).toBe(41);
    expect(toolNames).toHaveLength(41);
  });

  it('records tool-call fixtures as content text envelopes and anchors each case block', () => {
    const toolFixtures = FIXTURES.filter((entry) => entry.method === 'tools/call');

    for (const entry of toolFixtures) {
      expect(entry.expected.kind).toBe('tool-text');
      expect(entry.expected.contentType).toBe('text');
      expect(entry.tool).toBeTruthy();
      expect(TOOL_CATEGORIES[entry.tool!]).toBe(entry.category);
      expect(caseBlock(entry.tool!)).toMatch(/return\s+mcpOk\s*\(/);
    }
  });

  it('keeps mcpOk on the content[].text markdown envelope', () => {
    expect(INDEX_TS).toMatch(
      /function\s+mcpOk[\s\S]{1,500}content:\s*\[\{\s*type:\s*'text',\s*text\s*\}\]/,
    );
  });
});
