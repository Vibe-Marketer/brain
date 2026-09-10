/**
 * reconcile-transcripts -- Phase 37 Plan 03: forward-only, cross-recording
 * transcript reconciliation sweep.
 *
 * Mirrors resolve-speakers (Phase 35 Plan 03) / resolve-events (Phase 31
 * Plan 01) / resolve-identities (Phase 34 Plan 04): shared-secret gated, NOT
 * user-JWT authenticated, delegates all scoring/alignment logic to a pure
 * _shared module (`transcript-reconciler.ts`, Plan 02). This endpoint:
 *   1. Rejects any request missing/mismatching X-Reconcile-Secret with 401,
 *      BEFORE any DB work or body parse.
 *   2. Zod-validates a forward-only body ({ mode: 'forward', since?: ISO }).
 *   3. Service-role reads recordings resolved to an event AND whose event
 *      has an event_match_decisions row with decision='merge_applied'
 *      (37-01-SUMMARY.md's locked Task 1 gating decision, option-a) -- this
 *      is DELIBERATELY stricter than resolve-speakers' bare
 *      `event_id IS NOT NULL` query (37-RESEARCH.md Pitfall 2): a raw
 *      shared event_id with no applied merge decision is never swept.
 *   4. Buckets recordings by (event_id, organization_id) BEFORE any pairing
 *      -- SAFE-04 same-org bucketing guarantee, identical precedent to
 *      resolve-speakers. Only buckets with 2+ recordings have anything to
 *      reconcile (mirrors CONTEXT.md's "2+ recordings" trigger condition).
 *   5. Fetches transcript_chunks for every candidate recording, and derives
 *      a per-organization entity lexicon (Set<string> over each org's own
 *      chunks' `entities` column) ONCE, before the per-event loop --
 *      37-RESEARCH.md Pattern 4. The lexicon is NEVER a global cross-org
 *      aggregate (T-37-02).
 *   6. For each eligible (event, org) bucket, delegates ALL alignment/
 *      diffing/voting to `transcript-reconciler.ts`'s
 *      alignChunksToTimeline -> tokenizeAndAlignText -> (per disagreement)
 *      resolveTokenDisagreement -> buildReconciledSegment pipeline. Zero
 *      scoring logic lives in this file.
 *   7. Persists via full DELETE-then-INSERT per event into
 *      reconciled_transcript_segments (37-RESEARCH.md Pitfall 5 --
 *      RECON-04's "regenerable" requirement is full delete+rebuild, never
 *      an incremental write with a conflict-resolution target). On a
 *      delete error: fail closed, skip that event's insert, log, continue
 *      the sweep with the next event.
 *
 * transcript_chunks is READ-ONLY from this function's perspective (RECON-04)
 * -- no code path here ever writes transcript_chunks.chunk_text or any of
 * its embedding-related columns, and no embedding-pipeline function is
 * ever invoked (RECON-07).
 *
 * Cutover (forward-only, no historical backfill): defaults to this plan's
 * own migration's creation moment on TEST (20260910000000_create_
 * reconciled_transcript_segments.sql) -- recordings created before this
 * moment are never swept by default. Callers may pass an explicit `since`
 * to move the cutover forward.
 *
 * Deploy: deferred to a later plan (mirrors resolve-speakers' Plan 06-style
 * deferral).
 *   supabase functions deploy reconcile-transcripts --use-api --no-verify-jwt
 *   (shared-secret auth happens in application code, not Supabase's JWT
 *   gate -- reuses the existing RECONCILE_SECRET, already gating
 *   resolve-events/resolve-identities/resolve-speakers/fathom-reconcile; no
 *   new secret).
 *
 * Trigger/cron wiring is explicitly OUT OF SCOPE for this plan -- ships
 * inert-until-invoked, exactly like resolve-speakers did before its own
 * cron wiring.
 *
 * Env vars required:
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard)
 *   - RECONCILE_SECRET (shared secret; also gates resolve-events/
 *     resolve-identities/resolve-speakers/fathom-reconcile)
 *
 * LOCAL_DENO_TEST_PORT is read ONLY by this repo's local `deno run`
 * integration-test harness (Plan 03 Task 3) -- never set in any deployed
 * environment, mirrors merge-organizations/index.ts's identical pattern.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  alignChunksToTimeline,
  buildReconciledSegment,
  type ReconChunk,
  resolveTokenDisagreement,
  tokenizeAndAlignText,
} from '../_shared/transcript-reconciler.ts';

const requestSchema = z.object({
  mode: z.literal('forward'),
  since: z.string().datetime().optional(),
});

/** This plan's migration timestamp -- reconciled_transcript_segments' own creation moment on TEST. Forward-only default cutover. */
const DEFAULT_CUTOVER = '2026-09-10T00:00:00Z';

