/**
 * Unit tests for checkMatch's mandatory nonzero-time-overlap gate (MATCH-04,
 * Phase 32 Plan 01 Task 1).
 *
 * This module (dedup-fingerprint.ts) is the LIVE Zoom-only dedup matcher --
 * called synchronously by zoom-webhook and zoom-sync-meetings on every real
 * webhook delivery today. It had no dedicated test file before this plan
 * (32-RESEARCH.md Wave 0 gap).
 *
 * F5 bug (pre-fix, RED): checkMatch's 2-of-3 rule (title >=0.80 OR time
 * >=0.50 OR participants >=0.60, any two) never requires time to be one of
 * the two -- so two occurrences of the same recurring meeting (identical
 * title + participants, ZERO time overlap) merge today. The fix (GREEN)
 * adds a mandatory `timeOverlap > 0` gate inside checkMatch, independent of
 * the 2-of-3 count.
 *
 * Placed under _shared/__tests__/ to match vitest.config.ts's include glob
 * (supabase/functions/**\/__tests__/*.test.ts), mirroring
 * event-resolver.test.ts's plain-TS-module import convention.
 */
import { describe, expect, it } from 'vitest';
import { checkMatch, type MeetingFingerprint } from '../dedup-fingerprint.ts';

/** Builds a MeetingFingerprint with sensible defaults, override per-test. */
function makeFingerprint(overrides: Partial<MeetingFingerprint>): MeetingFingerprint {
  return {
    title_normalized: 'weekly sync',
    start_time_bucket: '2026-09-01T10:00:00.000Z',
    duration_bucket: 60,
    participant_hash: 'unused-by-checkmatch',
    participant_emails: ['alice@example.com', 'bob@example.com'],
    ...overrides,
  };
}

describe('checkMatch: mandatory nonzero-time-overlap gate (MATCH-04 / F5)', () => {
  it('RED anchor: rejects the exact F5 shape -- identical title + participants, zero time overlap (two recurring-meeting occurrences a day apart)', () => {
    const occurrence1 = makeFingerprint({
      start_time_bucket: '2026-09-01T10:00:00.000Z',
      duration_bucket: 60,
    });
    const occurrence2 = makeFingerprint({
      start_time_bucket: '2026-09-02T10:00:00.000Z', // 24h later -- zero overlap
      duration_bucket: 60,
    });

    const result = checkMatch(occurrence1, occurrence2);

    // Pre-fix: title (1.0) + participants (1.0) both meet threshold ->
    // criteriaMetCount=2 -> old code returns is_match=true. This is F5.
    // Post-fix: timeOverlap===0 must reject regardless of the 2-of-3 count.
    expect(result.details.time_overlap).toBe(0);
    expect(result.criteria_met.title).toBe(true);
    expect(result.criteria_met.participants).toBe(true);
    expect(result.is_match).toBe(false);
  });

  it('preserved: a genuine same-event pair with real (nonzero) time overlap plus title+participants still matches', () => {
    const fp1 = makeFingerprint({
      start_time_bucket: '2026-09-01T10:00:00.000Z',
      duration_bucket: 60,
    });
    const fp2 = makeFingerprint({
      start_time_bucket: '2026-09-01T10:15:00.000Z', // 45min overlap of a 60min meeting = 0.75
      duration_bucket: 60,
    });

    const result = checkMatch(fp1, fp2);

    expect(result.details.time_overlap).toBeGreaterThan(0);
    expect(result.criteria_met.time).toBe(true);
    expect(result.criteria_met.title).toBe(true);
    expect(result.criteria_met.participants).toBe(true);
    expect(result.is_match).toBe(true);
  });

  it('necessary-not-sufficient: nonzero time overlap alone does not force a match when title and participants both fail', () => {
    const fp1 = makeFingerprint({
      title_normalized: 'quarterly planning',
      start_time_bucket: '2026-09-01T10:00:00.000Z',
      duration_bucket: 60,
      participant_emails: ['carol@example.com'],
    });
    const fp2 = makeFingerprint({
      title_normalized: 'budget review',
      start_time_bucket: '2026-09-01T10:58:00.000Z', // tiny 2-min overlap, just above 0
      duration_bucket: 60,
      participant_emails: ['dave@example.com'],
    });

    const result = checkMatch(fp1, fp2);

    expect(result.details.time_overlap).toBeGreaterThan(0);
    expect(result.criteria_met.title).toBe(false);
    expect(result.criteria_met.participants).toBe(false);
    expect(result.is_match).toBe(false);
  });

  it('reporting intact: details and criteria_met reflect real computed values regardless of the gate', () => {
    const occurrence1 = makeFingerprint({ start_time_bucket: '2026-09-01T10:00:00.000Z' });
    const occurrence2 = makeFingerprint({ start_time_bucket: '2026-09-02T10:00:00.000Z' });

    const result = checkMatch(occurrence1, occurrence2);

    expect(result.details.title_similarity).toBe(1);
    expect(result.details.time_overlap).toBe(0);
    expect(result.details.participant_overlap).toBe(1);
    expect(result.criteria_met).toEqual({ title: true, time: false, participants: true });
    // is_match is gated false even though the underlying scores are fully reported.
    expect(result.is_match).toBe(false);
  });

  it('boundary: timeOverlap exactly 0 (back-to-back, touching but non-overlapping windows) with title+participants maximally met still rejects -- the gate is absolute', () => {
    const meeting1 = makeFingerprint({
      start_time_bucket: '2026-09-01T10:00:00.000Z',
      duration_bucket: 60, // 10:00-11:00
    });
    const meeting2 = makeFingerprint({
      start_time_bucket: '2026-09-01T11:00:00.000Z',
      duration_bucket: 60, // 11:00-12:00 -- touches but does not overlap
    });

    const result = checkMatch(meeting1, meeting2);

    expect(result.details.time_overlap).toBe(0);
    expect(result.criteria_met.title).toBe(true);
    expect(result.criteria_met.participants).toBe(true);
    expect(result.is_match).toBe(false);
  });
});
