/**
 * event-resolver.ts -- Phase 31 Plan 01: pure tier-1 (deterministic, no-scoring)
 * matcher + the shadow-mode sweep that proposes merges without ever applying
 * them (SAFE-02).
 *
 * Design constraints (31-CONTEXT.md / 31-RESEARCH.md, locked):
 *   - MATCH-01: a tier-1 hit is an EXACT shared identifier match, never scored.
 *   - extractTier1Signal fails CLOSED (returns null) on any malformed/missing
 *     input and on any unexpected error -- the opposite of connector-pipeline's
 *     checkDuplicate fail-open convention. A false merge here is a
 *     data-exposure incident, not a blocked import.
 *   - Zoom's OTHER numeric-ID source_metadata field (a reusable
 *     Personal-Meeting-ID-style number, NOT a per-occurrence-stable
 *     identifier -- verified in zoom-webhook/index.ts and
 *     zoom-sync-meetings/index.ts) is NEVER read as a signal. Only the
 *     confusingly-named zoom_meeting_id key is read; despite its name it
 *     holds recording.uuid, the safe, per-occurrence-stable value -- see
 *     31-RESEARCH.md Common Pitfall 5 for the full field-naming writeup.
 *   - fireflies (fireflies_meeting_link) and read-ai (its own platform-ID
 *     field) are DELIBERATELY EXCLUDED from the tier-1 map. Sampled against
 *     real production data during this task (see 31-01-SUMMARY.md "A1/A4
 *     sampling result"): both were empirically proven to carry a reusable
 *     Zoom room/Personal-Meeting-ID number shared across many distinct,
 *     weeks-apart recurring-meeting occurrences -- the exact same
 *     false-merge risk Zoom's own reusable numeric-ID field carries (one
 *     sampled room number appeared as BOTH read-ai's platform-ID across 4+
 *     distinct read-ai rows AND embedded in a fireflies_meeting_link reused
 *     across 5 separate weekly occurrences of the same recurring meeting).
 *     Using either as a no-scoring tier-1 signal would propose merging
 *     genuinely different real-world meetings. Do not add them back without
 *     new per-occurrence-stability evidence.
 *   - runShadowSweep NEVER writes recordings.event_id or the events table,
 *     and NEVER calls the apply/reverse RPC pair (Plan 02's MATCH-10
 *     mechanism -- SAFE-02). It only proposes
 *     (INSERT ... decision='merge_proposed', applied=false), idempotently
 *     under concurrency/re-run via a plain insert call + unique_violation
 *     tolerance (Pattern 3) -- deliberately not an upsert or a raw row
 *     update, which this file's own acceptance gate greps to confirm
 *     absent, so a reviewer (or CI) can prove by inspection alone that this
 *     file cannot silently grow a write path into recordings/events.
 *
 * Deno-edge-function-safe AND Vitest-importable: the only Supabase reference
 * is a TYPE-ONLY import (erased at build time -- no runtime resolution of the
 * esm.sh URL happens under Node/Vite), mirroring
 * supabase/functions/_shared/connector-pipeline.ts's runPipeline pattern.
 * This file never constructs its own client; it always receives one.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  calculateParticipantOverlap,
  calculateTimeOverlap,
  calculateTitleSimilarity,
  MATCH_THRESHOLDS,
  normalizeParticipant,
  normalizeTitle,
} from './dedup-fingerprint.ts';

/** A recording's minimal shape needed for tier-1 matching. */
export interface Tier1Candidate {
  id: string;
  organization_id: string;
  source_app: string | null;
  source_metadata: Record<string, unknown> | null;
}

/** One proposed deterministic-tier pair, canonically ordered (a < b). */
export interface DeterministicMatch {
  recording_id_a: string;
  recording_id_b: string;
  /** Provider-prefixed signal value that produced the match, e.g. "zoom:<uuid>". */
  signal: string;
}

export interface ShadowSweepOptions {
  /** Organization IDs with the 'event_resolution' flag enabled (already resolved by the caller). */
  flaggedOrgIds: string[];
  /** Max recordings fetched per sweep tick. Default 500 -- shadow mode has no user-facing latency requirement. */
  batchSize?: number;
}