// LOCAL_DENO_TEST_PORT is read ONLY by this repo's local `deno run`
// integration-test harness -- never set in any deployed environment.
const LOCAL_TEST_PORT = Number(Deno.env.get('LOCAL_DENO_TEST_PORT')) || 8000;

interface RecordingRow {
  id: string;
  event_id: string;
  recording_start_time: string | null;
}

interface ChunkRow {
  id: string;
  canonical_recording_id: string;
  chunk_index: number;
  chunk_text: string | null;
  source_platform: string | null;
  speaker_name: string | null;
  speaker_email: string | null;
  timestamp_start: string | null;
  timestamp_end: string | null;
  entities: { companies?: string[]; people?: string[]; products?: string[] } | null;
}

interface ParticipantRow {
  recording_id: string;
  organization_id: string;
}

interface ReconcileSummary {
  eventsScanned: number;
  bucketsScanned: number;
  chunksScanned: number;
  eventsReconciled: number;
  segmentsWritten: number;
  errors: number;
}

/** Extracts a flat Set<string> of every entity string across companies/people/products, defensively -- entities is JSONB DEFAULT '{}' with no enforced nested-array shape (37-RESEARCH.md Pattern 4 caveat). Never throws on a malformed/missing row -- fails closed to contributing nothing from that row. */
function extractEntityStrings(entities: ChunkRow['entities']): string[] {
  if (!entities || typeof entities !== 'object') return [];
  const out: string[] = [];
  for (const key of ['companies', 'people', 'products'] as const) {
    const arr = entities[key];
    if (Array.isArray(arr)) {
      for (const v of arr) {
        if (typeof v === 'string' && v.trim().length > 0) out.push(v);
      }
    }
  }
  return out;
}

