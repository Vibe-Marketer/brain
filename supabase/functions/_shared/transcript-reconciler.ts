/**
 * transcript-reconciler.ts -- Phase 37 Plan 02: pure, DB-free token-level
 * cross-recording transcript reconciliation module.
 *
 * This file is the one genuinely novel capability of Phase 37 (37-RESEARCH.md
 * Summary): every prior resolution phase in this milestone (event matching,
 * identity resolution, speaker resolution) resolved *which* row/label is
 * correct -- none of them ever merged actual transcript *prose* from two or
 * more independently-transcribed sources of the same event. This module does
 * exactly that: given 2+ recordings' `transcript_chunks` rows for one event,
 * it (1) aligns chunks onto a shared content-derived timeline by REUSING
 * Phase 35's `deriveAbsoluteInterval`/`alignChunksAcrossRecordings`/
 * `CLOCK_DRIFT_TOLERANCE_MS` primitives verbatim (no duplicated interval
 * math -- 37-RESEARCH.md Pattern 2, 37-01-SUMMARY.md's locked import
 * decision), (2) word-tokenizes and fuzzily aligns each aligned group's
 * overlapping chunk text via a hand-rolled Wagner-Fischer-style edit-distance
 * DP (fastest-levenshtein's `distance()` is a scalar cost oracle only, no
 * alignment path -- 37-01-SUMMARY.md's independently re-verified finding),
 * (3) resolves token-level disagreements by weighted vote across hardcoded
 * per-provider accuracy priors + per-token confidence (when exposed) +
 * majority, broken by a per-workspace entity lexicon and, for a true 3-way
 * tie, a fixed deterministic provider-priority fallback -- NEVER random, so
 * regeneration (RECON-04's full delete+rebuild) is idempotent, and (4)
 * assembles the final reconciled segment with sorted provenance arrays and
 * an explicit single_source/consensus coverage marker (RECON-05/06).
 *
 * No DB access in this file (mirrors speaker-resolver.ts / event-resolver.ts
 * / identity-resolver.ts's pure-functions style). The caller (Plan 03's
 * `reconcile-transcripts` edge function) is responsible for same-org/event
 * bucketing BEFORE constructing input to this module (SAFE-04 precedent) and
 * for fetching the per-workspace entity lexicon as a plain `Set<string>`.
 */
import { distance } from 'https://esm.sh/fastest-levenshtein@1.0.16';
import {
  alignChunksAcrossRecordings,
  type AlignedChunk,
  type AlignmentInput,
  CLOCK_DRIFT_TOLERANCE_MS,
  deriveAbsoluteInterval,
  intervalsOverlapWithTolerance,
  type SpeakerChunk,
} from './speaker-resolver.ts';

// Re-export the reused primitives so callers/tests of this module can import
// everything from one place without also reaching into speaker-resolver.ts
// directly -- purely a convenience re-export, not a reimplementation.
export { alignChunksAcrossRecordings, CLOCK_DRIFT_TOLERANCE_MS, deriveAbsoluteInterval };

// --- Contract types ------------------------------------------------------

/**
 * A `transcript_chunks` row's minimal shape needed for reconciliation.
 * Structurally compatible with `SpeakerChunk` (so `deriveAbsoluteInterval`/
 * `alignChunksAcrossRecordings` accept it verbatim) plus the fields this
 * module additionally needs: the chunk's actual transcribed text, which
 * provider produced it (for the accuracy-prior weighted vote), and its
 * named-entity extraction (for the per-workspace lexicon).
 */
export interface ReconChunk extends SpeakerChunk {
  chunk_text: string;
  source_platform: string;
  /** Per-token confidence, if the source provider exposes it. Absent for most providers -- fail closed to majority-only voting when missing (37-RESEARCH.md Pattern 3 / RECON-02). */
  token_confidence?: number[] | null;
}

/** One event's ReconChunks across 2+ recordings, plus the per-recording start-time anchors `deriveAbsoluteInterval` needs. */
export interface ReconAlignmentInput {
  event_id: string;
  organization_id: string;
  chunks: ReconChunk[];
  /** canonical_recording_id -> recording_start_time (nullable ISO), one entry per recording referenced in `chunks`. */
  recordingStartTimes: Record<string, string | null>;
}

/**
 * A group of chunks (from 1+ recordings) whose derived AbsoluteIntervals
 * mutually overlap within `CLOCK_DRIFT_TOLERANCE_MS`. A group with exactly
 * one contributing recording is a single-source group by construction
 * (RECON-06) -- it is NEVER upgraded to multi-source/consensus downstream.
 */
