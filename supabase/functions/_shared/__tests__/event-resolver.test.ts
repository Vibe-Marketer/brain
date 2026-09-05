/**
 * Unit tests for the pure tier-1 (deterministic) matcher, written BEFORE
 * event-resolver.ts exists (TDD RED -> GREEN, Phase 31 Plan 01 Task 2).
 *
 * DB-free -- these cover extractTier1Signal and findDeterministicMatches
 * only. The DB-touching runShadowSweep is proven separately by
 * src/test/event-resolution-shadow.integration.test.ts against TEST (Task 3).
 *
 * Placed under _shared/__tests__/ (not directly in _shared/) because
 * vitest.config.ts's `include` glob only matches "supabase/functions" +
 * any-depth + "/__tests__/" + "*.test.ts" -- a file directly in _shared/
 * would never be collected by `npm run test`.
 * Mirrors the proven supabase/functions/_shared/__tests__/connector-pipeline.test.ts
 * plain-TS-module import convention (no Deno runtime needed).
 */
import { describe, expect, it } from 'vitest';
import {
  type AlibiCandidate,
  type AlibiParticipant,
  CONTENT_PROOF_MIN_SHARED_SHINGLES,
  type ContentProofCandidate,
  type ContentProofChunk,
  extractShingles,
  extractTier1Signal,
  findContentProofMatches,
  findDeterministicMatches,
  findMetadataCandidates,
  isSpeakerAlibiViolation,
  MERGE_PROPOSE_THRESHOLD,
  type MetadataCandidate,
  RECURRING_TITLE_OCCURRENCE_THRESHOLD,
  runShadowSweep,
  scoreContentProofOverlap,
  SHINGLE_SIZE,
  shouldSuppressTitleSignal,
  type Tier1Candidate,
} from '../event-resolver.ts';

