/**
 * Security regression tests: ISC-8–12 JWT grant pivot fix
 *
 * These are structural (static-analysis) tests — they verify that
 * auth.ts contains exactly the secure pattern and does NOT contain
 * the vulnerable readClientIdFromJwt() function.
 *
 * Test 1: forged client_id in JWT payload cannot pivot grant lookup
 *   — verified structurally: auth.ts must NOT call readClientIdFromJwt()
 *     or atob(), so no raw JWT decoding can happen
 *
 * Test 2: valid OAuth flow uses app_metadata for client_id extraction
 *   — verified structurally: auth.ts must read client_id from
 *     jwtUser.app_metadata (cryptographically-verified user object)
 *
 * Test 3: missing client_id in app_metadata returns 401
 *   — verified structurally: clientId null-check must still exist and
 *     must return unauthorizedResponse (not fall back to raw decode)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_TS = readFileSync(
  resolve(process.cwd(), 'supabase/functions/mcp-server/auth.ts'),
  'utf8',
);

describe('ISC-8-12 JWT grant pivot fix (sec-jwt-fix)', () => {
  it('Test 1 (forged client_id pivot prevention): readClientIdFromJwt is completely absent from auth.ts', () => {
    expect(AUTH_TS).not.toMatch(/readClientIdFromJwt/);
  });

  it('Test 1 (forged client_id pivot prevention): atob() is completely absent from auth.ts', () => {
    expect(AUTH_TS).not.toMatch(/\batob\s*\(/);
  });

  it('Test 1 (forged client_id pivot prevention): base64UrlDecode helper is completely absent from auth.ts', () => {
    expect(AUTH_TS).not.toMatch(/base64UrlDecode/);
  });

  it('Test 2 (valid OAuth flow): client_id is extracted from jwtUser.app_metadata (verified user object)', () => {
    // Must use app_metadata to extract client_id
    expect(AUTH_TS).toMatch(/app_metadata/);
    // Must be read from the jwtUser returned by authClient.auth.getUser(rawToken)
    expect(AUTH_TS).toMatch(/jwtUser\.app_metadata/);
  });

  it('Test 2 (valid OAuth flow): comment documents ISC-9 field confirmation', () => {
    expect(AUTH_TS).toMatch(/ISC-9/);
  });

  it('Test 3 (missing client_id returns 401): null clientId still triggers unauthorizedResponse', () => {
    // The null-check for clientId must still exist and return an unauthorized response
    expect(AUTH_TS).toMatch(/if\s*\(!clientId\)/);
    expect(AUTH_TS).toMatch(/unauthorizedResponse/);
  });

  it('existing contract: mcp_oauth_client_grants keyed by user_id + client_id is preserved', () => {
    expect(AUTH_TS).toMatch(/from\('mcp_oauth_client_grants'\)/);
    expect(AUTH_TS).toMatch(/\.eq\('user_id',\s*jwtUser\.id\)/);
    expect(AUTH_TS).toMatch(/\.eq\('client_id',\s*clientId\)/);
  });
});
