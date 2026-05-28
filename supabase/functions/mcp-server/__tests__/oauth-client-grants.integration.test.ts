import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/auth.ts'),
  'utf8',
);
const PROTOCOL_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/protocol.ts'),
  'utf8',
);

describe('oauth client grants auth regressions (phase 03 wave 0)', () => {
  it('resolves OAuth JWT authorization from mcp_oauth_client_grants keyed by user_id + client_id + scope', () => {
    expect(AUTH_TS).toMatch(/from\('mcp_oauth_client_grants'\)/);
    expect(AUTH_TS).toMatch(/\.eq\('user_id',\s*jwtUser\.id\)/);
    expect(AUTH_TS).toMatch(/\.eq\('client_id',\s*clientId\)/);
    expect(AUTH_TS).toMatch(/org_id|workspace_id/);
  });

  it('fails closed on revoked grants/tokens and updates last_used_at for active rows', () => {
    expect(AUTH_TS).toMatch(/revoked_at/);
    expect(AUTH_TS).toMatch(/last_used_at/);
    expect(AUTH_TS).toMatch(/forbiddenResponse|status:\s*403/);
  });

  it('recognizes cv_org_ and cv_ws_ prefixed tokens and keeps legacy 64-char hex fallback', () => {
    expect(AUTH_TS).toMatch(/cv_org_/);
    expect(AUTH_TS).toMatch(/cv_ws_/);
    expect(AUTH_TS).toMatch(/\^\[0-9a-f\]\{64\}\$/);
  });

  it('distinguishes invalid bearer (401) from authorization failure (403)', () => {
    expect(PROTOCOL_TS).toMatch(/function\s+unauthorizedResponse[\s\S]{1,1200}status:\s*401/);
    expect(PROTOCOL_TS).toMatch(/function\s+forbiddenResponse[\s\S]{1,600}status:\s*403/);
  });
});
