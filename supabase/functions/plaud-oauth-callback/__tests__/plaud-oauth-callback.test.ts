import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../index.ts'), 'utf8');

describe('plaud-oauth-callback wiring', () => {

  it('stores OAuth tokens through encrypted import_sources RPC', () => {
    expect(source).toMatch(/store_encrypted_oauth_tokens/);
    expect(source).toMatch(/p_source_id:\s*sourceId/);
    expect(source).toMatch(/p_access_token:\s*tokens\.access_token/);
  });

});
