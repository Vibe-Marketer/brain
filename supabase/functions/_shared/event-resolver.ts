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
  /** Tier-1 (deterministic) merge_proposed rows attempted (a re-run's unique_violation no-op still counts here). */
  proposed: number;
  /**
   * Tier-3 (metadata, Phase 32 Plan 02, MATCH-06) merge_proposed rows
   * attempted -- same unique_violation-tolerant counting as `proposed`.
   * Provider-agnostic: reads recordings + call_participants, never the
   * legacy Zoom-only raw-calls table. Always propose-only (MATCH-03).
   */
  metadataProposed: number;
  /**
   * Content-proof (Phase 33 Plan 02, MATCH-02) merge_proposed rows
   * attempted -- same unique_violation-tolerant counting as `proposed`/
   * `metadataProposed`. Always propose-only in the sweep: the auto-attach
   * CAPABILITY (apply_event_match_atomic with p_tier='content_proof') is
   * proven separately, by a direct integration-test RPC call only -- never
   * called from here (SAFE-02).
   */
  contentProofProposed: number;
  /**
   * Candidate pairs vetoed by the speaker-alibi constraint (Phase 33 Plan
   * 02, MATCH-07), across ANY tier (deterministic, content-proof,
   * metadata) -- incremented in place of writing a proposal row (33-01
   * Task 1 option-a: a violation silently skips the write, no 'rejected'
   * ledger row this phase).
   */
  alibiRejected: number;
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

/** Recording row shape driving BOTH the tier-1 and metadata-tier passes of one sweep tick. */
interface ShadowSweepCandidate extends Tier1Candidate {
  owner_user_id: string | null;
  title: string | null;
  recording_start_time: string | null;
  recording_end_time: string | null;
}

