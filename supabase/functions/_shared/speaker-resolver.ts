/**
 * speaker-resolver.ts -- Phase 35 Plan 01: contract types only.
 *
 * IDENT-04 (timeline-alignment propagation) and IDENT-05 (over-segmentation
 * consensus collapse) implementations land in Plan 02, AFTER the Task 2
 * checkpoint locks the two one-way-door decisions this plan's live
 * introspection feeds:
 *
 *   (A) the cross-recording time-origin alignment anchor -- see
 *       35-DESIGN-NOTES.md Finding 1 (recording_start_time: real,
 *       timestamptz, but prod fill-rate not independently reconfirmed this
 *       session) and Finding 3 (canonical-recording.ts's numeric
 *       startSeconds does NOT survive to persisted transcript_chunks --
 *       ruled out as an anchor this phase).
 *   (B) the write-target for resolved speaker names (identity_aliases
 *       evidence vs. a new speaker_resolution_decisions ledger).
 *
 * This file intentionally contains NO scoring/matching logic -- only the
 * shapes those functions will consume/produce, so Plan 02 can be written
 * against fixed types. Every exported function throws 'not implemented';
 * they exist solely so the file's call-shape compiles and is importable.
 *
 * Non-linking guarantee (mirrors supabase/functions/_shared/
 * identity-resolver.ts's DisplayNameCandidate pattern, Phase 34): the
 * "stay unresolved" outcome is pinned as a LITERAL type
 * (`identity_id: null`, `resolved: false`), not merely a runtime
 * convention -- see UnresolvedSpeaker below.
 *
 * No DB access in this file (mirrors event-resolver.ts / identity-resolver.ts's
 * pure-functions style).
 */

/**
 * A single transcript_chunks row's minimal shape needed for cross-recording
 * alignment and consensus. Mirrors the live, confirmed schema (see
 * 35-DESIGN-NOTES.md Finding 2) -- timestamp_start/timestamp_end are
 * nullable free-text ("HH:MM:SS"), NOT typed/enforced, and are
 * capture-relative offsets (not directly comparable across recordings
 * without deriving a shared origin -- Pitfall 2, 35-RESEARCH.md).
 */
export interface SpeakerChunk {
  canonical_recording_id: string;
  chunk_index: number;
  speaker_name: string | null;
  speaker_email: string | null;
  /** Capture-relative offset, "HH:MM:SS" TEXT, nullable. Never assume a fixed format at runtime. */
  timestamp_start: string | null;
  /** Capture-relative offset, "HH:MM:SS" TEXT, nullable. */
  timestamp_end: string | null;
  /**
   * Resolved identity for this chunk's speaker, if already known (e.g. via
   * call_participants.identity_id or a verified identity_aliases match).
   * NEVER set this from a bare speaker_name string match alone -- Pitfall 3.
   */
  identity_id: string | null;
}

/**
 * A chunk's derived absolute instant, keyed off whichever anchor Task 2
 * locks (recording_start_time + parsed timestamp_start, per Decision A1 --
 * or left unimplemented if A2's coarse fallback is chosen instead). This
 * type exists so downstream interval-overlap comparisons never operate on
 * raw offset strings directly (Pitfall 2).
 */
export interface AbsoluteInterval {
  canonical_recording_id: string;
  chunk_index: number;
  /** Derived absolute start instant (ISO-8601), or null if the anchor could not be derived for this chunk (e.g. recording_start_time was null). */
  start: string | null;
  /** Derived absolute end instant (ISO-8601), or null under the same fail-closed condition. */
  end: string | null;
}

/**
 * A candidate donor for name propagation: a chunk whose speaker already
 * carries a resolved identity_id or a verified alias. Deliberately does
 * NOT accept a bare speaker_name string as sufficient corroboration --
 * Pitfall 3 / IDENT-02's precedent. A caller with only a display-name
 * string and no identity_id/verified alias has no eligible donor and must
 * not construct this type.
 */
