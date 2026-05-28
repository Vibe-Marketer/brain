import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TOOL_CATEGORIES } from '../../_shared/mcp-tool-categories';

const INDEX_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/index.ts'),
  'utf8',
);
const PROTOCOL_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/protocol.ts'),
  'utf8',
);
const AUTH_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/auth.ts'),
  'utf8',
);
const CATEGORY_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/mcp-tool-categories.ts'),
  'utf8',
);

type ToolBlock = {
  name: string;
  source: string;
};

function toolsDefinitionBlock(): string {
  const start = INDEX_TS.indexOf('const TOOLS = [');
  const end = INDEX_TS.indexOf('\n];', start);
  if (start === -1 || end === -1) {
    throw new Error('const TOOLS block not found in mcp-server/index.ts');
  }
  return INDEX_TS.slice(start, end);
}

function toolBlocks(): ToolBlock[] {
  const source = toolsDefinitionBlock();
  const markers = Array.from(source.matchAll(/\n  \{\n    name:\s*'([^']+)'/g));

  return markers.map((marker, index) => {
    const next = markers[index + 1];
    return {
      name: marker[1],
      source: source.slice(marker.index, next?.index ?? source.length),
    };
  });
}

function categoryKeysFromSource(): string[] {
  const start = CATEGORY_TS.indexOf('export const TOOL_CATEGORIES');
  const end = CATEGORY_TS.indexOf('};', start);
  if (start === -1 || end === -1) {
    throw new Error('TOOL_CATEGORIES block not found');
  }

  return Array.from(CATEGORY_TS.slice(start, end).matchAll(/^\s{2}([a-z_]+):\s*'(read|write|admin|ai)'/gm))
    .map((match) => match[1]);
}

describe('MCP contract surface', () => {
  it('pins the current production surface to 41 tool definitions', () => {
    const blocks = toolBlocks();

    expect(blocks.map((block) => block.name)).toHaveLength(41);
    expect(new Set(blocks.map((block) => block.name)).size).toBe(41);
  });

  it('keeps every tool on an object-root outputSchema with required text', () => {
    for (const block of toolBlocks()) {
      expect(block.source, `${block.name} outputSchema is missing`).toMatch(/outputSchema:\s*\{/);
      expect(block.source, `${block.name} outputSchema must be object-root`).toMatch(
        /outputSchema:\s*\{[\s\S]*?type:\s*'object'/,
      );
      expect(block.source, `${block.name} outputSchema must describe text`).toMatch(
        /outputSchema:\s*\{[\s\S]*?text:\s*\{\s*type:\s*'string'/,
      );
      expect(block.source, `${block.name} outputSchema must require text`).toMatch(
        /outputSchema:\s*\{[\s\S]*?required:\s*\[\s*'text'\s*\]/,
      );
    }
  });

  it('keeps tool definitions and canonical category map in one-to-one coverage', () => {
    const toolNames = toolBlocks().map((block) => block.name).sort();
    const categoryNames = Object.keys(TOOL_CATEGORIES).sort();
    const sourceCategoryNames = categoryKeysFromSource().sort();

    expect(categoryNames).toEqual(toolNames);
    expect(sourceCategoryNames).toEqual(toolNames);
    expect(categoryNames).toHaveLength(41);
  });

  it('keeps mcpOk on the content[].text helper shape', () => {
    expect(PROTOCOL_TS).toMatch(
      /function\s+mcpOk[\s\S]{1,500}result:\s*\{[\s\S]{1,200}content:\s*\[\{\s*type:\s*'text',\s*text\s*\}\]/,
    );
  });

  it('keeps auth before protocol methods and tools/list behind token validation', () => {
    const authIdx = INDEX_TS.indexOf('const authResult = await authenticateMcpRequest');
    const invalidReturnIdx = INDEX_TS.indexOf('if (!authResult.ok) return authResult.response');
    const tokenValidatedIdx = INDEX_TS.indexOf('Protocol methods (token is now VALIDATED');
    const initializeIdx = INDEX_TS.indexOf("if (method === 'initialize')");
    const toolsListIdx = INDEX_TS.indexOf("if (method === 'tools/list')");

    expect(authIdx).toBeGreaterThan(-1);
    expect(invalidReturnIdx).toBeGreaterThan(authIdx);
    expect(tokenValidatedIdx).toBeGreaterThan(invalidReturnIdx);
    expect(initializeIdx).toBeGreaterThan(tokenValidatedIdx);
    expect(toolsListIdx).toBeGreaterThan(initializeIdx);
    expect(AUTH_TS).toMatch(/const authHeader = req\.headers\.get\('Authorization'\)/);
    expect(AUTH_TS).toMatch(/const rawToken = authHeader\.replace\('Bearer ', ''\)\.trim\(\)/);
  });

  it('keeps protocol before plan gating, plan gating before category gating, and category gating before dispatch', () => {
    const protocolIdx = INDEX_TS.indexOf('Protocol methods (token is now VALIDATED');
    const planGateIdx = INDEX_TS.indexOf('Plan gating: enforce paid-tier requirement');
    const routeIdx = INDEX_TS.indexOf('Route to tool handler');
    const categoryGateIdx = INDEX_TS.indexOf('Category gating (Phase 23');
    const switchIdx = INDEX_TS.search(/switch\s*\(\s*toolName\s*\)/);

    expect(planGateIdx).toBeGreaterThan(protocolIdx);
    expect(routeIdx).toBeGreaterThan(planGateIdx);
    expect(categoryGateIdx).toBeGreaterThan(routeIdx);
    expect(switchIdx).toBeGreaterThan(categoryGateIdx);
  });

  it('keeps tools/list after authentication instead of public introspection', () => {
    const unauthorizedIdx = INDEX_TS.indexOf('if (!authResult.ok) return authResult.response');
    const toolsListIdx = INDEX_TS.indexOf("if (method === 'tools/list')");

    expect(unauthorizedIdx).toBeGreaterThan(-1);
    expect(toolsListIdx).toBeGreaterThan(unauthorizedIdx);
  });
});