export interface AlignedChunkGroup {
  event_id: string;
  organization_id: string;
  /** The group's ReconChunks, tagged with their derived interval (mirrors AlignedChunk's shape). */
  members: Array<ReconChunk & { interval: AlignedChunk['interval'] }>;
  /** Union span across all members' intervals -- the group's own start/end. Null if any member's interval could not be derived (fails closed). */
  start: string | null;
  end: string | null;
}

/** One recording's token at a given aligned position, as input to disagreement resolution. */
export interface TokenCandidate {
  token: string;
  canonical_recording_id: string;
  source_platform: string;
  /** This token's own confidence score, if the source provider exposed one for its position. */
  confidence?: number;
}

/** A position in the aligned token stream where 2+ contributing recordings' tokens genuinely disagree (post-fuzzy-match). */
export interface TokenDisagreement {
  position: number;
  candidates: TokenCandidate[];
}

/** A position in the aligned token stream where all contributing recordings agree (post-fuzzy-match) on effectively the same token. */
export interface TokenAgreement {
  position: number;
  token: string;
  agreeing_recording_ids: string[];
}

/** Either agreement or disagreement at one aligned token position -- never both. */
export type TokenAlignment = TokenAgreement | TokenDisagreement;

/** Discriminated result of resolving one TokenDisagreement: the winning token is always drawn from `candidates` (or a lexicon-preferred variant of a candidate) -- never fabricated (T-37-05). */
export interface ResolvedToken {
  position: number;
  token: string;
  /** Which recordings' tokens (post-fuzzy-match) agree with the winning token. */
  agreeing_recording_ids: string[];
  /** Why this token won: which mechanism decided it. Diagnostic only. */
  resolution: 'weighted_vote' | 'entity_lexicon_tiebreak' | 'provider_priority_fallback' | 'unanimous';
}

/** The final assembled segment for one AlignedChunkGroup. */
export interface ReconciledSegmentResult {
  event_id: string;
  organization_id: string;
  segment_text: string;
  start_time: string;
  end_time: string;
  /** All recordings that contributed a chunk to this group's interval, sorted ascending by recording id. */
  source_recording_ids: string[];
  /** Recordings whose text agreed with the resolved segment_text's tokens, sorted ascending by recording id. A single-source group's agreeing_recording_ids is always its own lone source -- never implying independent corroboration. */
  agreeing_recording_ids: string[];
  /** 'single_source' when only one recording contributed; 'consensus' when 2+ recordings contributed and were reconciled. RECON-06: a single-source group must never be marked 'consensus'. */
  coverage: 'single_source' | 'consensus';
}

/** Structural refusal to build a segment -- mirrors speaker-resolver.ts's UnresolvedSpeaker/ConsensusRefusal fail-closed literal-type pattern. */
export interface ReconciliationRefusal {
  event_id: string;
  resolved: false;
  reason: 'anchor_unavailable' | 'empty_group';
}

export type BuildSegmentResult = ReconciledSegmentResult | ReconciliationRefusal;

// --- Hardcoded per-provider accuracy priors + deterministic tie-break ----

/**
 * Hardcoded initial per-provider source-accuracy priors (37-RESEARCH.md
 * user_constraints: "no historical accuracy data exists yet to learn from" --
 * mirrors dedup-fingerprint.ts's MATCH_THRESHOLDS hardcoded-weight precedent).
 * Values are illustrative confidence-in-ASR-accuracy weights, not derived
 * from real accuracy measurements this phase. Unrecognized providers fall
 * back to a conservative default weight so an unknown source_platform never
 * silently wins/loses on an unweighted 0.
 */
export const PROVIDER_ACCURACY_PRIORS: Record<string, number> = {
  fathom: 0.85,
  zoom: 0.8,
  grain: 0.8,
  fireflies: 0.75,
  read_ai: 0.75,
  plaud: 0.65,
  loom: 0.6,
};

const DEFAULT_PROVIDER_ACCURACY_PRIOR = 0.5;

/** Deterministic fixed fallback order for a true 3-way (or n-way) tie -- 37-RESEARCH.md's "never random" requirement. Earlier entries win. Unlisted providers sort after all listed ones, in stable input order. */
export const PROVIDER_PRIORITY_ORDER: readonly string[] = ['fathom', 'zoom', 'grain', 'fireflies', 'read_ai', 'plaud', 'loom'];