describe('event-resolver: extractTier1Signal', () => {
  it('returns the provider-prefixed Zoom UUID from zoom_meeting_id', () => {
    expect(
      extractTier1Signal('zoom', {
        zoom_meeting_id: 'abc-uuid',
        zoom_numeric_id: '99',
        zoom_share_url: 'https://zoom.us/j/99',
      }),
    ).toBe('zoom:abc-uuid');
  });

  it('NEVER reads zoom_numeric_id -- returns null when only the reusable PMI-style field is present', () => {
    expect(extractTier1Signal('zoom', { zoom_numeric_id: '99' })).toBeNull();
  });

  it('returns null for providers with no eligible tier-1 field today (fathom, grain, plaud)', () => {
    expect(
      extractTier1Signal('fathom', { fathom_call_id: 123, fathom_url: 'https://fathom.video/x' }),
    ).toBeNull();
    expect(extractTier1Signal('grain', { grain_recording_id: 'abc' })).toBeNull();
    expect(extractTier1Signal('plaud', { plaud_file_id: 'xyz' })).toBeNull();
  });

  it('deliberately excludes fireflies and read-ai -- proven-reusable Zoom PMI/room number, verified against real production data (31-01-SUMMARY.md)', () => {
    // fireflies_meeting_link "https://zoom.us/j/92765150884" was empirically
    // proven (production sample, Task 2 Wave 0) to repeat across 8 distinct
    // weekly recurring-meeting occurrences spanning 7 weeks -- the same
    // reusable-PMI false-merge risk explicitly forbidden for zoom_numeric_id.
    expect(
      extractTier1Signal('fireflies', { fireflies_meeting_link: 'https://zoom.us/j/92765150884' }),
    ).toBeNull();
    // read_ai_platform_id "95671739481" was empirically proven to be the exact
    // same reusable Zoom PMI/room number shared across multiple distinct
    // read-ai meeting rows (different read_ai_meeting_id per row).
    expect(extractTier1Signal('read-ai', { read_ai_platform_id: '95671739481' })).toBeNull();
  });

  it('fails closed (returns null, never throws) on missing/null/empty source_metadata', () => {
    expect(extractTier1Signal('zoom', null)).toBeNull();
    expect(extractTier1Signal('zoom', undefined)).toBeNull();
    expect(extractTier1Signal('zoom', {})).toBeNull();
  });

  it('fails closed on missing/malformed source_app', () => {
    expect(extractTier1Signal(null, { zoom_meeting_id: 'abc' })).toBeNull();
    expect(extractTier1Signal(undefined, { zoom_meeting_id: 'abc' })).toBeNull();
    expect(extractTier1Signal('', { zoom_meeting_id: 'abc' })).toBeNull();
    expect(extractTier1Signal('not-a-real-provider', { zoom_meeting_id: 'abc' })).toBeNull();
  });

  it('never throws on wildly malformed input (fail-closed, the opposite of checkDuplicate)', () => {
    const malformedInputs: Array<[unknown, unknown]> = [
      [123, { zoom_meeting_id: 'abc' }],
      [{}, { zoom_meeting_id: 'abc' }],
      ['zoom', 'not-an-object'],
      ['zoom', 123],
      ['zoom', ['array', 'not', 'object']],
      ['zoom', { zoom_meeting_id: { nested: 'object' } }],
      ['zoom', { zoom_meeting_id: 12345 }],
      ['zoom', { zoom_meeting_id: null }],
      ['zoom', { zoom_meeting_id: '' }],
      ['zoom', { zoom_meeting_id: '   ' }],
    ];

    for (const [sourceApp, sourceMetadata] of malformedInputs) {
      expect(() =>
        extractTier1Signal(
          sourceApp as string,
          sourceMetadata as Record<string, unknown>,
        ),
      ).not.toThrow();
    }
  });

  it('CR-01 regression: fails closed for source_app values that collide with Object.prototype property names', () => {
    // 31-REVIEW.md CR-01: TIER1_SIGNAL_EXTRACTORS/TIER1_MATCHED_FIELD_NAMES
    // were plain object literals indexed with unguarded bracket notation,
    // which walks the prototype chain. `extractTier1Signal('constructor', {...})`
    // resolved to the inherited `Object` constructor (truthy, so the
    // `!extractor` guard never fired) and produced the content-independent
    // collision string "constructor:[object Object]" for ANY non-empty
    // metadata object -- a guaranteed false-merge signal regardless of what
    // source_metadata actually contained. Fixed by declaring both maps with
    // Object.assign(Object.create(null), {...}) so there is no prototype to
    // walk; bracket lookup on a non-own key now always yields `undefined`.
    const poisonSourceApps = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__'];
    for (const sourceApp of poisonSourceApps) {
      expect(extractTier1Signal(sourceApp, { foo: 'bar' })).toBeNull();
      // Must also fail closed for a DIFFERENT non-empty metadata object --
      // the actual danger isn't "returns non-null", it's "returns the SAME
      // non-null value regardless of content." Both must be null so there's
      // nothing to compare/collide on.
      expect(extractTier1Signal(sourceApp, { totallyDifferent: 1 })).toBeNull();
    }
  });

  it('never reads zoom_numeric_id under any circumstance (source-level guarantee, also grep-verified in acceptance)', () => {
    // Only the unsafe field is present -- must fail closed, not fall back to it.
    const onlyNumericId = extractTier1Signal('zoom', { zoom_numeric_id: '123456789' });
    expect(onlyNumericId).toBeNull();

    // Both fields present with DIFFERENT values -- if the implementation ever
    // read zoom_numeric_id (even as a secondary/fallback source), this row
    // would produce a signal containing '999999999' instead of 'safe-uuid'.
    const bothPresentDisagreeing = extractTier1Signal('zoom', {
      zoom_meeting_id: 'safe-uuid',
      zoom_numeric_id: '999999999',
    });
    expect(bothPresentDisagreeing).toBe('zoom:safe-uuid');
    expect(bothPresentDisagreeing).not.toContain('999999999');
  });
});