export interface ShadowSweepSummary {
  organizationsScanned: number;
  recordingsScanned: number;
  /** merge_proposed rows attempted (a re-run's unique_violation no-op still counts here). */
  proposed: number;
  /** Recordings with no tier-1 signal -- the normal case for 5 of 6 providers today, not an error. */
  skipped: number;
  errors: number;
}

/**
 * Per-provider tier-1 field extractor. Centralized here (not scattered
 * if/else branches) so Phase 32/33 can extend this one map instead of
 * re-deriving the provider survey (31-RESEARCH.md "Don't Hand-Roll").
 *
 * A provider absent from this map returns null -- the normal case for
 * fathom, grain, and plaud today (no eligible field exists in their
 * source_metadata at all), and the deliberate, evidence-based exclusion
 * for fireflies and read-ai (see file header).
 */
// Both maps below are built with Object.assign(Object.create(null), {...})
// rather than a plain object literal. A plain `{}` literal inherits
// Object.prototype, whose members (constructor, toString, valueOf,
// hasOwnProperty, __proto__, etc.) are reachable via bracket-notation
// lookup even though they're not "own" properties. If `sourceApp` /
// `provider` were ever equal to one of those names, `MAP[sourceApp]`
// would silently resolve to the inherited prototype member instead of
// `undefined` -- a content-independent, guaranteed-collision signal (see
// 31-REVIEW.md CR-01). Object.create(null) has no prototype at all, so
// there is nothing for bracket notation to walk into; only explicitly
// assigned keys are ever visible.
const TIER1_SIGNAL_EXTRACTORS: Record<
  string,
  (metadata: Record<string, unknown>) => string | null
> = Object.assign(Object.create(null), {
  zoom: (metadata: Record<string, unknown>) => {
    // recording.uuid, per-occurrence stable, stored under the (misleadingly
    // named) zoom_meeting_id key. Deliberately never reads the reusable
    // numeric/PMI-style field.
    const value = metadata['zoom_meeting_id'];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  },
});

/** Human-readable field name recorded in the ledger's signals.matched_field. */
const TIER1_MATCHED_FIELD_NAMES: Record<string, string> = Object.assign(Object.create(null), {
  zoom: 'zoom_meeting_id',
});

/**
 * Extract a provider-prefixed tier-1 candidate identifier from a recording's
 * source_metadata, or null if this provider/row has no eligible signal.
 *
 * Fails CLOSED: never throws, never returns a value for a provider without a
 * verified-safe field, never reads Zoom's reusable numeric-ID field (see file
 * header).
 */
export function extractTier1Signal(
  sourceApp: string | null | undefined,
  sourceMetadata: Record<string, unknown> | null | undefined,
): string | null {
  try {
    if (!sourceApp || typeof sourceApp !== 'string') return null;
    if (!sourceMetadata || typeof sourceMetadata !== 'object' || Array.isArray(sourceMetadata)) {
      return null;
    }

    const extractor = TIER1_SIGNAL_EXTRACTORS[sourceApp];
    if (!extractor) return null;

    const rawValue = extractor(sourceMetadata);
    if (!rawValue) return null;

    return `${sourceApp}:${rawValue}`;
  } catch (err) {
    console.error('[event-resolver] extractTier1Signal failed closed:', err);
    return null;
  }
}

/**
 * Pure, DB-free matcher: pairs same-organization candidates that share an
 * identical non-null tier-1 signal. No scoring (MATCH-01) -- a shared
 * identifier is a match, full stop. Canonically orders each pair
 * (recording_id_a < recording_id_b) to match event_match_decisions' CHECK
 * constraint and UNIQUE index.
 *
 * Same-org only this phase (cross-org matching is Phase 32/SAFE-04).
 */