/** Length-scaled fuzzy-match threshold (37-RESEARCH.md Open Question 3's recommended resolution, over a flat constant): short tokens require an exact/near-exact match (guards "a" vs "I"), longer tokens tolerate proportionally more edit distance. Capped at 2 chars per the ChatGPT/ChatGBT worked example. */
export const TOKEN_FUZZY_MATCH_THRESHOLD_FN = (tokenLength: number): number => Math.min(2, Math.floor(tokenLength * 0.25));

// --- Task 1: alignChunksToTimeline ---------------------------------------

/**
 * Groups an event's ReconChunks (across 1+ recordings) into
 * AlignedChunkGroups whose members' derived AbsoluteIntervals mutually
 * overlap within CLOCK_DRIFT_TOLERANCE_MS. Delegates all interval math to
 * `alignChunksAcrossRecordings`/`deriveAbsoluteInterval` (Phase 35, reused
 * verbatim -- 37-RESEARCH.md Pattern 2, do not reimplement).
 *
 * Grouping is a simple union-find-by-overlap over the aligned chunks: two
 * chunks join the same group iff their intervals overlap within tolerance
 * (transitively). Adjacent-but-non-overlapping chunks (touching endpoints,
 * genuinely outside the tolerance buffer) stay in separate groups -- merging
 * only happens for genuinely overlapping content intervals, never mere
 * adjacency (must_haves truth #2). A chunk whose interval could not be
 * derived (anchor unavailable) forms its own single-member group with null
 * start/end, rather than being silently dropped -- fails closed, never
 * discards data.
 */
export function alignChunksToTimeline(input: ReconAlignmentInput): AlignedChunkGroup[] {
  const alignmentInput: AlignmentInput = {
    event_id: input.event_id,
    organization_id: input.organization_id,
    chunks: input.chunks,
    recordingStartTimes: input.recordingStartTimes,
  };
  const aligned = alignChunksAcrossRecordings(alignmentInput);

  // Re-attach each ReconChunk's original text/provider/confidence fields
  // (alignChunksAcrossRecordings only carries SpeakerChunk's subset), keyed
  // by (canonical_recording_id, chunk_index) -- always unique per input.
  const byKey = new Map<string, ReconChunk>();
  for (const c of input.chunks) {
    byKey.set(`${c.canonical_recording_id}:${c.chunk_index}`, c);
  }

  type Member = ReconChunk & { interval: AlignedChunk['interval'] };
  const members: Member[] = aligned.map((a) => {
    const original = byKey.get(`${a.canonical_recording_id}:${a.chunk_index}`)!;
    return { ...original, interval: a.interval };
  });

  // Union-find over `members` by pairwise interval overlap within tolerance.
  const parent = members.map((_, i) => i);
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }
  function union(a: number, b: number): void {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      if (intervalsOverlapWithTolerance(members[i].interval, members[j].interval, CLOCK_DRIFT_TOLERANCE_MS)) {
        union(i, j);
      }
    }
  }

  const groupsByRoot = new Map<number, Member[]>();
  members.forEach((m, i) => {
    const root = find(i);
    const list = groupsByRoot.get(root) ?? [];
    list.push(m);
    groupsByRoot.set(root, list);
  });

  const groups: AlignedChunkGroup[] = [];
  for (const groupMembers of groupsByRoot.values()) {
    if (groupMembers.length === 0) continue; // no group for zero contributing recordings
    const starts = groupMembers.map((m) => m.interval.start).filter((s): s is string => s !== null);
    const ends = groupMembers.map((m) => m.interval.end).filter((e): e is string => e !== null);
    groups.push({
      event_id: input.event_id,
      organization_id: input.organization_id,
      members: groupMembers,
      start: starts.length > 0 ? starts.reduce((min, s) => (s < min ? s : min)) : null,
      end: ends.length > 0 ? ends.reduce((max, e) => (e > max ? e : max)) : null,
    });
  }

  // Deterministic ordering: sort groups by start (nulls last), for
  // reproducible output across identical-input regenerations (RECON-04).
  groups.sort((a, b) => {
    if (a.start === null && b.start === null) return 0;
    if (a.start === null) return 1;
    if (b.start === null) return -1;
    return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  });

  return groups;
}

// --- Task 2: tokensMatch, tokenizeAndAlignText, resolveTokenDisagreement --