describe('event-resolver: findDeterministicMatches', () => {
  const orgA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const orgB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('pairs exactly two recordings that share a tier-1 signal, canonically ordered, and ignores the non-matching third', () => {
    const candidates: Tier1Candidate[] = [
      {
        id: 'rec-zzz',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'shared-uuid' },
      },
      {
        id: 'rec-aaa',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'shared-uuid' },
      },
      {
        id: 'rec-ccc',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'different-uuid' },
      },
    ];

    const matches = findDeterministicMatches(candidates);

    expect(matches).toHaveLength(1);
    expect(matches[0].recording_id_a).toBe('rec-aaa');
    expect(matches[0].recording_id_b).toBe('rec-zzz');
    expect(matches[0].recording_id_a < matches[0].recording_id_b).toBe(true);
  });

  it('returns zero pairs when no two candidates share a signal', () => {
    const candidates: Tier1Candidate[] = [
      {
        id: 'rec-1',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'uuid-1' },
      },
      {
        id: 'rec-2',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'uuid-2' },
      },
      {
        id: 'rec-3',
        organization_id: orgA,
        source_app: 'fathom',
        source_metadata: { fathom_call_id: 1 },
      },
    ];

    expect(findDeterministicMatches(candidates)).toEqual([]);
  });

  it('never pairs recordings from different organizations, even with an identical signal', () => {
    const candidates: Tier1Candidate[] = [
      {
        id: 'rec-org-a',
        organization_id: orgA,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'cross-org-shared-uuid' },
      },
      {
        id: 'rec-org-b',
        organization_id: orgB,
        source_app: 'zoom',
        source_metadata: { zoom_meeting_id: 'cross-org-shared-uuid' },
      },
    ];

    expect(findDeterministicMatches(candidates)).toEqual([]);
  });

  it('returns an empty array for an empty candidate list', () => {
    expect(findDeterministicMatches([])).toEqual([]);
  });

  it('CR-01 regression: never proposes a merge for two recordings sharing a prototype-colliding source_app, even with wildly different content', () => {
    // End-to-end reproduction of the exact false-merge scenario CR-01
    // describes: two same-org recordings with source_app='constructor' and
    // COMPLETELY DIFFERENT source_metadata. Pre-fix, extractTier1Signal
    // collapsed both to the identical content-independent signal
    // "constructor:[object Object]", so findDeterministicMatches proposed
    // them as a merge regardless of actual content.
    const candidates: Tier1Candidate[] = [
      {
        id: 'rec-poison-1',
        organization_id: orgA,
        source_app: 'constructor',
        source_metadata: { foo: 'bar' },
      },
      {
        id: 'rec-poison-2',
        organization_id: orgA,
        source_app: 'constructor',
        source_metadata: { completelyUnrelated: 2 },
      },
    ];

    expect(findDeterministicMatches(candidates)).toEqual([]);
  });
});

describe('event-resolver: shouldSuppressTitleSignal (MATCH-05)', () => {
  it('returns false below the default threshold', () => {
    expect(shouldSuppressTitleSignal(0)).toBe(false);
    expect(shouldSuppressTitleSignal(1)).toBe(false);
    expect(shouldSuppressTitleSignal(RECURRING_TITLE_OCCURRENCE_THRESHOLD - 1)).toBe(false);
  });

  it('returns true exactly at the default threshold', () => {
    expect(shouldSuppressTitleSignal(RECURRING_TITLE_OCCURRENCE_THRESHOLD)).toBe(true);
  });

  it('returns true above the default threshold', () => {
    expect(shouldSuppressTitleSignal(RECURRING_TITLE_OCCURRENCE_THRESHOLD + 5)).toBe(true);
    expect(shouldSuppressTitleSignal(1000)).toBe(true);
  });

  it('fails closed toward NOT suppressed for null/undefined/NaN/negative -- a missing count never suppresses a real signal', () => {
    expect(shouldSuppressTitleSignal(null)).toBe(false);
    expect(shouldSuppressTitleSignal(undefined)).toBe(false);
    expect(shouldSuppressTitleSignal(0)).toBe(false);
    expect(shouldSuppressTitleSignal(-1)).toBe(false);
    expect(shouldSuppressTitleSignal(-100)).toBe(false);
    expect(shouldSuppressTitleSignal(NaN)).toBe(false);
  });

  it('honors a custom threshold argument', () => {
    expect(shouldSuppressTitleSignal(2, 2)).toBe(true);
    expect(shouldSuppressTitleSignal(1, 2)).toBe(false);
    expect(shouldSuppressTitleSignal(10, 100)).toBe(false);
    expect(shouldSuppressTitleSignal(100, 100)).toBe(true);
  });
});

