/**
 * Unit tests for srt-parser.ts
 *
 * Covers: header detection, timestamp parsing, multi-speaker cues,
 * cue without speaker, malformed SRT graceful fallback.
 */

import { describe, it, expect } from 'vitest';
import { isSrtContent, parseSRT, srtTimestampToSeconds, srtSecondsToHMS } from '../srt-parser';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASIC_SRT = `1
00:00:01,000 --> 00:00:05,000
Hello world

2
00:00:06,000 --> 00:00:10,000
Second line
`;

const SPEAKER_SRT = `1
00:00:01,000 --> 00:00:05,000
Alice: Hello there everyone

2
00:00:06,000 --> 00:00:10,000
Bob: Good morning folks

3
00:00:11,000 --> 00:00:15,000
Alice: Thanks for joining
`;

const NO_SPEAKER_SRT = `1
00:00:01,000 --> 00:00:05,000
This is plain text with no speaker

2
00:00:06,000 --> 00:00:10,000
More plain text
`;

const MALFORMED_PLAIN_TEXT = `This is just plain text with no SRT format at all.
It has multiple lines but no timestamps or cue indices.`;

const VTT_CONTENT = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
Hello world`;

const LARGE_SRT = `1
01:30:45,500 --> 01:30:50,000
Alice Chen: Final remarks from the meeting
`;

// ---------------------------------------------------------------------------
// isSrtContent — format detection
// ---------------------------------------------------------------------------

describe('isSrtContent', () => {
  it('detects basic SRT (no speakers)', () => {
    expect(isSrtContent(BASIC_SRT)).toBe(true);
  });

  it('detects SRT with speaker attribution', () => {
    expect(isSrtContent(SPEAKER_SRT)).toBe(true);
  });

  it('detects SRT with no speaker labels', () => {
    expect(isSrtContent(NO_SPEAKER_SRT)).toBe(true);
  });

  it('rejects plain text (no cue structure)', () => {
    expect(isSrtContent(MALFORMED_PLAIN_TEXT)).toBe(false);
  });

  it('rejects VTT content (WEBVTT header)', () => {
    expect(isSrtContent(VTT_CONTENT)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isSrtContent('')).toBe(false);
  });

  it('rejects fathom-paste format', () => {
    const fathom = `[00:01:00] Alice: Hello everyone