/**
 * True if two tokens should be treated as "the same" for alignment/voting
 * purposes: exact (case-insensitive) match, or within the length-scaled
 * fuzzy threshold (37-RESEARCH.md Pattern 3 / Pitfall 4). Short tokens (<=4
 * chars) require distance 0 after the length scaling floors to 0 -- this is
 * the short-token guard that keeps "a" vs "I" (distance 1) from falsely
 * matching, since Math.floor(1 * 0.25) = 0.
 */
export function tokensMatch(a: string, b: string): boolean {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA === lowerB) return true;
  const threshold = TOKEN_FUZZY_MATCH_THRESHOLD_FN(Math.max(lowerA.length, lowerB.length));
  if (threshold === 0) return false;
  return distance(lowerA, lowerB) <= threshold;
}

function wordTokenize(text: string): string[] {
  return text.trim().length === 0 ? [] : text.trim().split(/\s+/);
}

/**
 * Word-tokenizes each contributing chunk's `chunk_text` in a group and
 * produces a token-level alignment via a hand-rolled Wagner-Fischer-style
 * edit-distance DP, using `tokensMatch` (fuzzy) as the substitution-cost
 * equality predicate -- so a single-char misspelling ("ChatGPT"/"ChatGBT")
 * aligns as a substitution at the SAME position, not an insert+delete pair
 * that would corrupt the surrounding alignment (37-RESEARCH.md Pitfall 4).
 *
 * For exactly 2 sources this is a direct pairwise DP. For 3+ sources, the
 * first source's token sequence is used as the alignment backbone and each
 * additional source is pairwise-aligned against it in turn (progressive
 * alignment) -- sufficient for this milestone's realistic disagreement
 * shape (near-identical word sequences per source, not restructured text,
 * per 37-RESEARCH.md Assumption A2).
 */
export function tokenizeAndAlignText(group: AlignedChunkGroup): TokenAlignment[] {
  const sources = group.members
    .map((m) => ({
      canonical_recording_id: m.canonical_recording_id,
      source_platform: m.source_platform,
      tokens: wordTokenize(m.chunk_text),
      confidence: m.token_confidence ?? null,
    }))
    .filter((s) => s.tokens.length > 0);

  if (sources.length === 0) return [];
  if (sources.length === 1) {
    const only = sources[0];
    return only.tokens.map((token, position) => ({
      position,
      token,
      agreeing_recording_ids: [only.canonical_recording_id],
    }));
  }

  // Backbone = first source's tokens. Progressively align every other
  // source's tokens onto the backbone's positions via pairwise DP.
  const backbone = sources[0];
  type Cell = { position: number; perSource: Map<string, TokenCandidate | null> };
  const cells: Cell[] = backbone.tokens.map((token, position) => ({
    position,
    perSource: new Map([
      [
        backbone.canonical_recording_id,
        { token, canonical_recording_id: backbone.canonical_recording_id, source_platform: backbone.source_platform, confidence: backbone.confidence?.[position] } as TokenCandidate,
      ],
    ]),
  }));

  for (let s = 1; s < sources.length; s++) {
    const other = sources[s];
    const path = pairwiseAlign(backbone.tokens, other.tokens);
    for (const step of path) {
      if (step.aIndex === null) continue; // pure insertion relative to backbone: no backbone position to attach to -- dropped from the position-indexed view, consistent with backbone-anchored alignment.
      if (step.bIndex === null) continue; // backbone token with no counterpart in this source: leave this source's slot empty at this position.
      cells[step.aIndex].perSource.set(other.canonical_recording_id, {
        token: other.tokens[step.bIndex],
        canonical_recording_id: other.canonical_recording_id,
        source_platform: other.source_platform,
        confidence: other.confidence?.[step.bIndex],
      });
    }
  }

  return cells.map((cell) => {
    const candidates = Array.from(cell.perSource.values()).filter((c): c is TokenCandidate => c !== null);
    const allAgree = candidates.every((c) => tokensMatch(c.token, candidates[0].token));
    if (allAgree) {
      return {
        position: cell.position,
        token: candidates[0].token,
        agreeing_recording_ids: candidates.map((c) => c.canonical_recording_id),
      } satisfies TokenAgreement;
    }
    return { position: cell.position, candidates } satisfies TokenDisagreement;
  });
}

/** One step of a pairwise edit-distance alignment path: aIndex/bIndex are the matched/substituted positions (null on the side that has an insertion/deletion). */
interface AlignStep {
  aIndex: number | null;
  bIndex: number | null;
}