/**
 * Shadow-mode sweep (SAFE-02): computes and RECORDS proposed deterministic
 * (tier-1) AND metadata-tier (Phase 32 Plan 02, MATCH-06) merges for the
 * given flagged organizations, but NEVER applies either. The metadata tier
 * is provider-agnostic by construction -- it reads `recordings` +
 * `call_participants` + `recurring_call_titles`, never the legacy Zoom-only
 * raw-calls table (the old Zoom-only path stays live and untouched
 * elsewhere).
 *
 * Never writes recordings.event_id or the events table. Never calls the
 * apply/reverse RPC pair (that mechanism is built and proven separately --
 * this function must not know it exists). On any query/extraction error,
 * fails CLOSED: skips, writes nothing for the failed item, logs, and
 * continues with the rest of the batch. The metadata tier's own fetch/write
 * errors are isolated from tier-1's -- a metadata-tier failure never unwinds
 * or blocks tier-1's already-attempted proposals in the same tick.
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
    metadataProposed: 0,
    contentProofProposed: 0,
    alibiRejected: 0,
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
    // already-merged event is still found. Columns extended (Phase 32 Plan
    // 02) to also drive the metadata tier from this SAME fetch -- no second
    // recordings query needed.
    const { data, error } = await supabase
      .from('recordings')
      .select(
        'id, organization_id, owner_user_id, title, source_app, source_metadata, recording_start_time, recording_end_time',
      )
      .is('event_id', null)
      .in('organization_id', opts.flaggedOrgIds)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (error) {
      console.error('[event-resolver] runShadowSweep candidate fetch failed closed:', error.message);
      summary.errors++;
      return summary;
    }

    const candidates = (data ?? []) as ShadowSweepCandidate[];
    summary.recordingsScanned = candidates.length;
    summary.skipped = candidates.filter(
      (c) => extractTier1Signal(c.source_app, c.source_metadata) === null,
    ).length;

    // ---- Speaker-alibi lookup (Phase 33 Plan 02, MATCH-07) ----
    // Hoisted ONCE, before any tier's write path, from the SAME candidate
    // batch fetched above. A separate, purpose-built fetch reading only
    // (recording_id, email, has_confirmed_speech) -- distinct from the
    // metadata tier's own call_participants fetch below (which reads `name`
    // for its own scoring and is left untouched). Checked before every
    // tier's write (tier-1, content-proof, metadata) via isAlibiVetoed
    // (33-01 Task 1 option-a: a violation silently skips the write, no
    // 'rejected' ledger row this phase).
    //
    // Fails closed TOWARD NOT VETOING: on a fetch error, or for any
    // recording missing from the lookup (no valid start/end, or simply
    // absent), isAlibiVetoed returns false -- an empty/partial lookup can
    // only ever ADD a rejection on positive evidence already fetched, never
    // silently block a genuine merge because of a data problem.
    const alibiLookup = new Map<string, AlibiCandidate>();
    {
      const alibiRecordingIds = candidates.map((c) => c.id);
      if (alibiRecordingIds.length > 0) {
        try {
          const alibiParticipantsResult = await supabase
            .from('call_participants')
            .select('recording_id, email, has_confirmed_speech')
            .in('recording_id', alibiRecordingIds);

          if (alibiParticipantsResult.error) {
            console.error(
              '[event-resolver] runShadowSweep alibi participants fetch failed closed:',
              alibiParticipantsResult.error.message,
            );
            summary.errors++;
          } else {
            const alibiParticipantsByRecording = new Map<string, AlibiParticipant[]>();
            for (const row of (alibiParticipantsResult.data ?? []) as {
              recording_id: string;
              email: string | null;
              has_confirmed_speech: boolean | null;
            }[]) {
              if (!row.email) continue;
              const participant: AlibiParticipant = {
                email: row.email,
                has_confirmed_speech: row.has_confirmed_speech,
              };
              const bucket = alibiParticipantsByRecording.get(row.recording_id);
              if (bucket) bucket.push(participant);
              else alibiParticipantsByRecording.set(row.recording_id, [participant]);
            }

            for (const c of candidates) {
              if (!c.recording_start_time || !c.recording_end_time) continue;
              alibiLookup.set(c.id, {
                start: c.recording_start_time,
                end: c.recording_end_time,
                participants: alibiParticipantsByRecording.get(c.id) ?? [],
              });
            }
          }
        } catch (err) {
          console.error('[event-resolver] runShadowSweep alibi lookup failed closed:', err);
          summary.errors++;
        }
      }
    }

    /** True if either side is missing from the lookup (fail closed toward NOT vetoing) or isSpeakerAlibiViolation fires. */
    const isAlibiVetoed = (recordingIdA: string, recordingIdB: string): boolean => {
      const a = alibiLookup.get(recordingIdA);
      const b = alibiLookup.get(recordingIdB);
      if (!a || !b) return false;
      return isSpeakerAlibiViolation(a, b);
    };

    const matches = findDeterministicMatches(candidates);

    for (const match of matches) {
      if (isAlibiVetoed(match.recording_id_a, match.recording_id_b)) {
        summary.alibiRejected++;
        continue;
      }

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

    // ---- Content-proof tier (Phase 33 Plan 02, MATCH-02) ----
    // Rare-shingle transcript-overlap pass over the SAME candidate batch
    // fetched above. Isolated in its own try/catch: a failure here fails
    // closed (log, count an error) without touching tier-1's already-written
    // proposals above, and without blocking the metadata tier below.
    // PROPOSE-ONLY (33-01 Task 1 option-a): this pass NEVER calls
    // apply_event_match_atomic and NEVER writes recordings.event_id -- the
    // auto-attach CAPABILITY is proven separately, only by a direct
    // integration-test RPC call (SAFE-02).
    try {
      const contentProofRecordingIds = candidates.map((c) => c.id);

      if (contentProofRecordingIds.length > 0) {
        // transcript_chunks has no live writer today (33-RESEARCH.md
        // Pitfall 1) -- the dominant real-world outcome of this fetch is
        // ZERO rows, which must fall through to the metadata tier with no
        // error (Success Criterion 3), not an edge case to special-case.
        const chunksResult = await supabase
          .from('transcript_chunks')
          .select('canonical_recording_id, chunk_index, chunk_text')
          .in('canonical_recording_id', contentProofRecordingIds);

        if (chunksResult.error) {
          console.error(
            '[event-resolver] runShadowSweep transcript_chunks fetch failed closed:',
            chunksResult.error.message,
          );
          summary.errors++;
        } else {
          const chunksByRecording = new Map<string, ContentProofChunk[]>();
          for (const row of (chunksResult.data ?? []) as {
            canonical_recording_id: string | null;
            chunk_index: number;
            chunk_text: string | null;
          }[]) {
            if (!row.canonical_recording_id) continue;
            const chunk: ContentProofChunk = { chunk_index: row.chunk_index, chunk_text: row.chunk_text };
            const bucket = chunksByRecording.get(row.canonical_recording_id);
            if (bucket) bucket.push(chunk);
            else chunksByRecording.set(row.canonical_recording_id, [chunk]);
          }

          // Every candidate is included, even with zero chunks (empty
          // array) -- findContentProofMatches naturally proposes nothing
          // for an empty-chunks side (extractShingles([]) -> empty Set ->
          // never conclusive), which IS the dominant real-world path today.
          const contentProofCandidates: ContentProofCandidate[] = candidates.map((c) => ({
            id: c.id,
            organization_id: c.organization_id,
            chunks: chunksByRecording.get(c.id) ?? [],
          }));

          const contentProofMatches = findContentProofMatches(contentProofCandidates);

          for (const match of contentProofMatches) {
            if (isAlibiVetoed(match.recording_id_a, match.recording_id_b)) {
              summary.alibiRejected++;
              continue;
            }

            // Same idempotent idiom as tier-1/metadata (Pattern 3): a plain
            // insert, tolerating unique_violation as a benign no-op.
            const { error: insertError } = await supabase.from('event_match_decisions').insert({
              recording_id_a: match.recording_id_a,
              recording_id_b: match.recording_id_b,
              tier: 'content_proof',
              score: match.score,
              signals: match.signals,
              decision: 'merge_proposed',
              decided_by: 'auto',
              applied: false,
            });

            if (insertError) {
              if (isUniqueViolation(insertError)) {
                summary.contentProofProposed++;
                continue;
              }
              console.error(
                '[event-resolver] runShadowSweep content-proof insert failed closed:',
                insertError.message,
              );
              summary.errors++;
              continue;
            }
            summary.contentProofProposed++;
          }
        }
      }
    } catch (err) {
      console.error('[event-resolver] runShadowSweep content-proof tier failed closed:', err);
      summary.errors++;
    }

    // ---- Metadata tier (Phase 32 Plan 02, MATCH-06) ----
    // Provider-agnostic same-org pass over the SAME candidate batch fetched
    // above. Isolated in its own try/catch: a failure here fails closed
    // (skip metadata proposing for this tick, log, count an error) without
    // touching tier-1's proposals already written above.
    try {
      const recordingIds = candidates.map((c) => c.id);

      if (recordingIds.length > 0) {
        // Second query, keyed by recording_id IN the batch, same-org --
        // deliberately NOT the legacy Zoom-only raw-calls table (MATCH-06's
        // provider-agnostic seam).
        const participantsResult = await supabase
          .from('call_participants')
          .select('recording_id, email, name')
          .in('recording_id', recordingIds);

        if (participantsResult.error) {
          console.error(
            '[event-resolver] runShadowSweep call_participants fetch failed closed:',
            participantsResult.error.message,
          );
          summary.errors++;
        } else {
          const participantsByRecording = new Map<string, string[]>();
          for (const row of (participantsResult.data ?? []) as {
            recording_id: string;
            email: string | null;
            name: string | null;
          }[]) {
            // Prefer email; fall back to name only when email is null
            // (interfaces contract, 32-02-PLAN.md).
            const raw = row.email && row.email.trim().length > 0 ? row.email : row.name;
            if (!raw) continue;
            const normalized = normalizeParticipant(raw);
            if (normalized.length === 0) continue;
            const bucket = participantsByRecording.get(row.recording_id);
            if (bucket) bucket.push(normalized);
            else participantsByRecording.set(row.recording_id, [normalized]);
          }

          // recurring_call_titles is keyed by (user_id = owner_user_id, title)
          // -- already provider-agnostic (32-RESEARCH.md, MATCH-05
          // substrate), no migration needed to consume it here.
          const ownerIds = [
            ...new Set(candidates.map((c) => c.owner_user_id).filter((id): id is string => !!id)),
          ];
          const occurrenceByOwnerTitle = new Map<string, number>();
          // CR-02 fix (32-REVIEW.md): tracks whether the recurring_call_titles
          // fetch itself FAILED, as distinct from "no owners to look up"
          // (ownerIds.length === 0), which is a legitimate zero-row case, not
          // an error. Metadata-tier candidate-building/scoring/proposing below
          // is gated on this flag, mirroring the call_participants error
          // branch above: a fetch error must skip proposing for the WHOLE
          // tick, not silently fall back to occurrence_count=null --
          // shouldSuppressTitleSignal(null) resolves to "NOT suppressed" by
          // its own documented fail-closed contract, which would reopen the
          // F5 recurring-title false-merge trap at full title weight.
          let recurringTitlesFetchFailed = false;

          if (ownerIds.length > 0) {
            const recurringResult = await supabase
              .from('recurring_call_titles')
              .select('user_id, title, occurrence_count')
              .in('user_id', ownerIds);

            if (recurringResult.error) {
              console.error(
                '[event-resolver] runShadowSweep recurring_call_titles fetch failed closed:',
                recurringResult.error.message,
              );
              summary.errors++;
              recurringTitlesFetchFailed = true;
            } else {
              for (const row of (recurringResult.data ?? []) as {
                user_id: string;
                title: string;
                occurrence_count: number;
              }[]) {
                occurrenceByOwnerTitle.set(`${row.user_id}::${row.title}`, row.occurrence_count);
              }
            }
          }

          // Fail closed (CR-02): only build/score/propose metadata-tier
          // candidates when the recurring-titles lookup did NOT fail. Tier-1's
          // proposals above are unaffected either way (already attempted and
          // written before this metadata-tier block ever runs).
          if (!recurringTitlesFetchFailed) {
            const metadataCandidates: MetadataCandidate[] = candidates.map((c) => ({
              id: c.id,
              organization_id: c.organization_id,
              owner_user_id: c.owner_user_id ?? null,
              title: c.title ?? null,
              recording_start_time: c.recording_start_time ?? null,
              recording_end_time: c.recording_end_time ?? null,
              participant_emails: participantsByRecording.get(c.id) ?? [],
              occurrence_count:
                c.owner_user_id && c.title
                  ? occurrenceByOwnerTitle.get(`${c.owner_user_id}::${c.title}`) ?? null
                  : null,
            }));

            const metadataMatches = findMetadataCandidates(metadataCandidates);
            const nonVetoedMetadataMatches: MetadataMatch[] = [];
            for (const metadataMatch of metadataMatches) {
              if (isAlibiVetoed(metadataMatch.recording_id_a, metadataMatch.recording_id_b)) {
                summary.alibiRejected++;
                continue;
              }
              nonVetoedMetadataMatches.push(metadataMatch);
            }
            const writeResult = await writeMetadataProposals(supabase, nonVetoedMetadataMatches);
            summary.metadataProposed += writeResult.proposed;
            summary.errors += writeResult.errors;
          }
        }
      }
    } catch (err) {
      console.error('[event-resolver] runShadowSweep metadata tier failed closed:', err);
      summary.errors++;
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
 * recordings + call_participants (never the legacy Zoom-only raw-calls
 * table -- MATCH-06). Locked
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
 * (never from the legacy Zoom-only raw-calls table -- MATCH-06's
 * provider-agnostic seam).
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

/**
 * ============================================================================
 * Content-proof tier (Phase 33 Plan 01) -- MATCH-02
 * ============================================================================
 *
 * Rare-shingle transcript overlap: a pure, DB-free, fail-closed scorer that
 * decides whether two recordings' transcript_chunks share enough long (7+
 * token) word shingles to CONCLUSIVELY prove they are captures of the same
 * event -- this tier CAN auto-attach (unlike the metadata tier, which only
 * ever proposes). Locked design (33-01 Task 1, option-a, approved as-is):
 * shingles are 7-token windows, exact-set overlap, conclusive at
 * CONTENT_PROOF_MIN_SHARED_SHINGLES (5) or more shared shingles. Long
 * shingles are rare by construction (33-RESEARCH.md: 6+ tokens is standard
 * in near-duplicate-detection literature) -- no corpus-wide IDF-like rarity
 * model is needed for a binary conclusive/not-conclusive decision between
 * exactly two transcripts.
 *
 * Alignment is by chunk_index ordinal position ONLY -- never
 * timestamp_start/timestamp_end, which are nullable TEXT with no live writer
 * and unconfirmed format (33-RESEARCH.md Pitfall 4). This is also the more
 * spec-faithful reading of "aligned on relative offsets... not wall-clock":
 * content-derived ordinal position is immune to device clock skew by
 * construction.
 *
 * Same-org bucketing reuses the identical Map<organization_id, candidate[]>
 * pattern already proven in findDeterministicMatches/findMetadataCandidates
 * (SAFE-04/T-33-03 defense-in-depth -- cross-org pairs are never even
 * grouped, let alone scored).
 *
 * This section stands alone: it is exercised only by this file's own unit
 * tests. Wiring into runShadowSweep (proposing content-proof candidates) and
 * proving the auto-attach capability against apply_event_match_atomic's new
 * p_tier parameter are both Plan 02's job, not this plan's.
 */

/** Shingle length in tokens (locked, 33-01 Task 1 option-a). Long enough that exact collision across two unrelated recordings is implausible by construction. */
export const SHINGLE_SIZE = 7;

/** Conclusive bar: two recordings sharing at least this many distinct shingles are the same event (locked, 33-01 Task 1 option-a). */
export const CONTENT_PROOF_MIN_SHARED_SHINGLES = 5;

/**
 * Tokenizes `text` into overlapping k-token shingles (each shingle is its
 * tokens joined with a single space), for exact-set overlap comparison.
 * Tokenization: lowercased, split on any run of non-letter/non-number
 * Unicode characters (punctuation, whitespace, emoji, symbols all act as
 * separators), empty tokens dropped.
 *
 * Pure, DB-free, fail-closed (mirrors extractTier1Signal's convention):
 * never throws; malformed input, an empty string, or text with fewer than
 * `k` tokens all return an empty Set rather than erroring.
 */
export function extractShingles(text: string | null | undefined, k: number = SHINGLE_SIZE): Set<string> {
  try {
    if (typeof text !== 'string' || text.length === 0) return new Set();
    if (!Number.isInteger(k) || k <= 0) return new Set();

    const tokens = text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 0);

    if (tokens.length < k) return new Set();

    const shingles = new Set<string>();
    for (let i = 0; i <= tokens.length - k; i++) {
      shingles.add(tokens.slice(i, i + k).join(' '));
    }
    return shingles;
  } catch (err) {
    console.error('[event-resolver] extractShingles failed closed:', err);
    return new Set();
  }
}

/** A transcript_chunks row's minimal shape needed for content-proof alignment. */
export interface ContentProofChunk {
  chunk_index: number;
  chunk_text: string | null;
}

/** Sorts chunks by chunk_index (ordinal position -- never a wall-clock timestamp, Pitfall 4) and joins their text with a space. Fails closed to '' on malformed input. */
function concatenateChunksByIndex(chunks: ContentProofChunk[] | null | undefined): string {
  if (!Array.isArray(chunks)) return '';
  return chunks
    .filter((c): c is ContentProofChunk => !!c && typeof c === 'object' && typeof c.chunk_index === 'number')
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map((c) => (typeof c.chunk_text === 'string' ? c.chunk_text : ''))
    .join(' ');
}

export interface ContentProofOverlapResult {
  sharedShingles: number;
  /** Jaccard similarity of the two shingle sets (0..1), carried for ledger provenance -- NOT the conclusive gate itself. */
  jaccard: number;
  conclusive: boolean;
}

/**
 * Scores content-proof overlap between two recordings' transcript chunks.
 * Concatenates each side's chunks in chunk_index order into one token stream
 * per side, extracts SHINGLE_SIZE-token shingles, and compares the two sets.
 * Pure, DB-free, fail-closed: never throws; malformed/empty input yields
 * sharedShingles=0, jaccard=0, conclusive=false.
 */
export function scoreContentProofOverlap(
  chunksA: ContentProofChunk[] | null | undefined,
  chunksB: ContentProofChunk[] | null | undefined,
  minSharedShingles: number = CONTENT_PROOF_MIN_SHARED_SHINGLES,
): ContentProofOverlapResult {
  try {
    const shinglesA = extractShingles(concatenateChunksByIndex(chunksA));
    const shinglesB = extractShingles(concatenateChunksByIndex(chunksB));

    let sharedShingles = 0;
    for (const shingle of shinglesA) {
      if (shinglesB.has(shingle)) sharedShingles++;
    }

    const unionSize = shinglesA.size + shinglesB.size - sharedShingles;
    const jaccard = unionSize > 0 ? sharedShingles / unionSize : 0;

    return { sharedShingles, jaccard, conclusive: sharedShingles >= minSharedShingles };
  } catch (err) {
    console.error('[event-resolver] scoreContentProofOverlap failed closed:', err);
    return { sharedShingles: 0, jaccard: 0, conclusive: false };
  }
}

/** A recording's shape needed for content-proof scoring: its id, org (for same-org bucketing), and transcript chunks. */
export interface ContentProofCandidate {
  id: string;
  organization_id: string;
  chunks: ContentProofChunk[];
}

/** One proposed content-proof-tier pair, canonically ordered (a < b). Carries no decision/applied intent -- write-time only, mirrors MetadataMatch. */
export interface ContentProofMatch {
  recording_id_a: string;
  recording_id_b: string;
  tier: 'content_proof';
  /** Jaccard overlap of the two shingle sets, for ledger provenance. */
  score: number;
  signals: {
    shared_shingles: number;
  };
}

/**
 * Pure, DB-free content-proof matcher (MATCH-02): pairs same-organization
 * candidates -- reusing the identical Map<organization_id, candidate[]>
 * bucketing pattern as findDeterministicMatches/findMetadataCandidates
 * verbatim, so cross-org pairs are never even grouped, let alone scored
 * (SAFE-04/T-33-03 defense-in-depth) -- scores each pair's transcript-chunk
 * shingle overlap, and emits a ContentProofMatch ONLY for conclusive pairs.
 * Never throws -- malformed candidates are skipped, not fatal.
 */
export function findContentProofMatches(candidates: ContentProofCandidate[]): ContentProofMatch[] {
  try {
    const valid = (Array.isArray(candidates) ? candidates : []).filter(
      (c): c is ContentProofCandidate =>
        !!c &&
        typeof c === 'object' &&
        typeof (c as ContentProofCandidate).id === 'string' &&
        (c as ContentProofCandidate).id.length > 0 &&
        typeof (c as ContentProofCandidate).organization_id === 'string' &&
        (c as ContentProofCandidate).organization_id.length > 0 &&
        Array.isArray((c as ContentProofCandidate).chunks),
    );

    // Same-org-only pairing: cross-org candidates are never even grouped
    // together, so a cross-org pair can never be scored, let alone proposed.
    const byOrg = new Map<string, ContentProofCandidate[]>();
    for (const c of valid) {
      const bucket = byOrg.get(c.organization_id);
      if (bucket) bucket.push(c);
      else byOrg.set(c.organization_id, [c]);
    }

    const matches: ContentProofMatch[] = [];
    for (const bucket of byOrg.values()) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          try {
            const result = scoreContentProofOverlap(bucket[i].chunks, bucket[j].chunks);
            if (!result.conclusive) continue;

            const [recording_id_a, recording_id_b] =
              bucket[i].id < bucket[j].id ? [bucket[i].id, bucket[j].id] : [bucket[j].id, bucket[i].id];

            matches.push({
              recording_id_a,
              recording_id_b,
              tier: 'content_proof',
              score: result.jaccard,
              signals: { shared_shingles: result.sharedShingles },
            });
          } catch (err) {
            console.error('[event-resolver] findContentProofMatches pair scoring failed closed:', err);
          }
        }
      }
    }

    return matches;
  } catch (err) {
    console.error('[event-resolver] findContentProofMatches failed closed:', err);
    return [];
  }
}