describe('event-resolver: findMetadataCandidates (MATCH-03/MATCH-06/MATCH-08)', () => {
  const orgA = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const orgB = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  function candidate(overrides: Partial<MetadataCandidate>): MetadataCandidate {
    return {
      id: 'rec-default',
      organization_id: orgA,
      owner_user_id: 'user-1',
      title: 'Weekly Sync',
      recording_start_time: '2026-01-01T10:00:00.000Z',
      recording_end_time: '2026-01-01T11:00:00.000Z',
      participant_emails: ['alice@example.com', 'bob@example.com'],
      occurrence_count: 0,
      ...overrides,
    };
  }

  it('proposes a same-org pair with full time+participant+title overlap, canonically ordered a<b, score >= threshold', () => {
    const a = candidate({ id: 'rec-meta-b' });
    const b = candidate({ id: 'rec-meta-a' });

    const result = findMetadataCandidates([a, b]);

    expect(result).toHaveLength(1);
    expect(result[0].recording_id_a).toBe('rec-meta-a');
    expect(result[0].recording_id_b).toBe('rec-meta-b');
    expect(result[0].recording_id_a < result[0].recording_id_b).toBe(true);
    expect(result[0].score).toBeGreaterThanOrEqual(MERGE_PROPOSE_THRESHOLD);
  });

  it('discards a pair with ZERO time overlap even with identical title+participants (nonzero-time gate, mirrors MATCH-04)', () => {
    const a = candidate({ id: 'rec-zero-a' });
    const b = candidate({
      id: 'rec-zero-b',
      // Next day -- no overlap with the 10:00-11:00 window at all.
      recording_start_time: '2026-01-02T10:00:00.000Z',
      recording_end_time: '2026-01-02T11:00:00.000Z',
    });

    expect(findMetadataCandidates([a, b])).toEqual([]);
  });

  it('recurring-title trap closed: identical recurring titles alone cannot push a below-bar pair over the propose threshold', () => {
    // Full participant overlap (Jaccard 1.0) + partial time overlap (0.75) +
    // identical titles. Without suppression, title's max 0.20 contribution
    // would push this OVER threshold (0.45 + 0.2625 + 0.20 = 0.9125). With
    // suppression (occurrence_count >= threshold on both sides), title
    // contributes 0, leaving 0.7125 -- below MERGE_PROPOSE_THRESHOLD.
    const recurring = (id: string, occurrenceCount: number, startOffsetMinutes: number) =>
      candidate({
        id,
        title: 'Weekly Standup',
        occurrence_count: occurrenceCount,
        recording_start_time: new Date(
          new Date('2026-01-01T10:00:00.000Z').getTime() + startOffsetMinutes * 60_000,
        ).toISOString(),
        recording_end_time: new Date(
          new Date('2026-01-01T11:00:00.000Z').getTime() + startOffsetMinutes * 60_000,
        ).toISOString(),
      });

    const suppressedA = recurring('rec-recur-a', RECURRING_TITLE_OCCURRENCE_THRESHOLD, 0);
    const suppressedB = recurring('rec-recur-b', RECURRING_TITLE_OCCURRENCE_THRESHOLD, 15);
    expect(findMetadataCandidates([suppressedA, suppressedB])).toEqual([]);

    // Contrast: same signals, occurrence_count below threshold (NOT
    // suppressed) -- title's contribution now pushes the same pair over the
    // bar, proving suppression (not coincidence) is what closed the trap.
    const unsuppressedA = recurring('rec-recur-c', 0, 0);
    const unsuppressedB = recurring('rec-recur-d', 0, 15);
    const unsuppressedResult = findMetadataCandidates([unsuppressedA, unsuppressedB]);
    expect(unsuppressedResult).toHaveLength(1);
    expect(unsuppressedResult[0].signals.title_suppressed).toBe(false);
  });

  it('NEVER proposes a cross-org pair, even with identical everything', () => {
    const a = candidate({ id: 'rec-cross-a', organization_id: orgA });
    const b = candidate({ id: 'rec-cross-b', organization_id: orgB });

    expect(findMetadataCandidates([a, b])).toEqual([]);
  });

  it('every emitted match carries tier:"metadata" and a 0..1 score; none carries a decision/applied/apply intent', () => {
    const a = candidate({ id: 'rec-shape-a' });
    const b = candidate({ id: 'rec-shape-b' });

    const result = findMetadataCandidates([a, b]);

    expect(result).toHaveLength(1);
    expect(result[0].tier).toBe('metadata');
    expect(result[0].score).toBeGreaterThanOrEqual(0);
    expect(result[0].score).toBeLessThanOrEqual(1);
    expect('decision' in result[0]).toBe(false);
    expect('applied' in result[0]).toBe(false);
  });

  it('fails closed on malformed candidate rows -- skipped, never throws', () => {
    const good1 = candidate({ id: 'rec-good-a' });
    const good2 = candidate({ id: 'rec-good-b' });
    const malformedRows: unknown[] = [
      good1,
      good2,
      { id: 'rec-bad-null-times', organization_id: orgA, participant_emails: [], recording_start_time: null, recording_end_time: null },
      { id: 'rec-bad-inverted', organization_id: orgA, participant_emails: [], recording_start_time: '2026-01-01T12:00:00.000Z', recording_end_time: '2026-01-01T10:00:00.000Z' },
      { organization_id: orgA }, // missing id
      { id: 'rec-bad-no-org' }, // missing organization_id
      { id: 'rec-bad-participants', organization_id: orgA, participant_emails: 'not-an-array', recording_start_time: '2026-01-01T10:00:00.000Z', recording_end_time: '2026-01-01T11:00:00.000Z' },
      null,
      undefined,
      'not-an-object',
      42,
    ];

    expect(() => findMetadataCandidates(malformedRows as MetadataCandidate[])).not.toThrow();

    const result = findMetadataCandidates(malformedRows as MetadataCandidate[]);
    expect(result.some((m) => m.recording_id_a === 'rec-good-a' && m.recording_id_b === 'rec-good-b')).toBe(true);
  });

  it('returns an empty array for an empty candidate list', () => {
    expect(findMetadataCandidates([])).toEqual([]);
  });
});

