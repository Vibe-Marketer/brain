import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
const REGISTRY_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/tools/registry.ts'),
  'utf8',
);
const DEFINITIONS_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/tools/definitions.ts'),
  'utf8',
);
const ADMIN_TOOLS_DIR = resolve(
  process.cwd(),
  'supabase/functions/mcp-server/tools/admin',
);
const AI_TOOLS_DIR = resolve(
  process.cwd(),
  'supabase/functions/mcp-server/tools/ai',
);

type ToolBlock = {
  name: string;
  source: string;
};

function toolsDefinitionBlock(): string {
  const start = DEFINITIONS_TS.indexOf('export const TOOL_DEFINITIONS = [');
  const end = DEFINITIONS_TS.indexOf('\n];', start);
  if (start === -1 || end === -1) {
    throw new Error('TOOL_DEFINITIONS block not found in tools/definitions.ts');
  }
  return DEFINITIONS_TS.slice(start, end);
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
  it('pins the current production surface to 45 tool definitions', () => {
    const blocks = toolBlocks();

    expect(blocks.map((block) => block.name)).toHaveLength(45);
    expect(new Set(blocks.map((block) => block.name)).size).toBe(45);
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
    expect(categoryNames).toHaveLength(45);
  });

  it('keeps phase 04 write tools defined with text-only output schemas', () => {
    for (const toolName of [
      'ingest_transcript',
      'append_to_transcript',
      'update_call_metadata',
      'set_speakers',
    ]) {
      const block = toolBlocks().find((entry) => entry.name === toolName);
      expect(block, `${toolName} must exist in TOOL_DEFINITIONS`).toBeTruthy();
      expect(block?.source, `${toolName} must require text output`).toMatch(
        /outputSchema:\s*\{[\s\S]*?required:\s*\[\s*'text'\s*\]/,
      );
    }
  });

  it('strips optional outputSchema from client-visible tool definitions', () => {
    expect(REGISTRY_TS).toMatch(/outputSchema:\s*_outputSchema/);
    expect(REGISTRY_TS).toMatch(/return\s+clientVisibleDefinition/);
  });

  it('keeps all eight admin tools extracted, registered, and category-marked as admin', () => {
    const adminToolNames = Object.entries(TOOL_CATEGORIES)
      .filter(([, category]) => category === 'admin')
      .map(([name]) => name)
      .sort();
    const adminFiles = readdirSync(ADMIN_TOOLS_DIR)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    expect(adminToolNames).toEqual([
      'create_folder',
      'create_organization',
      'create_tag',
      'create_workspace',
      'delete_folder',
      'delete_tag',
      'rename_folder',
      'rename_tag',
    ]);
    expect(adminFiles).toEqual(adminToolNames);

    for (const toolName of adminToolNames) {
      const moduleSource = readFileSync(resolve(ADMIN_TOOLS_DIR, `${toolName}.ts`), 'utf8');
      expect(moduleSource, `${toolName} module must export category admin`).toMatch(
        /category:\s*'admin'/,
      );
      expect(moduleSource, `${toolName} module must preserve its definition name`).toContain(
        `name: '${toolName}'`,
      );
    }

    for (const symbol of [
      'createFolderTool',
      'renameFolderTool',
      'deleteFolderTool',
      'createTagTool',
      'renameTagTool',
      'deleteTagTool',
      'createOrganizationTool',
      'createWorkspaceTool',
    ]) {
      expect(REGISTRY_TS, `${symbol} must be imported and included in EXTRACTED_TOOLS`).toMatch(
        new RegExp(`\\b${symbol}\\b[\\s\\S]*\\b${symbol}\\b`),
      );
    }
  });

  it('creates workspace_owner membership and fails closed if workspace membership creation breaks', () => {
    const createWorkspaceSource = readFileSync(resolve(ADMIN_TOOLS_DIR, 'create_workspace.ts'), 'utf8');
    expect(createWorkspaceSource).toContain("role: 'workspace_owner'");
    expect(createWorkspaceSource).toMatch(/Failed to create workspace membership/);
    expect(createWorkspaceSource).toMatch(/\.from\('workspaces'\)[\s\S]{0,300}\.delete\(/);
  });

  it('keeps all four AI tools extracted, registered, and category-marked as ai', () => {
    const aiToolNames = Object.entries(TOOL_CATEGORIES)
      .filter(([, category]) => category === 'ai')
      .map(([name]) => name)
      .sort();
    const aiFiles = readdirSync(AI_TOOLS_DIR)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => file.replace(/\.ts$/, ''))
      .sort();

    expect(aiToolNames).toEqual([
      'ask_call',
      'extract_action_items',
      'get_coaching_notes',
      'get_sentiment',
    ]);
    expect(aiFiles).toEqual(aiToolNames);

    for (const toolName of aiToolNames) {
      const moduleSource = readFileSync(resolve(AI_TOOLS_DIR, `${toolName}.ts`), 'utf8');
      expect(moduleSource, `${toolName} module must export category ai`).toMatch(
        /category:\s*'ai'/,
      );
      expect(moduleSource, `${toolName} module must preserve its definition name`).toContain(
        `name: '${toolName}'`,
      );
    }

    for (const symbol of [
      'extractActionItemsTool',
      'askCallTool',
      'getSentimentTool',
      'getCoachingNotesTool',
    ]) {
      expect(REGISTRY_TS, `${symbol} must be imported and included in EXTRACTED_TOOLS`).toMatch(
        new RegExp(`\\b${symbol}\\b[\\s\\S]*\\b${symbol}\\b`),
      );
    }
  });

  it('keeps mcpOk on the content[].text helper shape', () => {
    expect(PROTOCOL_TS).toMatch(
      /function\s+mcpOk[\s\S]{1,500}result:\s*\{[\s\S]{1,200}content:\s*\[\{\s*type:\s*'text',\s*text\s*\}\]/,
    );
  });

  it('advertises the Streamable HTTP MCP protocol version for remote clients', () => {
    expect(INDEX_TS).toMatch(/protocolVersion:\s*'2025-03-26'/);
    expect(INDEX_TS).not.toMatch(/protocolVersion:\s*'2024-11-05'/);
  });

  it('accepts initialized notifications without returning an invalid JSON-RPC id:null response', () => {
    const initializedIdx = INDEX_TS.indexOf("method === 'notifications/initialized'");
    const initializeIdx = INDEX_TS.indexOf("if (method === 'initialize')");
    const planGateIdx = INDEX_TS.indexOf('Plan gating: enforce paid-tier requirement');

    expect(initializedIdx).toBeGreaterThan(-1);
    expect(initializedIdx).toBeLessThan(initializeIdx);
    expect(initializedIdx).toBeLessThan(planGateIdx);
    expect(INDEX_TS).toMatch(
      /method\s*===\s*'notifications\/initialized'[\s\S]{1,180}hasOwnProperty\.call\(body,\s*'id'\)[\s\S]{1,80}return mcpAccepted\(corsHeaders\)/,
    );
    expect(PROTOCOL_TS).toMatch(
      /function\s+mcpAccepted[\s\S]{1,160}new Response\(null,\s*\{\s*status:\s*202,\s*headers:\s*corsHeaders\s*\}\)/,
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
    const dispatchIdx = INDEX_TS.indexOf('const toolModule = getToolModule(toolName)');
    const switchIdx = INDEX_TS.search(/switch\s*\(\s*toolName\s*\)/);

    expect(planGateIdx).toBeGreaterThan(protocolIdx);
    expect(routeIdx).toBeGreaterThan(planGateIdx);
    expect(categoryGateIdx).toBeGreaterThan(routeIdx);
    expect(dispatchIdx).toBeGreaterThan(categoryGateIdx);
    expect(switchIdx).toBe(-1);
  });

  it('keeps tools/list after authentication instead of public introspection', () => {
    const unauthorizedIdx = INDEX_TS.indexOf('if (!authResult.ok) return authResult.response');
    const toolsListIdx = INDEX_TS.indexOf("if (method === 'tools/list')");

    expect(unauthorizedIdx).toBeGreaterThan(-1);
    expect(toolsListIdx).toBeGreaterThan(unauthorizedIdx);
  });

  it('keeps authenticated non-POST probes spec-compliant without exposing tools', () => {
    const nonPostIdx = INDEX_TS.indexOf("if (req.method !== 'POST')");
    const nonPostAuthIdx = INDEX_TS.indexOf(
      'const authResult = await authenticateMcpRequest',
      nonPostIdx,
    );
    const nonPostInvalidIdx = INDEX_TS.indexOf(
      'if (!authResult.ok) return authResult.response',
      nonPostAuthIdx,
    );
    const methodNotAllowedIdx = INDEX_TS.indexOf("status: 405", nonPostInvalidIdx);
    const parseJsonIdx = INDEX_TS.indexOf('// Parse JSON-RPC body');

    expect(nonPostIdx).toBeGreaterThan(-1);
    expect(nonPostAuthIdx).toBeGreaterThan(nonPostIdx);
    expect(nonPostInvalidIdx).toBeGreaterThan(nonPostAuthIdx);
    expect(methodNotAllowedIdx).toBeGreaterThan(nonPostInvalidIdx);
    expect(methodNotAllowedIdx).toBeLessThan(parseJsonIdx);
    expect(INDEX_TS.slice(methodNotAllowedIdx, parseJsonIdx)).toContain("'Allow': 'POST, OPTIONS'");
    expect(INDEX_TS.slice(nonPostInvalidIdx, parseJsonIdx)).not.toContain('buildToolDefinitions');
    expect(INDEX_TS.slice(nonPostInvalidIdx, parseJsonIdx)).not.toContain('tools:');
  });

  it('strips optional outputSchema at the final response boundary', () => {
    expect(INDEX_TS).toMatch(/function\s+stripOptionalOutputSchemas/);
    expect(INDEX_TS).toMatch(/outputSchema:\s*_outputSchema/);
    expect(INDEX_TS).toMatch(/stripOptionalOutputSchemas\(filterToolsForToken\(allTools,\s*mcpToken\)\)/);
  });
});
