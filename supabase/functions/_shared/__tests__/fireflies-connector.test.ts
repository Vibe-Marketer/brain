import { describe, expect, it, vi } from 'vitest';
import {
  fetchFirefliesTranscript,
  firefliesTranscriptToCanonical,
  type FirefliesTranscript,
} from '../fireflies-connector';

describe('fireflies connector', () => {
  const transcript: FirefliesTranscript = {
    id: '01HXFIREFLIES',
    title: 'CallVault Connector Design',
    dateString: '2026-05-23T15:00:00Z',
    duration: 95,
    host_email: 'host@example.com',
    organizer_email: 'organizer@example.com',
    transcript_url: 'https://app.fireflies.ai/view/01HXFIREFLIES',
    meeting_link: 'https://meet.example.com/abc',
    participants: ['guest@example.com'],
    meeting_attendees: [
      { displayName: 'Host User', email: 'host@example.com' },
      { displayName: 'Guest User', email: 'guest@example.com' },
    ],
    sentences: [
      { index: 2, speaker_name: 'Guest User', text: 'Second turn.', start_time: 12.2, end_time: 18 },
      { index: 1, speaker_name: 'Host User', text: 'First turn.', start_time: 0, end_time: 5 },
    ],
    summary: {
      short_summary: 'Connector design review.',
      action_items: ['Build conformance tests'],
      topics_discussed: ['Canonical recordings'],
    },
  };

  it('normalizes Fireflies transcript payloads into canonical recordings', () => {
    const canonical = firefliesTranscriptToCanonical(transcript);

    expect(canonical).toMatchObject({
      externalId: '01HXFIREFLIES',
      sourceApp: 'fireflies',
      title: 'CallVault Connector Design',
      recordingStartTime: '2026-05-23T15:00:00.000Z',
      recordingEndTime: '2026-05-23T15:01:35.000Z',
      durationSeconds: 95,
      sourceUrl: 'https://app.fireflies.ai/view/01HXFIREFLIES',
      recordedByEmail: 'host@example.com',
      participantEmails: ['host@example.com', 'organizer@example.com', 'guest@example.com'],
    });
    expect(canonical.fullTranscript).toBe('[0:00] Host User: First turn.\n\n[0:12] Guest User: Second turn.');
    expect(canonical.summary).toContain('Connector design review.');
    expect(canonical.summary).toContain('- Build conformance tests');
    expect(canonical.sourceMetadata).toMatchObject({
      fireflies_transcript_id: '01HXFIREFLIES',
      recorded_by_name: 'Host User',
      recorded_by_email: 'host@example.com',
    });
  });

  it('uses the documented GraphQL endpoint and bearer auth', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: { transcript } }), { status: 200 })) as unknown as typeof fetch;

    const result = await fetchFirefliesTranscript('secret-key', '01HXFIREFLIES', fetchImpl);

    expect(result.id).toBe('01HXFIREFLIES');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.fireflies.ai/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-key',
        },
      }),
    );
  });
});