describe('event-resolver: runShadowSweep metadata-tier fails closed on recurring_call_titles fetch error (CR-02, 32-REVIEW.md)', () => {
  const orgCr02 = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
  const ownerCr02 = 'user-cr02-owner';

  interface FakeResult<T> {
    data: T | null;
    error: { message: string; code?: string } | null;
  }

  /**
   * Minimal thenable chain: every chain method is a no-op returning itself;
   * awaiting the chain resolves to the canned result -- mirrors how the real
   * supabase-js query builder is awaited directly with no terminal
   * `.then()`/execute call in runShadowSweep's own code.
   */
  function makeReadChain<T>(result: FakeResult<T>) {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'is', 'in', 'order', 'limit']) {
      chain[method] = () => chain;
    }
    chain.then = (
      onFulfilled: (value: FakeResult<T>) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return chain;
  }

  /**
   * Fixture: two same-org, same-owner, identically-titled candidates with NO
   * tier-1 signal (source_app null, so findDeterministicMatches proposes
   * nothing -- isolates the assertions to the metadata tier), full
   * participant overlap (Jaccard 1.0), and a 15-minute start offset over a
   * 60-minute window (timeOverlap = 0.75) -- the EXACT math the
   * "recurring-title trap closed" pure-function test above already proved:
   * unsuppressed score = 0.45 + 0.2625 + 0.20 = 0.9125 (proposes), suppressed
   * score = 0.45 + 0.2625 + 0 = 0.7125 (does not propose). Only
   * `recurring_call_titles`'s fetch outcome varies between the tests below.
   */
  function makeFakeSupabase(opts: {
    recurring: FakeResult<{ user_id: string; title: string; occurrence_count: number }[]>;
    metadataInserts: unknown[];
  }) {
    const recordings = [
      {
        id: 'rec-cr02-a',
        organization_id: orgCr02,
        owner_user_id: ownerCr02,
        title: 'Weekly Standup',
        source_app: null,
        source_metadata: null,
        recording_start_time: '2026-01-01T10:00:00.000Z',
        recording_end_time: '2026-01-01T11:00:00.000Z',
      },
      {
        id: 'rec-cr02-b',
        organization_id: orgCr02,
        owner_user_id: ownerCr02,
        title: 'Weekly Standup',
        source_app: null,
        source_metadata: null,
        recording_start_time: '2026-01-01T10:15:00.000Z',
        recording_end_time: '2026-01-01T11:15:00.000Z',
      },
    ];
    const participants = [
      { recording_id: 'rec-cr02-a', email: 'alice@example.com', name: null },
      { recording_id: 'rec-cr02-a', email: 'bob@example.com', name: null },
      { recording_id: 'rec-cr02-b', email: 'alice@example.com', name: null },
      { recording_id: 'rec-cr02-b', email: 'bob@example.com', name: null },
    ];

    return {
      from(table: string) {
        if (table === 'recordings') return makeReadChain({ data: recordings, error: null });
        if (table === 'call_participants') return makeReadChain({ data: participants, error: null });
        if (table === 'recurring_call_titles') return makeReadChain(opts.recurring);
        if (table === 'event_match_decisions') {
          return {
            insert: (row: unknown) => {
              opts.metadataInserts.push(row);
              return Promise.resolve({ error: null });
            },
          };
        }
        throw new Error(`unexpected table in CR-02 test fake: ${table}`);
      },
    };
  }

  it('CR-02 regression: a recurring_call_titles fetch error yields ZERO metadata proposals for the tick, not full-title-weight proposals', async () => {
    const metadataInserts: unknown[] = [];
    const fakeSupabase = makeFakeSupabase({
      recurring: {
        data: null,
        error: { message: 'permission denied for view recurring_call_titles', code: '42501' },
      },
      metadataInserts,
    });

    const summary = await runShadowSweep(
      fakeSupabase as unknown as Parameters<typeof runShadowSweep>[0],
      { flaggedOrgIds: [orgCr02] },
    );

    // Pre-fix: occurrence_count resolves to null for both candidates (fetch
    // errored, the lookup map stays empty), shouldSuppressTitleSignal(null)
    // returns false (fail-closed toward NOT suppressed by its own contract),
    // and this fixture's unsuppressed score (0.9125) clears
    // MERGE_PROPOSE_THRESHOLD (0.80) -- the exact F5-class false-merge risk
    // CR-02 describes. Fixed behavior: skip metadata-tier proposing for the
    // WHOLE tick when this fetch fails.
    expect(summary.metadataProposed).toBe(0);
    expect(metadataInserts).toHaveLength(0);
    expect(summary.errors).toBeGreaterThanOrEqual(1);
  });

  it('control: same fixture, recurring_call_titles succeeds with a below-threshold count -- title is unsuppressed and the pair IS proposed (proves the fixture can propose, isolating CR-02 to the error path)', async () => {
    const metadataInserts: unknown[] = [];
    const fakeSupabase = makeFakeSupabase({
      recurring: {
        data: [{ user_id: ownerCr02, title: 'Weekly Standup', occurrence_count: 0 }],
        error: null,
      },
      metadataInserts,
    });

    const summary = await runShadowSweep(
      fakeSupabase as unknown as Parameters<typeof runShadowSweep>[0],
      { flaggedOrgIds: [orgCr02] },
    );

    expect(summary.metadataProposed).toBe(1);
    expect(metadataInserts).toHaveLength(1);
  });

  it('control: same fixture, recurring_call_titles succeeds with an at-threshold count -- title is correctly suppressed and the pair is NOT proposed (proves the CR-02 refactor did not break normal success-path suppression)', async () => {
    const metadataInserts: unknown[] = [];
    const fakeSupabase = makeFakeSupabase({
      recurring: {
        data: [
          {
            user_id: ownerCr02,
            title: 'Weekly Standup',
            occurrence_count: RECURRING_TITLE_OCCURRENCE_THRESHOLD,
          },
        ],
        error: null,
      },
      metadataInserts,
    });

    const summary = await runShadowSweep(
      fakeSupabase as unknown as Parameters<typeof runShadowSweep>[0],
      { flaggedOrgIds: [orgCr02] },
    );

    expect(summary.metadataProposed).toBe(0);
    expect(metadataInserts).toHaveLength(0);
  });
});

