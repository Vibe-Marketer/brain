import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MCP_INDEX_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/index.ts');
const MCP_AUTH_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/auth.ts');
const MCP_PROTOCOL_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/protocol.ts');
const MCP_GATING_PATH = resolve(process.cwd(), 'supabase/functions/mcp-server/gating.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('workspace scoped MCP routing contract (MCP-01, D-03)', () => {
  it('parses /mcp/w/{workspace_uuid} and keeps /mcp compatibility in one function', () => {
    const src = read(MCP_INDEX_PATH);
    expect(src).toMatch(/parseWorkspaceIdFromMcpPath/);
    expect(src).toMatch(/requestedWorkspaceId/);
  });

  it('returns 403 (not 401) for valid credential with workspace audience mismatch', () => {
    const src = read(MCP_AUTH_PATH);
    expect(src).toMatch(/workspace/i);
    expect(src).toMatch(/forbiddenResponse\(/);
    const protocolSrc = read(MCP_PROTOCOL_PATH);
    expect(protocolSrc).toMatch(/status:\s*403/);
    expect(src).toMatch(/mismatch|does not match|different workspace/i);
  });

  it('still returns 401 with WWW-Authenticate resource metadata for unauthenticated probes', () => {
    const src = read(MCP_PROTOCOL_PATH);
    expect(src).toMatch(/status:\s*401/);
    expect(src).toMatch(/WWW-Authenticate/);
    expect(src).toMatch(/resource_metadata=/);
  });

  it('preserves category/tool filtering enforcement after workspace route support', () => {
    const src = read(MCP_GATING_PATH);
    expect(src).toMatch(/enabled_categories\s*!==\s*null/);
    expect(src).toMatch(/method\s*===\s*['"]tools\/call['"]/);
    expect(src).toMatch(/is disabled for this token/);
  });
});
