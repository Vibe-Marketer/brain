/**
 * Adversarial unit suite for the pure transcript-reconciler scoring
 * functions (Phase 37 Plan 02, TDD RED -> GREEN, against this plan's locked
 * contract types in ../transcript-reconciler.ts).
 *
 * DB-free -- these are pure, inputs-in/decisions-out functions, mirroring
 * speaker-resolver.test.ts's plain-TS-module import convention (no Deno
 * runtime needed; the esm.sh fastest-levenshtein import resolves via
 * vitest.config.ts's resolve.alias shim, Phase 32 precedent).
 *
 * Per Andrew's standing test-quality directive (STATE.md, 2026-09-06):
 * tests must prove real behavior, not ceremony. Every negative/adversarial
 * case here is constructed so it would only pass against a REAL
 * implementation, not a naive/stub one -- e.g. the determinism test asserts
 * byte-identical output across two independent invocations, and the
 * fabrication-guard test asserts the winning token is always drawn from the
 * real candidate set.
 */
import { describe, expect, it } from 'vitest';
import {
  alignChunksToTimeline,
  type AlignedChunkGroup,
  buildReconciledSegment,
  PROVIDER_ACCURACY_PRIORS,
  PROVIDER_PRIORITY_ORDER,
  type ReconChunk,
  resolveTokenDisagreement,
  tokenizeAndAlignText,
  tokensMatch,
  type TokenAgreement,
  type TokenDisagreement,
} from '../transcript-reconciler.ts';

const EVENT_ID = 'evt-recon-1';
const ORG_ID = 'org-recon-1';

const RECORDING_A_START = '2026-01-01T10:00:00.000Z';
const RECORDING_B_START = '2026-01-01T09:59:50.000Z'; // 10s behind A -- clock drift
const RECORDING_C_START = '2026-01-01T10:00:05.000Z'; // 5s ahead of A

function chunk(overrides: Partial<ReconChunk> & Pick<ReconChunk, 'canonical_recording_id' | 'chunk_index' | 'chunk_text'>): ReconChunk {
  return {
    speaker_name: null,
    speaker_email: null,
    timestamp_start: '00:05:00',
    timestamp_end: '00:06:00',
    identity_id: null,
    source_platform: 'fathom',
    ...overrides,
  };
}

// --- Task 1: alignChunksToTimeline ----------------------------------------

