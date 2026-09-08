/**
 * resolve-speakers -- Phase 35 Plan 03: forward-only speaker-identity propagation
 * across recordings of the same event.
 *
 * Mirrors resolve-identities (Phase 34 Plan 04) / resolve-events (Phase 31 Plan 01):
 * shared-secret gated, NOT user-JWT authenticated, delegates all matching decisions
 * to a pure _shared module. This endpoint:
 *   1. Rejects any request missing/mismatching X-Reconcile-Secret with 401, BEFORE
 *      any DB work or body parse.
 *   2. Zod-validates a forward-only body ({ mode: 'forward', since?: ISO }).
 *   3. Service-role reads recordings resolved to an event (event_id IS NOT NULL),
 *      created at/after the cutover, plus their transcript_chunks and
 *      call_participants.
 *   4. Buckets recordings by (event_id, organization_id) BEFORE any pairing --
 *      SAFE-04 same-org bucketing guarantee. No cross-event or cross-org pairing
 *      is structurally possible.
 *   5. For each bucket with >=2 recordings, derives donor chunks (transcript_chunks
 *      whose speaker matches a call_participants row with a resolved identity_id --
 *      by verified email, or by exact name when no email is present) and target
 *      chunks (every other chunk in the bucket), then delegates ALL interval-
 *      overlap / propagation logic to _shared/speaker-resolver.ts's
 *      propagateNamedLabel (Plan 02, IDENT-04). Zero matching logic lives here.
 *   6. Writes every propagated resolution as a row in speaker_resolution_decisions
 *      (Decision B2, 35-01-SUMMARY.md) -- the locked write-target. This function
 *      NEVER overwrites the transcript_chunks columns in place; that
 *      write is reserved for a future phase's apply step (Anti-Pattern this
 *      phase, T-35-07).
 *
 * Cutover (forward-only, no historical backfill): defaults to the timestamp this
 * plan's migration created speaker_resolution_decisions on TEST -- recordings
 * created before this moment are never swept by default. Callers may pass an
 * explicit `since` to move the cutover forward.
 *
 * Consensus collapse (IDENT-05, collapsePhantomSpeaker) runs as a second pass
 * per bucket, AFTER propagation: for every donor's labeled span, any OTHER
 * recording in the same bucket whose chunks are anonymous, over-segmented
 * (2+ distinct anonymous chunks), and each wholly subsumed within the
 * donor's span (within the clock-drift tolerance buffer) are collapsed onto
 * the donor's identity_id. Written as tier='consensus_collapse' rows,
 * distinct from tier='propagation' -- the ledger's UNIQUE(target_recording_id,
 * target_chunk_index, tier) constraint lets both mechanisms independently
 * propose a decision for the same chunk without clobbering each other.
 * collapsePhantomSpeaker fails closed (refuses) the moment any candidate
 * chunk falls outside the labeled span -- a genuinely different second
 * speaker is never force-merged (T-35-04).
 *
 * Deploy: deferred to a later plan (mirrors resolve-identities' Plan 07 deferral).
 *   supabase functions deploy resolve-speakers --use-api --no-verify-jwt
 *   (shared-secret auth happens in application code, not Supabase's JWT gate --
 *   reuses the existing RECONCILE_SECRET, already gating resolve-events/
 *   resolve-identities/fathom-reconcile; no new secret).
 *
 * Trigger/cron wiring is explicitly OUT OF SCOPE for this plan -- ships
 * inert-until-invoked, exactly like resolve-identities/resolve-events did before
 * their own cron wiring.
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - RECONCILE_SECRET (shared secret; also gates resolve-events/resolve-identities/
 *     fathom-reconcile)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  collapsePhantomSpeaker,
  type ConsensusCandidate,
  type ConsensusResult,
  deriveAbsoluteInterval,
  type PropagationDonor,
  type PropagationResult,
  type SpeakerChunk,
  propagateNamedLabel,
} from '../_shared/speaker-resolver.ts';

const requestSchema = z.object({
  mode: z.literal('forward'),
  since: z.string().datetime().optional(),
});

/** This plan's migration timestamp -- speaker_resolution_decisions' own creation moment on TEST. Forward-only default cutover. */
const DEFAULT_CUTOVER = '2026-09-08T12:00:00Z';

interface RecordingRow {
  id: string;
  event_id: string;
  recording_start_time: string | null;
}

interface ChunkRow {
  id: string;
  canonical_recording_id: string;
  chunk_index: number;
  speaker_name: string | null;
  speaker_email: string | null;
  timestamp_start: string | null;
  timestamp_end: string | null;
}

interface ParticipantRow {
  recording_id: string;
  organization_id: string;
  name: string | null;
  email: string | null;
  identity_id: string | null;
}

