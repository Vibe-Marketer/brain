/**
 * Adversarial unit suite for the pure speaker-resolver scoring functions
 * (Phase 35 Plan 02, TDD RED -> GREEN, against Plan 01's locked contract
 * types in ../speaker-resolver.ts).
 *
 * DB-free -- these are pure, inputs-in/decisions-out functions, mirroring
 * event-resolver.test.ts / identity-resolver.test.ts's plain-TS-module
 * import convention (no Deno runtime needed).
 *
 * Per Andrew's standing directive (35-VALIDATION.md) + the tolerance-buffer
 * refinement locked in 35-01-SUMMARY.md: every negative case here is
 * constructed so it would only pass against a REAL implementation, not a
 * naive/stub one -- e.g. the overlap-adversarial fixture's gap (60s) is
 * deliberately well outside the chosen +-20s clock-drift tolerance so the
 * tolerance buffer cannot be blamed for a false pass.
 */
import { describe, expect, it } from 'vitest';
import {
  alignChunksAcrossRecordings,
  collapsePhantomSpeaker,
  type ConsensusCandidate,
  type ConsensusInput,
  deriveAbsoluteInterval,
  type PropagationDonor,
  type PropagationInput,
  propagateNamedLabel,
  type SpeakerChunk,
} from '../speaker-resolver.ts';

// --- shared fixture constants -----------------------------------------

const EVENT_ID = 'evt-1';
const ORG_ID = 'org-1';

// Recording A is the "labeled" donor source; Recording B is the anonymous
// target source. Their recording_start_time values are deliberately offset
// by 10s to model real cross-tool clock drift (Zoom server clock vs. a
// Plaud device's local clock) -- 35-01-SUMMARY.md's locked refinement.
const RECORDING_A_START = '2026-01-01T10:00:00.000Z';
const RECORDING_B_START = '2026-01-01T09:59:50.000Z'; // 10s behind A

function donorChunkInterval(startOffset: string, endOffset: string) {
  return deriveAbsoluteInterval(
    { canonical_recording_id: 'rec-a', chunk_index: 0, speaker_name: 'Alice', speaker_email: null, timestamp_start: startOffset, timestamp_end: endOffset, identity_id: 'id-alice' },
    RECORDING_A_START,
  );
}

describe('deriveAbsoluteInterval', () => {
  it('derives an absolute ISO interval from recording_start_time + capture-relative offset', () => {
    const interval = deriveAbsoluteInterval(
      { canonical_recording_id: 'rec-a', chunk_index: 0, speaker_name: 'Alice', speaker_email: null, timestamp_start: '00:05:00', timestamp_end: '00:06:00', identity_id: 'id-alice' },
      RECORDING_A_START,
    );
    expect(interval.start).toBe('2026-01-01T10:05:00.000Z');
    expect(interval.end).toBe('2026-01-01T10:06:00.000Z');
  });

  it('fails closed (null start/end) when recording_start_time is null -- never guesses an anchor', () => {
    const interval = deriveAbsoluteInterval(
      { canonical_recording_id: 'rec-a', chunk_index: 0, speaker_name: 'Alice', speaker_email: null, timestamp_start: '00:05:00', timestamp_end: '00:06:00', identity_id: null },
      null,
    );
    expect(interval.start).toBeNull();
    expect(interval.end).toBeNull();
  });
});

describe('alignChunksAcrossRecordings', () => {
  it('derives AbsoluteIntervals for every chunk, grouped by the single event/org already scoped into the input', () => {
    const chunks: SpeakerChunk[] = [
      { canonical_recording_id: 'rec-a', chunk_index: 0, speaker_name: 'Alice', speaker_email: null, timestamp_start: '00:05:00', timestamp_end: '00:06:00', identity_id: 'id-alice' },
      { canonical_recording_id: 'rec-b', chunk_index: 0, speaker_name: 'Speaker 1', speaker_email: null, timestamp_start: '00:05:05', timestamp_end: '00:06:05', identity_id: null },
    ];
    const aligned = alignChunksAcrossRecordings({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-a': RECORDING_A_START, 'rec-b': RECORDING_B_START },
    });
    expect(aligned).toHaveLength(2);
    expect(aligned.every((c) => c.event_id === EVENT_ID && c.organization_id === ORG_ID)).toBe(true);
    expect(aligned.find((c) => c.canonical_recording_id === 'rec-a')?.interval.start).toBe('2026-01-01T10:05:00.000Z');
  });

  it('fails closed to a null interval (never a guessed anchor) when a recording has no recording_start_time', () => {
    const chunks: SpeakerChunk[] = [
      { canonical_recording_id: 'rec-c', chunk_index: 0, speaker_name: null, speaker_email: null, timestamp_start: '00:05:00', timestamp_end: '00:06:00', identity_id: null },
    ];
    const aligned = alignChunksAcrossRecordings({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-c': null },
    });
    expect(aligned[0].interval.start).toBeNull();
    expect(aligned[0].interval.end).toBeNull();
  });
});

