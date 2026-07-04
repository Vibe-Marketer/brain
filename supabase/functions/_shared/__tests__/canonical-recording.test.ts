import { describe, expect, it } from 'vitest';
import {
  canonicalTurnsToSegments,
  canonicalToConnectorRecord,
  formatCanonicalTranscript,
  formatOffset,
  validateCanonicalRecording,
} from '../canonical-recording';

describe('canonical recording contract', () => {
  it('maps every vendor into the existing connector pipeline field names', () => {
    const record = canonicalToConnectorRecord(
      {
        externalId: 'ff-123',
        sourceApp: 'fireflies',
        title: 'Pipeline Review',
        fullTranscript: '[0:00] Alice: hello',
        recordingStartTime: '2026-05-23T12:00:00Z',
        recordingEndTime: '2026-05-23T12:30:00Z',
        durationSeconds: 1800,
        summary: 'Discussed the pipeline.',
        sourceUrl: 'https://app.fireflies.ai/view/ff-123',
        recordedByEmail: 'alice@example.com',
        participantEmails: ['Alice@Example.com', 'bob@example.com,carol@example.com', 'alice@example.com'],
        sourceMetadata: { vendor_specific: true },
        transcriptTurns: [
          {
            speakerName: 'Alice',
            speakerEmail: 'ALICE@Example.com',
            providerSpeakerId: 'speaker-1',
            text: 'hello',
            startSeconds: 0,
            endSeconds: 2.5,
          },
        ],
      },
      { importSource: 'fireflies-sync-meetings', syncedAt: '2026-05-23T12:31:00Z' },
    );

    expect(record).toMatchObject({
      external_id: 'ff-123',
      source_app: 'fireflies',
      title: 'Pipeline Review',
      full_transcript: '[0:00] Alice: hello',
      summary: 'Discussed the pipeline.',
      recording_start_time: '2026-05-23T12:00:00.000Z',
      recording_end_time: '2026-05-23T12:30:00.000Z',
      duration: 1800,
    });
    expect(record.source_metadata).toMatchObject({
      source_app: 'fireflies',
      source_url: 'https://app.fireflies.ai/view/ff-123',
      share_url: 'https://app.fireflies.ai/view/ff-123',
      recorded_by_email: 'alice@example.com',
      participant_emails: ['alice@example.com', 'bob@example.com', 'carol@example.com'],
      import_source: 'fireflies-sync-meetings',
      synced_at: '2026-05-23T12:31:00Z',
      vendor_specific: true,
    });
    expect(record.transcript_segments).toEqual([
      {
        id: 'seg-0',
        speaker_name: 'Alice',
        speaker_email: 'alice@example.com',
        provider_speaker_id: 'speaker-1',
        text: 'hello',
        timestamp: '0:00',
        start_seconds: 0,
        end_seconds: 2.5,
      },
    ]);
  });

  it.each(['fireflies', 'grain', 'otter', 'riverside', 'tldv'])(
    'accepts %s without changing the downstream recordings shape',
    (sourceApp) => {
      const record = canonicalToConnectorRecord(
        {
          externalId: `${sourceApp}-recording-1`,
          sourceApp,
          title: `${sourceApp} call`,
          fullTranscript: '[0:00] Speaker: hello',
          recordingStartTime: '2026-05-23T12:00:00Z',
        },
        { importSource: `${sourceApp}-connector-test` },
      );

      expect(record.external_id).toBe(`${sourceApp}-recording-1`);
      expect(record.source_app).toBe(sourceApp);
      expect(record.title).toBe(`${sourceApp} call`);
      expect(record.full_transcript).toBe('[0:00] Speaker: hello');
      expect(record.source_metadata.source_app).toBe(sourceApp);
    },
  );

  it('rejects invalid canonical records before database writes', () => {
    const errors = validateCanonicalRecording({
      externalId: '',
      sourceApp: 'Fireflies',
      title: '',
      fullTranscript: '',
      recordingStartTime: 'not-a-date',
    });

    expect(errors).toEqual([
      'externalId is required',
      'sourceApp must be lowercase kebab-case',
      'title is required',
      'fullTranscript is required',
      'recordingStartTime must be a valid date string',
    ]);
  });

  it('throws when converting invalid canonical records for database writes', () => {
    expect(() =>
      canonicalToConnectorRecord(
        {
          externalId: '',
          sourceApp: '',
          title: '',
          fullTranscript: '',
          recordingStartTime: '',
        },
        { importSource: 'test' },
      ),
    ).toThrow(/Invalid canonical recording/);
  });

  it('formats turns the same way Fathom-like downstream transcript readers expect', () => {
    expect(
      formatCanonicalTranscript([
        { speakerName: 'Alice', text: 'Start.', startSeconds: 0 },
        { speakerEmail: 'bob@example.com', text: 'After an hour.', startSeconds: 3661 },
        { speakerName: 'Ignored', text: '   ', startSeconds: 2 },
      ]),
    ).toBe('[0:00] Alice: Start.\n\n[1:01:01] bob@example.com: After an hour.');
  });

  it('converts canonical turns into stored transcript segments', () => {
    expect(
      canonicalTurnsToSegments([
        {
          speakerName: ' Alice ',
          speakerEmail: 'ALICE@EXAMPLE.COM',
          providerSpeakerId: ' speaker-a ',
          text: ' Hello. ',
          startSeconds: 0,
          endSeconds: 4.25,
        },
        {
          speakerEmail: 'bob@example.com',
          text: 'After the hour.',
          startSeconds: 3661,
          endSeconds: -1,
        },
        {
          speakerName: 'Ignored',
          text: '   ',
          startSeconds: 2,
        },
      ]),
    ).toEqual([
      {
        id: 'seg-0',
        speaker_name: 'Alice',
        speaker_email: 'alice@example.com',
        text: 'Hello.',
        timestamp: '0:00',
        start_seconds: 0,
        end_seconds: 4.25,
        provider_speaker_id: 'speaker-a',
      },
      {
        id: 'seg-1',
        speaker_name: 'bob@example.com',
        speaker_email: 'bob@example.com',
        text: 'After the hour.',
        timestamp: '1:01:01',
        start_seconds: 3661,
        end_seconds: null,
      },
    ]);
  });

  it('omits transcript_segments when no turns are provided', () => {
    const record = canonicalToConnectorRecord(
      {
        externalId: 'grain-1',
        sourceApp: 'grain',
        title: 'No structured turns yet',
        fullTranscript: '[0:00] Speaker: hello',
        recordingStartTime: '2026-05-23T12:00:00Z',
      },
      { importSource: 'grain-test' },
    );

    expect('transcript_segments' in record).toBe(false);
  });

  it.each([
    [0, '0:00'],
    [-5, '0:00'],
    [Number.NaN, '0:00'],
    [59, '0:59'],
    [3600, '1:00:00'],
    [3661, '1:01:01'],
  ])('formatOffset(%s) returns %s', (seconds, expected) => {
    expect(formatOffset(seconds)).toBe(expected);
  });
});