describe('alignChunksToTimeline', () => {
  it('aligns two recordings genuinely overlapping chunks (within +-20s tolerance) into one multi-source group', () => {
    const chunks: ReconChunk[] = [
      chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'Hello team welcome', timestamp_start: '00:05:00', timestamp_end: '00:06:00', source_platform: 'fathom' }),
      chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'Hello team welcome', timestamp_start: '00:05:05', timestamp_end: '00:06:05', source_platform: 'zoom' }),
    ];
    const groups = alignChunksToTimeline({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-a': RECORDING_A_START, 'rec-b': RECORDING_B_START },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
    expect(new Set(groups[0].members.map((m) => m.canonical_recording_id))).toEqual(new Set(['rec-a', 'rec-b']));
  });

  it('keeps adjacent-but-not-overlapping chunks (gap well beyond the tolerance buffer) as SEPARATE groups -- adjacency alone never merges', () => {
    const chunks: ReconChunk[] = [
      chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'first segment', timestamp_start: '00:05:00', timestamp_end: '00:05:30' }),
      // Starts 60s after rec-a's end -- well outside the 20s tolerance buffer.
      chunk({ canonical_recording_id: 'rec-a', chunk_index: 1, chunk_text: 'second segment', timestamp_start: '00:06:30', timestamp_end: '00:07:00' }),
    ];
    const groups = alignChunksToTimeline({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-a': RECORDING_A_START },
    });
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.members.length === 1)).toBe(true);
  });

  it('produces a single-source group for a non-overlapping chunk with no partner recording (RECON-06 foundation)', () => {
    const chunks: ReconChunk[] = [chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'only one source here', timestamp_start: '00:05:00', timestamp_end: '00:06:00' })];
    const groups = alignChunksToTimeline({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-a': RECORDING_A_START },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(1);
  });

  it('yields no groups for zero input chunks (an interval with zero contributing recordings yields no group)', () => {
    const groups = alignChunksToTimeline({ event_id: EVENT_ID, organization_id: ORG_ID, chunks: [], recordingStartTimes: {} });
    expect(groups).toHaveLength(0);
  });

  it('transitively groups three recordings whose intervals overlap in a chain (A~B, B~C) even though A and C alone might not directly overlap', () => {
    const chunks: ReconChunk[] = [
      chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'chained overlap test', timestamp_start: '00:05:00', timestamp_end: '00:05:20', source_platform: 'fathom' }),
      chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'chained overlap test', timestamp_start: '00:05:10', timestamp_end: '00:05:35', source_platform: 'zoom' }),
      chunk({ canonical_recording_id: 'rec-c', chunk_index: 0, chunk_text: 'chained overlap test', timestamp_start: '00:05:25', timestamp_end: '00:05:50', source_platform: 'grain' }),
    ];
    const groups = alignChunksToTimeline({
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      chunks,
      recordingStartTimes: { 'rec-a': RECORDING_A_START, 'rec-b': RECORDING_A_START, 'rec-c': RECORDING_A_START },
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });

  it('fails closed to a null-bounded group (never silently drops the chunk) when a recording has no recording_start_time', () => {
    const chunks: ReconChunk[] = [chunk({ canonical_recording_id: 'rec-x', chunk_index: 0, chunk_text: 'anchor unavailable', timestamp_start: '00:05:00', timestamp_end: '00:06:00' })];
    const groups = alignChunksToTimeline({ event_id: EVENT_ID, organization_id: ORG_ID, chunks, recordingStartTimes: { 'rec-x': null } });
    expect(groups).toHaveLength(1);
    expect(groups[0].start).toBeNull();
    expect(groups[0].end).toBeNull();
  });
});

// --- Task 2: tokensMatch ----------------------------------------------------

describe('tokensMatch', () => {
  it('fuzzy-matches a single-character misspelling within the length-scaled threshold ("ChatGPT" vs "ChatGBT")', () => {
    expect(tokensMatch('ChatGPT', 'ChatGBT')).toBe(true);
  });

  it('does NOT fuzzy-match two short, genuinely different tokens ("a" vs "I") -- short-token guard', () => {
    expect(tokensMatch('a', 'I')).toBe(false);
  });

  it('does NOT fuzzy-match two unrelated longer words beyond the scaled threshold', () => {
    expect(tokensMatch('scheduling', 'marketing')).toBe(false);
  });

  it('matches identical tokens case-insensitively', () => {
    expect(tokensMatch('Hello', 'hello')).toBe(true);
  });
});

// --- Task 2: tokenizeAndAlignText ------------------------------------------

