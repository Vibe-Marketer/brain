/**
 * Phase 32 Plan 03, Task 1 -- proves SAFE-03: kill_switch_revert_event_merges
 * reverts every decision='merge_applied' event_match_decisions row inside a
 * time range, in one atomic RPC call (one implicit transaction), optionally
 * scoped to one organization, writing a 'reversed' ledger row per reversal.
 * Also proves the two adjacent guarantees the threat model requires:
 * (T-32-02b) an out-of-window applied merge is left untouched, the
 * p_start_time > p_end_time guard rejects, and the org filter both excludes
 * a different org's in-window merge AND, in a second call, correctly
 * reverts that same org's merge when named.
 *
 * Modeled on src/test/event-match-apply-reverse.integration.test.ts's
 * fixture/cleanup/apply-RPC-calling pattern (supabase/CLAUDE.md "Running
 * integration tests safely").
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts. No fallback to
 * production-like env vars.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-32-03 event-resolution-kill-switch]";

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} SAFE-03 kill_switch_revert_event_merges bulk reversal`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let ownerUserId = "";
    let orgAId = "";
    let orgBId = "";
    const allRecordingIds: string[] = [];

    // Org A, pair "old" -- applied BEFORE the kill-switch's time window is
    // computed, proving an out-of-window applied merge is left untouched.
    let recOld1Id = "";
    let recOld2Id = "";
    let decisionOldId = "";

    // Org A, pair 1 -- inside the window, reverted by the org-A-scoped call.
    let recA1Id = "";
    let recA2Id = "";
    let decision1Id = "";

    // Org A, pair 2 -- inside the window, reverted by the org-A-scoped call.
    let recA3Id = "";
    let recA4Id = "";
    let decision2Id = "";

    // Org B, pair 3 -- inside the window, must NOT be reverted by the
    // org-A-scoped call (proves the org filter excludes the wrong org), then
    // IS reverted by a second, org-B-scoped call (proves the filter also
    // includes the right org).
    let recB1Id = "";
    let recB2Id = "";
    let decision3Id = "";

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      const ownerEmail = `phase32-03-killswitch-owner-${stamp}@callvault.test`;
      const password = `phase32-03-killswitch-${stamp}-pwd!`;

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

      const orgA = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org A ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgA.error || !orgA.data) {
        throw new Error(`${SUITE_TAG} insert org A failed: ${orgA.error?.message}`);
      }
      orgAId = orgA.data.id as string;

      const orgB = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org B ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgB.error || !orgB.data) {
        throw new Error(`${SUITE_TAG} insert org B failed: ${orgB.error?.message}`);
      }
      orgBId = orgB.data.id as string;

      const makeRecording = async (orgId: string, label: string) => {
        const rec = await admin
          .from("recordings")
          .insert({
            organization_id: orgId,
            owner_user_id: ownerUserId,
            title: `${SUITE_TAG} ${label} ${stamp}`,
            source_app: "manual",
          })
          .select("id")
          .single();
        if (rec.error || !rec.data) {
          throw new Error(
            `${SUITE_TAG} insert recording (${label}) failed: ${rec.error?.message}`,
          );
        }
        const id = rec.data.id as string;
        allRecordingIds.push(id);
        return id;
      };

      recOld1Id = await makeRecording(orgAId, "old-1");
      recOld2Id = await makeRecording(orgAId, "old-2");
      recA1Id = await makeRecording(orgAId, "a1");
      recA2Id = await makeRecording(orgAId, "a2");
      recA3Id = await makeRecording(orgAId, "a3");
      recA4Id = await makeRecording(orgAId, "a4");
      recB1Id = await makeRecording(orgBId, "b1");
      recB2Id = await makeRecording(orgBId, "b2");

      const applyPair = async (
        recIdA: string,
        recIdB: string,
        label: string,
      ): Promise<string> => {
        const applied = await admin.rpc("apply_event_match_atomic", {
          p_recording_id_a: recIdA,
          p_recording_id_b: recIdB,
          p_event_id: null,
          p_decided_by: "admin",
          p_signals: { matched_field: `phase32_03_${label}` },
          p_owner_user_id: ownerUserId,
        });
        if (applied.error) {
          throw new Error(
            `${SUITE_TAG} apply_event_match_atomic (${label}) failed: ${applied.error.message}`,
          );
        }
        const [a, b] = recIdA < recIdB ? [recIdA, recIdB] : [recIdB, recIdA];
        const row = await admin
          .from("event_match_decisions")
          .select("id")
          .eq("recording_id_a", a)
          .eq("recording_id_b", b)
          .eq("decision", "merge_applied")
          .single();
        if (row.error || !row.data) {
          throw new Error(
            `${SUITE_TAG} could not read back ${label}'s merge_applied row: ${row.error?.message}`,
          );
        }
        return row.data.id as string;
      };

      // Apply the "old" merge FIRST and read back its real created_at from
      // the DB later (in the test body) -- the kill-switch window boundaries
      // are derived from actual ledger timestamps, never local Date.now(),
      // to avoid test-runner/DB clock-skew flakiness.
      decisionOldId = await applyPair(recOld1Id, recOld2Id, "old");

      // Then apply the three "in window" merges (org A x2, org B x1).
      decision1Id = await applyPair(recA1Id, recA2Id, "a-pair1");
      decision2Id = await applyPair(recA3Id, recA4Id, "a-pair2");
      decision3Id = await applyPair(recB1Id, recB2Id, "b-pair3");
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // Same cleanup contract as event-match-apply-reverse.integration.test.ts:
      // workspace_entries first (BEFORE DELETE trigger blocks hard-delete
      // while referenced), then recordings (cascades event_match_decisions +
      // call_participants), then both organizations, then the fixture user.
      // Every step's `.error` is checked/logged inside its own try/catch so
      // one failure doesn't strand the rest (supabase/CLAUDE.md cleanup
      // contract).
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
        if (orgAId) {
          const { error } = await admin.from("organizations").delete().eq("id", orgAId);
          if (error) {
            console.warn(`${SUITE_TAG} org A delete returned an error:`, error.message);
          }
        }
        if (orgBId) {
          const { error } = await admin.from("organizations").delete().eq("id", orgBId);
          if (error) {
            console.warn(`${SUITE_TAG} org B delete returned an error:`, error.message);
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

    it("kill_switch_revert_event_merges rejects p_start_time > p_end_time", async () => {
      const { data, error } = await admin.rpc("kill_switch_revert_event_merges", {
        p_start_time: "2026-09-02T12:00:00.000Z",
        p_end_time: "2026-09-02T00:00:00.000Z",
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toMatch(/must be <=/i);
    });

    it("reverts both org-A merges in the time window, leaves the out-of-window merge and the other org's merge untouched, and writes a reversed ledger row per reversal", async () => {
      // Window = [decision1's created_at, decision3's created_at] -- covers
      // decision1/decision2/decision3, excludes decisionOld (applied before
      // decision1, so its created_at is strictly earlier -- outside the
      // window's lower bound).
      const boundsQuery = await admin
        .from("event_match_decisions")
        .select("id, created_at")
        .in("id", [decision1Id, decision3Id]);
      expect(boundsQuery.error).toBeNull();
      const byId = new Map(
        (boundsQuery.data ?? []).map((row) => [row.id as string, row.created_at as string]),
      );
      const startTime = byId.get(decision1Id);
      const endTime = byId.get(decision3Id);
      expect(startTime, "decision1 created_at must be readable").toBeTruthy();
      expect(endTime, "decision3 created_at must be readable").toBeTruthy();

      const { data: revertedCount, error } = await admin.rpc(
        "kill_switch_revert_event_merges",
        {
          p_start_time: startTime,
          p_end_time: endTime,
          p_organization_id: orgAId,
        },
      );
      expect(error).toBeNull();
      expect(revertedCount, "expected exactly the 2 org-A in-window merges reverted").toBe(2);

      // Org A's two in-window pairs: event_id back to NULL.
      const orgARecs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recA1Id, recA2Id, recA3Id, recA4Id]);
      expect(orgARecs.error).toBeNull();
      for (const row of orgARecs.data ?? []) {
        expect(row.event_id, `recording ${row.id} was not reverted`).toBeNull();
      }

      // The out-of-window pair (decisionOld) is untouched.
      const oldRecs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recOld1Id, recOld2Id]);
      expect(oldRecs.error).toBeNull();
      for (const row of oldRecs.data ?? []) {
        expect(
          row.event_id,
          `recording ${row.id} (out-of-window pair) must NOT have been reverted`,
        ).not.toBeNull();
      }

      // Org B's in-window pair is untouched (org filter excluded it).
      const orgBRecs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recB1Id, recB2Id]);
      expect(orgBRecs.error).toBeNull();
      for (const row of orgBRecs.data ?? []) {
        expect(
          row.event_id,
          `recording ${row.id} (org B, filtered by p_organization_id=orgA) must NOT have been reverted`,
        ).not.toBeNull();
      }

      // Exactly one reversed row per reverted decision (decision1, decision2);
      // NONE for decisionOld or decision3.
      const reversedRows = await admin
        .from("event_match_decisions")
        .select("id, decision, applied, event_id, reverses_decision_id")
        .in("reverses_decision_id", [decision1Id, decision2Id, decision3Id, decisionOldId]);
      expect(reversedRows.error).toBeNull();
      const reversesSet = new Set((reversedRows.data ?? []).map((r) => r.reverses_decision_id));
      expect(reversesSet.has(decision1Id), "decision1 must have a reversed row").toBe(true);
      expect(reversesSet.has(decision2Id), "decision2 must have a reversed row").toBe(true);
      expect(
        reversesSet.has(decision3Id),
        "decision3 (org B) must NOT have a reversed row yet",
      ).toBe(false);
      expect(
        reversesSet.has(decisionOldId),
        "decisionOld (out-of-window) must NOT have a reversed row",
      ).toBe(false);
      for (const row of reversedRows.data ?? []) {
        expect(row.decision).toBe("reversed");
        expect(row.applied).toBe(false);
        expect(row.event_id).toBeNull();
      }
    });

    it("a second, org-B-scoped call over the same window reverts exactly the org-B merge and does not re-revert the already-reverted org-A merges", async () => {
      const boundsQuery = await admin
        .from("event_match_decisions")
        .select("id, created_at")
        .in("id", [decision1Id, decision3Id]);
      expect(boundsQuery.error).toBeNull();
      const byId = new Map(
        (boundsQuery.data ?? []).map((row) => [row.id as string, row.created_at as string]),
      );
      const startTime = byId.get(decision1Id);
      const endTime = byId.get(decision3Id);

      const { data: revertedCount, error } = await admin.rpc(
        "kill_switch_revert_event_merges",
        {
          p_start_time: startTime,
          p_end_time: endTime,
          p_organization_id: orgBId,
        },
      );
      expect(error).toBeNull();
      expect(revertedCount, "expected exactly the 1 org-B in-window merge reverted").toBe(1);

      const orgBRecs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recB1Id, recB2Id]);
      expect(orgBRecs.error).toBeNull();
      for (const row of orgBRecs.data ?? []) {
        expect(row.event_id, `recording ${row.id} was not reverted`).toBeNull();
      }

      const reversedForB = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("reverses_decision_id", decision3Id);
      expect(reversedForB.error).toBeNull();
      expect(reversedForB.data?.length, "expected exactly one reversed row for decision3").toBe(1);

      // decision1/decision2 (already reverted in the prior test) must not
      // have gained a SECOND reversed row from this call -- decision =
      // 'merge_applied' is the RPC's own filter, so an already-reversed
      // decision is no longer eligible on a later call.
      const doubleReverted = await admin
        .from("event_match_decisions")
        .select("id")
        .in("reverses_decision_id", [decision1Id, decision2Id]);
      expect(doubleReverted.error).toBeNull();
      expect(
        doubleReverted.data?.length,
        "decision1/decision2 must have exactly one reversed row each (from the prior test), not two",
      ).toBe(2);
    });

    it("CR-03 regression (32-REVIEW.md): calling kill_switch_revert_event_merges twice with IDENTICAL parameters (same org, same window) reverts zero decisions the second time and does not create a duplicate reversed row", async () => {
      // Self-contained fixture -- a fresh org-A pair, applied and read back
      // independently of decision1/decision2/decision3/decisionOld above, so
      // this test's identical-window-and-org repeat call cannot interact
      // with (or be confused with) the earlier tests' already-reverted
      // decisions.
      const makeIdempotencyRecording = async (label: string): Promise<string> => {
        const rec = await admin
          .from("recordings")
          .insert({
            organization_id: orgAId,
            owner_user_id: ownerUserId,
            title: `${SUITE_TAG} cr03-idempotency ${label} ${Date.now()}`,
            source_app: "manual",
          })
          .select("id")
          .single();
        if (rec.error || !rec.data) {
          throw new Error(
            `${SUITE_TAG} CR-03 insert recording (${label}) failed: ${rec.error?.message}`,
          );
        }
        const id = rec.data.id as string;
        allRecordingIds.push(id);
        return id;
      };

      const recIdemp1 = await makeIdempotencyRecording("idemp-1");
      const recIdemp2 = await makeIdempotencyRecording("idemp-2");

      const applied = await admin.rpc("apply_event_match_atomic", {
        p_recording_id_a: recIdemp1,
        p_recording_id_b: recIdemp2,
        p_event_id: null,
        p_decided_by: "admin",
        p_signals: { matched_field: "phase32_cr03_idempotency" },
        p_owner_user_id: ownerUserId,
      });
      expect(applied.error).toBeNull();

      const [a, b] = recIdemp1 < recIdemp2 ? [recIdemp1, recIdemp2] : [recIdemp2, recIdemp1];
      const decisionRow = await admin
        .from("event_match_decisions")
        .select("id, created_at")
        .eq("recording_id_a", a)
        .eq("recording_id_b", b)
        .eq("decision", "merge_applied")
        .single();
      expect(decisionRow.error).toBeNull();
      const decisionIdempId = decisionRow.data!.id as string;
      const decisionCreatedAt = decisionRow.data!.created_at as string;

      // IDENTICAL parameters for both calls -- same org, same exact window (a
      // 1-second pad on each side of the decision's own created_at, so the
      // window unambiguously contains exactly this one decision and nothing
      // from the other tests' fixtures).
      const windowStart = new Date(new Date(decisionCreatedAt).getTime() - 1000).toISOString();
      const windowEnd = new Date(new Date(decisionCreatedAt).getTime() + 1000).toISOString();
      const params = {
        p_start_time: windowStart,
        p_end_time: windowEnd,
        p_organization_id: orgAId,
      };

      const firstCall = await admin.rpc("kill_switch_revert_event_merges", params);
      expect(firstCall.error).toBeNull();
      expect(
        firstCall.data,
        "first call must revert exactly the 1 idempotency-fixture decision",
      ).toBe(1);

      // Second call: IDENTICAL parameters -- same org, same window. Must NOT
      // double the reverted count or write a second reversed row. This is
      // the exact CR-03 regression: the pre-fix migration re-selected the
      // same already-reverted decision on a repeat call because its
      // `decision` column was never mutated away from 'merge_applied'.
      const secondCall = await admin.rpc("kill_switch_revert_event_merges", params);
      expect(secondCall.error).toBeNull();
      expect(
        secondCall.data,
        "second identical call must revert ZERO decisions (already reverted)",
      ).toBe(0);

      const reversedRows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("reverses_decision_id", decisionIdempId);
      expect(reversedRows.error).toBeNull();
      expect(
        reversedRows.data?.length,
        "exactly ONE reversed row must exist for this decision, not two",
      ).toBe(1);

      const recs = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recIdemp1, recIdemp2]);
      expect(recs.error).toBeNull();
      for (const row of recs.data ?? []) {
        expect(row.event_id, `recording ${row.id} must remain reverted (NULL)`).toBeNull();
      }
    });
  },
);