Deno.serve({ port: LOCAL_TEST_PORT }, async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Shared-secret gate BEFORE any DB work -- this endpoint is
    //    forward-only-batch-triggered, never user-JWT (mirrors
    //    resolve-speakers/resolve-identities/resolve-events/fathom-reconcile's
    //    reconcile mode).
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

    const summary: ReconcileSummary = {
      eventsScanned: 0,
      bucketsScanned: 0,
      chunksScanned: 0,
      eventsReconciled: 0,
      segmentsWritten: 0,
      errors: 0,
    };

    // 5a. Gating (37-RESEARCH.md Pitfall 2 / 37-01-SUMMARY.md's locked
    //     Task 1 decision, option-a): reconciliation eligibility requires an
    //     event_match_decisions row with decision='merge_applied' -- NOT
    //     merely `recordings.event_id IS NOT NULL`. Collect the set of
    //     eligible event ids first.
    const { data: decisionRows, error: decisionsError } = await supabase
      .from('event_match_decisions')
      .select('event_id')
      .eq('decision', 'merge_applied')
      .not('event_id', 'is', null)
      .limit(2000);

    if (decisionsError) {
      console.error('[reconcile-transcripts] event_match_decisions fetch failed closed:', decisionsError.message);
      return new Response(JSON.stringify({ error: decisionsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eligibleEventIds = [...new Set((decisionRows ?? []).map((d) => d.event_id as string).filter(Boolean))];

    if (eligibleEventIds.length === 0) {
      return new Response(JSON.stringify({ success: true, since, ...summary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5b. Forward-only sweep: recordings resolved to an eligible event,
    //     created at/after the cutover. No historical backfill.
    const { data: recordingRows, error: recordingsError } = await supabase
      .from('recordings')
      .select('id, event_id, recording_start_time, created_at')
      .in('event_id', eligibleEventIds)
      .gte('created_at', since)
      .order('event_id', { ascending: true })
      .limit(1000);

    if (recordingsError) {
      console.error('[reconcile-transcripts] recordings fetch failed closed:', recordingsError.message);
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

    // 6. Group recordings by event_id -- only multi-recording events can
    //    have anything to reconcile across.
    const recordingsByEvent = new Map<string, RecordingRow[]>();
    for (const r of recordings) {
      const list = recordingsByEvent.get(r.event_id) ?? [];
      list.push(r);
      recordingsByEvent.set(r.event_id, list);
    }

    const allRecordingIds = recordings.map((r) => r.id);

    // 7. Load call_participants for org bucketing (SAFE-04), and
    //    transcript_chunks for every candidate recording, once, up front.
    const { data: participantRows, error: participantsError } = await supabase
      .from('call_participants')
      .select('recording_id, organization_id')
      .in('recording_id', allRecordingIds);

    if (participantsError) {
      console.error('[reconcile-transcripts] call_participants fetch failed closed:', participantsError.message);
      return new Response(JSON.stringify({ error: participantsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: chunkRows, error: chunksError } = await supabase
      .from('transcript_chunks')
      .select(
        'id, canonical_recording_id, chunk_index, chunk_text, source_platform, speaker_name, speaker_email, timestamp_start, timestamp_end, entities',
      )
      .in('canonical_recording_id', allRecordingIds)
      // WR-01: deterministic secondary sort -- Postgres does not guarantee
      // row order without an explicit ORDER BY, so without this two sweep
      // runs over identical underlying data could return chunkRows in a
      // different order. bucketChunks/group.members inherit this order
      // directly, and tokenizeAndAlignText picks group.members[0] as its
      // alignment backbone -- an unstable fetch order would make the
      // reconciled segment_text non-reproducible across otherwise-identical
      // sweep runs (breaks RECON-04's "regenerable" guarantee).
      .order('canonical_recording_id', { ascending: true })
      .order('chunk_index', { ascending: true });

    if (chunksError) {
      console.error('[reconcile-transcripts] transcript_chunks fetch failed closed:', chunksError.message);
      return new Response(JSON.stringify({ error: chunksError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const participants = (participantRows ?? []) as ParticipantRow[];
    const chunks = (chunkRows ?? []) as ChunkRow[];
    summary.chunksScanned = chunks.length;

    // 8. SAFE-04: derive each candidate recording's organization_id ONCE,
    //    globally -- never per-event, so bucketing is consistent and the
    //    entity lexicon (next step) can be scoped per-org without
    //    re-deriving membership per event.
    const orgByRecordingId = new Map<string, string>();
    for (const p of participants) {
      if (!orgByRecordingId.has(p.recording_id) && p.organization_id) {
        orgByRecordingId.set(p.recording_id, p.organization_id);
      }
    }

    // 9. Per-organization entity lexicon (37-RESEARCH.md Pattern 4): built
    //    ONCE, before the per-event loop, from each org's own in-scope
    //    transcript_chunks.entities -- NEVER a global cross-org aggregate
    //    (T-37-02). Defensive against NULL/missing keys (extractEntityStrings
    //    fails closed to an empty contribution per row, never throws).
    const entityLexiconByOrg = new Map<string, Set<string>>();
    for (const chunk of chunks) {
      const orgId = orgByRecordingId.get(chunk.canonical_recording_id);
      if (!orgId) continue; // no org evidence for this recording -- skip, fail closed.
      const set = entityLexiconByOrg.get(orgId) ?? new Set<string>();
      for (const entity of extractEntityStrings(chunk.entities)) set.add(entity);
      entityLexiconByOrg.set(orgId, set);
    }

    for (const [eventId, eventRecordings] of recordingsByEvent) {
      summary.eventsScanned++;

      // SAFE-04: bucket this event's recordings by organization_id BEFORE
      // any pairing -- no cross-org reconciliation is structurally possible.
      const recordingsByOrg = new Map<string, RecordingRow[]>();
      for (const r of eventRecordings) {
        const orgId = orgByRecordingId.get(r.id);
        if (!orgId) continue; // no org evidence for this recording -- skip, fail closed.
        const list = recordingsByOrg.get(orgId) ?? [];
        list.push(r);
        recordingsByOrg.set(orgId, list);
      }

      for (const [organizationId, orgRecordings] of recordingsByOrg) {
        if (orgRecordings.length < 2) continue; // nothing to reconcile across -- CONTEXT.md's "2+ recordings" trigger condition.
        summary.bucketsScanned++;

        const recordingIdsInBucket = new Set(orgRecordings.map((r) => r.id));
        const recordingStartTimes: Record<string, string | null> = {};
        for (const r of orgRecordings) recordingStartTimes[r.id] = r.recording_start_time;

        const bucketChunks: ReconChunk[] = chunks
          .filter((c) => recordingIdsInBucket.has(c.canonical_recording_id))
          .map((c) => ({
            canonical_recording_id: c.canonical_recording_id,
            chunk_index: c.chunk_index,
            speaker_name: c.speaker_name,
            speaker_email: c.speaker_email,
            timestamp_start: c.timestamp_start,
            timestamp_end: c.timestamp_end,
            identity_id: null,
            chunk_text: c.chunk_text ?? '',
            source_platform: c.source_platform ?? 'other',
          }));

        if (bucketChunks.length === 0) continue;

        const entityLexicon = entityLexiconByOrg.get(organizationId) ?? new Set<string>();

        // Delegate ALL alignment/diffing/voting logic to
        // transcript-reconciler.ts -- zero scoring logic lives in this edge
        // function body (Task 2, per this plan's <action>).
        const groups = alignChunksToTimeline({
          event_id: eventId,
          organization_id: organizationId,
          chunks: bucketChunks,
          recordingStartTimes,
        });

        const freshRows: Array<{
          event_id: string;
          segment_text: string;
          start_time: string;
          end_time: string;
          source_recording_ids: string[];
          agreeing_recording_ids: string[];
          signals: Record<string, unknown>;
          organization_id: string;
        }> = [];

        for (const group of groups) {
          const alignments = tokenizeAndAlignText(group);
          if (alignments.length === 0) continue;

          let disagreementCount = 0;
          let entityLexiconTiebreaks = 0;
          let providerPriorityFallbacks = 0;

          const resolvedTokens = alignments.map((alignment) => {
            if ('candidates' in alignment) {
              disagreementCount++;
              const resolved = resolveTokenDisagreement(alignment, entityLexicon);
              if (resolved.resolution === 'entity_lexicon_tiebreak') entityLexiconTiebreaks++;
              if (resolved.resolution === 'provider_priority_fallback') providerPriorityFallbacks++;
              // Every candidate at this disagreement position that did NOT
              // end up among the winning token's agreeing_recording_ids lost
              // this token-level vote -- thread those ids through so
              // buildReconciledSegment can track per-recording dissent
              // directly (CR-01 fix) instead of inferring it from absence.
              const dissentingRecordingIds = alignment.candidates
                .map((c) => c.canonical_recording_id)
                .filter((id) => !resolved.agreeing_recording_ids.includes(id));
              return { token: resolved.token, agreeing_recording_ids: resolved.agreeing_recording_ids, dissenting_recording_ids: dissentingRecordingIds };
            }
            return { token: alignment.token, agreeing_recording_ids: alignment.agreeing_recording_ids };
          });

          const built = buildReconciledSegment(group, resolvedTokens);
          if ('resolved' in built) continue; // fail closed -- ReconciliationRefusal (anchor_unavailable/empty_group), skip this group only. `resolved` never appears on a successful ReconciledSegmentResult, so key-presence alone is the discriminant.

          freshRows.push({
            event_id: built.event_id,
            segment_text: built.segment_text,
            start_time: built.start_time,
            end_time: built.end_time,
            source_recording_ids: built.source_recording_ids,
            agreeing_recording_ids: built.agreeing_recording_ids,
            signals: { coverage: built.coverage, disagreementCount, entityLexiconTiebreaks, providerPriorityFallbacks },
            organization_id: built.organization_id,
          });
        }

        // 10. Persist via full DELETE-then-INSERT (37-RESEARCH.md Pitfall 5
        //     -- RECON-04's "regenerable" requirement). Never an
        //     incremental write with a conflict-resolution target -- this
        //     table has no UNIQUE constraint on purpose (37-01-SUMMARY.md's
        //     locked schema decision). On a delete error: fail closed, skip
        //     this event's insert, log, continue the sweep with the next
        //     event.
        const { error: deleteError } = await supabase.from('reconciled_transcript_segments').delete().eq('event_id', eventId);

        if (deleteError) {
          console.error('[reconcile-transcripts] reconciled_transcript_segments delete failed closed:', deleteError.message);
          summary.errors++;
          continue;
        }

        if (freshRows.length > 0) {
          const { error: insertError } = await supabase.from('reconciled_transcript_segments').insert(freshRows);

          if (insertError) {
            console.error('[reconcile-transcripts] reconciled_transcript_segments insert failed closed:', insertError.message);
            summary.errors++;
            continue;
          }

          summary.segmentsWritten += freshRows.length;
        }

        summary.eventsReconciled++;
      }
    }

    // 11. Return the sweep summary.
    return new Response(JSON.stringify({ success: true, since, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[reconcile-transcripts] handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