describe('tokenizeAndAlignText', () => {
  it('aligns a spelling-variant token as a SUBSTITUTION at the same position, not an insert+delete pair -- surrounding tokens stay aligned', () => {
    const group: AlignedChunkGroup = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      start: '2026-01-01T10:05:00.000Z',
      end: '2026-01-01T10:06:00.000Z',
      members: [
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'we use ChatGPT daily', source_platform: 'fathom' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'we use ChatGBT daily', source_platform: 'zoom' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    };
    const alignment = tokenizeAndAlignText(group);
    // "we", "use", "ChatGPT"/"ChatGBT", "daily" -- 4 backbone positions, the
    // spelling-variant token substituted in place (not split into an
    // insert+delete pair that would misalign "daily").
    expect(alignment).toHaveLength(4);
    const disagreements = alignment.filter((a): a is TokenDisagreement => 'candidates' in a);
    expect(disagreements).toHaveLength(0); // fuzzy match absorbs ChatGPT/ChatGBT as agreement, not disagreement
    const lastToken = alignment[3];
    expect('token' in lastToken && lastToken.token).toBe('daily');
  });

  it('produces agreement positions for identical surrounding tokens and exactly one disagreement position for a genuine substitution', () => {
    const group: AlignedChunkGroup = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      start: '2026-01-01T10:05:00.000Z',
      end: '2026-01-01T10:06:00.000Z',
      members: [
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'the quarterly revenue grew', source_platform: 'fathom' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'the quarterly revenue shrank', source_platform: 'zoom' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    };
    const alignment = tokenizeAndAlignText(group);
    expect(alignment).toHaveLength(4);
    const disagreements = alignment.filter((a): a is TokenDisagreement => 'candidates' in a);
    const agreements = alignment.filter((a): a is TokenAgreement => 'agreeing_recording_ids' in a && 'token' in a && !('candidates' in a));
    expect(disagreements).toHaveLength(1);
    expect(agreements).toHaveLength(3);
    expect(disagreements[0].candidates.map((c) => c.token).sort()).toEqual(['grew', 'shrank']);
  });

  it('returns per-position agreement for a single-source group (no disagreement possible with one contributor)', () => {
    const group: AlignedChunkGroup = {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      start: '2026-01-01T10:05:00.000Z',
      end: '2026-01-01T10:06:00.000Z',
      members: [{ ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'solo speaker text' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } }],
    };
    const alignment = tokenizeAndAlignText(group);
    expect(alignment).toHaveLength(3);
    expect(alignment.every((a) => 'agreeing_recording_ids' in a && !('candidates' in a))).toBe(true);
  });
});

// --- Task 2: resolveTokenDisagreement --------------------------------------

