import { describe, it, expect } from 'vitest';
import { parseYouTubeTranscript, isYouTubeTranscriptFormat } from '../transcriptUtils';

describe('isYouTubeTranscriptFormat', () => {
  it('returns true for YouTube 2-part [M:SS] format', () => {
    const transcript = `[0:00]
Hello and welcome to this video
more text here

[0:30]
next section text
continues here`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(true);
  });

  it('returns false for Fathom/Zoom [HH:MM:SS] format with speakers', () => {
    const transcript = `[00:00:08] Andrew Naegele: Hello this is a test
[00:00:15] Other Person: Yes I agree with that`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(false);
  });

  it('returns false for malformed Fathom transcript missing speaker labels', () => {
    // Key regression case: [HH:MM:SS] format without speakers should NOT be detected
    // as YouTube just because speakers are missing — the 3-part zero-padded format
    // is structurally distinct from YouTube's 2-part [M:SS] format.
    const malformedFathom = `[00:00:08]
some transcript text without a speaker label
[00:00:45]
more text here`;
    expect(isYouTubeTranscriptFormat(malformedFathom)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isYouTubeTranscriptFormat('')).toBe(false);
  });

  it('returns true for YouTube over-1-hour format [H:MM:SS] with single-digit hour', () => {
    const transcript = `[1:00:00]
text at one hour`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(true);
  });

  it('returns false for Fathom over-1-hour format [HH:MM:SS] with zero-padded hour', () => {
    const transcript = `[01:00:00] Speaker: text at one hour`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(false);
  });
});

describe('parseYouTubeTranscript', () => {
  it('parses basic YouTube transcript into segments', () => {
    const transcript = `[0:00]
Hello and welcome to this video
more text here

[0:30]
next section text
continues here`;

    const segments = parseYouTubeTranscript(transcript, 123);
    expect(segments).toHaveLength(2);
    expect(segments[0].timestamp).toBe('0:00');
    expect(segments[0].text).toBe('Hello and welcome to this video more text here');
    expect(segments[1].timestamp).toBe('0:30');
    expect(segments[1].text).toBe('next section text continues here');
  });

  it('sets speaker_name to empty string for all segments', () => {
    const transcript = `[0:00]
some text`;
    const segments = parseYouTubeTranscript(transcript, 'uuid-123');
    expect(segments[0].speaker_name).toBe('');
    expect(segments[0].speaker_email).toBeNull();
  });

  it('assigns unique ids to segments', () => {
    const transcript = `[0:00]
first
[0:30]
second`;
    const segments = parseYouTubeTranscript(transcript, 1);
    expect(segments[0].id).toBe('yt-0');
    expect(segments[1].id).toBe('yt-1');
  });

  it('returns empty array for transcript with no timestamps', () => {
    const transcript = 'just plain text with no timestamps';
    expect(parseYouTubeTranscript(transcript, 1)).toHaveLength(0);
  });

  it('skips empty text blocks between timestamps', () => {
    const transcript = `[0:00]

[0:30]
actual content here`;
    const segments = parseYouTubeTranscript(transcript, 1);
    expect(segments).toHaveLength(1);
    expect(segments[0].timestamp).toBe('0:30');
  });

  it('handles hour-format timestamps', () => {
    const transcript = `[1:00:00]
text at one hour
[1:00:30]
more text`;
    const segments = parseYouTubeTranscript(transcript, 1);
    expect(segments).toHaveLength(2);
    expect(segments[0].timestamp).toBe('1:00:00');
    expect(segments[1].timestamp).toBe('1:00:30');
  });

  it('marks segments as not deleted and without edits', () => {
    const transcript = `[0:00]
some text`;
    const segments = parseYouTubeTranscript(transcript, 1);
    expect(segments[0].is_deleted).toBe(false);
    expect(segments[0].edited_text).toBeNull();
    expect(segments[0].edited_speaker_name).toBeNull();
  });
});