describe('event-resolver: extractShingles (MATCH-02)', () => {
  it('extracts overlapping k=SHINGLE_SIZE token shingles from a sentence', () => {
    const shingles = extractShingles('the quick brown fox jumps over the lazy dog today', SHINGLE_SIZE);
    // 10 tokens -> 10 - 7 + 1 = 4 shingles
    expect(shingles.size).toBe(4);
    expect(shingles.has('the quick brown fox jumps over the')).toBe(true);
    expect(shingles.has('quick brown fox jumps over the lazy')).toBe(true);
    expect(shingles.has('brown fox jumps over the lazy dog')).toBe(true);
    expect(shingles.has('fox jumps over the lazy dog today')).toBe(true);
  });

  it('lowercases and splits on non-alphanumeric, dropping empty tokens', () => {
    const shingles = extractShingles('The, Quick-Brown!! Fox Jumps Over The Lazy Dog.', SHINGLE_SIZE);
    expect(shingles.has('the quick brown fox jumps over the')).toBe(true);
  });

  it('tolerates arbitrary Unicode without throwing', () => {
    const text = 'café résumé naïve 日本語 テスト 中文 测试 emoji 🎉 works fine';
    expect(() => extractShingles(text, SHINGLE_SIZE)).not.toThrow();
    expect(extractShingles(text, SHINGLE_SIZE).size).toBeGreaterThan(0);
  });

  it('returns an empty Set for empty string', () => {
    expect(extractShingles('', SHINGLE_SIZE)).toEqual(new Set());
  });

  it('returns an empty Set for text shorter than k tokens, never throws', () => {
    expect(extractShingles('short phrase here', SHINGLE_SIZE)).toEqual(new Set());
    expect(() => extractShingles('short phrase here', SHINGLE_SIZE)).not.toThrow();
  });

  it('fails closed (empty Set, never throws) on malformed input', () => {
    expect(extractShingles(null as unknown as string)).toEqual(new Set());
    expect(extractShingles(undefined as unknown as string)).toEqual(new Set());
    expect(() => extractShingles(123 as unknown as string)).not.toThrow();
  });
});

