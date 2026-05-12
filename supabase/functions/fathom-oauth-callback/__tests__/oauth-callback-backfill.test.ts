/**
 * fathom-oauth-callback Phase 39 wiring contract (plan 39-03).
 *
 * Static-analysis pattern: reads index.ts and asserts the post-token-storage
 * wiring is in place — backfill invoke, webhook auto-registration, and
 * EdgeRuntime.waitUntil non-blocking pattern.
 *
 * Also asserts the Phase 37 invariants (authenticateRequest, encrypted token
 * RPC) are preserved, since Phase 39 modifies the SAME file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FN_PATH = resolve(__dirname, '..', 'index.ts');
const source = readFileSync(FN_PATH, 'utf-8');

describe('fathom-oauth-callback Phase 39 wiring', () => {
  it('invokes fathom-reconcile in backfill mode after token storage', () => {
    expect(source).toMatch(/supabase\.functions\.invoke\(['"]fathom-reconcile['"]/);
    expect(source).toMatch(/mode:\s*['"]backfill['"]/);
  });

  it('invokes create-fathom-webhook for auto-registration', () => {
    expect(source).toMatch(/supabase\.functions\.invoke\(['"]create-fathom-webhook['"]/);
  });

  it('wraps backfill+webhook in EdgeRuntime.waitUntil for non-blocking behavior', () => {
    expect(source).toMatch(/EdgeRuntime\.waitUntil/);
    expect(source).toMatch(/Promise\.allSettled/);
  });

  it('still uses authenticateRequest (Phase 37 SEC-02A invariant)', () => {
    expect(source).toMatch(/authenticateRequest/);
  });

  it('still uses encrypted OAuth tokens (Phase 37 SEC-09 invariant)', () => {
    expect(source).toMatch(/store_encrypted_oauth_tokens/);
  });

  it('treats 409 webhook-already-exists as success (not error)', () => {
    expect(source).toMatch(/already exists/);
  });

  it('returns backfillTriggered:true in success response', () => {
    expect(source).toMatch(/backfillTriggered:\s*true/);
  });
});