export interface PropagationDonor {
  identity_id: string;
  /** True only when identity_id came from a verified alias/participant match, never a bare name-similarity guess. */
  verified: true;
  source_canonical_recording_id: string;
  source_chunk_index: number;
  interval: AbsoluteInterval;
}

/** Input to the (Plan 02) propagation function: one event's chunks across >=2 recordings, plus known donors. */
export interface PropagationInput {
  event_id: string;
  organization_id: string;
  donors: PropagationDonor[];
  /** Anonymous-labeled chunks eligible to receive a propagated identity. */
  targets: SpeakerChunk[];
  /**
   * canonical_recording_id -> recording_start_time (nullable ISO
   * timestamptz), needed to derive each target's AbsoluteInterval via
   * deriveAbsoluteInterval (Decision A1). Plan 02 addition (Rule 2): Plan
   * 01's PropagationInput didn't carry this, but targets are raw
   * SpeakerChunk[] (capture-relative offsets) and cannot be compared for
   * overlap without it -- omitting it would make the locked propagation
   * behavior structurally impossible to implement.
   */
  recordingStartTimes: Record<string, string | null>;
}

/** A successful propagation outcome: an anonymous chunk resolved via an overlapping, verified donor interval. */
export interface PropagatedResolution {
  canonical_recording_id: string;
  chunk_index: number;
  identity_id: string;
  /** Provenance: which donor chunk/recording supplied this identity. */
  donor: Pick<PropagationDonor, 'source_canonical_recording_id' | 'source_chunk_index'>;
  confidence: number;
}

/**
 * A speaker/chunk that could NOT be resolved -- structurally incapable of
 * carrying an identity_id, mirroring identity-resolver.ts's
 * DisplayNameCandidate literal-type guarantee. This is Success Criterion 3
 * ("speakers with no calendar data, no attendee list, and only anonymous
 * diarization stay unresolved") enforced at the type level, not just by
 * convention.
 */
export interface UnresolvedSpeaker {
  canonical_recording_id: string;
  chunk_index: number;
  identity_id: null;
  resolved: false;
  /** Why this chunk could not be resolved (no overlapping donor, ambiguous overlap, etc.) -- diagnostic only, never a partial resolution. */
  reason: 'no_overlapping_donor' | 'ambiguous_overlap' | 'anchor_unavailable';
}

/** Discriminated result of resolving one target chunk: either propagated, or structurally unresolved. Never both. */
export type PropagationResult = PropagatedResolution | UnresolvedSpeaker;

/**
 * Input to the (Plan 02) consensus/collapse function: one labeled source's
 * single spanning interval vs. another source's candidate split pair, for
 * one event.
 */
export interface ConsensusCandidate {
  canonical_recording_id: string;
  chunk_indices: number[];
  identity_id: string | null;
  interval: AbsoluteInterval;
}

export interface ConsensusInput {
  event_id: string;
  organization_id: string;
  /** The source believed to hold ground truth (single, labeled span). */
  labeled: ConsensusCandidate;
  /** The candidate over-segmented pair/set from another source, believed to be a phantom split of `labeled`. */
  candidateSplit: ConsensusCandidate[];
}

/** A successful consensus collapse: candidateSplit chunks are attributed to `labeled`'s identity_id. */
export interface ConsensusCollapse {
  event_id: string;
  collapsed_into_identity_id: string;
  collapsed_chunks: Array<Pick<ConsensusCandidate, 'canonical_recording_id' | 'chunk_indices'>>;
  confidence: number;
}

/**
 * Discriminated result of a consensus attempt: either a collapse, or a
 * structural refusal to collapse (sources disagree -- never force a merge
 * on ambiguous/conflicting evidence, per the milestone's asymmetric-threshold
 * philosophy, MATCH-08, applied by extension here).
 */
export interface ConsensusRefusal {
  event_id: string;
  collapsed: false;
  reason: 'disagreement' | 'insufficient_overlap' | 'anchor_unavailable';
}

