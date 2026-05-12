/**
 * fathom-reconcile contract test (Phase 39 plan 39-02).
 *
 * Static-analysis pattern: read the source file and assert wiring contracts.
 * The Deno edge function imports from https://esm.sh/... which Vitest can't
 * resolve directly. Static analysis catches removed wiring without runtime
 * mocking. End-to-end behavior is verified by Phase 39 integration tests
 * and manual OAuth flow verification.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FN_PATH = resolve(__dirname, '..', 'index.ts');
const source = readFileSync(FN_PATH, 'utf-8');

describe('fathom-reconcile contract (Phase 39)', () => {
  it('exposes Deno.serve handler', () => {
    expect(source).toMatch(/Deno\.serve/);
  });

  it('routes mode=reconcile through RECONCILE_SECRET gate', () => {
    expect(source).toMatch(/X-Reconcile-Secret/);
    expect(source).toMatch(/RECONCILE_SECRET/);
    expect(source).toMatch(/status:\s*401/);
  });

  it('routes mode=backfill through authenticateRequest', () => {
    expect(source).toMatch(/authenticateRequest/);
  });

  it('iterates ALL active fathom import_sources in reconcile mode', () => {
    expect(source).toMatch(/source_app['"]?\s*,\s*['"]fathom['"]/);
    expect(source).toMatch(/is_active['"]?\s*,\s*true/);
  });

  it('uses runPipeline for canonical insert', () => {
    expect(source).toMatch(/runPipeline/);
  });

  it('uses composite onConflict for mirror upsert', () => {
    expect(source).toMatch(/onConflict:\s*['"]recording_id,user_id['"]/);
  });

  it('stamps import_source_id on every upsert', () => {
    expect(source).toMatch(/import_source_id:\s*sourceId/);
  });

  it('uses FathomClient.fetchWithRetry (NOT raw fetch) for Fathom meetings API', () => {
    expect(source).toMatch(/FathomClient\.fetchWithRetry/);
  });

  it('honors OAUTH_ENCRYPTION_KEY via decrypt_oauth_tokens RPC when set', () => {
    expect(source).toMatch(/OAUTH_ENCRYPTION_KEY/);
    expect(source).toMatch(/decrypt_oauth_tokens/);
  });
});