describe('propagateNamedLabel', () => {
  it('propagates identity_id from a verified donor onto a genuinely time-overlapping anonymous target', () => {
    const donor: PropagationDonor = {
      identity_id: 'id-alice',
      verified: true,
      source_canonical_recording_id: 'rec-a',
      source_chunk_index: 0,
      interval: donorChunkInterval('00:05:00', '00:06:00'), // 10:05:00 - 10:06:00
    };
    const target: SpeakerChunk = {
      canonical_recording_id: 'rec-b',
      chunk_index: 0,
      speaker_name: 'Speaker 1',
      speaker_email: null,
      timestamp_start: '00:05:15', // rec-b anchor 09:59:50 -> absolute 10:05:05
      timestamp_end: '00:05:45', // absolute 10:05:35 -- genuinely inside donor span
      identity_id: null,
    };
    const input: PropagationInput = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      donors: [donor],
      targets: [target],
      recordingStartTimes: { 'rec-b': RECORDING_B_START },
    };
    const [result] = propagateNamedLabel(input);
    expect(result).toMatchObject({ identity_id: 'id-alice', canonical_recording_id: 'rec-b', chunk_index: 0 });
    expect((result as { confidence: number }).confidence).toBeGreaterThan(0);
  });

  it('propagates across a near-miss gap inside the +-20s clock-drift tolerance buffer (locked refinement, 35-01-SUMMARY.md)', () => {
    const donor: PropagationDonor = {
      identity_id: 'id-alice',
      verified: true,
      source_canonical_recording_id: 'rec-a',
      source_chunk_index: 0,
      interval: donorChunkInterval('00:05:00', '00:05:30'), // 10:05:00 - 10:05:30
    };
    // Target interval starts 10s AFTER the donor ends (disjoint by design)
    // but 10s < the 20s tolerance buffer, so it must still propagate.
    const target: SpeakerChunk = {
      canonical_recording_id: 'rec-b',
      chunk_index: 1,
      speaker_name: 'Speaker 1',
      speaker_email: null,
      timestamp_start: '00:05:40', // rec-b anchor 09:59:50 -> absolute 10:05:30
      timestamp_end: '00:06:00',
      identity_id: null,
    };
    const input: PropagationInput = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      donors: [donor],
      targets: [target],
      recordingStartTimes: { 'rec-b': RECORDING_B_START },
    };
    const [result] = propagateNamedLabel(input);
    expect(result).toMatchObject({ identity_id: 'id-alice' });
  });

  it('NEVER propagates from a bare speaker_name string match with no identity_id/verified-alias donor backing it (Pitfall 3)', () => {
    // No eligible donor exists at all -- only a same-named, unverified target
    // elsewhere in the recording set. A naive implementation that falls back
    // to name-string matching would wrongly resolve this; the real
    // implementation must return the literal unresolved shape.
    const target: SpeakerChunk = {
      canonical_recording_id: 'rec-b',
      chunk_index: 0,
      speaker_name: 'Alice', // matches donor's real name by STRING alone
      speaker_email: null,
      timestamp_start: '00:05:15',
      timestamp_end: '00:05:45',
      identity_id: null, // no resolved identity -- must not be inferred from the name
    };
    const input: PropagationInput = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      donors: [], // no verified donor -- proves name alone cannot manufacture one
      targets: [target],
      recordingStartTimes: { 'rec-b': RECORDING_B_START },
    };
    const [result] = propagateNamedLabel(input);
    expect(result).toEqual({
      canonical_recording_id: 'rec-b',
      chunk_index: 0,
      identity_id: null,
      resolved: false,
      reason: 'no_overlapping_donor',
    });
  });

  it('overlap-adversarial: does NOT propagate across a 60s gap, clearly larger than the +-20s tolerance buffer', () => {
    const donor: PropagationDonor = {
      identity_id: 'id-alice',
      verified: true,
      source_canonical_recording_id: 'rec-a',
      source_chunk_index: 0,
      interval: donorChunkInterval('00:05:00', '00:05:30'), // 10:05:00 - 10:05:30
    };
    // Target starts 60s after donor ends -- disjoint by a real margin, well
    // past the 20s tolerance, so this must stay unresolved.
    const target: SpeakerChunk = {
      canonical_recording_id: 'rec-b',
      chunk_index: 2,
      speaker_name: 'Speaker 1',
      speaker_email: null,
      timestamp_start: '00:06:40', // rec-b anchor 09:59:50 -> absolute 10:06:30
      timestamp_end: '00:07:00',
      identity_id: null,
    };
    const input: PropagationInput = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      donors: [donor],
      targets: [target],
      recordingStartTimes: { 'rec-b': RECORDING_B_START },
    };
    const [result] = propagateNamedLabel(input);
    expect(result).toMatchObject({ identity_id: null, resolved: false, reason: 'no_overlapping_donor' });
  });

  it('unresolved: a chunk with zero donor evidence returns the literal-typed unresolved shape, never a guessed name', () => {
    const target: SpeakerChunk = {
      canonical_recording_id: 'rec-c',
      chunk_index: 0,
      speaker_name: null,
      speaker_email: null,
      timestamp_start: '00:10:00',
      timestamp_end: '00:10:30',
      identity_id: null,
    };
    const input: PropagationInput = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      donors: [],
      targets: [target],
      recordingStartTimes: { 'rec-c': RECORDING_A_START },
    };
    const [result] = propagateNamedLabel(input);
    expect(result).toEqual({
      canonical_recording_id: 'rec-c',
      chunk_index: 0,
      identity_id: null,
      resolved: false,
      reason: 'no_overlapping_donor',
    });
  });
});

