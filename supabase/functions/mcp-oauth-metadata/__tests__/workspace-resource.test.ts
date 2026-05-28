import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const METADATA_PATH = resolve(process.cwd(), 'supabase/functions/mcp-oauth-metadata/index.ts');
const WORKER_PATH = resolve(process.cwd(), 'cloudflare/api-proxy/worker.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('workspace protected-resource metadata contract (MCP-02)', () => {
  it('advertises workspace-specific resource for /.well-known/oauth-protected-resource/mcp/w/{workspace_uuid}', () => {
    const src = read(METADATA_PATH);
    expect(src).toMatch(/oauth-protected-resource\/mcp\/w\//);
    expect(src).toMatch(/resource/);
    expect(src).toMatch(/\/mcp\/w\//);
  });

  it('keeps non-workspace protected-resource metadata path for /mcp', () => {
    const src = read(METADATA_PATH);
    expect(src).toMatch(/canonicalResource\s*=\s*`\$\{canonicalOrigin\}\/mcp`/);
  });

  it('cloudflare worker routes workspace metadata and workspace MCP paths to Supabase without exposing raw URL', () => {
    const src = read(WORKER_PATH);
    expect(src).toMatch(/\/mcp\/w\//);
    expect(src).toMatch(/oauth-protected-resource\/mcp\/w\//);
    expect(src).toMatch(/functions\/v1\/mcp-server/);
    expect(src).toMatch(/functions\/v1\/mcp-oauth-metadata/);
  });
});
