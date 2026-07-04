import { describe, expect, it } from 'vitest';
import { collectTranscriptParticipantIdentities } from '../connector-pipeline';

describe('connector pipeline participant identity collection', () => {
  it('dedupes transcript speakers by normalized email first', () => {
    const identities = collectTranscriptParticipantIdentities(
      [
        {
          speaker_name: 'Alice',
          speaker_email: 'ALICE@example.com',
          text: 'hello',
        },
        {
          speaker_name: 'Alice A.',
          speaker_email: 'alice@example.com',
          text: 'again',
        },
      ],
      {
        transcript_speaker_names: ['Alice', 'Bob'],
        participant_emails: ['BOB@example.com', 'alice@example.com'],
        recorded_by_name: 'Host User',
        recorded_by_email: 'host@example.com',
      },
    );

    expect(identities).toEqual([
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: null },
      { name: null, email: 'bob@example.com' },
      { name: 'Host User', email: 'host@example.com' },
    ]);
  });

  it('skips duplicate unknown speaker-only rows while preserving known emails', () => {
    const identities = collectTranscriptParticipantIdentities(
      [
        {
          speaker_name: 'Unknown',
          speaker_email: null,
          text: 'speakerless',
        },
        {
          speaker_name: '',
          speaker_email: null,
          text: 'still speakerless',
        },
        {
          speaker_name: 'unknown@example.com',
          speaker_email: 'unknown@example.com',
          text: 'email only',
        },
      ],
      {
        transcript_speaker_names: ['Unknown', 'Unknown Speaker'],
        participant_emails: ['unknown@example.com'],
      },
    );

    expect(identities).toEqual([
      { name: null, email: 'unknown@example.com' },
    ]);
  });

  it('splits comma-separated participant_emails instead of storing a combined email', () => {
    const identities = collectTranscriptParticipantIdentities(
      [],
      {
        participant_emails: ['andrew@aisimple.co,naegele412@gmail.com'],
      },
    );

    expect(identities).toEqual([
      { name: null, email: 'andrew@aisimple.co' },
      { name: null, email: 'naegele412@gmail.com' },
    ]);
  });
});