/**
 * ============================================================================
 * Speaker-alibi constraint (Phase 33 Plan 01) -- MATCH-07
 * ============================================================================
 *
 * NOT a fourth scoring tier -- a pure, DB-free VETO layered across whatever
 * tier (1, 2, or 3) produces a candidate, applied before that candidate is
 * written (33-RESEARCH.md Pattern 3). An identity with confirmed speech in
 * one candidate during interval T, present (by email) in a time-disjoint
 * other candidate during the same T, vetoes that candidate pair --
 * attendance alone (has_confirmed_speech NULL or false) is never an alibi,
 * only `=== true` anchors one.
 *
 * T-33-02 (threat register): this function's ONLY truthy meaning is "veto
 * this candidate." `false` means "no alibi violation found" -- it must NEVER
 * be read by any caller as a positive confirmation that two candidates ARE
 * the same event. Per 33-01 Task 1 option-a, a violation silently skips the
 * write (no ledger row); wiring this predicate into the tiers' write paths
 * is Plan 02's job, not this plan's.
 */

/** A single participant's identity + confirmed-speech state for one side of an alibi comparison. */
export interface AlibiParticipant {
  email: string;
  /** NULL/false = attendance only (never an alibi); true = confirmed spoke (the only value that can anchor a violation). */
  has_confirmed_speech: boolean | null;
}

