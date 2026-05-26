/**
 * Tests for the VTT parser — focused on the NOTE-block metadata extraction
 * (`extractVTTMetadata`) added so the PasteTranscriptModal can auto-fill
 * title + date when a user pastes Zoom VTT content directly.
 */

import { describe, it, expect } from 'vitest';
import { extractVTTMetadata, parseVTTWithMetadata } from '../vtt-parser';

const baseCues = `
00:00:00.000 --> 00:00:05.000
<v Andrew Naegele>Hey, thanks for jumping on.

00:00:05.000 --> 00:00:10.000
<v Phill Tomlinson>No problem.
`;

describe('extractVTTMetadata', () => {
  it('returns nothing for a VTT with no NOTE blocks', () => {
    const vtt = `WEBVTT\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta).toEqual({});
  });

  it('extracts title from `NOTE Meeting:`', () => {
    const vtt = `WEBVTT\n\nNOTE Meeting: Weekly Sync\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.title).toBe('Weekly Sync');
  });

  it('extracts title from `NOTE Title:`', () => {
    const vtt = `WEBVTT\n\nNOTE Title: Quarterly Review\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.title).toBe('Quarterly Review');
  });

  it('extracts title from `NOTE Topic:`', () => {
    const vtt = `WEBVTT\n\nNOTE Topic: Standup\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.title).toBe('Standup');
  });

  it('extracts recorded_at from `NOTE Recorded on YYYY-MM-DD`', () => {
    const vtt = `WEBVTT\n\nNOTE Recorded on 2026-05-20\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.recorded_at).toMatch(/^2026-05-20T/);
  });

  it('extracts recorded_at from `NOTE Date:` with ISO datetime', () => {
    const vtt = `WEBVTT\n\nNOTE Date: 2026-05-20T14:30:00Z\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.recorded_at).toBe('2026-05-20T14:30:00.000Z');
  });

  it('extracts recorded_at from `NOTE Started at YYYY-MM-DD HH:MM`', () => {
    const vtt = `WEBVTT\n\nNOTE Started at 2026-05-20 09:00\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.recorded_at).toMatch(/^2026-05-20T/);
  });

  it('extracts a bare ISO date inside a NOTE block', () => {
    const vtt = `WEBVTT\n\nNOTE Some prose mentioning 2026-05-20 in passing\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.recorded_at).toMatch(/^2026-05-20T/);
  });

  it('extracts both title and date from multiple NOTE blocks', () => {
    const vtt = `WEBVTT

NOTE Meeting: Weekly Sync

NOTE Recorded on 2026-05-20

${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.title).toBe('Weekly Sync');
    expect(meta.recorded_at).toMatch(/^2026-05-20T/);
  });

  it('does not match dates inside cues — only NOTE blocks', () => {
    const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n<v Speaker>We met on 2026-05-20 about the rollout.\n`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.recorded_at).toBeUndefined();
  });

  it('caps title at 500 chars', () => {
    const huge = 'A'.repeat(600);
    const vtt = `WEBVTT\n\nNOTE Meeting: ${huge}\n${baseCues}`;
    const meta = extractVTTMetadata(vtt);
    expect(meta.title?.length).toBe(500);
  });
});

describe('parseVTTWithMetadata — integration', () => {
  it('returns title/recorded_at on the top-level result', () => {
    const vtt = `WEBVTT\n\nNOTE Meeting: Weekly Sync\nNOTE Recorded on 2026-05-20\n${baseCues}`;
    const parsed = parseVTTWithMetadata(vtt);
    expect(parsed.title).toBe('Weekly Sync');
    expect(parsed.recorded_at).toMatch(/^2026-05-20T/);
    expect(parsed.segments.length).toBe(2);
    expect(parsed.duration_seconds).toBe(10);
  });

  it('still works with no NOTE blocks (no metadata)', () => {
    const vtt = `WEBVTT\n${baseCues}`;
    const parsed = parseVTTWithMetadata(vtt);
    expect(parsed.title).toBeUndefined();
    expect(parsed.recorded_at).toBeUndefined();
    expect(parsed.segments.length).toBe(2);
  });
});
