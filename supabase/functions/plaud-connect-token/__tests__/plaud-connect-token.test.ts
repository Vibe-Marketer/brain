import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../index.ts'), 'utf8');

describe('plaud-connect-token wiring', () => {
  it('validates a pasted Plaud web token with the consumer client', () => {
    expect(source).toMatch(/new PlaudClient\(accessToken, \{ apiBase \}\)/);
    expect(source).toMatch(/await plaudClient\.listDevices\(\)/);
  });

  it('validates Plaud devices before workspace-token metadata is resolved', () => {
    const clientSource = readFileSync(join(__dirname, '../../_shared/plaud-client.ts'), 'utf8');

    expect(clientSource).toMatch(/async listDevices\(\): Promise<PlaudDeviceListResponse> \{\s*return await this\.requestJson<PlaudDeviceListResponse>\('\/device\/list', \{\s*auth: 'user',\s*\}\);\s*\}/);
  });

  it('stores the durable Plaud connection metadata on import_sources', () => {
    expect(source).toMatch(/connection_metadata:/);
    expect(source).toMatch(/auth_type:\s*'consumer_token'/);
    expect(source).toMatch(/workspace_id:\s*plaudClient\.workspaceId/);
  });

  it('uses encrypted token storage when available', () => {
    expect(source).toMatch(/store_encrypted_oauth_tokens/);
    expect(source).toMatch(/p_refresh_token:\s*null/);
  });
});
