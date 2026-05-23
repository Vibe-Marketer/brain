import { describe, expect, it } from 'vitest';
import {
  canonicalToConnectorRecord,
  formatCanonicalTranscript,
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
        participantEmails: ['Alice@Example.com', 'bob@example.com', 'alice@example.com'],
        sourceMetadata: { vendor_specific: true },
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
      participant_emails: ['alice@example.com', 'bob@example.com'],
      import_source: 'fireflies-sync-meetings',
      synced_at: '2026-05-23T12:31:00Z',
      vendor_specific: true,
    });
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

  it('formats turns the same way Fathom-like downstream transcript readers expect', () => {
    expect(
      formatCanonicalTranscript([
        { speakerName: 'Alice', text: 'Start.', startSeconds: 0 },
        { speakerEmail: 'bob@example.com', text: 'After an hour.', startSeconds: 3661 },
        { speakerName: 'Ignored', text: '   ', startSeconds: 2 },
      ]),
    ).toBe('[0:00] Alice: Start.\n\n[1:01:01] bob@example.com: After an hour.');
  });
});