/**
 * Classic Wagner-Fischer edit-distance DP with backtrace, using `tokensMatch`
 * as the substitution-cost-0-vs-1 equality predicate (fuzzy, not exact) --
 * this IS the hand-rolled alignment path fastest-levenshtein's bare
 * `distance()` does not expose (37-01-SUMMARY.md's independently
 * re-verified finding; 37-RESEARCH.md Pattern 3 caveat).
 */
function pairwiseAlign(a: string[], b: string[]): AlignStep[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const subCost = tokensMatch(a[i - 1], b[j - 1]) ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + subCost, // match/substitute
        dp[i - 1][j] + 1, // deletion (a[i-1] has no counterpart in b)
        dp[i][j - 1] + 1, // insertion (b[j-1] has no counterpart in a)
      );
    }
  }

  const path: AlignStep[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + (tokensMatch(a[i - 1], b[j - 1]) ? 0 : 1)) {
      path.push({ aIndex: i - 1, bIndex: j - 1 });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      path.push({ aIndex: i - 1, bIndex: null });
      i -= 1;
    } else {
      path.push({ aIndex: null, bIndex: j - 1 });
      j -= 1;
    }
  }
  path.reverse();
  return path;
}

/**
 * Resolves one TokenDisagreement by weighted vote: each candidate's vote
 * weight is PROVIDER_ACCURACY_PRIORS[source_platform] (or the conservative
 * default) times its own per-token confidence when exposed (else weight is
 * accuracy-prior-only, i.e. majority-by-provider-trust). Votes are summed
 * per distinct (fuzzy-grouped) token value. Ties, in order:
 *   1. Entity-lexicon tie-break: if exactly one tied token value is present
 *      in `entityLexicon`, it wins (37-RESEARCH.md's ChatGPT/ChatGBT case).
 *   2. Deterministic PROVIDER_PRIORITY_ORDER fallback: the tied token
 *      contributed by the highest-priority provider wins -- NEVER random,
 *      identical output across repeated runs on identical input.
 * The winning token is always a literal candidate token (or a
 * lexicon-preferred variant that is itself a real candidate) -- never
 * fabricated (T-37-05, prohibitions).
 */
export function resolveTokenDisagreement(disagreement: TokenDisagreement, entityLexicon: ReadonlySet<string>): ResolvedToken {
  const { position, candidates } = disagreement;

  // Group candidates by fuzzy-equal token value (canonical value = first
  // candidate seen for that group), so near-miss spelling variants vote
  // together rather than splitting the tally across "ChatGPT" and "ChatGBT"
  // as if they were fully independent options.
  const groups: Array<{ canonicalToken: string; members: TokenCandidate[] }> = [];
  for (const c of candidates) {
    const existing = groups.find((g) => tokensMatch(g.canonicalToken, c.token));
    if (existing) existing.members.push(c);
    else groups.push({ canonicalToken: c.token, members: [c] });
  }

  if (groups.length === 1) {
    return {
      position,
      token: groups[0].canonicalToken,
      agreeing_recording_ids: groups[0].members.map((m) => m.canonical_recording_id),
      resolution: 'unanimous',
    };
  }

  const scored = groups.map((g) => {
    const weight = g.members.reduce((sum, m) => {
      const prior = PROVIDER_ACCURACY_PRIORS[m.source_platform] ?? DEFAULT_PROVIDER_ACCURACY_PRIOR;
      const confidenceFactor = typeof m.confidence === 'number' ? m.confidence : 1;
      return sum + prior * confidenceFactor;
    }, 0);
    return { group: g, weight };
  });

  const maxWeight = Math.max(...scored.map((s) => s.weight));
  // Floating-point-safe tie detection.
  const tied = scored.filter((s) => Math.abs(s.weight - maxWeight) < 1e-9);

  if (tied.length === 1) {
    return {
      position,
      token: tied[0].group.canonicalToken,
      agreeing_recording_ids: tied[0].group.members.map((m) => m.canonical_recording_id),
      resolution: 'weighted_vote',
    };
  }

  // Entity-lexicon tie-break: exactly one tied group's token is a known
  // lexicon entry -> it wins.
  const lexiconMatches = tied.filter((s) => entityLexicon.has(s.group.canonicalToken));
  if (lexiconMatches.length === 1) {
    return {
      position,
      token: lexiconMatches[0].group.canonicalToken,
      agreeing_recording_ids: lexiconMatches[0].group.members.map((m) => m.canonical_recording_id),
      resolution: 'entity_lexicon_tiebreak',
    };
  }

  // True n-way tie: deterministic PROVIDER_PRIORITY_ORDER fallback. Each
  // tied group's "best" provider is the one earliest in the priority order;
  // the group whose best provider ranks earliest overall wins. Never random.
  function bestProviderRank(members: TokenCandidate[]): number {
    let best = PROVIDER_PRIORITY_ORDER.length; // unlisted providers rank last
    for (const m of members) {
      const rank = PROVIDER_PRIORITY_ORDER.indexOf(m.source_platform);
      const effectiveRank = rank === -1 ? PROVIDER_PRIORITY_ORDER.length : rank;
      if (effectiveRank < best) best = effectiveRank;
    }
    return best;
  }
  const withRank = tied
    .map((s) => ({ ...s, rank: bestProviderRank(s.group.members) }))
    .sort((x, y) => x.rank - y.rank || x.group.canonicalToken.localeCompare(y.group.canonicalToken));
  const winner = withRank[0];

  return {
    position,
    token: winner.group.canonicalToken,
    agreeing_recording_ids: winner.group.members.map((m) => m.canonical_recording_id),
    resolution: 'provider_priority_fallback',
  };
}

