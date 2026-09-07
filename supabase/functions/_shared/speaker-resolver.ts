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
 * Derives an AbsoluteInterval for a chunk given a recording's start-time
 * anchor. NOT IMPLEMENTED -- the anchor strategy (Decision A) is locked at
 * the Task 2 checkpoint; this signature exists so Plan 02 can implement
 * against a fixed call shape.
 */
export function deriveAbsoluteInterval(
  _chunk: SpeakerChunk,
  _recordingStartTime: string | null,
): AbsoluteInterval {
  throw new Error('not implemented -- Plan 02, after Task 2 locks Decision A');
}

/**
 * Propagates named/resolved identities from donor chunks onto overlapping
 * anonymous target chunks. NOT IMPLEMENTED -- see file header.
 */
export function propagateNamedLabel(_input: PropagationInput): PropagationResult[] {
  throw new Error('not implemented -- Plan 02, after Task 2 locks Decision A');
}

/**
 * Collapses a phantom over-segmented speaker pair/set into one labeled
 * source's truth when intervals corroborate. NOT IMPLEMENTED -- see file
 * header.
 */
export function collapsePhantomSpeaker(_input: ConsensusInput): ConsensusResult {
  throw new Error('not implemented -- Plan 02, after Task 2 locks Decision A');
}