describe('event-resolver: scoreContentProofOverlap + findContentProofMatches (MATCH-02)', () => {
  const orgA = '11111111-1111-1111-1111-111111111111';
  const orgB = '22222222-2222-2222-2222-222222222222';

  // 11 tokens -> 11 - 7 + 1 = 5 overlapping 7-grams, exactly at
  // CONTENT_PROOF_MIN_SHARED_SHINGLES.
  const SHARED_PASSAGE =
    'so the quarterly revenue numbers came in higher than we projected for the region';

  it('scores two transcripts sharing a long verbatim passage as conclusive', () => {
    const chunksA: ContentProofChunk[] = [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }];
    const chunksB: ContentProofChunk[] = [
      { chunk_index: 0, chunk_text: `unrelated intro remarks. ${SHARED_PASSAGE}. unrelated closing remarks` },
    ];

    const result = scoreContentProofOverlap(chunksA, chunksB);

    expect(result.sharedShingles).toBeGreaterThanOrEqual(CONTENT_PROOF_MIN_SHARED_SHINGLES);
    expect(result.conclusive).toBe(true);
  });

  it('scores two transcripts sharing only a short stock phrase as NOT conclusive', () => {
    const chunksA: ContentProofChunk[] = [
      { chunk_index: 0, chunk_text: 'thank you so much everyone for joining today great call about the roadmap' },
    ];
    const chunksB: ContentProofChunk[] = [
      { chunk_index: 0, chunk_text: 'thank you so much everyone completely different topic about pricing strategy next quarter' },
    ];

    const result = scoreContentProofOverlap(chunksA, chunksB);

    expect(result.conclusive).toBe(false);
  });

  it('aligns chunks by chunk_index even when supplied out of order', () => {
    const inOrder: ContentProofChunk[] = [
      { chunk_index: 0, chunk_text: 'so the quarterly revenue numbers' },
      { chunk_index: 1, chunk_text: 'came in higher than we projected for the region' },
    ];
    const outOfOrder: ContentProofChunk[] = [
      { chunk_index: 1, chunk_text: 'came in higher than we projected for the region' },
      { chunk_index: 0, chunk_text: 'so the quarterly revenue numbers' },
    ];
    const chunksB: ContentProofChunk[] = [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }];

    const resultInOrder = scoreContentProofOverlap(inOrder, chunksB);
    const resultOutOfOrder = scoreContentProofOverlap(outOfOrder, chunksB);

    expect(resultOutOfOrder).toEqual(resultInOrder);
    expect(resultInOrder.conclusive).toBe(true);
  });

  it('fails closed (never throws, conclusive=false) on empty/malformed chunk arrays', () => {
    expect(() => scoreContentProofOverlap([], [])).not.toThrow();
    expect(scoreContentProofOverlap([], [])).toEqual({ sharedShingles: 0, jaccard: 0, conclusive: false });
    expect(scoreContentProofOverlap(null, undefined).conclusive).toBe(false);
  });

  it('findContentProofMatches buckets by organization_id and never compares cross-org pairs', () => {
    const candidates: ContentProofCandidate[] = [
      { id: 'rec-a', organization_id: orgA, chunks: [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }] },
      { id: 'rec-b', organization_id: orgB, chunks: [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }] },
    ];

    expect(findContentProofMatches(candidates)).toEqual([]);
  });

  it('findContentProofMatches emits a canonically-ordered, conclusive-only match with tier=content_proof', () => {
    const candidates: ContentProofCandidate[] = [
      { id: 'rec-zzz', organization_id: orgA, chunks: [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }] },
      { id: 'rec-aaa', organization_id: orgA, chunks: [{ chunk_index: 0, chunk_text: SHARED_PASSAGE }] },
      {
        id: 'rec-none',
        organization_id: orgA,
        chunks: [{ chunk_index: 0, chunk_text: 'completely unrelated short filler text about nothing important' }],
      },
    ];

    const matches = findContentProofMatches(candidates);

    expect(matches).toHaveLength(1);
    expect(matches[0].recording_id_a).toBe('rec-aaa');
    expect(matches[0].recording_id_b).toBe('rec-zzz');
    expect(matches[0].tier).toBe('content_proof');
    expect(matches[0].signals.shared_shingles).toBeGreaterThanOrEqual(CONTENT_PROOF_MIN_SHARED_SHINGLES);
  });

  it('returns an empty array for an empty candidate list, never throws on malformed rows', () => {
    expect(findContentProofMatches([])).toEqual([]);
    expect(() => findContentProofMatches([null, undefined, 42] as unknown as ContentProofCandidate[])).not.toThrow();
  });
});

