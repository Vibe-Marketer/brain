import { describe, it, expect } from 'vitest';
import { parseYouTubeTranscript, isYouTubeTranscriptFormat } from '../transcriptUtils';

describe('isYouTubeTranscriptFormat', () => {
  it('returns true for YouTube-format transcript', () => {
    const transcript = `[0:00]
Hello and welcome to this video
more text here

[0:30]
next section text
continues here`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(true);
  });

  it('returns false for Fathom/Zoom format transcript', () => {
    const transcript = `[00:00:08] Andrew Naegele: Hello this is a test
[00:00:15] Other Person: Yes I agree with that`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isYouTubeTranscriptFormat('')).toBe(false);
  });

  it('handles hour-long YouTube videos', () => {
    const transcript = `[1:00:00]
text at one hour`;
    expect(isYouTubeTranscriptFormat(transcript)).toBe(true);
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
