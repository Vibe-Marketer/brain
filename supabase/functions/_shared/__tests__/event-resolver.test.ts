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
  extractTier1Signal,
  findDeterministicMatches,
  RECURRING_TITLE_OCCURRENCE_THRESHOLD,
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