describe('event-resolver: isSpeakerAlibiViolation (MATCH-07)', () => {
  function participant(email: string, hasConfirmedSpeech: boolean | null): AlibiParticipant {
    return { email, has_confirmed_speech: hasConfirmedSpeech };
  }

  it('flags a violation: confirmed speaker in A is present in a time-disjoint B', () => {
    const a: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('alice@example.com', true)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: [participant('alice@example.com', null)],
    };

    expect(isSpeakerAlibiViolation(a, b)).toBe(true);
  });

  it('checks both directions -- confirmed speaker in B present in disjoint A', () => {
    const a: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('bob@example.com', false)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: [participant('bob@example.com', true)],
    };

    expect(isSpeakerAlibiViolation(a, b)).toBe(true);
  });

  it('attendance alone (has_confirmed_speech NULL or false) never triggers a violation', () => {
    const a: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('carol@example.com', null), participant('dave@example.com', false)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: [participant('carol@example.com', null), participant('dave@example.com', false)],
    };

    expect(isSpeakerAlibiViolation(a, b)).toBe(false);
  });

  it('overlapping intervals never trigger a violation, even with a shared confirmed speaker', () => {
    const a: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('erin@example.com', true)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T10:30:00.000Z', // overlaps A's 10:00-11:00 window
      end: '2026-01-01T11:30:00.000Z',
      participants: [participant('erin@example.com', null)],
    };

    expect(isSpeakerAlibiViolation(a, b)).toBe(false);
  });

  it('reject-only invariant (T-33-02): false means "not vetoed", never "confirmed" -- a pair with no shared identity returns false, not a positive match signal', () => {
    const a: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('frank@example.com', true)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: [participant('someone-else@example.com', true)],
    };

    // This function's ONLY truthy meaning is "veto this candidate". `false`
    // here means "no alibi violation found" -- it must NEVER be read by any
    // caller as "these two are confirmed to be the same event."
    expect(isSpeakerAlibiViolation(a, b)).toBe(false);
  });

  it('fails closed: malformed/missing participants array returns false, never throws', () => {
    const validSide: AlibiCandidate = {
      start: '2026-01-01T10:00:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
      participants: [participant('grace@example.com', true)],
    };
    const malformed = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: null,
    } as unknown as AlibiCandidate;

    expect(() => isSpeakerAlibiViolation(validSide, malformed)).not.toThrow();
    expect(isSpeakerAlibiViolation(validSide, malformed)).toBe(false);
    expect(() => isSpeakerAlibiViolation(null as unknown as AlibiCandidate, validSide)).not.toThrow();
    expect(isSpeakerAlibiViolation(null as unknown as AlibiCandidate, validSide)).toBe(false);
  });

  it('fails closed: unparseable timestamps return false, never throw', () => {
    const a: AlibiCandidate = {
      start: 'not-a-date',
      end: 'also-not-a-date',
      participants: [participant('heidi@example.com', true)],
    };
    const b: AlibiCandidate = {
      start: '2026-01-01T12:00:00.000Z',
      end: '2026-01-01T13:00:00.000Z',
      participants: [participant('heidi@example.com', null)],
    };

    expect(() => isSpeakerAlibiViolation(a, b)).not.toThrow();
    expect(isSpeakerAlibiViolation(a, b)).toBe(false);
  });
});
