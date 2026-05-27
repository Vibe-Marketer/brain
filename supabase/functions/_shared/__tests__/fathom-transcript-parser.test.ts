/**
 * Phase 24 — Behavioral tests for the Fathom transcript parser util.
 *
 * Tests the pure parser exports that BOTH the edge function AND the
 * PasteTranscriptModal client preview rely on. Since this module is the
 * shared truth for what gets parsed, dedup-key extraction, and what falls
 * back to raw text, these tests are required to hold the contract that
 * PASTE-02 (FTS-searchable raw fallback) and PASTE-03 (share-token dedup
 * key) depend on.
 */

import { describe, it, expect } from 'vitest';
import {
  parseFathomCopyFormat,
  extractShareToken,
} from '../fathom-transcript-parser';

describe('extractShareToken — dedup key extraction (PASTE-03)', () => {
  it('extracts token from a plain share URL', () => {
    expect(extractShareToken('https://fathom.video/share/abc123')).toBe('abc123');
  });

  it('extracts token from /share/h/<token> variant', () => {
    expect(extractShareToken('https://fathom.video/share/h/xyz789')).toBe('xyz789');
  });

  it('extracts token from /share/i, /share/p, /share/u variants', () => {
    expect(extractShareToken('https://fathom.video/share/i/foo')).toBe('foo');
    expect(extractShareToken('https://fathom.video/share/p/bar')).toBe('bar');
    expect(extractShareToken('https://fathom.video/share/u/baz')).toBe('baz');
  });

  it('strips query string and hash before matching', () => {
    expect(
      extractShareToken('https://fathom.video/share/abc?ref=email#h'),
    ).toBe('abc');
  });

  it('handles www subdomain', () => {
    expect(extractShareToken('https://www.fathom.video/share/wwwtoken')).toBe('wwwtoken');
  });

  it('returns null for /calls/ URLs (those are not share links)', () => {
    expect(extractShareToken('https://fathom.video/calls/12345')).toBeNull();
  });

  it('returns null for non-fathom URLs', () => {
    expect(extractShareToken('https://example.com/share/abc')).toBeNull();
    expect(extractShareToken('https://otter.ai/u/abc')).toBeNull();
  });

  it('returns null for null / empty / non-string inputs', () => {
    expect(extractShareToken(null)).toBeNull();
    expect(extractShareToken(undefined)).toBeNull();
    expect(extractShareToken('')).toBeNull();
    expect(extractShareToken('   ')).toBeNull();
    // @ts-expect-error — guarding against runtime junk
    expect(extractShareToken(42)).toBeNull();
    // @ts-expect-error — guarding against runtime junk
    expect(extractShareToken({})).toBeNull();
  });

  it('SAME share URL produces the SAME token (dedup key stability)', () => {
    // PASTE-03: re-pasting the same share URL must hit the same row. The
    // dedup key is the parsed token, so the parser must be deterministic
    // across whitespace, casing, query strings, and hashes.
    const variants = [
      'https://fathom.video/share/dedupX',
      '  https://fathom.video/share/dedupX  ',
      'https://fathom.video/share/dedupX?utm=email',
      'https://fathom.video/share/dedupX#section',
      'https://fathom.video/share/dedupX?utm=email#section',
    ];
    const tokens = variants.map((u) => extractShareToken(u));
    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).toBe('dedupX');
  });
});

