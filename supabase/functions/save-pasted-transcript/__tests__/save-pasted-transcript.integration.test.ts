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
  'TEST_USER_EMAIL',
  'TEST_USER_PASSWORD',
  'TEST_ORG_ID',
  'OTHER_ORG_ID',
] as const;

const SUPABASE_URL =
  process.env.SUPABASE_TEST_URL ??
  process.env.VITE_SUPABASE_TEST_URL ??
  process.env.VITE_SUPABASE_URL ??
  '';
const ANON_KEY =
  process.env.SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_TEST_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  '';
const SERVICE_KEY =
  process.env.SUPABASE_TEST_SERVICE_KEY ??
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  '';

const skipAll = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY || REQUIRED_ENV.some(k => !process.env[k]);
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

const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:05,000
Alice: Hello everyone from SRT

2
00:00:06,000 --> 00:00:10,000
Bob: Thanks for joining the SRT test
`.trim();

const SAMPLE_OTTER = `Transcript by Otter.ai
Launch Planning
Alice: Hello everyone, this is a realistic Otter speaker turn for import testing.
Bob: Thanks for joining, this is another realistic Otter speaker turn today.
Alice: We should preserve speaker turns when importing this transcript format.
`.trim();

const SAMPLE_RAW = `This is a raw transcript body that does not match any known structured format.
It should still save as full transcript text so the user does not lose pasted content.`;

const SAMPLE_LOOM = `0:00
Welcome to the product walkthrough.
0:07
Here is how the transcript import works.`;

const SAMPLE_MARKDOWN = `# Customer Call Notes

Alice: We need this markdown transcript preserved as text.
Bob: Agreed, it should import without becoming document ingestion.`;

const MALFORMED_VTT = `WEBVTT

This looks like a VTT file but has no valid cue timestamps.
The raw body should still survive import intact.`;

let userToken: string | undefined;
let adminClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  if (skipAll) return;
  adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
  // Sign in the test user to get a JWT
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
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

function getRecordingId(data: unknown): string {
  const recordingId = (data as { data?: { recording_id?: string } })?.data?.recording_id;
  expect(recordingId).toBeTruthy();
  expect(typeof recordingId).toBe('string');
  return recordingId as string;
}

async function loadRecording(recordingId: string) {
  const { data, error } = await adminClient
    .from('recordings')
    .select('id, source_app, full_transcript, source_metadata, transcript_segments')
    .eq('id', recordingId)
    .single();
  if (error) throw new Error(`Failed to load recording ${recordingId}: ${error.message}`);
  return data as {
    id: string;
    source_app: string;
    full_transcript: string | null;
    source_metadata: { parse_status?: string; source_platform?: string } | null;
    transcript_segments: unknown;
  };
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
      getRecordingId(data);
    });
  });

  // ── Format Detection (SRT) ──────────────────────────────────────────────────
  describe('SRT format detection', () => {
    it('detects and parses SRT, returns 200 with recording_id', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_SRT, organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(200);
      getRecordingId(data);
    });
  });

  // ── Format Detection (Otter) ────────────────────────────────────────────────
  describe('Otter format detection', () => {
    it('detects and parses Otter text export, returns 200 with recording_id', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_OTTER, organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(200);
      getRecordingId(data);
    });
  });

  // ── Raw Fallback ───────────────────────────────────────────────────────────
  describe('Raw fallback', () => {
    it('saves unstructured raw transcript text, returns 200 with recording_id', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_RAW, organization_id: ORG_ID },
        userToken
      );
      expect(status).toBe(200);
      const recordingId = getRecordingId(data);
      const recording = await loadRecording(recordingId);
      expect(recording.full_transcript).toContain('does not match any known structured format');
      expect(recording.source_metadata?.parse_status).toBe('raw');
      expect(recording.transcript_segments).toBeNull();
    });
  });

  // ── Format Detection (Loom) ────────────────────────────────────────────────
  describe('Loom format detection', () => {
    it('preserves Loom source URL metadata and imports timestamped Loom text', async () => {
      const { status, data } = await invoke(
        {
          raw_transcript: SAMPLE_LOOM,
          organization_id: ORG_ID,
          source_url: `https://www.loom.com/share/integration-${Date.now()}`,
        },
        userToken
      );
      expect(status).toBe(200);
      const recording = await loadRecording(getRecordingId(data));
      expect(recording.source_app).toBe('loom');
      expect(recording.source_metadata?.source_platform).toBe('loom');
      expect(recording.source_metadata?.parse_status).toBe('parsed');
    });
  });

  // ── Markdown Raw Text ──────────────────────────────────────────────────────
  describe('Markdown/raw text import', () => {
    it('imports Markdown as transcript text and preserves the raw body', async () => {
      const { status, data } = await invoke(
        { raw_transcript: SAMPLE_MARKDOWN, organization_id: ORG_ID, source_app: 'file-upload' },
        userToken
      );
      expect(status).toBe(200);
      const recording = await loadRecording(getRecordingId(data));
      expect(recording.full_transcript).toContain('# Customer Call Notes');
      expect(recording.full_transcript).toContain('markdown transcript preserved as text');
    });

    it('preserves malformed structured text through raw fallback', async () => {
      const { status, data } = await invoke(
        { raw_transcript: MALFORMED_VTT, organization_id: ORG_ID, source_app: 'zoom' },
        userToken
      );
      expect(status).toBe(200);
      const recording = await loadRecording(getRecordingId(data));
      expect(recording.full_transcript).toContain('no valid cue timestamps');
      expect(recording.source_metadata?.parse_status).toBe('raw');
      expect(recording.transcript_segments).toBeNull();
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
      getRecordingId(data);
    });
  });

  // ── Dedup Enforcement ───────────────────────────────────────────────────────
  describe('Dedup enforcement (same share URL twice)', () => {
    const SHARE_URL = `https://fathom.video/share/integration-test-dedup-${Date.now()}`;
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