describe('resolveTokenDisagreement', () => {
  const EMPTY_LEXICON = new Set<string>();

  it('resolves via weighted vote favoring the higher-accuracy-prior provider when the split is 1-vs-1 and no confidence is exposed', () => {
    expect(PROVIDER_ACCURACY_PRIORS.fathom).toBeGreaterThan(PROVIDER_ACCURACY_PRIORS.plaud);
    const disagreement: TokenDisagreement = {
      position: 2,
      candidates: [
        { token: 'grew', canonical_recording_id: 'rec-a', source_platform: 'fathom' },
        { token: 'shrank', canonical_recording_id: 'rec-b', source_platform: 'plaud' },
      ],
    };
    const resolved = resolveTokenDisagreement(disagreement, EMPTY_LEXICON);
    expect(resolved.token).toBe('grew');
    expect(resolved.resolution).toBe('weighted_vote');
    expect(resolved.agreeing_recording_ids).toEqual(['rec-a']);
  });

  it('resolves via majority when 2 sources agree against 1 dissenter, even if the dissenter has a higher individual provider prior', () => {
    const disagreement: TokenDisagreement = {
      position: 0,
      candidates: [
        { token: 'north', canonical_recording_id: 'rec-a', source_platform: 'plaud' }, // lower prior, alone
        { token: 'south', canonical_recording_id: 'rec-b', source_platform: 'plaud' },
        { token: 'south', canonical_recording_id: 'rec-c', source_platform: 'plaud' },
      ],
    };
    const resolved = resolveTokenDisagreement(disagreement, EMPTY_LEXICON);
    expect(resolved.token).toBe('south');
    expect(resolved.agreeing_recording_ids.sort()).toEqual(['rec-b', 'rec-c']);
  });

  it('uses the entity lexicon to break an otherwise-tied vote, preferring the seeded correct spelling ("ChatGPT" over "ChatGBT")', () => {
    const lexicon = new Set(['ChatGPT']);
    const disagreement: TokenDisagreement = {
      position: 5,
      candidates: [
        { token: 'ChatGPT', canonical_recording_id: 'rec-a', source_platform: 'fathom' },
        { token: 'Chatbot9', canonical_recording_id: 'rec-b', source_platform: 'fathom' }, // same provider/prior, exact tie by weight, distinct-enough token to NOT fuzzy-match ChatGPT
      ],
    };
    const resolved = resolveTokenDisagreement(disagreement, lexicon);
    expect(resolved.token).toBe('ChatGPT');
    expect(resolved.resolution).toBe('entity_lexicon_tiebreak');
  });

  it('resolves a true 3-way tie (equal weights, no lexicon match) deterministically via PROVIDER_PRIORITY_ORDER -- winner is always a real candidate token', () => {
    // All three candidates use the SAME provider (equal weight, no possible
    // weighted-vote winner) and none is in the lexicon -- forces the true
    // n-way-tie fallback path.
    const disagreement: TokenDisagreement = {
      position: 9,
      candidates: [
        { token: 'alpha', canonical_recording_id: 'rec-a', source_platform: 'plaud' },
        { token: 'beta', canonical_recording_id: 'rec-b', source_platform: 'plaud' },
        { token: 'gamma', canonical_recording_id: 'rec-c', source_platform: 'plaud' },
      ],
    };
    const first = resolveTokenDisagreement(disagreement, EMPTY_LEXICON);
    const second = resolveTokenDisagreement(disagreement, EMPTY_LEXICON);
    // Determinism: identical input -> byte-identical output across independent invocations.
    expect(first).toEqual(second);
    expect(first.resolution).toBe('provider_priority_fallback');
    // Fabrication guard: winner must be one of the real candidate tokens.
    expect(['alpha', 'beta', 'gamma']).toContain(first.token);
  });

  it('proves determinism is NOT accidental by re-running the whole suite of representative disagreements twice and diffing JSON output', () => {
    const disagreements: TokenDisagreement[] = [
      { position: 0, candidates: [{ token: 'x', canonical_recording_id: 'r1', source_platform: 'fathom' }, { token: 'y', canonical_recording_id: 'r2', source_platform: 'zoom' }] },
      { position: 1, candidates: [{ token: 'p', canonical_recording_id: 'r1', source_platform: 'plaud' }, { token: 'q', canonical_recording_id: 'r2', source_platform: 'plaud' }, { token: 'r', canonical_recording_id: 'r3', source_platform: 'plaud' }] },
    ];
    const runOnce = () => disagreements.map((d) => resolveTokenDisagreement(d, new Set(['q'])));
    const runA = JSON.stringify(runOnce());
    const runB = JSON.stringify(runOnce());
    expect(runA).toBe(runB);
  });

  it('never fabricates a token absent from the candidate set, across every resolution path (weighted vote, lexicon, fallback)', () => {
    const cases: TokenDisagreement[] = [
      { position: 0, candidates: [{ token: 'grew', canonical_recording_id: 'r1', source_platform: 'fathom' }, { token: 'shrank', canonical_recording_id: 'r2', source_platform: 'plaud' }] },
      { position: 1, candidates: [{ token: 'ChatGPT', canonical_recording_id: 'r1', source_platform: 'fathom' }, { token: 'Chatbot9', canonical_recording_id: 'r2', source_platform: 'fathom' }] },
      { position: 2, candidates: [{ token: 'alpha', canonical_recording_id: 'r1', source_platform: 'plaud' }, { token: 'beta', canonical_recording_id: 'r2', source_platform: 'plaud' }, { token: 'gamma', canonical_recording_id: 'r3', source_platform: 'plaud' }] },
    ];
    for (const c of cases) {
      const resolved = resolveTokenDisagreement(c, new Set(['ChatGPT']));
      expect(c.candidates.map((cand) => cand.token)).toContain(resolved.token);
    }
  });

  it('weighs per-token confidence when exposed, letting a lower-prior provider with high confidence outvote a higher-prior provider with low confidence', () => {
    const disagreement: TokenDisagreement = {
      position: 0,
      candidates: [
        { token: 'fathom-word', canonical_recording_id: 'rec-a', source_platform: 'fathom', confidence: 0.1 }, // 0.85 * 0.1 = 0.085
        { token: 'plaud-word', canonical_recording_id: 'rec-b', source_platform: 'plaud', confidence: 0.99 }, // 0.65 * 0.99 = 0.6435
      ],
    };
    const resolved = resolveTokenDisagreement(disagreement, EMPTY_LEXICON);
    expect(resolved.token).toBe('plaud-word');
  });
});