[00:01:15] Bob: Thanks for joining`;
    expect(isSrtContent(fathom)).toBe(false);
  });

  it('handles leading whitespace / BOM gracefully', () => {
    const withBOM = '\uFEFF\n\n1\n00:00:01,000 --> 00:00:05,000\nHello\n';
    // BOM + blank lines before index — may or may not detect depending on trim
    // The key requirement is it doesn't throw
    expect(() => isSrtContent(withBOM)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// srtTimestampToSeconds — timestamp conversion
// ---------------------------------------------------------------------------

describe('srtTimestampToSeconds', () => {
  it('converts 00:00:01,000 to 1', () => {
    expect(srtTimestampToSeconds('00:00:01,000')).toBe(1);
  });

  it('converts 00:01:00,000 to 60', () => {
    expect(srtTimestampToSeconds('00:01:00,000')).toBe(60);
  });

  it('converts 01:30:00,000 to 5400', () => {
    expect(srtTimestampToSeconds('01:30:00,000')).toBe(5400);
  });

  it('converts 00:00:05,500 to 5.5', () => {
    expect(srtTimestampToSeconds('00:00:05,500')).toBeCloseTo(5.5);
  });

  it('returns 0 for empty string', () => {
    expect(srtTimestampToSeconds('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// srtSecondsToHMS — inverse conversion
// ---------------------------------------------------------------------------

describe('srtSecondsToHMS', () => {
  it('converts 0 to 00:00:00', () => {
    expect(srtSecondsToHMS(0)).toBe('00:00:00');
  });

  it('converts 61 to 00:01:01', () => {
    expect(srtSecondsToHMS(61)).toBe('00:01:01');
  });

  it('converts 3600 to 01:00:00', () => {
    expect(srtSecondsToHMS(3600)).toBe('01:00:00');
  });
});

// ---------------------------------------------------------------------------
// parseSRT — full parse
// ---------------------------------------------------------------------------

describe('parseSRT', () => {
  describe('basic parsing', () => {
    it('parses correct number of segments from BASIC_SRT', () => {
      const result = parseSRT(BASIC_SRT);
      expect(result.segments).toHaveLength(2);
    });

    it('preserves cue text content', () => {
      const result = parseSRT(BASIC_SRT);
      expect(result.segments[0].text).toBe('Hello world');
      expect(result.segments[1].text).toBe('Second line');
    });

    it('assigns correct cue indices', () => {
      const result = parseSRT(BASIC_SRT);
      expect(result.segments[0].index).toBe(1);
      expect(result.segments[1].index).toBe(2);
    });

    it('parses start and end times as HH:MM:SS strings', () => {
      const result = parseSRT(BASIC_SRT);
      expect(result.segments[0].start_time).toBe('00:00:01');
      expect(result.segments[0].end_time).toBe('00:00:05');
    });
  });

  describe('speaker extraction', () => {
    it('extracts speaker names from "Name: text" format', () => {
      const result = parseSRT(SPEAKER_SRT);
      expect(result.segments[0].speaker).toBe('Alice');
      expect(result.segments[1].speaker).toBe('Bob');
      expect(result.segments[2].speaker).toBe('Alice');
    });

    it('strips speaker from text field', () => {
      const result = parseSRT(SPEAKER_SRT);
      expect(result.segments[0].text).toBe('Hello there everyone');
      expect(result.segments[0].text).not.toContain('Alice:');
    });

    it('does not set speaker when none is present', () => {
      const result = parseSRT(NO_SPEAKER_SRT);
      expect(result.segments[0].speaker).toBeUndefined();
      expect(result.segments[1].speaker).toBeUndefined();
    });
  });

  describe('duration', () => {
    it('calculates duration_seconds from last segment end time', () => {
      const result = parseSRT(BASIC_SRT);
      // Last segment ends at 00:00:10,000 → 10 seconds
      expect(result.duration_seconds).toBe(10);
    });

    it('calculates correct duration for a large timestamp', () => {
      const result = parseSRT(LARGE_SRT);
      // 01:30:50,000 → 5450 seconds
      expect(result.duration_seconds).toBe(5450);
    });
  });

  describe('full_text', () => {
    it('builds full_text with speaker prefix when speakers present', () => {
      const result = parseSRT(SPEAKER_SRT);
      expect(result.full_text).toContain('Alice: Hello there everyone');
      expect(result.full_text).toContain('Bob: Good morning folks');
    });

    it('builds full_text without speaker prefix for no-speaker SRT', () => {
      const result = parseSRT(NO_SPEAKER_SRT);
      expect(result.full_text).toContain('This is plain text with no speaker');
      expect(result.full_text).not.toContain('undefined:');
    });
  });

  describe('malformed input', () => {
    it('returns empty segments for plain text', () => {
      const result = parseSRT(MALFORMED_PLAIN_TEXT);
      expect(result.segments).toHaveLength(0);
      expect(result.duration_seconds).toBe(0);
    });

    it('returns empty segments for empty string', () => {
      const result = parseSRT('');
      expect(result.segments).toHaveLength(0);
    });

    it('does not throw for VTT input (graceful degradation)', () => {
      expect(() => parseSRT(VTT_CONTENT)).not.toThrow();
    });

    it('skips cues with missing timestamp lines', () => {
      const malformed = `1
This is not a timestamp
Hello world

2
00:00:06,000 --> 00:00:10,000
Valid cue
`;
      const result = parseSRT(malformed);
      // Only the second (valid) cue should parse
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].text).toBe('Valid cue');
    });
  });

  describe('multi-line cue text', () => {
    it('joins multi-line cue text into a single string', () => {
      const multiLine = `1
00:00:01,000 --> 00:00:05,000
First line
Second line continues
`;
      const result = parseSRT(multiLine);
      expect(result.segments[0].text).toBe('First line Second line continues');
    });
  });
});
