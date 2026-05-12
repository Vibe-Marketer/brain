/**
 * fathom-refresh contract test (Phase 40 plan 40-01).
 *
 * Static-analysis pattern: read the source file and assert wiring contracts.
 * The Deno edge function imports from https://esm.sh/... which Vitest can't
 * resolve directly. Static analysis catches removed wiring without runtime
 * mocking. End-to-end behavior is verified by Phase 40 integration tests.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FN_PATH = resolve(__dirname, '..', 'index.ts');
const source = readFileSync(FN_PATH, 'utf-8');

describe('fathom-refresh contract (Phase 40)', () => {
  it('exposes Deno.serve handler', () => {
    expect(source).toMatch(/Deno\.serve/);
  });

  it('requires JWT auth via authenticateRequest', () => {
    expect(source).toMatch(/authenticateRequest/);
  });

  it('verifies owner_user_id ownership of recording', () => {
    expect(source).toMatch(/owner_user_id\s*!==?\s*userId/);
  });

  it('returns 404 (not 403) on cross-org / not-found', () => {
    expect(source).toMatch(/RECORDING_NOT_FOUND/);
  });

  it('rejects non-Fathom recordings', () => {
    expect(source).toMatch(/NOT_A_FATHOM_CALL/);
  });

  it('returns FATHOM_CALL_NOT_FOUND when meeting missing upstream', () => {
    expect(source).toMatch(/FATHOM_CALL_NOT_FOUND/);
  });

  it('returns FATHOM_AUTH_EXPIRED on refresh-token failure', () => {
    expect(source).toMatch(/FATHOM_AUTH_EXPIRED/);
  });

  it('returns FATHOM_RATE_LIMITED on 429 + Retry-After header', () => {
    expect(source).toMatch(/FATHOM_RATE_LIMITED/);
    expect(source).toMatch(/Retry-After/);
  });

  it('uses FathomClient.fetchWithRetry (NOT raw fetch) for meetings API', () => {
    expect(source).toMatch(/FathomClient\.fetchWithRetry/);
  });

  it('updates ONLY the editable fields on recordings (preservation invariant)', () => {
    // Find the UPDATE block — must NOT mention id, organization_id, owner_user_id,
    // legacy_recording_id, source_app, source_call_id, or created_at as SET targets.
    const updateBlock = source.match(/\.from\('recordings'\)\s*\.update\(\{[\s\S]*?\}\)/);
    expect(updateBlock, 'expected an .update({...}) on recordings').toBeTruthy();
    const block = updateBlock![0];
    expect(block).not.toMatch(/\bid:\s/);
    expect(block).not.toMatch(/organization_id:\s/);
    expect(block).not.toMatch(/owner_user_id:\s/);
    expect(block).not.toMatch(/legacy_recording_id:\s/);
    expect(block).not.toMatch(/source_app:\s/);
    expect(block).not.toMatch(/source_call_id:\s/);
    expect(block).not.toMatch(/created_at:\s/);
  });

  it('re-upserts fathom_raw_calls mirror on composite key', () => {
    expect(source).toMatch(/from\(['"]fathom_raw_calls['"]\)/);
    expect(source).toMatch(/onConflict:\s*['"]recording_id,user_id['"]/);
  });

  it('honors OAUTH_ENCRYPTION_KEY via decrypt_oauth_tokens RPC when set', () => {
    expect(source).toMatch(/OAUTH_ENCRYPTION_KEY/);
    expect(source).toMatch(/decrypt_oauth_tokens/);
  });
});
