import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, '../index.ts'), 'utf8');

describe('plaud-oauth-callback wiring', () => {
  it('exchanges Plaud direct OAuth code with PKCE verifier', () => {
    expect(source).toMatch(/PlaudClient\.exchangeCodeForTokens/);
    expect(source).toMatch(/codeVerifier:\s*plaudState\.codeVerifier/);
  });
  it('supports a Plaud-specific redirect URI override for local verification', () => {
    expect(source).toMatch(/PLAUD_OAUTH_REDIRECT_URI/);
  });

  it('stores OAuth tokens through encrypted import_sources RPC', () => {
    expect(source).toMatch(/store_encrypted_oauth_tokens/);
    expect(source).toMatch(/p_source_id:\s*sourceId/);
    expect(source).toMatch(/p_access_token:\s*tokens\.access_token/);
  });

  it('starts Plaud sync after successful connection', () => {
    expect(source).toMatch(/supabase\.functions\.invoke\('plaud-sync-recordings'/);
    expect(source).toMatch(/body:\s*\{\s*sourceId\s*\}/);
  });
});
