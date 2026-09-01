/**
 * Phase 31 Plan 01, Task 3 -- proves the shadow-resolution pipeline end to
 * end on TEST: a shared Zoom tier-1 identifier produces exactly one
 * merge_proposed event_match_decisions row (MATCH-01, MATCH-09), the
 * per-organization flag gate blocks an unflagged org even when it shares an
 * identical signal (SAFE-01), and recordings.event_id stays NULL for every
 * fixture recording after the sweep (SAFE-02 -- the ledger exists, the merge
 * does not).
 *
 * Modeled directly on src/test/event-schema-noop.integration.test.ts's
 * fixture/cleanup-contract template (supabase/CLAUDE.md "Running integration
 * tests safely"). Calls runShadowSweep directly with the service-role
 * client -- the cron -> HTTP path (resolve-events/index.ts) is exercised in
 * prod; the resolution logic itself is proven here.
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

const SUITE_TAG = "[phase-31-01 event-resolution-shadow]";

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} MATCH-01/MATCH-09/SAFE-01/SAFE-02 shadow sweep proof`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let userId = "";
    let userEmail = "";
    let orgOnId = "";
    let orgOffId = "";
    let recOnSharedA = "";
    let recOnSharedB = "";
    let recOnDistinct = "";
    let recOffSharedA = "";
    let recOffSharedB = "";
    const allRecordingIds: string[] = [];

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      userEmail = `phase31-01-shadow-${stamp}@callvault.test`;
      const userPassword = `phase31-01-shadow-${stamp}-pwd!`;

      // 1. One fixture user -- recordings.owner_user_id is NOT NULL
      //    REFERENCES auth.users(id), reused across every fixture recording
      //    (ownership is not what this suite tests).
      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      if (createUser.error || !createUser.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser failed: ${createUser.error?.message}`,
        );
      }
      userId = createUser.data.user.id;

      // 2. Two organizations: O_on gets the event_resolution flag enabled,
      //    O_off gets NO flag row at all (SAFE-01's "off unless an explicit
      //    row exists" -- the stronger, more literal proof than enabled=false).
      const orgOn = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org-on ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgOn.error || !orgOn.data) {
        throw new Error(`${SUITE_TAG} insert org-on failed: ${orgOn.error?.message}`);
      }
      orgOnId = orgOn.data.id as string;

      const orgOff = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org-off ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgOff.error || !orgOff.data) {
        throw new Error(`${SUITE_TAG} insert org-off failed: ${orgOff.error?.message}`);
      }
      orgOffId = orgOff.data.id as string;

      // 3. Flag row for O_on only.
      const flagInsert = await admin.from("organization_feature_flags").insert({
        organization_id: orgOnId,
        flag_key: "event_resolution",
        enabled: true,
      });
      if (flagInsert.error) {
        throw new Error(
          `${SUITE_TAG} insert organization_feature_flags failed: ${flagInsert.error.message}`,
        );
      }

      // 4. Recordings. O_on: two share a Zoom tier-1 signal, one differs.
      //    O_off: two share a Zoom tier-1 signal too -- proves the flag gate,
      //    not the matcher itself, is what keeps them unmerged.
      const sharedOnSignal = `${SUITE_TAG}-on-shared-${stamp}`;
      const distinctOnSignal = `${SUITE_TAG}-on-distinct-${stamp}`;
      const sharedOffSignal = `${SUITE_TAG}-off-shared-${stamp}`;

      const insertRecording = async (
        organizationId: string,
        label: string,
        zoomMeetingId: string,
      ): Promise<string> => {
        const rec = await admin
          .from("recordings")
          .insert({
            organization_id: organizationId,
            owner_user_id: userId,
            title: `${SUITE_TAG} ${label} ${stamp}`,
            source_app: "zoom",
            source_metadata: { zoom_meeting_id: zoomMeetingId, zoom_numeric_id: "000000000" },
          })
          .select("id")
          .single();
        if (rec.error || !rec.data) {
          throw new Error(`${SUITE_TAG} insert recording ${label} failed: ${rec.error?.message}`);
        }
        const id = rec.data.id as string;
        allRecordingIds.push(id);
        return id;
      };

      recOnSharedA = await insertRecording(orgOnId, "on-shared-a", sharedOnSignal);
      recOnSharedB = await insertRecording(orgOnId, "on-shared-b", sharedOnSignal);
      recOnDistinct = await insertRecording(orgOnId, "on-distinct", distinctOnSignal);
      recOffSharedA = await insertRecording(orgOffId, "off-shared-a", sharedOffSignal);
      recOffSharedB = await insertRecording(orgOffId, "off-shared-b", sharedOffSignal);
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // recordings has a protective BEFORE DELETE trigger
      // (prevent_recording_hard_delete, 20260307000001_lifecycle_rules.sql):
      // "if a recording has ANY workspace_entries, it cannot be hard
      // deleted." tr_auto_create_default_workspace_entry auto-linked every
      // fixture recording into its org's default workspace on INSERT, so
      // workspace_entries must be cleared FIRST, recordings second.
      // Deleting recordings then cascades event_match_decisions
      // (recording_id_a/b ON DELETE CASCADE) + call_participants. Deleting
      // organizations cascades workspaces + organization_feature_flags + any
      // remaining recordings. Belt and suspenders: absorb each step's
      // failure so one FK hiccup doesn't strand the rest (supabase/CLAUDE.md
      // cleanup contract). Every delete's returned `.error` is checked and
      // logged explicitly -- a Supabase query error does not throw, so a
      // bare try/catch around an unchecked `.delete()` call would silently
      // report cleanup as successful even when a row was left behind.
      try {
        if (allRecordingIds.length > 0) {
          const { error } = await admin
            .from("workspace_entries")
            .delete()
            .in("recording_id", allRecordingIds);
          if (error) {
            console.warn(`${SUITE_TAG} workspace_entries cleanup returned an error:`, error.message);
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
        for (const orgId of [orgOnId, orgOffId]) {
          if (!orgId) continue;
          const { error } = await admin.from("organizations").delete().eq("id", orgId);
          if (error) {
            console.warn(`${SUITE_TAG} organization ${orgId} delete returned an error:`, error.message);
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
          console.warn(
            `${SUITE_TAG} cleanup_test_fixture_users RPC failed:`,
            error.message,
          );
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
      expect(data?.length ?? 0).toBe(5);
      for (const row of data ?? []) {
        expect(row.event_id).toBeNull();
      }
    });

    it("runShadowSweep(admin, { flaggedOrgIds: [O_on] }) proposes exactly one merge for the O_on matching pair, zero for the distinct third, zero for the unflagged O_off pair, and leaves every recording's event_id NULL", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgOnId] });

      // Sanity on the summary shape itself (bonus coverage beyond (a)-(d)).
      expect(summary.organizationsScanned).toBe(1);
      expect(summary.recordingsScanned).toBe(3); // only O_on's 3 recordings -- O_off was never in flaggedOrgIds
      expect(summary.proposed).toBe(1);
      expect(summary.errors).toBe(0);

      // (a) exactly ONE event_match_decisions row for the O_on matching pair,
      //     MATCH-09 shape: tier='deterministic', score=NULL,
      //     decision='merge_proposed', applied=false, decided_by='auto',
      //     both recording IDs present and canonically ordered.
      const [expectedA, expectedB] =
        recOnSharedA < recOnSharedB ? [recOnSharedA, recOnSharedB] : [recOnSharedB, recOnSharedA];

      const onPairRows = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, score, signals, decision, decided_by, applied, reverses_decision_id, created_at",
        )
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB);

      expect(onPairRows.error).toBeNull();
      expect(onPairRows.data?.length, "expected exactly one merge_proposed row for the O_on matching pair").toBe(1);

      const row = onPairRows.data![0];
      expect(row.recording_id_a).toBe(expectedA);
      expect(row.recording_id_b).toBe(expectedB);
      expect(row.recording_id_a < row.recording_id_b).toBe(true);
      expect(row.tier).toBe("deterministic");
      expect(row.score).toBeNull();
      expect(row.decision).toBe("merge_proposed");
      expect(row.decided_by).toBe("auto");
      expect(row.applied).toBe(false);
      expect(row.event_id).toBeNull();
      expect(row.signals).toEqual({ matched_field: "zoom_meeting_id" });

      // (b) ZERO rows for the O_on non-matching third recording.
      const distinctRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(`recording_id_a.eq.${recOnDistinct},recording_id_b.eq.${recOnDistinct}`);
      expect(distinctRows.error).toBeNull();
      expect(distinctRows.data?.length ?? 0).toBe(0);

      // (c) ZERO rows for O_off's pair even though they share a UUID
      //     (SAFE-01 flag gate -- O_off was never in flaggedOrgIds).
      const offPairRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(
          `recording_id_a.eq.${recOffSharedA},recording_id_b.eq.${recOffSharedA},recording_id_a.eq.${recOffSharedB},recording_id_b.eq.${recOffSharedB}`,
        );
      expect(offPairRows.error).toBeNull();
      expect(offPairRows.data?.length ?? 0).toBe(0);

      // (d) after the sweep, recordings.event_id IS NULL for ALL five
      //     recordings (SAFE-02 noop -- the ledger exists, the merge does not).
      const postSweep = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(postSweep.error).toBeNull();
      expect(postSweep.data?.length ?? 0).toBe(5);
      for (const r of postSweep.data ?? []) {
        expect(
          r.event_id,
          `recording ${r.id} unexpectedly has event_id set -- SAFE-02 violated`,
        ).toBeNull();
      }
    });

    it("re-running the sweep is idempotent -- still exactly one row for the O_on pair (Pattern 3 unique_violation no-op)", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgOnId] });
      expect(summary.errors).toBe(0);
      expect(summary.proposed).toBe(1); // re-proposed, no-op'd via unique_violation tolerance

      const [expectedA, expectedB] =
        recOnSharedA < recOnSharedB ? [recOnSharedA, recOnSharedB] : [recOnSharedB, recOnSharedA];
      const rows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB);
      expect(rows.error).toBeNull();
      expect(rows.data?.length, "re-run must not create a second row for the same pair+tier").toBe(1);
    });
  },
);
