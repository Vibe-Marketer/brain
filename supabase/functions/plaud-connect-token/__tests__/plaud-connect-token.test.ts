import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../index.ts'), 'utf8');

describe('plaud-connect-token wiring', () => {

  it('uses encrypted token storage when available', () => {
    expect(source).toMatch(/store_encrypted_oauth_tokens/);
    expect(source).toMatch(/p_refresh_token:\s*null/);
  });
});
