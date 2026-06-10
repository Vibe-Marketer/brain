import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/auth.ts'),
  'utf8',
);

describe('auth slug resolution contract', () => {
  it('reads Worker-injected org and workspace slug headers', () => {
    expect(AUTH_TS).toMatch(/x-callvault-org-slug/);
    expect(AUTH_TS).toMatch(/x-callvault-workspace-slug/);
    expect(AUTH_TS).toMatch(/function\s+enforceSubdomainSlugAudience/);
  });

  it('resolves the org slug with the service role client and fails unknown slugs closed', () => {
    expect(AUTH_TS).toMatch(/from\('organizations'\)/);
    expect(AUTH_TS).toMatch(/\.select\('id'\)/);
    expect(AUTH_TS).toMatch(/\.eq\('slug',\s*orgSlugHeader\)/);
    expect(AUTH_TS).toMatch(/org_not_found/);
  });

  it('rejects tokens whose org does not match the subdomain org', () => {
    expect(AUTH_TS).toMatch(/mcpToken\.org_id\s*!==\s*orgId/);
    expect(AUTH_TS).toMatch(/token_org_mismatch/);
    expect(AUTH_TS).toMatch(/jsonAudienceError\('token_org_mismatch',\s*403\)/);
  });

  it('rejects workspace slug misses and workspace-token mismatches', () => {
    expect(AUTH_TS).toMatch(/from\('workspaces'\)/);
    expect(AUTH_TS).toMatch(/\.eq\('slug',\s*workspaceSlugHeader\)/);
    expect(AUTH_TS).toMatch(/\.eq\('organization_id',\s*orgId\)/);
    expect(AUTH_TS).toMatch(/token_workspace_mismatch/);
    expect(AUTH_TS).toMatch(/mcpToken\.workspace_id\s*!==\s*workspaceId/);
  });

  it('keeps legacy no-subdomain requests unchanged', () => {
    expect(AUTH_TS).toMatch(/if\s*\(!orgSlugHeader\)\s*return\s*\{\s*ok:\s*true,\s*mcpToken\s*\}/);
  });

  it('narrows org tokens to the workspace resolved from the subdomain slug', () => {
    expect(AUTH_TS).toMatch(/scope:\s*'workspace'/);
    expect(AUTH_TS).toMatch(/workspace_id:\s*workspaceId/);
  });
});