export type ConsensusResult = ConsensusCollapse | ConsensusRefusal;

/**
 * Cross-recording clock-drift tolerance buffer (Plan 01's locked
 * refinement, 35-01-SUMMARY.md, Andrew's explicit request): two intervals
 * separated by a gap <= this many ms are still treated as overlapping,
 * because different recording tools' own system clocks (e.g. Zoom's
 * server clock vs. a Plaud device's local clock) can disagree by several
 * seconds even for genuinely simultaneous speech.
 *
 * Chosen: 20_000ms (20s) -- the midpoint of Andrew's requested 15-30s
 * range. 20s comfortably absorbs typical consumer-device clock drift
 * while staying tight enough that two real, separately-timed speaker
 * turns (e.g. 60s+ apart, this suite's overlap-adversarial fixture) are
 * never falsely merged.
 */
export const CLOCK_DRIFT_TOLERANCE_MS = 20_000;

/** Parses a capture-relative "HH:MM:SS" offset into milliseconds. Returns null for anything malformed -- never guesses (Pitfall 2). */
function parseOffsetToMs(offset: string | null): number | null {
  if (!offset) return null;
  const match = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(offset.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  const hours = Number(h);
  const minutes = Number(m);
  const seconds = Number(s);
  if (minutes > 59 || seconds > 59) return null;
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/** Parses an ISO-8601 timestamptz into epoch ms. Returns null on anything invalid -- never guesses. */
function parseIsoToMs(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Derives an AbsoluteInterval for a chunk given a recording's start-time
 * anchor (Decision A1, locked 35-01-SUMMARY.md: recording_start_time +
 * parsed timestamp_start/timestamp_end). Fails closed to null start/end
 * (never a guessed anchor) when the recording start time or either offset
 * is missing/malformed.
 */
export function deriveAbsoluteInterval(
  chunk: SpeakerChunk,
  recordingStartTime: string | null,
): AbsoluteInterval {
  const anchorMs = parseIsoToMs(recordingStartTime);
  const startOffsetMs = parseOffsetToMs(chunk.timestamp_start);
  const endOffsetMs = parseOffsetToMs(chunk.timestamp_end);

  const start = anchorMs !== null && startOffsetMs !== null ? new Date(anchorMs + startOffsetMs).toISOString() : null;
  const end = anchorMs !== null && endOffsetMs !== null ? new Date(anchorMs + endOffsetMs).toISOString() : null;

  return {
    canonical_recording_id: chunk.canonical_recording_id,
    chunk_index: chunk.chunk_index,
    start,
    end,
  };
}

/**
 * Gap in ms between two intervals -- 0 if they genuinely overlap,
 * otherwise the positive distance between the nearer edges. Mirrors
 * event-resolver.ts's isSpeakerAlibiViolation disjoint-check shape
 * (`endA <= startB || endB <= startA`), extended to return a magnitude
 * instead of a boolean so the clock-drift tolerance buffer can be applied.
 */
function intervalGapMs(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number): number {
  if (aEndMs <= bStartMs) return bStartMs - aEndMs;
  if (bEndMs <= aStartMs) return aStartMs - bEndMs;
  return 0;
}

/**
 * True if two AbsoluteIntervals overlap, or are within the clock-drift
 * tolerance buffer of overlapping. Fails closed (false) on any
 * unparseable/null edge.
 *
 * Exported additively (Phase 37 Plan 02): transcript-reconciler.ts's
 * alignChunksToTimeline() needs this exact overlap-with-tolerance predicate
 * for arbitrary pairwise chunk-group merging, not just the donor/target or
 * labeled/candidateSplit shapes this file's own callers use it for. No
 * behavior change -- same function, now importable.
 */
export function intervalsOverlapWithTolerance(a: AbsoluteInterval, b: AbsoluteInterval, toleranceMs: number): boolean {
  const aStartMs = parseIsoToMs(a.start);
  const aEndMs = parseIsoToMs(a.end);
  const bStartMs = parseIsoToMs(b.start);
  const bEndMs = parseIsoToMs(b.end);
  if (aStartMs === null || aEndMs === null || bStartMs === null || bEndMs === null) return false;
  return intervalGapMs(aStartMs, aEndMs, bStartMs, bEndMs) <= toleranceMs;
}

/** Confidence score for a propagation/collapse decision: 1.0 for a genuine overlap, decaying toward 0.75 as the gap approaches the tolerance buffer's edge. Never below 0.75 for an accepted match (accepted matches are, by definition, within tolerance). */
function confidenceForGap(gapMs: number, toleranceMs: number): number {
  const ratio = toleranceMs === 0 ? 0 : Math.min(gapMs, toleranceMs) / toleranceMs;
  return Number((1 - ratio * 0.25).toFixed(2));
}

/** One event's chunks, tagged with derived AbsoluteInterval + event/org scope, for downstream propagation/collapse pairing. */
export interface AlignmentInput {
  event_id: string;
  organization_id: string;
  chunks: SpeakerChunk[];
  /** canonical_recording_id -> recording_start_time (nullable ISO), one entry per recording referenced in `chunks`. */
  recordingStartTimes: Record<string, string | null>;
}

export interface AlignedChunk {
  event_id: string;
  organization_id: string;
  canonical_recording_id: string;
  chunk_index: number;
  speaker_name: string | null;
  speaker_email: string | null;
  identity_id: string | null;
  interval: AbsoluteInterval;
}

/**
 * Derives each chunk's AbsoluteInterval and tags it with the event/org
 * scope already fixed by the input (single event, single org per call --
 * this is the SAFE-04 same-org bucketing guarantee: callers must bucket by
 * organization_id BEFORE constructing this input, so no cross-org pairing
 * is structurally possible downstream).
 */
export function alignChunksAcrossRecordings(input: AlignmentInput): AlignedChunk[] {
  return input.chunks.map((chunk) => ({
    event_id: input.event_id,
    organization_id: input.organization_id,
    canonical_recording_id: chunk.canonical_recording_id,
    chunk_index: chunk.chunk_index,
    speaker_name: chunk.speaker_name,
    speaker_email: chunk.speaker_email,
    identity_id: chunk.identity_id,
    interval: deriveAbsoluteInterval(chunk, input.recordingStartTimes[chunk.canonical_recording_id] ?? null),
  }));
}

/**
 * Propagates named/resolved identities from donor chunks onto overlapping
 * anonymous target chunks. Fails closed to the literal UnresolvedSpeaker
 * shape whenever no eligible donor's interval overlaps (within the
 * clock-drift tolerance buffer) -- NEVER falls back to speaker_name string
 * matching (Pitfall 3 / T-35-03).
 */
export function propagateNamedLabel(input: PropagationInput): PropagationResult[] {
  return input.targets.map((target) => {
    const targetInterval = deriveAbsoluteInterval(target, input.recordingStartTimes[target.canonical_recording_id] ?? null);

    if (targetInterval.start === null || targetInterval.end === null) {
      return {
        canonical_recording_id: target.canonical_recording_id,
        chunk_index: target.chunk_index,
        identity_id: null,
        resolved: false,
        reason: 'anchor_unavailable',
      } satisfies UnresolvedSpeaker;
    }

    let best: { donor: PropagationDonor; gapMs: number } | null = null;
    for (const donor of input.donors) {
      // Structural guard mirroring the type contract: a donor without a
      // resolved, verified identity_id is never eligible (Pitfall 3).
      if (!donor.identity_id || donor.verified !== true) continue;
      if (donor.interval.start === null || donor.interval.end === null) continue;
      if (!intervalsOverlapWithTolerance(donor.interval, targetInterval, CLOCK_DRIFT_TOLERANCE_MS)) continue;

      const gapMs = intervalGapMs(
        parseIsoToMs(donor.interval.start)!,
        parseIsoToMs(donor.interval.end)!,
        parseIsoToMs(targetInterval.start)!,
        parseIsoToMs(targetInterval.end)!,
      );
      if (!best || gapMs < best.gapMs) best = { donor, gapMs };
    }

    if (!best) {
      return {
        canonical_recording_id: target.canonical_recording_id,
        chunk_index: target.chunk_index,
        identity_id: null,
        resolved: false,
        reason: 'no_overlapping_donor',
      } satisfies UnresolvedSpeaker;
    }

    return {
      canonical_recording_id: target.canonical_recording_id,
      chunk_index: target.chunk_index,
      identity_id: best.donor.identity_id,
      donor: {
        source_canonical_recording_id: best.donor.source_canonical_recording_id,
        source_chunk_index: best.donor.source_chunk_index,
      },
      confidence: confidenceForGap(best.gapMs, CLOCK_DRIFT_TOLERANCE_MS),
    } satisfies PropagatedResolution;
  });
}

/**
 * Collapses a phantom over-segmented speaker pair/set into one labeled
 * source's truth ONLY when every candidateSplit interval is subsumed
 * (within the clock-drift tolerance buffer) by the labeled source's single
 * span. Fails closed to a structural refusal ('disagreement') the moment
 * any candidateSplit chunk falls outside that span -- that's the signature
 * of a genuinely different, real second speaker, not a diarization
 * over-segmentation artifact (T-35-04).
 */
export function collapsePhantomSpeaker(input: ConsensusInput): ConsensusResult {
  const { labeled, candidateSplit } = input;

  if (!labeled.identity_id) {
    return { event_id: input.event_id, collapsed: false, reason: 'anchor_unavailable' };
  }
  if (labeled.interval.start === null || labeled.interval.end === null) {
    return { event_id: input.event_id, collapsed: false, reason: 'anchor_unavailable' };
  }
  if (candidateSplit.length === 0) {
    return { event_id: input.event_id, collapsed: false, reason: 'insufficient_overlap' };
  }

  const labeledStartMs = parseIsoToMs(labeled.interval.start)!;
  const labeledEndMs = parseIsoToMs(labeled.interval.end)!;
  const labeledSpanExpandedStart = labeledStartMs - CLOCK_DRIFT_TOLERANCE_MS;
  const labeledSpanExpandedEnd = labeledEndMs + CLOCK_DRIFT_TOLERANCE_MS;

  let maxGapMs = 0;
  for (const candidate of candidateSplit) {
    const cStartMs = parseIsoToMs(candidate.interval.start);
    const cEndMs = parseIsoToMs(candidate.interval.end);
    if (cStartMs === null || cEndMs === null) {
      return { event_id: input.event_id, collapsed: false, reason: 'anchor_unavailable' };
    }
    // Subsumption: the candidate's whole span must fall within the
    // labeled source's span (expanded by the tolerance buffer). Any
    // spillover outside that expanded window means this chunk reflects
    // real speech the labeled source's single continuous speaker could
    // not have produced -- refuse, don't force a merge.
    if (cStartMs < labeledSpanExpandedStart || cEndMs > labeledSpanExpandedEnd) {
      return { event_id: input.event_id, collapsed: false, reason: 'disagreement' };
    }
    const overshootStart = Math.max(0, labeledStartMs - cStartMs);
    const overshootEnd = Math.max(0, cEndMs - labeledEndMs);
    maxGapMs = Math.max(maxGapMs, overshootStart, overshootEnd);
  }

  return {
    event_id: input.event_id,
    collapsed_into_identity_id: labeled.identity_id,
    collapsed_chunks: candidateSplit.map((c) => ({
      canonical_recording_id: c.canonical_recording_id,
      chunk_indices: c.chunk_indices,
    })),
    confidence: confidenceForGap(maxGapMs, CLOCK_DRIFT_TOLERANCE_MS),
  } satisfies ConsensusCollapse;
}