interface ResolveSummary {
  eventsScanned: number;
  bucketsScanned: number;
  chunksScanned: number;
  donorsFound: number;
  targetsScanned: number;
  propagated: number;
  unresolved: number;
  collapsed: number;
  errors: number;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Shared-secret gate BEFORE any DB work -- this endpoint is
    //    forward-only-batch-triggered, never user-JWT (mirrors
    //    resolve-identities/resolve-events/fathom-reconcile's reconcile mode).
    const secret = req.headers.get('X-Reconcile-Secret');
    const expected = Deno.env.get('RECONCILE_SECRET');
    if (!expected || secret !== expected) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Validate request body -- forward-only, no historical backfill mode exists.
    const body = await req.json().catch(() => ({}));
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const since = validation.data.since ?? DEFAULT_CUTOVER;

    // 4. Service-role client -- this endpoint has no user session to bind to.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const summary: ResolveSummary = {
      eventsScanned: 0,
      bucketsScanned: 0,
      chunksScanned: 0,
      donorsFound: 0,
      targetsScanned: 0,
      propagated: 0,
      unresolved: 0,
      collapsed: 0,
      errors: 0,
    };

    // 5. Forward-only sweep: recordings resolved to an event, created at/after
    //    the cutover. No historical backfill.
    const { data: recordingRows, error: recordingsError } = await supabase
      .from('recordings')
      .select('id, event_id, recording_start_time, created_at')
      .not('event_id', 'is', null)
      .gte('created_at', since)
      .limit(1000);

    if (recordingsError) {
      console.error('[resolve-speakers] recordings fetch failed closed:', recordingsError.message);
      return new Response(JSON.stringify({ error: recordingsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recordings = (recordingRows ?? []) as RecordingRow[];
    if (recordings.length === 0) {
      return new Response(JSON.stringify({ success: true, since, ...summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Group recordings by event_id -- only multi-recording events can have
    //    anything to propagate across.
    const recordingsByEvent = new Map<string, RecordingRow[]>();
    for (const r of recordings) {
      const list = recordingsByEvent.get(r.event_id) ?? [];
      list.push(r);
      recordingsByEvent.set(r.event_id, list);
    }

    const allRecordingIds = recordings.map((r) => r.id);

    // 7. Load call_participants for org bucketing + donor identity lookup, and
    //    transcript_chunks for every candidate recording, once, up front.
    const { data: participantRows, error: participantsError } = await supabase
      .from('call_participants')
      .select('recording_id, organization_id, name, email, identity_id')
      .in('recording_id', allRecordingIds);

    if (participantsError) {
      console.error('[resolve-speakers] call_participants fetch failed closed:', participantsError.message);
      return new Response(JSON.stringify({ error: participantsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: chunkRows, error: chunksError } = await supabase
      .from('transcript_chunks')
      .select('id, canonical_recording_id, chunk_index, speaker_name, speaker_email, timestamp_start, timestamp_end')
      .in('canonical_recording_id', allRecordingIds);

    if (chunksError) {
      console.error('[resolve-speakers] transcript_chunks fetch failed closed:', chunksError.message);
      return new Response(JSON.stringify({ error: chunksError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const participants = (participantRows ?? []) as ParticipantRow[];
    const chunks = (chunkRows ?? []) as ChunkRow[];

    for (const [eventId, eventRecordings] of recordingsByEvent) {
      summary.eventsScanned++;

      // SAFE-04: bucket this event's recordings by organization_id BEFORE any
      // pairing -- no cross-org propagation is structurally possible.
      const orgByRecordingId = new Map<string, string>();
      for (const p of participants) {
        if (!orgByRecordingId.has(p.recording_id) && p.organization_id) {
          orgByRecordingId.set(p.recording_id, p.organization_id);
        }
      }

      const recordingsByOrg = new Map<string, RecordingRow[]>();
      for (const r of eventRecordings) {
        const orgId = orgByRecordingId.get(r.id);
        if (!orgId) continue; // no org evidence for this recording -- skip, fail closed.
        const list = recordingsByOrg.get(orgId) ?? [];
        list.push(r);
        recordingsByOrg.set(orgId, list);
      }

      for (const [organizationId, orgRecordings] of recordingsByOrg) {
        if (orgRecordings.length < 2) continue; // nothing to propagate across.
        summary.bucketsScanned++;

        const recordingIdsInBucket = new Set(orgRecordings.map((r) => r.id));
        const recordingStartTimes: Record<string, string | null> = {};
        for (const r of orgRecordings) recordingStartTimes[r.id] = r.recording_start_time;

        const bucketChunks = chunks.filter((c) => recordingIdsInBucket.has(c.canonical_recording_id));
        const bucketParticipants = participants.filter((p) => recordingIdsInBucket.has(p.recording_id) && p.identity_id);

        summary.chunksScanned += bucketChunks.length;

        // Donor derivation: a chunk's speaker matches a call_participants row
        // WITH a resolved identity_id, by verified email first, then exact
        // name when no email is present on either side. Never a bare
        // speaker_name-only guess without a resolved identity_id backing it
        // (Pitfall 3 / T-35-03).
        const donors: PropagationDonor[] = [];
        const donorChunkIds = new Set<string>();
        for (const chunk of bucketChunks) {
          const chunkEmail = chunk.speaker_email?.trim().toLowerCase() || null;
          const chunkName = chunk.speaker_name?.trim() || null;
          if (!chunkEmail && !chunkName) continue;

          const match = bucketParticipants.find((p) => {
            const pEmail = p.email?.trim().toLowerCase() || null;
            if (chunkEmail && pEmail) return chunkEmail === pEmail;
            const pName = p.name?.trim() || null;
            return !pEmail && !chunkEmail && chunkName !== null && pName === chunkName;
          });

          if (!match || !match.identity_id) continue;

          const speakerChunk: SpeakerChunk = {
            canonical_recording_id: chunk.canonical_recording_id,
            chunk_index: chunk.chunk_index,
            speaker_name: chunk.speaker_name,
            speaker_email: chunk.speaker_email,
            timestamp_start: chunk.timestamp_start,
            timestamp_end: chunk.timestamp_end,
            identity_id: match.identity_id,
          };

          // Delegate the donor's interval derivation to the same pure
          // function propagateNamedLabel uses internally for targets --
          // no anchor math duplicated in this edge function body.
          const interval = deriveAbsoluteInterval(speakerChunk, recordingStartTimes[chunk.canonical_recording_id] ?? null);

          donors.push({
            identity_id: match.identity_id,
            verified: true,
            source_canonical_recording_id: chunk.canonical_recording_id,
            source_chunk_index: chunk.chunk_index,
            interval,
          });
          donorChunkIds.add(chunk.id);
          summary.donorsFound++;
        }

        // Targets: every chunk in this bucket that was NOT itself used as a
        // donor. propagateNamedLabel fails closed (UnresolvedSpeaker) for
        // anything with no overlapping donor -- including a donor's own
        // recording's other chunks, which is correct (never re-derive an
        // already-resolved speaker's own identity from a different donor).
        const targets: SpeakerChunk[] = bucketChunks
          .filter((c) => !donorChunkIds.has(c.id))
          .map((c) => ({
            canonical_recording_id: c.canonical_recording_id,
            chunk_index: c.chunk_index,
            speaker_name: c.speaker_name,
            speaker_email: c.speaker_email,
            timestamp_start: c.timestamp_start,
            timestamp_end: c.timestamp_end,
            identity_id: null,
          }));

        summary.targetsScanned += targets.length;

        if (donors.length === 0 || targets.length === 0) continue;

        // Delegate ALL matching/interval-overlap logic to speaker-resolver.ts
        // -- zero scoring logic lives in this edge function body.
        const results: PropagationResult[] = propagateNamedLabel({
          event_id: eventId,
          organization_id: organizationId,
          donors,
          targets,
          recordingStartTimes,
        });

        for (const result of results) {
          if ('resolved' in result && result.resolved === false) {
            summary.unresolved++;
            continue;
          }

          const propagated = result as Extract<PropagationResult, { identity_id: string }>;

          // Write ONLY to the locked write-target ledger (Decision B2) --
          // NEVER an in-place UPDATE to transcript_chunks.speaker_name/
          // speaker_email (T-35-07, reserved for a future phase's apply step).
          const { error: insertError } = await supabase
            .from('speaker_resolution_decisions')
            .upsert(
              {
                event_id: eventId,
                donor_recording_id: propagated.donor.source_canonical_recording_id,
                donor_chunk_index: propagated.donor.source_chunk_index,
                target_recording_id: propagated.canonical_recording_id,
                target_chunk_index: propagated.chunk_index,
                identity_id: propagated.identity_id,
                tier: 'propagation',
                score: propagated.confidence,
                signals: { donor: propagated.donor },
                decision: 'resolution_proposed',
                decided_by: 'auto',
                applied: false,
              },
              { onConflict: 'target_recording_id,target_chunk_index,tier' },
            );

          if (insertError) {
            console.error('[resolve-speakers] speaker_resolution_decisions insert failed closed:', insertError.message);
            summary.errors++;
            continue;
          }

          summary.propagated++;
        }

        // 7b. Consensus collapse (IDENT-05): for each donor's labeled span,
        // look for OTHER recordings in this bucket with 2+ distinct
        // anonymous speaker labels whose combined chunks are wholly
        // subsumed within the donor's span -- the signature of a
        // diarization over-segmentation artifact on that recording's
        // source, not a real second speaker. Delegates the subsumption
        // check entirely to collapsePhantomSpeaker; zero matching logic
        // lives here.
        for (const donor of donors) {
          const labeled: ConsensusCandidate = {
            canonical_recording_id: donor.source_canonical_recording_id,
            chunk_indices: [donor.source_chunk_index],
            identity_id: donor.identity_id,
            interval: donor.interval,
          };

          const otherRecordingIds = orgRecordings
            .map((r) => r.id)
            .filter((id) => id !== donor.source_canonical_recording_id);

          for (const otherRecordingId of otherRecordingIds) {
            // Group this OTHER recording's chunks (excluding anything
            // already used as a donor elsewhere) by raw speaker_name label
            // -- 2+ distinct labels within one recording, none carrying a
            // resolved identity_id, is the over-segmentation signature this
            // pass targets.
            const anonymousChunksByLabel = new Map<string, ChunkRow[]>();
            for (const chunk of bucketChunks) {
              if (chunk.canonical_recording_id !== otherRecordingId) continue;
              if (donorChunkIds.has(chunk.id)) continue;
              const label = chunk.speaker_name?.trim() || `__anon_${chunk.id}`;
              const list = anonymousChunksByLabel.get(label) ?? [];
              list.push(chunk);
              anonymousChunksByLabel.set(label, list);
            }

            if (anonymousChunksByLabel.size < 2) continue; // not over-segmented -- nothing to collapse.

            const candidateSplit: ConsensusCandidate[] = [];
            for (const chunkGroup of anonymousChunksByLabel.values()) {
              const intervals = chunkGroup.map((c) =>
                deriveAbsoluteInterval(
                  {
                    canonical_recording_id: c.canonical_recording_id,
                    chunk_index: c.chunk_index,
                    speaker_name: c.speaker_name,
                    speaker_email: c.speaker_email,
                    timestamp_start: c.timestamp_start,
                    timestamp_end: c.timestamp_end,
                    identity_id: null,
                  },
                  recordingStartTimes[otherRecordingId] ?? null,
                ),
              );
              const starts = intervals.map((iv) => iv.start).filter((s): s is string => s !== null);
              const ends = intervals.map((iv) => iv.end).filter((e): e is string => e !== null);
              if (starts.length === 0 || ends.length === 0) continue; // anchor unavailable -- fail closed, skip this group.

              candidateSplit.push({
                canonical_recording_id: otherRecordingId,
                chunk_indices: chunkGroup.map((c) => c.chunk_index),
                identity_id: null,
                interval: {
                  canonical_recording_id: otherRecordingId,
                  chunk_index: chunkGroup[0].chunk_index,
                  start: starts.reduce((min, s) => (s < min ? s : min)),
                  end: ends.reduce((max, e) => (e > max ? e : max)),
                },
              });
            }

            if (candidateSplit.length < 2) continue;

            const consensusResult: ConsensusResult = collapsePhantomSpeaker({
              event_id: eventId,
              organization_id: organizationId,
              labeled,
              candidateSplit,
            });

            if ('collapsed' in consensusResult && consensusResult.collapsed === false) continue;

            const collapse = consensusResult as Extract<ConsensusResult, { collapsed_into_identity_id: string }>;

            for (const group of collapse.collapsed_chunks) {
              for (const chunkIndex of group.chunk_indices) {
                // Write ONLY to the locked write-target ledger, tier=
                // 'consensus_collapse' -- distinct from 'propagation' so
                // both mechanisms can independently record a decision for
                // the same chunk (UNIQUE(target_recording_id,
                // target_chunk_index, tier)). NEVER an in-place UPDATE to
                // transcript_chunks (T-35-07).
                const { error: collapseInsertError } = await supabase
                  .from('speaker_resolution_decisions')
                  .upsert(
                    {
                      event_id: eventId,
                      donor_recording_id: donor.source_canonical_recording_id,
                      donor_chunk_index: donor.source_chunk_index,
                      target_recording_id: group.canonical_recording_id,
                      target_chunk_index: chunkIndex,
                      identity_id: collapse.collapsed_into_identity_id,
                      tier: 'consensus_collapse',
                      score: collapse.confidence,
                      signals: { labeled_span: donor.interval, collapsed_group: group.chunk_indices },
                      decision: 'resolution_proposed',
                      decided_by: 'auto',
                      applied: false,
                    },
                    { onConflict: 'target_recording_id,target_chunk_index,tier' },
                  );

                if (collapseInsertError) {
                  console.error(
                    '[resolve-speakers] speaker_resolution_decisions (consensus_collapse) insert failed closed:',
                    collapseInsertError.message,
                  );
                  summary.errors++;
                  continue;
                }

                summary.collapsed++;
              }
            }
          }
        }
      }
    }

    // 8. Return the sweep summary.
    return new Response(JSON.stringify({ success: true, since, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[resolve-speakers] handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
