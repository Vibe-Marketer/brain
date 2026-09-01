/**
 * Phase 31 Plan 02, Task 2 -- proves MATCH-10: apply_event_match_atomic then
 * reverse_event_match_atomic round-trips recordings.event_id from NULL -> set
 * -> NULL atomically, with a merge_applied ledger row followed by a reversed
 * row (reverses_decision_id linking them). Also proves the ownership-by-
 * parameter guard on BOTH RPCs (a non-owner p_owner_user_id is rejected) and
 * the SAFE-02 boundary: _shared/event-resolver.ts (the automatic shadow
 * sweep) never references either RPC name, so this capability is exercised
 * ONLY here, by a direct service-role call -- never by the sweep and never by
 * any UI (there is none this phase).
 *
 * Modeled on src/test/event-schema-noop.integration.test.ts's fixture/cleanup
 * template and src/test/event-resolution-shadow.integration.test.ts's
 * recording-fixture-insert + cleanup-contract pattern (supabase/CLAUDE.md
 * "Running integration tests safely").
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts. No fallback to
 * production-like env vars.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-31-02 event-match-apply-reverse]";

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} MATCH-10 apply->reverse round trip + ownership guard + SAFE-02 boundary`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let ownerUserId = "";
    let otherUserId = "";
    let orgId = "";
    let recordingAId = "";
    let recordingBId = "";
    const allRecordingIds: string[] = [];
    let appliedDecisionId = "";
    let appliedEventId = "";

    // Distinct start/end per recording so the applied event's derived
    // canonical_start/end (LEAST(start)/GREATEST(end) across the pair, per
    // apply_event_match_atomic's implementation) is provably not a copy of
    // either single recording's own times.
    const startA = "2026-09-01T14:00:00.000Z";
    const endA = "2026-09-01T14:30:00.000Z";
    const startB = "2026-09-01T14:05:00.000Z"; // later start than A
    const endB = "2026-09-01T14:45:00.000Z"; // later end than A

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      const ownerEmail = `phase31-02-applyrev-owner-${stamp}@callvault.test`;
      const otherEmail = `phase31-02-applyrev-other-${stamp}@callvault.test`;
      const password = `phase31-02-applyrev-${stamp}-pwd!`;

      // 1. Two fixture users: the real owner, and a second user with NO
      //    relationship to the fixture recordings at all -- the negative
      //    ownership tests below call apply/reverse with this user's id.
      const createOwner = await admin.auth.admin.createUser({
        email: ownerEmail,
        password,
        email_confirm: true,
      });
      if (createOwner.error || !createOwner.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser (owner) failed: ${createOwner.error?.message}`,
        );
      }
      ownerUserId = createOwner.data.user.id;

      const createOther = await admin.auth.admin.createUser({
        email: otherEmail,
        password,
        email_confirm: true,
      });
      if (createOther.error || !createOther.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser (other) failed: ${createOther.error?.message}`,
        );
      }
      otherUserId = createOther.data.user.id;

      // 2. One organization.
      const org = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (org.error || !org.data) {
        throw new Error(`${SUITE_TAG} insert org failed: ${org.error?.message}`);
      }
      orgId = org.data.id as string;

      // 3. Two recordings owned by ownerUserId, event_id NULL (default),
      //    distinct start/end times.
      const recA = await admin
        .from("recordings")
        .insert({
          organization_id: orgId,
          owner_user_id: ownerUserId,
          title: `${SUITE_TAG} rec A ${stamp}`,
          source_app: "manual",
          recording_start_time: startA,
          recording_end_time: endA,
        })
        .select("id")
        .single();
      if (recA.error || !recA.data) {
        throw new Error(`${SUITE_TAG} insert recording A failed: ${recA.error?.message}`);
      }
      recordingAId = recA.data.id as string;
      allRecordingIds.push(recordingAId);

      const recB = await admin
        .from("recordings")
        .insert({
          organization_id: orgId,
          owner_user_id: ownerUserId,
          title: `${SUITE_TAG} rec B ${stamp}`,
          source_app: "manual",
          recording_start_time: startB,
          recording_end_time: endB,
        })
        .select("id")
        .single();
      if (recB.error || !recB.data) {
        throw new Error(`${SUITE_TAG} insert recording B failed: ${recB.error?.message}`);
      }
      recordingBId = recB.data.id as string;
      allRecordingIds.push(recordingBId);
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // Same cleanup contract as event-resolution-shadow.integration.test.ts
      // (Phase 31 Plan 01, Task 3): workspace_entries first (a BEFORE DELETE
      // trigger on recordings blocks hard-delete while any workspace_entries
      // row still references it -- tr_auto_create_default_workspace_entry
      // auto-linked both fixture recordings on INSERT), then recordings
      // (cascades event_match_decisions + call_participants), then the
      // organization (cascades workspaces + organization_feature_flags + any
      // remaining recordings), then the two fixture users. Every step's
      // `.error` is checked and logged -- a Supabase query error does not
      // throw, so an unchecked delete would silently under-report a cleanup
      // failure.
      try {
        if (allRecordingIds.length > 0) {
          const { error } = await admin
            .from("workspace_entries")
            .delete()
            .in("recording_id", allRecordingIds);
          if (error) {
            console.warn(
              `${SUITE_TAG} workspace_entries cleanup returned an error:`,
              error.message,
            );
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} workspace_entries cleanup threw:`, err);
      }

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

    it("fixture recordings start with event_id IS NULL", async () => {
      const { data, error } = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(error).toBeNull();
      expect(data?.length ?? 0).toBe(2);
      for (const row of data ?? []) {
        expect(row.event_id).toBeNull();
      }
    });

    it("apply_event_match_atomic rejects a non-owner p_owner_user_id (ownership-by-parameter guard)", async () => {
      const { data, error } = await admin.rpc("apply_event_match_atomic", {
        p_recording_id_a: recordingAId,
        p_recording_id_b: recordingBId,
        p_event_id: null,
        p_decided_by: "admin",
        p_signals: { matched_field: "manual_test_seed" },
        p_owner_user_id: otherUserId, // does NOT own recordingA/B
      });

      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/access denied/i);

      // Confirm the rejected call left no trace: still no event_id, no ledger row.
      const post = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(post.error).toBeNull();
      for (const row of post.data ?? []) {
        expect(row.event_id).toBeNull();
      }
    });

    it("apply_event_match_atomic(owner) creates an event, sets BOTH recordings' event_id, and writes exactly one merge_applied row", async () => {
      const signals = {
        matched_field: "manual_test_seed",
        note: "phase-31-02 apply-reverse round trip",
      };

      const { data: eventId, error } = await admin.rpc("apply_event_match_atomic", {
        p_recording_id_a: recordingAId,
        p_recording_id_b: recordingBId,
        p_event_id: null,
        p_decided_by: "admin",
        p_signals: signals,
        p_owner_user_id: ownerUserId,
      });

      expect(error).toBeNull();
      expect(typeof eventId).toBe("string");
      expect(eventId).not.toBe("");
      appliedEventId = eventId as string;

      // BOTH recordings now carry that event_id.
      const recs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(recs.error).toBeNull();
      expect(recs.data?.length ?? 0).toBe(2);
      for (const row of recs.data ?? []) {
        expect(
          row.event_id,
          `recording ${row.id} did not get the applied event_id`,
        ).toBe(appliedEventId);
      }

      // The derived event's canonical_start/end: LEAST(start)/GREATEST(end)
      // across the pair (recording A starts earlier, recording B ends later).
      const event = await admin
        .from("events")
        .select("id, canonical_start_time, canonical_end_time, resolution_confidence")
        .eq("id", appliedEventId)
        .single();
      expect(event.error).toBeNull();
      expect(new Date(event.data!.canonical_start_time as string).toISOString()).toBe(
        new Date(startA).toISOString(),
      );
      expect(new Date(event.data!.canonical_end_time as string).toISOString()).toBe(
        new Date(endB).toISOString(),
      );
      expect(event.data!.resolution_confidence).toBeNull();

      // Exactly one event_match_decisions row, decision='merge_applied',
      // applied=true (MATCH-09 shape).
      const [expectedA, expectedB] =
        recordingAId < recordingBId ? [recordingAId, recordingBId] : [recordingBId, recordingAId];
      const decisions = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, score, signals, decision, decided_by, applied, reverses_decision_id",
        )
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB)
        .eq("decision", "merge_applied");
      expect(decisions.error).toBeNull();
      expect(decisions.data?.length, "expected exactly one merge_applied row").toBe(1);

      const row = decisions.data![0];
      appliedDecisionId = row.id as string;
      expect(row.event_id).toBe(appliedEventId);
      expect(row.tier).toBe("deterministic");
      expect(row.score).toBeNull();
      expect(row.decided_by).toBe("admin");
      expect(row.applied).toBe(true);
      expect(row.reverses_decision_id).toBeNull();
      expect(row.signals).toEqual(signals);
    });

    it("reverse_event_match_atomic rejects a non-owner p_owner_user_id and leaves the applied merge untouched", async () => {
      expect(appliedDecisionId, "prior test must have set appliedDecisionId").not.toBe("");

      const { error } = await admin.rpc("reverse_event_match_atomic", {
        p_decision_id: appliedDecisionId,
        p_owner_user_id: otherUserId, // does NOT own recordingA/B
      });
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/access denied/i);

      // The applied merge is untouched: event_id still set, no reversed row.
      const recs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(recs.error).toBeNull();
      for (const row of recs.data ?? []) {
        expect(row.event_id, "rejected reverse call must not have mutated event_id").toBe(
          appliedEventId,
        );
      }

      const reversedRows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("reverses_decision_id", appliedDecisionId);
      expect(reversedRows.error).toBeNull();
      expect(reversedRows.data?.length ?? 0).toBe(0);
    });

    it("reverse_event_match_atomic(owner) nulls BOTH recordings' event_id and writes a reversed row referencing the applied decision", async () => {
      const { error } = await admin.rpc("reverse_event_match_atomic", {
        p_decision_id: appliedDecisionId,
        p_owner_user_id: ownerUserId,
      });
      expect(error).toBeNull();

      // BOTH recordings back to event_id IS NULL.
      const recs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(recs.error).toBeNull();
      expect(recs.data?.length ?? 0).toBe(2);
      for (const row of recs.data ?? []) {
        expect(row.event_id, `recording ${row.id} was not reversed back to NULL`).toBeNull();
      }

      // A new event_match_decisions row: decision='reversed',
      // reverses_decision_id = the applied row's id, applied=false,
      // event_id NULL, same canonically-ordered pair + tier as the original.
      const [expectedA, expectedB] =
        recordingAId < recordingBId ? [recordingAId, recordingBId] : [recordingBId, recordingAId];
      const reversedRows = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, decision, decided_by, applied, reverses_decision_id",
        )
        .eq("reverses_decision_id", appliedDecisionId);
      expect(reversedRows.error).toBeNull();
      expect(reversedRows.data?.length, "expected exactly one reversed row").toBe(1);

      const reversedRow = reversedRows.data![0];
      expect(reversedRow.decision).toBe("reversed");
      expect(reversedRow.applied).toBe(false);
      expect(reversedRow.event_id).toBeNull();
      expect(reversedRow.tier).toBe("deterministic");
      expect(reversedRow.recording_id_a).toBe(expectedA);
      expect(reversedRow.recording_id_b).toBe(expectedB);

      // The original applied row is untouched (append-only ledger -- the
      // reversal is a NEW row, not a mutation of the old one).
      const original = await admin
        .from("event_match_decisions")
        .select("id, decision, applied")
        .eq("id", appliedDecisionId)
        .single();
      expect(original.error).toBeNull();
      expect(original.data!.decision).toBe("merge_applied");
      expect(original.data!.applied).toBe(true);
    });

    it("SAFE-02 boundary: _shared/event-resolver.ts (the automatic shadow sweep) never references apply_event_match_atomic or reverse_event_match_atomic -- this RPC pair is exercised ONLY by this direct test, never by the sweep", () => {
      const resolverSource = readFileSync(
        resolve(process.cwd(), "supabase/functions/_shared/event-resolver.ts"),
        "utf-8",
      );
      expect(resolverSource).not.toContain("apply_event_match_atomic");
      expect(resolverSource).not.toContain("reverse_event_match_atomic");
    });
  },
);