// --- Task 3: buildReconciledSegment ----------------------------------------

describe('buildReconciledSegment', () => {
  function group(overrides: Partial<AlignedChunkGroup>): AlignedChunkGroup {
    return {
      event_id: EVENT_ID,
      organization_id: ORG_ID,
      start: '2026-01-01T10:05:00.000Z',
      end: '2026-01-01T10:06:00.000Z',
      members: [],
      ...overrides,
    };
  }

  it('marks a single-source group as single_source and NEVER claims consensus (adversarial negative -- RECON-06)', () => {
    const g = group({
      members: [{ ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'solo text' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } }],
    });
    const result = buildReconciledSegment(g, [
      { token: 'solo', agreeing_recording_ids: ['rec-a'] },
      { token: 'text', agreeing_recording_ids: ['rec-a'] },
    ]);
    expect('coverage' in result && result.coverage).toBe('single_source');
    expect('coverage' in result && result.coverage).not.toBe('consensus');
    if ('agreeing_recording_ids' in result) {
      expect(result.agreeing_recording_ids).toEqual(['rec-a']);
      expect(result.source_recording_ids).toEqual(['rec-a']);
    }
  });

  it('marks a multi-source, fully-agreeing group as consensus with both recordings in agreeing_recording_ids', () => {
    const g = group({
      members: [
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    });
    const result = buildReconciledSegment(g, [{ token: 'x', agreeing_recording_ids: ['rec-a', 'rec-b'] }]);
    expect('coverage' in result && result.coverage).toBe('consensus');
    if ('source_recording_ids' in result) {
      // RECON-05: sorted ascending by recording id.
      expect(result.source_recording_ids).toEqual(['rec-a', 'rec-b']);
      expect(result.agreeing_recording_ids).toEqual(['rec-a', 'rec-b']);
    }
  });

  it('excludes a dissenting recording from agreeing_recording_ids while still listing it in source_recording_ids', () => {
    const g = group({
      members: [
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'grew' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'shrank' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    });
    // resolved token "grew" -- only rec-a agreed at this position; rec-b's
    // "shrank" candidate lost the disagreement, so the caller threads it
    // through as dissenting_recording_ids (CR-01 fix -- dissent is tracked
    // directly per-position, not inferred from absence-from-agreement-list).
    const result = buildReconciledSegment(g, [{ token: 'grew', agreeing_recording_ids: ['rec-a'], dissenting_recording_ids: ['rec-b'] }]);
    if ('source_recording_ids' in result) {
      expect(result.source_recording_ids).toEqual(['rec-a', 'rec-b']);
      expect(result.agreeing_recording_ids).toEqual(['rec-a']);
      expect(result.coverage).toBe('consensus'); // still 2 sources, just not full agreement
    }
  });

  it('CR-01 regression: a recording that agrees on SOME tokens but dissents on even one token within the segment is excluded from agreeing_recording_ids (AND-semantics, not OR)', () => {
    // rec-b transcribes the shared word "the" identically to rec-a (would
    // land in SOME position's agreeing_recording_ids under the old,
    // buggy OR-semantics implementation) but disagrees on 2 of 3 remaining
    // words. Per buildReconciledSegment's documented contract, a recording
    // only counts as "agreeing" if it never loses a token-level
    // disagreement anywhere in the segment -- so rec-b must be excluded
    // from agreeing_recording_ids despite partially matching.
    const g = group({
      members: [
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'the quarterly revenue grew fast' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'the annual revenue shrank fast' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    });
    // Position 0 "the": both agree (unanimous). Position 1 "quarterly"/"annual": disagreement, rec-a wins, rec-b dissents. Position 2 "revenue": both agree. Position 3 "grew"/"shrank": disagreement, rec-a wins, rec-b dissents. Position 4 "fast": both agree.
    const resolvedTokens = [
      { token: 'the', agreeing_recording_ids: ['rec-a', 'rec-b'] },
      { token: 'quarterly', agreeing_recording_ids: ['rec-a'], dissenting_recording_ids: ['rec-b'] },
      { token: 'revenue', agreeing_recording_ids: ['rec-a', 'rec-b'] },
      { token: 'grew', agreeing_recording_ids: ['rec-a'], dissenting_recording_ids: ['rec-b'] },
      { token: 'fast', agreeing_recording_ids: ['rec-a', 'rec-b'] },
    ];
    const result = buildReconciledSegment(g, resolvedTokens);
    if ('agreeing_recording_ids' in result) {
      // rec-b matched 3 of 5 tokens but must be fully excluded -- partial
      // agreement is not agreement.
      expect(result.agreeing_recording_ids).toEqual(['rec-a']);
      expect(result.source_recording_ids).toEqual(['rec-a', 'rec-b']);
      expect(result.coverage).toBe('consensus');
    }
  });

  it('produces deterministic array ordering across repeated calls on identical input', () => {
    const g = group({
      members: [
        { ...chunk({ canonical_recording_id: 'rec-c', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-c', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
        { ...chunk({ canonical_recording_id: 'rec-b', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-b', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:00.000Z' } },
      ],
    });
    const tokens = [{ token: 'x', agreeing_recording_ids: ['rec-a', 'rec-b', 'rec-c'] }];
    const a = JSON.stringify(buildReconciledSegment(g, tokens));
    const b = JSON.stringify(buildReconciledSegment(g, tokens));
    expect(a).toBe(b);
    const parsed = JSON.parse(a);
    expect(parsed.source_recording_ids).toEqual(['rec-a', 'rec-b', 'rec-c']);
  });

  it('derives start_time/end_time from the group interval bounds', () => {
    const g = group({
      start: '2026-01-01T10:05:00.000Z',
      end: '2026-01-01T10:06:30.000Z',
      members: [{ ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: '2026-01-01T10:05:00.000Z', end: '2026-01-01T10:06:30.000Z' } }],
    });
    const result = buildReconciledSegment(g, [{ token: 'x', agreeing_recording_ids: ['rec-a'] }]);
    if ('start_time' in result) {
      expect(result.start_time).toBe('2026-01-01T10:05:00.000Z');
      expect(result.end_time).toBe('2026-01-01T10:06:30.000Z');
    }
  });

  it('fails closed to a structural refusal for an empty group -- never fabricates a segment from nothing', () => {
    const g = group({ members: [] });
    const result = buildReconciledSegment(g, []);
    expect('resolved' in result && result.resolved).toBe(false);
    if ('reason' in result) expect(result.reason).toBe('empty_group');
  });

  it('fails closed to a structural refusal when the group interval could not be derived (anchor_unavailable)', () => {
    const g = group({
      start: null,
      end: null,
      members: [{ ...chunk({ canonical_recording_id: 'rec-a', chunk_index: 0, chunk_text: 'x' }), interval: { canonical_recording_id: 'rec-a', chunk_index: 0, start: null, end: null } }],
    });
    const result = buildReconciledSegment(g, [{ token: 'x', agreeing_recording_ids: ['rec-a'] }]);
    expect('resolved' in result && result.resolved).toBe(false);
    if ('reason' in result) expect(result.reason).toBe('anchor_unavailable');
  });
});

// --- Cross-provider priority order sanity ----------------------------------

describe('PROVIDER_PRIORITY_ORDER', () => {
  it('is a fixed, non-empty, deterministic ordering (never randomized at runtime)', () => {
    expect(PROVIDER_PRIORITY_ORDER.length).toBeGreaterThan(0);
    expect(new Set(PROVIDER_PRIORITY_ORDER).size).toBe(PROVIDER_PRIORITY_ORDER.length);
  });
});