describe('parseFathomCopyFormat — structured parse (PASTE-01 detection)', () => {
  it('parses a standard 3-turn Fathom paste with header', () => {
    const raw = [
      'Title: Q3 Sales Sync',
      'Date: October 5, 2026',
      'Attendees: Alice Chen, Bob Smith, Carla Diaz',
      '',
      "Alice Chen (0:00) Hey team, let's get started.",
      'Bob Smith (0:14) Thanks. So the numbers from last quarter are strong.',
      'Alice Chen (1:32) Wait, before we go further...',
    ].join('\n');

    const result = parseFathomCopyFormat(raw);

    expect(result.parse_status).toBe('parsed');
    expect(result.title).toBe('Q3 Sales Sync');
    expect(result.recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0]).toMatchObject({
      start_ms: 0,
      speaker: 'Alice Chen',
      text: "Hey team, let's get started.",
    });
    expect(result.segments[1]).toMatchObject({ start_ms: 14_000, speaker: 'Bob Smith' });
    expect(result.segments[2]).toMatchObject({ start_ms: 92_000, speaker: 'Alice Chen' });
    // Attendees: union of header + speakers, dedup case-insensitively.
    expect(result.attendees).toEqual(['Alice Chen', 'Bob Smith', 'Carla Diaz']);
  });

  it('handles HH:MM:SS timestamps', () => {
    const raw = [
      'Alice (0:00) Start.',
      'Bob (1:01:30) Way later — over an hour in.',
    ].join('\n');
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.segments[1].start_ms).toBe((3600 + 60 + 30) * 1000);
  });

  it('joins multi-line turns into one segment', () => {
    const raw = [
      'Alice (0:00) First sentence.',
      'Continuation that is on a new line.',
      'Bob (0:30) New speaker.',
    ].join('\n');
    const result = parseFathomCopyFormat(raw);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe('First sentence. Continuation that is on a new line.');
    expect(result.segments[1].text).toBe('New speaker.');
  });

  it('parses dash-separated format (MM:SS - Speaker Name)', () => {
    const raw = `
00:00 - Pam Perumal - Breakthrough Specialist
  Hey, Andrew.

00:02 - Reprogramming Project Team (reprogrammingproject.com)
  You're my favorite, because you're new.
`;
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].start_ms).toBe(0);
    expect(result.segments[0].speaker).toBe('Pam Perumal - Breakthrough Specialist');
    expect(result.segments[0].text).toBe('Hey, Andrew.');
    expect(result.segments[1].start_ms).toBe(2000);
    expect(result.segments[1].speaker).toBe('Reprogramming Project Team (reprogrammingproject.com)');
    expect(result.segments[1].text).toBe("You're my favorite, because you're new.");
  });

  it('parses dash-separated format with H:MM:SS', () => {
    const raw = `
00:00:00 - Willie Dochee
  You didn't sing it today.

00:00:07 - Andrew Naegele
  That's it.
`;
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].start_ms).toBe(0);
    expect(result.segments[0].speaker).toBe('Willie Dochee');
    expect(result.segments[0].text).toBe("You didn't sing it today.");
    expect(result.segments[1].start_ms).toBe(7000);
    expect(result.segments[1].speaker).toBe('Andrew Naegele');
    expect(result.segments[1].text).toBe("That's it.");
  });

  it('handles CRLF line endings', () => {
    const raw = 'Alice (0:00) Hi.\r\nBob (0:05) Hello.';
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.segments).toHaveLength(2);
  });

  it('parses bracketed transcript lines saved by CallVault and Zoom VTT', () => {
    const raw = [
      '[00:00:00] Alice Chen: Kickoff.',
      '[00:00:14] Bob Smith: Reviewing the VTT import.',
    ].join('\n');
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.segments[0]).toMatchObject({
      start_ms: 0,
      speaker: 'Alice Chen',
      text: 'Kickoff.',
    });
    expect(result.segments[1]).toMatchObject({
      start_ms: 14_000,
      speaker: 'Bob Smith',
    });
  });

  it('infers title/date from common copied header lines without explicit labels', () => {
    const raw = [
      'Customer Demo Review',
      'May 26, 2026',
      '',
      'Alice Chen (0:00) First point.',
      'Bob Smith (0:08) Second point.',
    ].join('\n');
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('parsed');
    expect(result.title).toBe('Customer Demo Review');
    expect(result.recorded_at).toMatch(/^2026-05-26T/);
  });
});

describe('parseFathomCopyFormat — raw fallback (PASTE-02 data preservation)', () => {
  it('returns raw status for plain prose with no timestamps', () => {
    const result = parseFathomCopyFormat('hello world this is just text');
    expect(result.parse_status).toBe('raw');
    expect(result.segments).toEqual([]);
    expect(result.attendees).toEqual([]);
  });

  it('returns raw for header-only paste (no speaker turns)', () => {
    const raw = [
      'Title: Some Meeting',
      'Date: January 1 2026',
      'Attendees: Alice, Bob',
    ].join('\n');
    const result = parseFathomCopyFormat(raw);
    expect(result.parse_status).toBe('raw');
    expect(result.segments).toEqual([]);
  });

  it('returns raw for a single-turn paste (need 2+ to trigger parsed)', () => {
    const result = parseFathomCopyFormat('Alice (0:00) Just one line.');
    expect(result.parse_status).toBe('raw');
  });

  it('returns raw for empty / null-ish input without throwing', () => {
    expect(parseFathomCopyFormat('').parse_status).toBe('raw');
    // @ts-expect-error — runtime guard
    expect(parseFathomCopyFormat(null).parse_status).toBe('raw');
    // @ts-expect-error — runtime guard
    expect(parseFathomCopyFormat(undefined).parse_status).toBe('raw');
  });
});
