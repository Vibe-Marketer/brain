/**
 * Phase 33 Plan 02, Task 3 -- proves the content-proof tier + speaker-alibi
 * veto end to end on TEST: a same-org pair whose seeded transcript_chunks
 * share a long verbatim passage produces exactly one tier='content_proof'
 * merge_proposed row (MATCH-02); a same-org recording with NO
 * transcript_chunks at all -- the DOMINANT real-world case, since that table
 * has zero live writers today (33-RESEARCH.md Pitfall 1) -- falls through
 * with no error (Success Criterion 3); a same-org pair with time-DISJOINT
 * intervals sharing a confirmed speaker is vetoed despite otherwise-
 * conclusive chunks (MATCH-07); re-running the sweep is idempotent; and the
 * auto-attach CAPABILITY (apply_event_match_atomic with
 * p_tier='content_proof') is proven ONLY by a direct RPC call against two
 * dedicated recordings the sweep never touches (SAFE-02) -- mirroring Phase
 * 31's apply/reverse firewall exactly.
 *
 * Modeled directly on src/test/event-resolution-metadata-tier.integration.test.ts's
 * fixture/cleanup-contract template (supabase/CLAUDE.md "Running integration
 * tests safely") and src/test/event-match-apply-reverse.integration.test.ts's
 * direct apply RPC call shape.
 *
 * transcript_chunks seeding note (verified this session via LIVE schema
 * introspection on both TEST and prod, not just migration-file reading):
 * transcript_chunks.recording_id is NULLABLE with a still-LIVE composite FK
 * (transcript_chunks_recording_user_fkey on (recording_id, user_id) ->
 * fathom_raw_calls(recording_id, user_id)) -- contra 33-02-PLAN.md's
 * seeding-contract note, which claimed this FK was dropped and "any
 * unique-ish bigint works". Postgres never enforces a multi-column FK when
 * any column is NULL, so every seeded chunk below leaves recording_id
 * unset (NULL), sidestepping the FK entirely. canonical_recording_id is
 * what the sweep actually joins on.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and supabase/CLAUDE.md
 * "Running integration tests safely". No fallback to production-like env
 * vars.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";
import { runShadowSweep } from "../../supabase/functions/_shared/event-resolver.ts";

const SUITE_TAG = "[phase-33-02 event-resolution-content-proof]";

// PASSAGE_1: shared verbatim by the content-proof pair (A/B) ONLY. Split
// into 6 chunks of ~8 tokens each; concatenated by chunk_index (ordinal
// position -- exactly what the content-proof tier aligns on, never a
// wall-clock timestamp), the resulting ~48-token corpus is BYTE-IDENTICAL on
// both sides, producing far more than CONTENT_PROOF_MIN_SHARED_SHINGLES (5)
// shared 7-token shingles.
const PASSAGE_1_CHUNKS = [
  "so the quarterly revenue numbers came in higher",
  "than we originally projected for the entire region",
  "and the leadership team was genuinely pleased with",
  "the results we posted across every product line",
  "the renewal pipeline for next quarter also looks",
  "stronger than expected given the current market conditions",
];

// PASSAGE_2: shared verbatim by the alibi pair (A/B) ONLY -- deliberately
// disjoint vocabulary from PASSAGE_1 (a completely different topic) so no
// cross-pair 7-token shingle collision is even possible.
const PASSAGE_2_CHUNKS = [
  "the overnight deployment pipeline failed during the canary",
  "rollout and paged the on call engineer around",
  "three in the morning after digging through the",
  "logs we traced it to a stale feature",
  "flag that never got cleaned up after the",
  "previous release so we reverted and shipped a fix",
];

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} MATCH-02/MATCH-07 content-proof tier + alibi veto sweep proof`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let userId = "";
    let userEmail = "";
    let orgId = "";
    const allRecordingIds: string[] = [];
    const allWorkspaceEntryRecordingIds: string[] = [];
    const chunkBearingRecordingIds: string[] = [];
    let recContentProofA = ""; // org, fathom -- content-proof pair member 1
    let recContentProofB = ""; // org, grain -- content-proof pair member 2 (shares PASSAGE_1)
    let recZeroTranscript = ""; // org, fathom -- NO transcript_chunks at all (the dominant real-world case)
    let recAlibiA = ""; // org, fathom -- alibi pair member 1 (confirmed speaker)
    let recAlibiB = ""; // org, grain -- alibi pair member 2, time-DISJOINT from A, shares PASSAGE_2
    let recAutoAttachA = ""; // org, fathom -- dedicated pair for the direct apply RPC proof, untouched by the sweep
    let recAutoAttachB = ""; // org, grain -- dedicated pair for the direct apply RPC proof, untouched by the sweep

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      userEmail = `phase33-02-content-proof-${stamp}@callvault.test`;
      const userPassword = `phase33-02-content-proof-${stamp}-pwd!`;

      // 1. One fixture user, reused as owner_user_id across every fixture
      //    recording and as the seeded chunks' user_id.
      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      if (createUser.error || !createUser.data.user) {
        throw new Error(`${SUITE_TAG} createUser failed: ${createUser.error?.message}`);
      }
      userId = createUser.data.user.id;

      // 2. One organization, flagged for event_resolution.
      const org = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (org.error || !org.data) {
        throw new Error(`${SUITE_TAG} insert org failed: ${org.error?.message}`);
      }
      orgId = org.data.id as string;

      const flagInsert = await admin.from("organization_feature_flags").insert({
        organization_id: orgId,
        flag_key: "event_resolution",
        enabled: true,
      });
      if (flagInsert.error) {
        throw new Error(
          `${SUITE_TAG} insert organization_feature_flags failed: ${flagInsert.error.message}`,
        );
      }

      const insertRecording = async (opts: {
        label: string;
        sourceApp: string;
        title: string;
        start: string;
        end: string;
      }): Promise<string> => {
        const rec = await admin
          .from("recordings")
          .insert({
            organization_id: orgId,
            owner_user_id: userId,
            title: opts.title,
            source_app: opts.sourceApp,
            // Deliberately NO tier-1-eligible field (only zoom_meeting_id is
            // tier-1-eligible) anywhere in this fixture set -- zero tier-1
            // signal, isolating every assertion below to the content-proof
            // tier + alibi veto.
            source_metadata: { [`${opts.sourceApp}_call_id`]: `${opts.label}-${stamp}` },
            recording_start_time: opts.start,
            recording_end_time: opts.end,
          })
          .select("id")
          .single();
        if (rec.error || !rec.data) {
          throw new Error(`${SUITE_TAG} insert recording ${opts.label} failed: ${rec.error?.message}`);
        }
        const id = rec.data.id as string;
        allRecordingIds.push(id);
        allWorkspaceEntryRecordingIds.push(id);
        return id;
      };

      const insertParticipant = async (opts: {
        recordingId: string;
        email: string;
        hasConfirmedSpeech: boolean | null;
      }): Promise<void> => {
        const { error } = await admin.from("call_participants").insert({
          recording_id: opts.recordingId,
          organization_id: orgId,
          email: opts.email,
          name: null,
          participant_type: "attendee",
          has_confirmed_speech: opts.hasConfirmedSpeech,
        });
        if (error) {
          throw new Error(
            `${SUITE_TAG} insert call_participants for ${opts.recordingId} failed: ${error.message}`,
          );
        }
      };

      const insertTranscriptChunks = async (
        canonicalRecordingId: string,
        texts: string[],
      ): Promise<void> => {
        const rows = texts.map((text, index) => ({
          user_id: userId,
          // recording_id intentionally OMITTED (see file header) -- stays
          // NULL, sidestepping the still-live composite FK to
          // fathom_raw_calls rather than fabricating a bigint that would
          // violate it.
          canonical_recording_id: canonicalRecordingId,
          chunk_text: text,
          chunk_index: index,
        }));
        const { error } = await admin.from("transcript_chunks").insert(rows);
        if (error) {
          throw new Error(
            `${SUITE_TAG} insert transcript_chunks for ${canonicalRecordingId} failed: ${error.message}`,
          );
        }
        chunkBearingRecordingIds.push(canonicalRecordingId);
      };

      // (A) Content-proof pair: OVERLAPPING times, ZERO participant overlap
      // (no call_participants rows at all -- caps the metadata tier's max
      // possible score for this pair at participant(0) + time(<=0.35) +
      // title(<=0.20) = 0.55, structurally below MERGE_PROPOSE_THRESHOLD
      // (0.80) regardless of anything else, isolating every assertion below
      // to the content-proof tier alone), sharing PASSAGE_1 across 6 chunks
      // each. No confirmed-speaker alibi conflict is possible here by
      // construction -- overlapping intervals never violate the alibi veto
      // regardless of participants.
      recContentProofA = await insertRecording({
        label: "content-proof-a",
        sourceApp: "fathom",
        title: `${SUITE_TAG} content-proof-a ${stamp}`,
        start: "2026-01-01T09:00:00.000Z",
        end: "2026-01-01T10:00:00.000Z",
      });
      recContentProofB = await insertRecording({
        label: "content-proof-b",
        sourceApp: "grain",
        title: `${SUITE_TAG} content-proof-b ${stamp}`,
        start: "2026-01-01T09:15:00.000Z",
        end: "2026-01-01T10:15:00.000Z",
      });
      await insertTranscriptChunks(recContentProofA, PASSAGE_1_CHUNKS);
      await insertTranscriptChunks(recContentProofB, PASSAGE_1_CHUNKS);

      // (B) Zero-transcript recording -- the DOMINANT real-world case (no
      // live writer populates transcript_chunks today, 33-RESEARCH.md
      // Pitfall 1). NO chunks inserted at all. Far away in time with no
      // participants, so it can never pair with anything via any tier --
      // this recording exists purely to prove the fall-through path when
      // mixed into the SAME sweep batch as recordings that DO have chunks.
      recZeroTranscript = await insertRecording({
        label: "zero-transcript",
        sourceApp: "fathom",
        title: `${SUITE_TAG} zero-transcript ${stamp}`,
        start: "2026-04-01T09:00:00.000Z",
        end: "2026-04-01T10:00:00.000Z",
      });

      // (C) Alibi pair: time-DISJOINT (4-hour gap -- zero time overlap,
      // verified via calculateTimeOverlap's Math.max(0, ...) clamp), sharing
      // PASSAGE_2 chunks that WOULD otherwise be a conclusive content-proof
      // match on their own, AND a shared participant confirmed to have
      // spoken (has_confirmed_speech=true) on recAlibiA's side. The alibi
      // veto must suppress this pair despite the conclusive content-proof
      // match.
      recAlibiA = await insertRecording({
        label: "alibi-a",
        sourceApp: "fathom",
        title: `${SUITE_TAG} alibi-a ${stamp}`,
        start: "2026-02-01T09:00:00.000Z",
        end: "2026-02-01T10:00:00.000Z",
      });
      recAlibiB = await insertRecording({
        label: "alibi-b",
        sourceApp: "grain",
        title: `${SUITE_TAG} alibi-b ${stamp}`,
        start: "2026-02-01T14:00:00.000Z", // 4 hours after A ends -- fully disjoint
        end: "2026-02-01T15:00:00.000Z",
      });
      await insertTranscriptChunks(recAlibiA, PASSAGE_2_CHUNKS);
      await insertTranscriptChunks(recAlibiB, PASSAGE_2_CHUNKS);
      const alibiEmail = `alibi-shared-${stamp}@example.com`;
      await insertParticipant({ recordingId: recAlibiA, email: alibiEmail, hasConfirmedSpeech: true });
      await insertParticipant({ recordingId: recAlibiB, email: alibiEmail, hasConfirmedSpeech: null });

      // Two DEDICATED recordings for the direct apply_event_match_atomic
      // capability proof -- no chunks, no participants (inert to every
      // tier), never touched by any runShadowSweep call in this suite, so
      // they cannot disturb the content-proof pair's propose-only
      // assertions (per 33-02-PLAN.md Task 3, option: dedicated recordings
      // instead of reversing the merge in cleanup).
      recAutoAttachA = await insertRecording({
        label: "auto-attach-a",
        sourceApp: "fathom",
        title: `${SUITE_TAG} auto-attach-a ${stamp}`,
        start: "2026-05-01T09:00:00.000Z",
        end: "2026-05-01T09:30:00.000Z",
      });
      recAutoAttachB = await insertRecording({
        label: "auto-attach-b",
        sourceApp: "grain",
        title: `${SUITE_TAG} auto-attach-b ${stamp}`,
        start: "2026-05-01T09:05:00.000Z",
        end: "2026-05-01T09:35:00.000Z",
      });
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // 1. transcript_chunks FIRST, by canonical_recording_id. Its FK to
      //    recordings is ON DELETE SET NULL, not CASCADE -- deleting
      //    recordings before this would silently orphan these rows
      //    (canonical_recording_id -> NULL) and this WHERE clause would then
      //    match zero rows, leaking them permanently.
      try {
        if (chunkBearingRecordingIds.length > 0) {
          const { error } = await admin
            .from("transcript_chunks")
            .delete()
            .in("canonical_recording_id", chunkBearingRecordingIds);
          if (error) {
            console.warn(`${SUITE_TAG} transcript_chunks cleanup returned an error:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} transcript_chunks cleanup threw:`, err);
      }

      // 2. workspace_entries -- recordings has a protective BEFORE DELETE
      //    trigger blocking deletion while linked via workspace_entries
      //    (tr_auto_create_default_workspace_entry auto-links every fixture
      //    recording into its org's default workspace on INSERT).
      try {
        if (allWorkspaceEntryRecordingIds.length > 0) {
          const { error } = await admin
            .from("workspace_entries")
            .delete()
            .in("recording_id", allWorkspaceEntryRecordingIds);
          if (error) {
            console.warn(`${SUITE_TAG} workspace_entries cleanup returned an error:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} workspace_entries cleanup threw:`, err);
      }

      // 3. recordings (cascades event_match_decisions + call_participants).
      //    The `events` row created by the direct apply-RPC test becomes
      //    orphaned (recordings.event_id -> events.id has no reverse
      //    cascade) -- same accepted, uncleaned byproduct as
      //    event-match-apply-reverse.integration.test.ts's own established
      //    pattern (events carries no organization_id to cascade from
      //    either).
      try {
        for (const id of allRecordingIds) {
          const { error } = await admin.from("recordings").delete().eq("id", id);
          if (error) {
            console.warn(`${SUITE_TAG} recording ${id} delete returned an error:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} recording cleanup threw:`, err);
      }

      // 4. organization (cascades workspaces + organization_feature_flags +
      //    any remaining recordings).
      try {
        if (orgId) {
          const { error } = await admin.from("organizations").delete().eq("id", orgId);
          if (error) {
            console.warn(`${SUITE_TAG} organization delete returned an error:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} org cleanup threw:`, err);
      }

      // 5. fixture user.
      try {
        const { error } = await admin.rpc("cleanup_test_fixture_users", {
          p_max_age_minutes: 0,
        });
        if (error) {
          console.warn(`${SUITE_TAG} cleanup_test_fixture_users RPC failed:`, error.message);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} cleanup threw:`, err);
      }
    }, 60_000);

    it("fixture recordings all start with event_id IS NULL", async () => {
      const { data, error } = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);

      expect(error).toBeNull();
      expect(data?.length ?? 0).toBe(7);
      for (const row of data ?? []) {
        expect(row.event_id).toBeNull();
      }
    });

    it("runShadowSweep proposes exactly one content-proof pair, lets the zero-transcript recording fall through with no error, and vetoes the alibi pair despite conclusive chunks", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgId] });

      expect(summary.errors).toBe(0);
      expect(summary.organizationsScanned).toBe(1);
      expect(summary.recordingsScanned).toBe(7);
      // Zero tier-1 signal anywhere in this fixture set.
      expect(summary.proposed).toBe(0);
      expect(summary.skipped).toBe(7);
      // Zero metadata proposals -- every pair in this fixture set is either
      // zero-participant-overlap (caps score at 0.55) or zero-time-overlap
      // (hard-gated out), confirming this suite's isolation to the
      // content-proof tier + alibi veto is real, not coincidental.
      expect(summary.metadataProposed).toBe(0);
      // Exactly one conclusive content-proof pair (A, B); the alibi pair is
      // ALSO conclusive on content alone but is vetoed BEFORE it would be
      // counted here.
      expect(summary.contentProofProposed).toBe(1);
      // Exactly one veto: the alibi pair.
      expect(summary.alibiRejected).toBe(1);

      // (a) The content-proof pair produced exactly one tier='content_proof'
      //     row, MATCH-02's shape: decision='merge_proposed', applied=false,
      //     decided_by='auto', a 0..1 score, canonically ordered.
      const [expectedA, expectedB] =
        recContentProofA < recContentProofB
          ? [recContentProofA, recContentProofB]
          : [recContentProofB, recContentProofA];

      const contentProofRows = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, score, signals, decision, decided_by, applied",
        )
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB);

      expect(contentProofRows.error).toBeNull();
      expect(
        contentProofRows.data?.length,
        "expected exactly one merge_proposed row for the content-proof pair",
      ).toBe(1);

      const row = contentProofRows.data![0];
      expect(row.tier).toBe("content_proof");
      expect(row.decision).toBe("merge_proposed");
      expect(row.decided_by).toBe("auto");
      expect(row.applied).toBe(false);
      expect(row.event_id).toBeNull();
      expect(typeof row.score).toBe("number");
      expect(row.score as number).toBeGreaterThanOrEqual(0);
      expect(row.score as number).toBeLessThanOrEqual(1);
      const signals = row.signals as Record<string, unknown>;
      expect(typeof signals.shared_shingles).toBe("number");
      expect(signals.shared_shingles as number).toBeGreaterThanOrEqual(5);

      // (b) Zero-transcript recording: NO row anywhere involves it (Success
      //     Criterion 3, the dominant real-world path) -- the fetch found no
      //     chunks, produced no match, and raised no error (already asserted
      //     via summary.errors === 0 above).
      const zeroTranscriptRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(`recording_id_a.eq.${recZeroTranscript},recording_id_b.eq.${recZeroTranscript}`);
      expect(zeroTranscriptRows.error).toBeNull();
      expect(zeroTranscriptRows.data?.length ?? 0).toBe(0);

      // (c) Alibi pair: ZERO merge_proposed rows despite conclusive chunks --
      //     the veto suppressed the write entirely (reject-only, no ledger
      //     row this phase per 33-01 Task 1 option-a).
      const [alibiExpectedA, alibiExpectedB] =
        recAlibiA < recAlibiB ? [recAlibiA, recAlibiB] : [recAlibiB, recAlibiA];
      const alibiRows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("recording_id_a", alibiExpectedA)
        .eq("recording_id_b", alibiExpectedB);
      expect(alibiRows.error).toBeNull();
      expect(alibiRows.data?.length ?? 0).toBe(0);

      // (d) The two DEDICATED auto-attach recordings are completely
      //     untouched by the sweep -- zero event_match_decisions rows of ANY
      //     kind involving them (proves the direct-call proof below
      //     exercises a capability the sweep itself never invokes here).
      const autoAttachRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(
          `recording_id_a.eq.${recAutoAttachA},recording_id_b.eq.${recAutoAttachA},recording_id_a.eq.${recAutoAttachB},recording_id_b.eq.${recAutoAttachB}`,
        );
      expect(autoAttachRows.error).toBeNull();
      expect(autoAttachRows.data?.length ?? 0).toBe(0);

      // (e) recordings.event_id stays NULL for all 7 fixture recordings
      //     after the sweep -- propose-only, never applies (SAFE-02).
      const postSweep = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(postSweep.error).toBeNull();
      expect(postSweep.data?.length ?? 0).toBe(7);
      for (const r of postSweep.data ?? []) {
        expect(r.event_id, `recording ${r.id} unexpectedly has event_id set -- SAFE-02 violated`).toBeNull();
      }
    });

    it("re-running the sweep is idempotent -- still exactly one content-proof row for the pair, alibi pair still suppressed", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgId] });
      expect(summary.errors).toBe(0);
      expect(summary.contentProofProposed).toBe(1); // re-proposed, no-op'd via unique_violation tolerance (Pattern 3)
      expect(summary.alibiRejected).toBe(1); // recomputed fresh each call, not cumulative DB state

      const [expectedA, expectedB] =
        recContentProofA < recContentProofB
          ? [recContentProofA, recContentProofB]
          : [recContentProofB, recContentProofA];
      const rows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB);
      expect(rows.error).toBeNull();
      expect(rows.data?.length, "re-run must not create a second row for the same pair+tier").toBe(1);

      const [alibiExpectedA, alibiExpectedB] =
        recAlibiA < recAlibiB ? [recAlibiA, recAlibiB] : [recAlibiB, recAlibiA];
      const alibiRows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("recording_id_a", alibiExpectedA)
        .eq("recording_id_b", alibiExpectedB);
      expect(alibiRows.error).toBeNull();
      expect(alibiRows.data?.length ?? 0).toBe(0);
    });

    it("direct apply_event_match_atomic(p_tier='content_proof') auto-attaches two dedicated recordings, never via the sweep (SAFE-02)", async () => {
      const signals = { source: "phase-33-test" };

      const { data: eventId, error } = await admin.rpc("apply_event_match_atomic", {
        p_recording_id_a: recAutoAttachA,
        p_recording_id_b: recAutoAttachB,
        p_event_id: null,
        p_decided_by: "admin",
        p_signals: signals,
        p_owner_user_id: userId,
        p_tier: "content_proof",
      });

      expect(error).toBeNull();
      expect(typeof eventId).toBe("string");
      expect(eventId).not.toBe("");

      // BOTH recordings now carry that event_id.
      const recs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recAutoAttachA, recAutoAttachB]);
      expect(recs.error).toBeNull();
      expect(recs.data?.length ?? 0).toBe(2);
      for (const row of recs.data ?? []) {
        expect(row.event_id, `recording ${row.id} did not get the applied event_id`).toBe(eventId);
      }

      // Exactly one merge_applied ledger row, tier='content_proof' (proves
      // the p_tier plumbing all the way from the RPC parameter into the
      // ledger row -- Pitfall 2's whole point).
      const [expectedA, expectedB] =
        recAutoAttachA < recAutoAttachB ? [recAutoAttachA, recAutoAttachB] : [recAutoAttachB, recAutoAttachA];
      const decisions = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, score, signals, decision, decided_by, applied",
        )
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB)
        .eq("decision", "merge_applied");
      expect(decisions.error).toBeNull();
      expect(decisions.data?.length, "expected exactly one merge_applied row").toBe(1);

      const row = decisions.data![0];
      expect(row.tier).toBe("content_proof");
      expect(row.event_id).toBe(eventId);
      expect(row.score).toBeNull();
      expect(row.decided_by).toBe("admin");
      expect(row.applied).toBe(true);
      expect(row.signals).toEqual(signals);
    });
  },
);
