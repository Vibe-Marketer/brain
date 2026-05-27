---
id: "01-B"
phase: 1
title: "Real-Supabase Integration Tests (MAN-04)"
type: implementation
status: pending
files_modified:
  - supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts
  - package.json
---

# Plan 01-B: Real-Supabase Integration Tests (MAN-04)

## Goal

Create behavioral HTTP-level integration tests for `save-pasted-transcript` that run against a real Supabase test project (not mocked). Gate CI with an env-var guard. Tests must cover: auth rejection, workspace membership gate, dedup enforcement, format detection for VTT and Fathom paths.

## Background

Per BUG-01 / CONCERNS Phase 30 precedent: a mocked test passed the exact UUID/BIGINT bug that broke prod. Integration tests for this function **must** hit a real Supabase project. The existing `save-pasted-transcript.test.ts` is source-artifact inspection (runs fine without Supabase) and must not be changed or replaced.

## Tasks

### Task 1: Create integration test file

`supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts`:

```typescript
/**
 * Integration tests for save-pasted-transcript edge function.
 *
 * REQUIRES: Real Supabase test project credentials
 *   SUPABASE_TEST_URL — URL of the test Supabase project
 *   SUPABASE_TEST_ANON_KEY — anon key for the test project
 *   SUPABASE_TEST_SERVICE_KEY — service key for the test project
 *   TEST_USER_EMAIL — email of a seeded test user
 *   TEST_USER_PASSWORD — password of the seeded test user
 *   TEST_ORG_ID — organization_id the test user belongs to
 *   OTHER_ORG_ID — organization_id the test user does NOT belong to
 *
 * Per BUG-01 / CONCERNS Phase 30: NO mocked Supabase clients.
 * These tests will SKIP if env vars are not set.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = [
  'SUPABASE_TEST_URL',
  'SUPABASE_TEST_SERVICE_KEY',
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'TEST_ORG_ID',
  'OTHER_ORG_ID',
] as const;

const skipAll = REQUIRED_ENV.some(k => !process.env[k]);

const SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? '';
const USER_EMAIL = process.env.TEST_USER_EMAIL ?? '';
const USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? '';
const ORG_ID = process.env.TEST_ORG_ID ?? '';
const OTHER_ORG_ID = process.env.OTHER_ORG_ID ?? '';

const FUNCTION_NAME = 'save-pasted-transcript';

const SAMPLE_FATHOM_TRANSCRIPT = `
[00:00:01] Alice: Hello everyone, welcome to the meeting.
[00:00:15] Bob: Thanks for joining, let's get started.
[00:01:00] Alice: I have some updates on the project.
`.trim();

const SAMPLE_VTT = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
Alice: Hello everyone

2
00:00:06.000 --> 00:00:10.000
Bob: Thanks for joining
`.trim();

let userToken: string | undefined;
let adminClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  if (skipAll) return;
  adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  // Sign in the test user to get a JWT
  const anonClient = createClient(SUPABASE_URL, process.env.SUPABASE_TEST_ANON_KEY ?? '');
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: USER_EMAIL,
    password: USER_PASSWORD,
  });
  if (error) throw new Error(`Test user sign-in failed: ${error.message}`);
  userToken = data.session?.access_token;
});

async function invoke(
  body: Record<string, unknown>,
  token?: string
): Promise<{ data: unknown; error: unknown; status: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { data, error: null, status: response.status };
}

