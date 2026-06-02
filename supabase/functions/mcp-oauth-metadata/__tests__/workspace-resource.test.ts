import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const METADATA_PATH = resolve(process.cwd(), 'supabase/functions/mcp-oauth-metadata/index.ts');
const WORKER_PATH = resolve(process.cwd(), 'cloudflare/api-proxy/worker.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('workspace protected-resource metadata contract (MCP-02)', () => {
  it('advertises workspace-specific resources for root /w/{workspace_uuid} and legacy /mcp/w/{workspace_uuid}', () => {
    const src = read(METADATA_PATH);
    expect(src).toMatch(/resolveProtectedResourcePath/);
    expect(src).toMatch(/resource_path/);
    expect(src).toMatch(/\/w\/\$\{rootWorkspaceMatch\[1\]\.toLowerCase\(\)\}/);
    expect(src).toMatch(/\/mcp\/w\/\$\{legacyWorkspaceMatch\[1\]\.toLowerCase\(\)\}/);
  });

  it('keeps default protected-resource metadata on /mcp until the worker passes explicit root resource_path', () => {
    const src = read(METADATA_PATH);
    expect(src).toMatch(/const defaultResourcePath = '\/mcp'/);
    expect(src).toMatch(/canonicalResourcePath === '\/'/);
  });

  it('cloudflare worker routes root and legacy workspace metadata and MCP paths to Supabase without exposing raw URL', () => {
    const src = read(WORKER_PATH);
    expect(src).toMatch(/rootWorkspaceMatch/);
    expect(src).toMatch(/defaultResourcePath/);
    expect(src).toMatch(/encodeURIComponent\(defaultResourcePath\)/);
    expect(src).toMatch(/rootWorkspaceProtectedResourceMatch/);
    expect(src).toMatch(/workspaceProtectedResourceMatch/);
    expect(src).toMatch(/resource_path=/);
    expect(src).toMatch(/x-callvault-public-path/);
    expect(src).toMatch(/functions\/v1\/mcp-server/);
    expect(src).toMatch(/functions\/v1\/mcp-oauth-metadata/);
  });
});