export function findDeterministicMatches(candidates: Tier1Candidate[]): DeterministicMatch[] {
  const groups = new Map<string, string[]>();

  for (const candidate of candidates) {
    const signal = extractTier1Signal(candidate.source_app, candidate.source_metadata);
    if (!signal) continue;
    const key = `${candidate.organization_id}::${signal}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(candidate.id);
    else groups.set(key, [candidate.id]);
  }

  const matches: DeterministicMatch[] = [];
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue;
    const signal = key.slice(key.indexOf('::') + 2);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = ids[i] < ids[j] ? [ids[i], ids[j]] : [ids[j], ids[i]];
        matches.push({ recording_id_a: a, recording_id_b: b, signal });
      }
    }
  }

  return matches;
}

/** Postgres unique_violation, surfaced by PostgREST as error.code === '23505'. */
function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '23505' ||
    error.message?.includes('duplicate key value violates unique constraint') === true
  );
}

/**
 * Shadow-mode sweep (SAFE-02): computes and RECORDS proposed deterministic
 * merges for the given flagged organizations, but NEVER applies them.
 *
 * Never writes recordings.event_id or the events table. Never calls the
 * apply/reverse RPC pair (that mechanism is built and proven separately,
 * Plan 02 -- this function must not know it exists). On any
 * query/extraction error, fails CLOSED: skips, writes nothing for the
 * failed item, logs, and continues with the rest of the batch.
 */
export async function runShadowSweep(
  supabase: SupabaseClient,
  opts: ShadowSweepOptions,
): Promise<ShadowSweepSummary> {
  const batchSize = opts.batchSize ?? 500;
  const summary: ShadowSweepSummary = {
    organizationsScanned: opts.flaggedOrgIds.length,
    recordingsScanned: 0,
    proposed: 0,
    skipped: 0,
    errors: 0,
  };

  if (opts.flaggedOrgIds.length === 0) {
    return summary;
  }

  try {
    // Single driving fetch: recordings not yet resolved, in a flagged org,
    // oldest first. Today (Phase 31) this set IS the full comparison pool --
    // recordings.event_id is never written by ANY code path yet (Phase 30's
    // invariant, preserved here), so "unresolved" and "every recording in
    // the org" are the same set at runtime. Once Phase 32/33 wire the apply
    // RPC and event_id starts getting set, this comparison pool should widen
    // to also include already-resolved recordings so a new capture of an
    // already-merged event is still found.
    const { data, error } = await supabase
      .from('recordings')
      .select('id, organization_id, source_app, source_metadata')
      .is('event_id', null)
      .in('organization_id', opts.flaggedOrgIds)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error('[event-resolver] runShadowSweep candidate fetch failed closed:', error.message);
      summary.errors++;
      return summary;
    }

    const candidates = (data ?? []) as Tier1Candidate[];
    summary.recordingsScanned = candidates.length;
    summary.skipped = candidates.filter(
      (c) => extractTier1Signal(c.source_app, c.source_metadata) === null,
    ).length;

    const matches = findDeterministicMatches(candidates);

    for (const match of matches) {
      const provider = match.signal.slice(0, match.signal.indexOf(':'));
      const matchedField = TIER1_MATCHED_FIELD_NAMES[provider] ?? provider;

      // Idempotent under concurrency/re-run (31-RESEARCH.md Pattern 3): a
      // plain insert, tolerating unique_violation on
      // (recording_id_a, recording_id_b, tier) as a benign no-op rather than
      // an error -- a repeat proposal for the same pair+tier is expected on
      // overlapping sweep ticks, not a failure.
      const { error: insertError } = await supabase.from('event_match_decisions').insert({
        recording_id_a: match.recording_id_a,
        recording_id_b: match.recording_id_b,
        tier: 'deterministic',
        score: null,
        signals: { matched_field: matchedField },
        decision: 'merge_proposed',
        decided_by: 'auto',
        applied: false,
      });

      if (insertError) {
        if (isUniqueViolation(insertError)) {
          summary.proposed++;
          continue;
        }
        console.error('[event-resolver] runShadowSweep insert failed closed:', insertError.message);
        summary.errors++;
        continue;
      }
      summary.proposed++;
    }

    return summary;
  } catch (err) {
    console.error('[event-resolver] runShadowSweep failed closed:', err);
    summary.errors++;
    return summary;
  }
}

/**
 * MATCH-05: the occurrence-count threshold at or above which a title is
 * considered "recurring" and its title-similarity signal must be suppressed
 * as match evidence (F10 finding -- `recurring_call_titles` already supplies
 * `occurrence_count` per (owner_user_id, title), provider-agnostic, no
 * migration needed to consume it).
 */
export const RECURRING_TITLE_OCCURRENCE_THRESHOLD = 3;

/**
 * Pure, DB-free predicate (mirrors extractTier1Signal's fail-closed
 * convention): should a title's similarity signal be suppressed as match
 * evidence because it recurs too often to be distinguishing?
 *
 * The metadata tier (Plan 02) supplies `occurrenceCount` from the
 * `recurring_call_titles` view -- this function never reads the DB itself.
 *
 * Fails closed toward "NOT suppressed" (returns false) for any input that
 * isn't a valid, non-negative, finite occurrence count -- null, undefined,
 * NaN, and negative values all mean "unknown/no signal," and a missing
 * occurrence count must never accidentally suppress a real match signal.
 */
export function shouldSuppressTitleSignal(
  occurrenceCount: number | null | undefined,
  threshold: number = RECURRING_TITLE_OCCURRENCE_THRESHOLD,
): boolean {
  if (typeof occurrenceCount !== 'number' || !Number.isFinite(occurrenceCount)) return false;
  if (occurrenceCount < 0) return false;
  return occurrenceCount >= threshold;
}

/**
 * ============================================================================
 * Metadata tier (Phase 32 Plan 02) -- MATCH-03, MATCH-06, MATCH-08
 * ============================================================================
 *
 * Provider-agnostic, same-org, PROPOSE-ONLY candidate matcher reading
 * recordings + call_participants (never zoom_raw_calls -- MATCH-06). Locked
 * design (32-02 Task 1, option-a, approved as-is):
 *
 *   - Signals: timeOverlap (MUST be > 0 or the pair is discarded outright,
 *     mirroring MATCH-04's hard gate on checkMatch), participantOverlap
 *     (Jaccard on normalized call_participants emails), titleSimilarity
 *     (Levenshtein via dedup-fingerprint.ts) but contributes 0 when
 *     shouldSuppressTitleSignal(occurrence_count) is true for either side of
 *     the pair (MATCH-05 reuse -- closes the same recurring-title trap here).
 *   - Score = weighted blend biased to participants+time:
 *     participant 0.45 + time 0.35 + title 0.20 (title is the F5 trap, kept
 *     deliberately minority-weight).
 *   - Asymmetric: propose ONLY when score >= MERGE_PROPOSE_THRESHOLD (0.80)
 *     AND timeOverlap > 0 AND (participantOverlap OR timeOverlap
 *     independently clears its own MATCH_THRESHOLDS bar) -- this third gate
 *     is mathematically implied by the weights+threshold already (title's
 *     max 0.20 contribution alone can never carry a pair over 0.80), but is
 *     enforced explicitly so "never propose on a suppressed-title +
 *     weak-time pair" is provable by reading the code, not just by algebra.
 *   - Every proposal carries tier:'metadata' and NEVER a decision/applied
 *     field -- those are added only by the write path
 *     (writeMetadataProposals), which hardcodes decision='merge_proposed',
 *     applied=false (MATCH-03). This tier NEVER calls
 *     the apply RPC (the one Plan 01's apply/reverse pair defined) and NEVER
 *     writes recordings.event_id.
 *
 * Pure and DB-free (like findDeterministicMatches) -- same-org pairing,
 * fail-closed on malformed rows, never throws. The DB-touching fetch that
 * builds MetadataCandidate[] and calls this function lives in
 * runShadowSweep (Task 3), not here.
 */

/**
 * A recording's shape needed for metadata-tier scoring, resolved by the
 * caller from `recordings` + `call_participants` + `recurring_call_titles`
 * (never from zoom_raw_calls -- MATCH-06's provider-agnostic seam).
 */
export interface MetadataCandidate {
  id: string;
  organization_id: string;
  owner_user_id: string | null;
  title: string | null;
  recording_start_time: string | null;
  recording_end_time: string | null;
  /** Normalized (lowercased/trimmed) participant emails resolved from call_participants for this recording. */
  participant_emails: string[];
  /** recurring_call_titles.occurrence_count for this recording's (owner_user_id, title) pair, or null if unknown. */
  occurrence_count: number | null;
}

/** One proposed metadata-tier pair, canonically ordered (a < b). Carries no decision/applied intent -- write-time only. */
export interface MetadataMatch {
  recording_id_a: string;
  recording_id_b: string;
  tier: 'metadata';
  /** 0..1 weighted blend score. */
  score: number;
  signals: {
    time_overlap: number;
    participant_overlap: number;
    /** Raw title similarity, BEFORE suppression is applied (for audit/debugging in the ledger's signals column). */
    title_similarity: number;
    /** Whether shouldSuppressTitleSignal fired for either side of the pair -- if true, title contributed 0 to score. */
    title_suppressed: boolean;
  };
}

export interface MetadataTierWeights {
  participant: number;
  time: number;
  title: number;
}

export interface MetadataTierThresholds {
  mergeProposeThreshold: number;
  weights: MetadataTierWeights;
}

/** Locked weights (32-02 Task 1, option-a): participants + time dominate, title is minority-weight (the F5 trap). */
export const METADATA_TIER_WEIGHTS: MetadataTierWeights = {
  participant: 0.45,
  time: 0.35,
  title: 0.20,
};

/** Locked asymmetric high bar to propose (32-02 Task 1, option-a). A false merge is a data-exposure incident. */
export const MERGE_PROPOSE_THRESHOLD = 0.80;

export interface FindMetadataCandidatesOptions {
  thresholds?: Partial<MetadataTierThresholds>;
}

function parseValidTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Fails closed: anything not a well-formed candidate (missing id/org, non-array participants, missing/invalid/inverted times) is rejected, never throws. */
function isValidMetadataCandidate(c: unknown): c is MetadataCandidate {
  if (!c || typeof c !== 'object') return false;
  const candidate = c as Partial<MetadataCandidate>;
  if (typeof candidate.id !== 'string' || candidate.id.length === 0) return false;
  if (typeof candidate.organization_id !== 'string' || candidate.organization_id.length === 0) return false;
  if (!Array.isArray(candidate.participant_emails)) return false;
  const start = parseValidTimestamp(candidate.recording_start_time ?? null);
  const end = parseValidTimestamp(candidate.recording_end_time ?? null);
  if (start === null || end === null || end < start) return false;
  return true;
}

/** Scores one same-org pair. Returns null if the pair fails the nonzero-time gate or doesn't clear the asymmetric propose bar. */
function scoreMetadataPair(
  a: MetadataCandidate,
  b: MetadataCandidate,
  weights: MetadataTierWeights,
  mergeProposeThreshold: number,
): MetadataMatch | null {
  const startA = new Date(a.recording_start_time as string).getTime();
  const endA = new Date(a.recording_end_time as string).getTime();
  const startB = new Date(b.recording_start_time as string).getTime();
  const endB = new Date(b.recording_end_time as string).getTime();

  const durationMinutesA = (endA - startA) / 60000;
  const durationMinutesB = (endB - startB) / 60000;

  const timeOverlap = calculateTimeOverlap(
    a.recording_start_time as string,
    durationMinutesA,
    b.recording_start_time as string,
    durationMinutesB,
  );

  // MATCH-04-mirrored hard gate: a pair with zero real time overlap is
  // discarded outright, never scored/proposed, regardless of how strong the
  // other two signals are.
  if (timeOverlap <= 0) return null;

  const emailsA = (a.participant_emails ?? []).map(normalizeParticipant).filter((e) => e.length > 0);
  const emailsB = (b.participant_emails ?? []).map(normalizeParticipant).filter((e) => e.length > 0);
  const participantOverlap = calculateParticipantOverlap(emailsA, emailsB);

  // MATCH-05 reuse: suppress the title signal for this pair if EITHER side's
  // (owner,title) recurs too often to be distinguishing -- the exact
  // recurring-meeting trap F5 exploited, closed here too.
  const titleSuppressed = shouldSuppressTitleSignal(a.occurrence_count) || shouldSuppressTitleSignal(b.occurrence_count);
  const rawTitleSimilarity =
    a.title && b.title ? calculateTitleSimilarity(normalizeTitle(a.title), normalizeTitle(b.title)) : 0;
  const titleContribution = titleSuppressed ? 0 : rawTitleSimilarity;

  const score =
    participantOverlap * weights.participant +
    timeOverlap * weights.time +
    titleContribution * weights.title;

  // Explicit, provable-by-reading defense-in-depth: at least one of
  // participant/time must independently clear its own established
  // MATCH_THRESHOLDS bar. Mathematically implied by the weights already
  // (title's max 0.20 alone can never carry score to 0.80), but stated
  // explicitly so "never propose on a suppressed-title + weak-time pair" is
  // a readable invariant, not an inferred one.
  const independentlyStrong =
    participantOverlap >= MATCH_THRESHOLDS.participant_overlap || timeOverlap >= MATCH_THRESHOLDS.time_overlap;

  if (score < mergeProposeThreshold || !independentlyStrong) return null;

  const [recording_id_a, recording_id_b] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];

  return {
    recording_id_a,
    recording_id_b,
    tier: 'metadata',
    score,
    signals: {
      time_overlap: timeOverlap,
      participant_overlap: participantOverlap,
      title_similarity: rawTitleSimilarity,
      title_suppressed: titleSuppressed,
    },
  };
}

/**
 * Pure, DB-free metadata-tier matcher (MATCH-03/MATCH-06/MATCH-08): pairs
 * same-organization candidates (defense-in-depth to RLS, mirrors
 * findDeterministicMatches), scores each pair on time/participant/
 * suppressed-title signals, and emits a MetadataMatch ONLY when the
 * asymmetric propose bar is cleared. Never throws -- malformed candidate
 * rows are skipped, not fatal.
 */
export function findMetadataCandidates(
  candidates: MetadataCandidate[],
  opts?: FindMetadataCandidatesOptions,
): MetadataMatch[] {
  try {
    const weights: MetadataTierWeights = { ...METADATA_TIER_WEIGHTS, ...(opts?.thresholds?.weights ?? {}) };
    const mergeProposeThreshold = opts?.thresholds?.mergeProposeThreshold ?? MERGE_PROPOSE_THRESHOLD;

    const valid = (Array.isArray(candidates) ? candidates : []).filter((c) => {
      try {
        return isValidMetadataCandidate(c);
      } catch {
        return false;
      }
    });

    // Same-org-only pairing: cross-org candidates are never even grouped
    // together, so a cross-org pair can never be scored, let alone proposed
    // (MATCH-06/SAFE-04 defense-in-depth).
    const byOrg = new Map<string, MetadataCandidate[]>();
    for (const c of valid) {
      const bucket = byOrg.get(c.organization_id);
      if (bucket) bucket.push(c);
      else byOrg.set(c.organization_id, [c]);
    }

    const matches: MetadataMatch[] = [];
    for (const bucket of byOrg.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          try {
            const match = scoreMetadataPair(bucket[i], bucket[j], weights, mergeProposeThreshold);
            if (match) matches.push(match);
          } catch (err) {
            console.error('[event-resolver] findMetadataCandidates pair scoring failed closed:', err);
          }
        }
      }
    }

    return matches;
  } catch (err) {
    console.error('[event-resolver] findMetadataCandidates failed closed:', err);
    return [];
  }
}

/**
 * Metadata-tier propose-only write (MATCH-03): inserts each MetadataMatch as
 * a tier='metadata' merge_proposed row. Idempotent under concurrency
 * (Pattern 3 -- plain insert + unique_violation tolerance), the SAME idiom
 * runShadowSweep already uses for tier-1. NEVER an upsert or a raw row
 * mutation -- overwriting here could silently clobber a prior human/admin
 * decision on this pair. Never calls the apply RPC and never writes
 * recordings.event_id -- this tier only ever proposes.
 */
async function writeMetadataProposals(
  supabase: SupabaseClient,
  matches: MetadataMatch[],
): Promise<{ proposed: number; errors: number }> {
  let proposed = 0;
  let errors = 0;

  for (const match of matches) {
    const { error: insertError } = await supabase.from('event_match_decisions').insert({
      recording_id_a: match.recording_id_a,
      recording_id_b: match.recording_id_b,
      tier: 'metadata',
      score: match.score,
      signals: match.signals,
      decision: 'merge_proposed',
      decided_by: 'auto',
      applied: false,
    });

    if (insertError) {
      if (isUniqueViolation(insertError)) {
        proposed++;
        continue;
      }
      console.error('[event-resolver] writeMetadataProposals insert failed closed:', insertError.message);
      errors++;
      continue;
    }
    proposed++;
  }

  return { proposed, errors };
}