describe.skipIf(skipAll)('INT — save-pasted-transcript (real Supabase)', () => {

  // ── Auth Rejection ──────────────────────────────────────────────────────────
  describe('Auth rejection', () => {
    it('returns 401 when no Authorization header is provided', async () => {
      const { status } = await invoke({
        raw_transcript: SAMPLE_FATHOM_TRANSCRIPT,
        organization_id: ORG_ID,
      });
      expect(status).toBe(401);
    });

    it('returns 401 for an invalid JWT', async () => {
      const { status } = await invoke(
        { raw_transcript: SAMPLE_FATHOM_TRANSCRIPT, organization_id: ORG_ID },
        'not-a-valid-jwt'
      );
      expect(status).toBe(401);
    });
  });

  // ── Workspace Membership Gate ───────────────────────────────────────────────
  describe('Workspace membership gate', () => {
    it('returns 403 when user posts to an org they do not belong to', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_FATHOM_TRANSCRIPT, organization_id: OTHER_ORG_ID },
        userToken
      );
      expect(status).toBe(403);
      expect((data as { error?: string })?.error).toMatch(/member|workspace|access/i);
    });
  });

  // ── Format Detection (VTT) ──────────────────────────────────────────────────
  describe('VTT format detection', () => {
    it('detects and parses Zoom VTT, returns 200 with recording_id', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_VTT, organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(200);
      const recording_id = (data as { data?: { recording_id?: string } })?.data?.recording_id;
      expect(recording_id).toBeTruthy();
      expect(typeof recording_id).toBe('string');
    });
  });

  // ── Format Detection (Fathom copy) ─────────────────────────────────────────
  describe('Fathom format detection', () => {
    it('detects and parses Fathom copy format, returns 200 with recording_id', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_FATHOM_TRANSCRIPT, organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(200);
      const recording_id = (data as { data?: { recording_id?: string } })?.data?.recording_id;
      expect(recording_id).toBeTruthy();
    });
  });

  // ── Dedup Enforcement ───────────────────────────────────────────────────────
  describe('Dedup enforcement (same share URL twice)', () => {
    const SHARE_URL = 'https://fathom.video/share/integration-test-dedup-001';
    const body = {
      raw_transcript: SAMPLE_FATHOM_TRANSCRIPT,
      organization_id: ORG_ID,
      share_url: SHARE_URL,
    };

    it('first paste returns 200 with action=created', async () => {
      const { status, data } = await invoke(body, userToken);
      expect(status).toBe(200);
      expect((data as { data?: { action?: string } })?.data?.action).toBe('created');
    });

    it('second paste of same share URL returns 200 with action=updated', async () => {
      const { status, data } = await invoke(body, userToken);
      expect(status).toBe(200);
      expect((data as { data?: { action?: string } })?.data?.action).toBe('updated');
    });
  });

  // ── Input Validation ────────────────────────────────────────────────────────
  describe('Input validation', () => {
    it('returns 400 for transcript shorter than 20 chars', async () => {
      const { status } = await invoke(
        { raw_transcript: 'too short', organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(400);
    });

    it('returns 400 for invalid organization_id UUID', async () => {
      const { status } = await invoke(
        { raw_transcript: SAMPLE_FATHOM_TRANSCRIPT, organization_id: 'not-a-uuid' },
        userToken
      );
      expect(status).toBe(400);
    });
  });
});
```

### Task 2: Add test:integration script to package.json

Add to `scripts` in `package.json`:
```json
"test:integration": "vitest run --reporter=verbose src/__tests__/**/*.integration.test.ts supabase/functions/**/__tests__/*.integration.test.ts"
```

This script runs only integration test files (matched by `.integration.test.ts` suffix) and requires env vars to be set externally.

### Task 3: Ensure vitest.config.ts covers the function test path

Verify that `supabase/functions/**/__tests__/*.test.ts` is included in the vitest include glob. If not, add it.

## Verification

- Run `npm run test -- --reporter=verbose supabase/functions/save-pasted-transcript/__tests__/save-pasted-transcript.integration.test.ts` without env vars → all tests show as skipped (not failed)
- With credentials set: auth rejection tests pass, dedup tests pass, format detection tests pass
- Existing `save-pasted-transcript.test.ts` still passes unchanged

## Threat Model

- Integration tests run against a dedicated TEST Supabase project, never prod credentials. Test credentials are never committed — env-var gated only.
- The `OTHER_ORG_ID` env var is an org that the test user explicitly does NOT belong to — verifies the membership gate without creating real cross-org data.