/** One side of an alibi comparison: an event/recording's time interval + its participants. */
export interface AlibiCandidate {
  /** ISO-8601 (or any Date-parseable) interval start. */
  start: string;
  /** ISO-8601 (or any Date-parseable) interval end. */
  end: string;
  participants: AlibiParticipant[];
}

/** Fails closed to null (never throws) on any non-string, empty, or unparseable timestamp. */
function parseAlibiTimestamp(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * True if any participant on `confirmedSide` confirmed speaking
 * (has_confirmed_speech === true) AND shares an email with a participant
 * present on `otherSide` (presence alone on the other side is sufficient --
 * the other side's own has_confirmed_speech value is irrelevant to this
 * check).
 */
function hasConfirmedSpeakerInOther(confirmedSide: AlibiParticipant[], otherSide: AlibiParticipant[]): boolean {
  for (const p of confirmedSide) {
    if (!p || typeof p !== 'object') continue;
    if (p.has_confirmed_speech !== true) continue; // attendance alone is never an alibi
    if (typeof p.email !== 'string' || p.email.length === 0) continue;
    const present = otherSide.some((o) => o && typeof o === 'object' && o.email === p.email);
    if (present) return true;
  }
  return false;
}

/**
 * MATCH-07: pure, DB-free alibi predicate returning a boolean VETO ONLY (see
 * section header -- T-33-02). Mirrors shouldSuppressTitleSignal's
 * fail-closed style: any malformed/missing input (null participants,
 * unparseable timestamps) returns false, never throws -- a veto must never
 * fire on bad data alone, and a genuine merge must never be rejected because
 * of a data problem rather than a real alibi.
 *
 * A violation requires ALL of: the same email appears on both sides; that
 * email has has_confirmed_speech === true on (at least) one side; and the
 * two candidates' intervals are time-disjoint (checked BOTH directions --
 * confirmed-in-A-present-in-B, and confirmed-in-B-present-in-A). Overlapping
 * intervals never violate, even with a shared confirmed speaker -- a person
 * can genuinely speak in two overlapping captures of the SAME event.
 */
export function isSpeakerAlibiViolation(a: AlibiCandidate, b: AlibiCandidate): boolean {
  try {
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (!Array.isArray(a.participants) || !Array.isArray(b.participants)) return false;

    const startA = parseAlibiTimestamp(a.start);
    const endA = parseAlibiTimestamp(a.end);
    const startB = parseAlibiTimestamp(b.start);
    const endB = parseAlibiTimestamp(b.end);
    if (startA === null || endA === null || startB === null || endB === null) return false;

    const disjoint = endA <= startB || endB <= startA;
    if (!disjoint) return false; // overlapping intervals never violate, even with a shared confirmed speaker

    if (hasConfirmedSpeakerInOther(a.participants, b.participants)) return true;
    if (hasConfirmedSpeakerInOther(b.participants, a.participants)) return true;

    return false;
  } catch (err) {
    console.error('[event-resolver] isSpeakerAlibiViolation failed closed:', err);
    return false;
  }
}