// --- Task 3: buildReconciledSegment ---------------------------------------

/**
 * Assembles a group's resolved token stream into the final
 * ReconciledSegmentResult: segment text, sorted provenance arrays, coverage
 * marker, and interval bounds. Fail-closed guards first (missing interval /
 * empty group -> ReconciliationRefusal), mirroring
 * speaker-resolver.ts's collapsePhantomSpeaker's guards-first shape
 * (37-RESEARCH.md Pattern 1 / this plan's read_first pointer).
 *
 * `resolvedTokens` must already be the final per-position token stream
 * (agreements passed through as-is, disagreements pre-resolved via
 * `resolveTokenDisagreement`) in position order -- this function does not
 * itself call the resolver, keeping it a pure assembly step.
 */
export function buildReconciledSegment(
  group: AlignedChunkGroup,
  resolvedTokens: Array<{ token: string; agreeing_recording_ids: string[]; dissenting_recording_ids?: string[] }>,
): BuildSegmentResult {
  if (group.members.length === 0) {
    return { event_id: group.event_id, resolved: false, reason: 'empty_group' };
  }
  if (group.start === null || group.end === null) {
    return { event_id: group.event_id, resolved: false, reason: 'anchor_unavailable' };
  }

  const sourceRecordingIds = [...new Set(group.members.map((m) => m.canonical_recording_id))].sort();

  // Agreeing recordings = the set of recordings whose tokens agreed with the
  // FINAL resolved text at every position they contributed to -- i.e. a
  // recording is "agreeing" only if it never appears as a losing/dissenting
  // candidate anywhere in the resolved stream. This is the accurate
  // consensus signal: a source that lost even one token-level disagreement
  // did not fully agree with the reconciled segment.
  //
  // Dissent is tracked directly per-position via `dissenting_recording_ids`
  // (populated by the caller from each TokenDisagreement's losing
  // candidates -- see resolveTokenDisagreement's call site), NOT inferred
  // from absence-from-every-agreement-list. Inferring from absence is wrong:
  // a recording that wins/matches at even one shared token (e.g. a common
  // "the") would appear in SOME position's agreeing_recording_ids and thus
  // never be marked dissenting, even if it lost every other disagreement in
  // the segment (OR-semantics instead of the documented AND-semantics).
  const dissenting = new Set<string>();
  for (const t of resolvedTokens) {
    for (const id of t.dissenting_recording_ids ?? []) dissenting.add(id);
  }
  const agreeingRecordingIds = sourceRecordingIds.filter((id) => !dissenting.has(id)).sort();

  const segmentText = resolvedTokens.map((t) => t.token).join(' ');
  const coverage: 'single_source' | 'consensus' = sourceRecordingIds.length === 1 ? 'single_source' : 'consensus';

  // RECON-06 fail-closed guarantee: a single-source group's
  // agreeing_recording_ids is exactly its own lone source (never claiming
  // independent multi-source corroboration), regardless of how the
  // dissenting-detection loop above resolved (there are no other sources to
  // disagree with in a single-source group by construction).
  const finalAgreeingIds = coverage === 'single_source' ? [...sourceRecordingIds] : agreeingRecordingIds;

  return {
    event_id: group.event_id,
    organization_id: group.organization_id,
    segment_text: segmentText,
    start_time: group.start,
    end_time: group.end,
    source_recording_ids: sourceRecordingIds,
    agreeing_recording_ids: finalAgreeingIds,
    coverage,
  };
}