describe('collapsePhantomSpeaker', () => {
  const labeled: ConsensusCandidate = {
    canonical_recording_id: 'rec-a',
    chunk_indices: [0],
    identity_id: 'id-alice',
    interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:00:00.000Z', end: '2026-01-01T10:10:00.000Z' },
  };

  it('collapses an anonymous over-segmented split pair into the labeled identity when both halves fall inside the labeled span', () => {
    const candidateSplit: ConsensusCandidate[] = [
      { canonical_recording_id: 'rec-b', chunk_indices: [0], identity_id: null, interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:00:30.000Z', end: '2026-01-01T10:04:00.000Z' } },
      { canonical_recording_id: 'rec-b', chunk_indices: [1], identity_id: null, interval: { canonical_recording_id: 'rec-b', chunk_index: 1, start: '2026-01-01T10:04:30.000Z', end: '2026-01-01T10:09:00.000Z' } },
    ];
    const input: ConsensusInput = { event_id: EVENT_ID, organization_id: ORG_ID, labeled, candidateSplit };
    const result = collapsePhantomSpeaker(input);
    expect(result).toMatchObject({ collapsed_into_identity_id: 'id-alice' });
    expect((result as { collapsed_chunks: unknown[] }).collapsed_chunks).toHaveLength(2);
  });

  it('disagree: refuses to collapse when the unlabeled side reflects a genuinely different (out-of-span) second speaker', () => {
    const candidateSplit: ConsensusCandidate[] = [
      { canonical_recording_id: 'rec-b', chunk_indices: [0], identity_id: null, interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:00:30.000Z', end: '2026-01-01T10:04:00.000Z' } },
      // This second chunk starts 5 minutes AFTER the labeled span ends --
      // a real distinct speaker turn, not a phantom split. Must NOT collapse.
      { canonical_recording_id: 'rec-b', chunk_indices: [1], identity_id: null, interval: { canonical_recording_id: 'rec-b', chunk_index: 1, start: '2026-01-01T10:15:00.000Z', end: '2026-01-01T10:20:00.000Z' } },
    ];
    const input: ConsensusInput = { event_id: EVENT_ID, organization_id: ORG_ID, labeled, candidateSplit };
    const result = collapsePhantomSpeaker(input);
    expect(result).toEqual({ event_id: EVENT_ID, collapsed: false, reason: 'disagreement' });
  });
});
