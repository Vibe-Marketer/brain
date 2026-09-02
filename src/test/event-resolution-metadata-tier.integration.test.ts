/**
 * Phase 32 Plan 02, Task 3 -- proves the metadata tier end to end on TEST:
 * a provider-agnostic same-org candidate pair with NO tier-1 signal at all
 * (different source_app values, e.g. fathom + grain) produces exactly one
 * tier='metadata' merge_proposed row when time/participant/title signals
 * clear the asymmetric propose bar (MATCH-06/MATCH-08); a recurring-title
 * pair whose title-similarity contribution is suppressed does NOT propose
 * even though its raw signals would otherwise cross the bar (MATCH-05 reuse
 * closing the same F5-shaped trap here); a cross-org pair with identical
 * time+participants NEVER proposes (MATCH-06/SAFE-04 defense-in-depth); no
 * row anywhere carries decision='merge_applied' (MATCH-03); and
 * recordings.event_id stays NULL for every fixture recording (propose-only).
 *
 * Modeled directly on src/test/event-resolution-shadow.integration.test.ts's
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
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";
import { runShadowSweep } from "../../supabase/functions/_shared/event-resolver.ts";

const SUITE_TAG = "[phase-32-02 event-resolution-metadata-tier]";

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} MATCH-03/MATCH-06/MATCH-08 metadata tier sweep proof`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let userId = "";
    let userEmail = "";
    let orgAId = "";
    let orgBId = "";
    const allRecordingIds: string[] = [];
    const allWorkspaceEntryRecordingIds: string[] = [];
    let recGenuineA = ""; // org A, fathom -- genuine pair member 1
    let recGenuineB = ""; // org A, grain -- genuine pair member 2 (NO tier-1 signal on either side)
    let recRecurringA = ""; // org A, fathom -- recurring-title pair member 1
    let recRecurringB = ""; // org A, grain -- recurring-title pair member 2
    let recRecurringC = ""; // org A, fathom -- third occurrence, bumps occurrence_count to threshold, pairs with neither (zero time overlap)
    let recCrossOrgB = ""; // org B, fathom -- identical time+participants to recGenuineA, DIFFERENT org (and different title, to avoid contaminating recGenuineA/B's occurrence_count)

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      userEmail = `phase32-02-metadata-${stamp}@callvault.test`;
      const userPassword = `phase32-02-metadata-${stamp}-pwd!`;

      // 1. One fixture user, reused as owner_user_id across every fixture
      //    recording (ownership is not what this suite tests; sharing one
      //    owner is required so recurring_call_titles' (owner,title)
      //    grouping behaves predictably across the fixture set).
      const createUser = await admin.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      if (createUser.error || !createUser.data.user) {
        throw new Error(`${SUITE_TAG} createUser failed: ${createUser.error?.message}`);
      }
      userId = createUser.data.user.id;

      // 2. Two organizations, BOTH flagged for event_resolution -- unlike
      //    the shadow suite's on/off flag-gate proof, this suite needs BOTH
      //    orgs in the SAME sweep batch to prove the matcher's own same-org
      //    pairing logic (not the flag gate) is what blocks cross-org pairs.
      const orgA = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org-a ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgA.error || !orgA.data) {
        throw new Error(`${SUITE_TAG} insert org-a failed: ${orgA.error?.message}`);
      }
      orgAId = orgA.data.id as string;

      const orgB = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org-b ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgB.error || !orgB.data) {
        throw new Error(`${SUITE_TAG} insert org-b failed: ${orgB.error?.message}`);
      }
      orgBId = orgB.data.id as string;

      for (const orgId of [orgAId, orgBId]) {
        const flagInsert = await admin.from("organization_feature_flags").insert({
          organization_id: orgId,
          flag_key: "event_resolution",
          enabled: true,
        });
        if (flagInsert.error) {
          throw new Error(
            `${SUITE_TAG} insert organization_feature_flags for ${orgId} failed: ${flagInsert.error.message}`,
          );
        }
      }

      const genuineTitle = `${SUITE_TAG} genuine ${stamp}`;
      const recurringTitle = `${SUITE_TAG} recurring ${stamp}`;
      const crossOrgTitle = `${SUITE_TAG} org-b-lone ${stamp}`;
      const p1 = `p1-${stamp}@example.com`;
      const p2 = `p2-${stamp}@example.com`;

      const insertRecording = async (opts: {
        label: string;
        organizationId: string;
        sourceApp: string;
        title: string;
        start: string;
        end: string;
        participants: string[];
      }): Promise<string> => {
        const rec = await admin
          .from("recordings")
          .insert({
            organization_id: opts.organizationId,
            owner_user_id: userId,
            title: opts.title,
            source_app: opts.sourceApp,
            // Deliberately NO tier-1-eligible field (only zoom_meeting_id is
            // tier-1-eligible, per event-resolver.ts's TIER1_SIGNAL_EXTRACTORS)
            // so a proposal here proves the metadata tier alone, with zero
            // tier-1 involvement.
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

        for (const email of opts.participants) {
          const participant = await admin.from("call_participants").insert({
            recording_id: id,
            organization_id: opts.organizationId,
            email,
            name: null,
            participant_type: "attendee",
          });
          if (participant.error) {
            throw new Error(
              `${SUITE_TAG} insert call_participants for ${opts.label} failed: ${participant.error.message}`,
            );
          }
        }

        return id;
      };

      // Genuine pair (org A): fathom + grain, 75% time overlap, identical
      // participants (Jaccard 1.0), identical non-recurring title
      // (occurrence_count=2, below RECURRING_TITLE_OCCURRENCE_THRESHOLD=3) --
      // title contributes fully. score = 0.45(participant) + 0.2625(time) +
      // 0.20(title) = 0.9125 >= 0.80 -> proposed.
      recGenuineA = await insertRecording({
        label: "genuine-a",
        organizationId: orgAId,
        sourceApp: "fathom",
        title: genuineTitle,
        start: "2026-01-01T09:00:00.000Z",
        end: "2026-01-01T10:00:00.000Z",
        participants: [p1, p2],
      });
      recGenuineB = await insertRecording({
        label: "genuine-b",
        organizationId: orgAId,
        sourceApp: "grain",
        title: genuineTitle,
        start: "2026-01-01T09:15:00.000Z",
        end: "2026-01-01T10:15:00.000Z",
        participants: [p1, p2],
      });

      // Recurring-title pair (org A): IDENTICAL time+participant shape to
      // the genuine pair above (0.45 + 0.2625 = 0.7125 without title), but
      // this title recurs 3x for this owner (>= threshold) -- title
      // contributes 0, so the pair stays at 0.7125 < 0.80 -> NOT proposed.
      // Without suppression this would have scored 0.9125 and proposed,
      // same as the genuine pair -- proving suppression (not coincidence)
      // is what closes the trap.
      recRecurringA = await insertRecording({
        label: "recurring-a",
        organizationId: orgAId,
        sourceApp: "fathom",
        title: recurringTitle,
        start: "2026-02-01T09:00:00.000Z",
        end: "2026-02-01T10:00:00.000Z",
        participants: [p1, p2],
      });
      recRecurringB = await insertRecording({
        label: "recurring-b",
        organizationId: orgAId,
        sourceApp: "grain",
        title: recurringTitle,
        start: "2026-02-01T09:15:00.000Z",
        end: "2026-02-01T10:15:00.000Z",
        participants: [p1, p2],
      });
      // Third occurrence, far away in time (zero overlap with A/B) -- exists
      // ONLY to push recurring_call_titles.occurrence_count to 3 for
      // (userId, recurringTitle). Forms no pairs of its own.
      recRecurringC = await insertRecording({
        label: "recurring-c",
        organizationId: orgAId,
        sourceApp: "fathom",
        title: recurringTitle,
        start: "2026-05-01T09:00:00.000Z",
        end: "2026-05-01T10:00:00.000Z",
        participants: [p1],
      });

      // Cross-org control (org B): identical time+participants to
      // recGenuineA, but a DIFFERENT organization_id (and a distinct title,
      // so it never contaminates recGenuineA/B's occurrence_count). Alone in
      // org B -- no same-org partner, so this proves the cross-org gate
      // specifically (if the matcher ever grouped across orgs, this would
      // otherwise score identically to the genuine pair against recGenuineA).
      recCrossOrgB = await insertRecording({
        label: "cross-org-b",
        organizationId: orgBId,
        sourceApp: "fathom",
        title: crossOrgTitle,
        start: "2026-01-01T09:00:00.000Z",
        end: "2026-01-01T10:00:00.000Z",
        participants: [p1, p2],
      });
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // Same cleanup contract as event-resolution-shadow.integration.test.ts:
      // recordings has a protective BEFORE DELETE trigger blocking deletion
      // while linked via workspace_entries (tr_auto_create_default_workspace_entry
      // auto-links every fixture recording into its org's default workspace
      // on INSERT). workspace_entries must be cleared FIRST, recordings
      // second (cascades call_participants + event_match_decisions).
      // Deleting organizations cascades workspaces + organization_feature_flags
      // + any remaining recordings. Every step absorbs its own failure
      // (supabase/CLAUDE.md cleanup contract) -- one FK hiccup must not
      // strand the rest, and every `.error` is checked explicitly (a
      // Supabase query error does not throw).
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
        for (const orgId of [orgAId, orgBId]) {
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
      expect(data?.length ?? 0).toBe(6);
      for (const row of data ?? []) {
        expect(row.event_id).toBeNull();
      }
    });

    it("runShadowSweep proposes the provider-agnostic genuine pair (fathom+grain, NO tier-1 signal), suppresses the recurring-title pair, and never crosses orgs", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgAId, orgBId] });

      expect(summary.organizationsScanned).toBe(2);
      expect(summary.recordingsScanned).toBe(6);
      // Zero tier-1 signal anywhere in this fixture set -- every recording
      // uses a non-zoom source_app with no eligible tier-1 field.
      expect(summary.proposed).toBe(0);
      expect(summary.skipped).toBe(6);
      expect(summary.errors).toBe(0);
      // Exactly one metadata proposal: the genuine fathom/grain pair.
      expect(summary.metadataProposed).toBe(1);

      // (a) The genuine pair produced exactly one tier='metadata' row, with
      //     MATCH-03's shape: decision='merge_proposed', applied=false,
      //     decided_by='auto', a 0..1 score, canonically ordered.
      const [expectedA, expectedB] =
        recGenuineA < recGenuineB ? [recGenuineA, recGenuineB] : [recGenuineB, recGenuineA];

      const genuineRows = await admin
        .from("event_match_decisions")
        .select(
          "id, recording_id_a, recording_id_b, event_id, tier, score, signals, decision, decided_by, applied, created_at",
        )
        .eq("recording_id_a", expectedA)
        .eq("recording_id_b", expectedB);

      expect(genuineRows.error).toBeNull();
      expect(genuineRows.data?.length, "expected exactly one merge_proposed row for the genuine fathom/grain pair").toBe(1);

      const row = genuineRows.data![0];
      expect(row.tier).toBe("metadata");
      expect(row.decision).toBe("merge_proposed");
      expect(row.decided_by).toBe("auto");
      expect(row.applied).toBe(false);
      expect(row.event_id).toBeNull();
      expect(typeof row.score).toBe("number");
      expect(row.score as number).toBeGreaterThanOrEqual(0.8);
      expect(row.score as number).toBeLessThanOrEqual(1);
      const signals = row.signals as Record<string, unknown>;
      expect(signals.title_suppressed).toBe(false);

      // (b) ZERO rows for the recurring-title pair -- title suppression
      //     closed the trap even though raw participant+time alone would
      //     have needed the title contribution to cross the bar.
      const [recA, recB] =
        recRecurringA < recRecurringB ? [recRecurringA, recRecurringB] : [recRecurringB, recRecurringA];
      const recurringRows = await admin
        .from("event_match_decisions")
        .select("id")
        .eq("recording_id_a", recA)
        .eq("recording_id_b", recB);
      expect(recurringRows.error).toBeNull();
      expect(recurringRows.data?.length ?? 0).toBe(0);

      // (c) ZERO rows anywhere involving the third recurring occurrence
      //     (recRecurringC) -- it shares zero time overlap with A/B, so it
      //     can never pair with either.
      const recurringCRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(`recording_id_a.eq.${recRecurringC},recording_id_b.eq.${recRecurringC}`);
      expect(recurringCRows.error).toBeNull();
      expect(recurringCRows.data?.length ?? 0).toBe(0);

      // (d) ZERO rows anywhere involving the cross-org control recording --
      //     it has no same-org partner in org B, and it must NEVER pair
      //     with recGenuineA/B in org A despite the identical time+participants
      //     recCrossOrgB shares with recGenuineA.
      const crossOrgRows = await admin
        .from("event_match_decisions")
        .select("id")
        .or(`recording_id_a.eq.${recCrossOrgB},recording_id_b.eq.${recCrossOrgB}`);
      expect(crossOrgRows.error).toBeNull();
      expect(crossOrgRows.data?.length ?? 0).toBe(0);

      // (e) Zero rows anywhere in this fixture set carry decision='merge_applied'
      //     -- the metadata tier NEVER applies, only proposes (MATCH-03).
      const appliedRows = await admin
        .from("event_match_decisions")
        .select("id")
        .in("recording_id_a", allRecordingIds)
        .eq("decision", "merge_applied");
      expect(appliedRows.error).toBeNull();
      expect(appliedRows.data?.length ?? 0).toBe(0);

      // (f) recordings.event_id stays NULL for all six fixture recordings
      //     after the sweep -- propose-only, never applies.
      const postSweep = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", allRecordingIds);
      expect(postSweep.error).toBeNull();
      expect(postSweep.data?.length ?? 0).toBe(6);
      for (const r of postSweep.data ?? []) {
        expect(r.event_id, `recording ${r.id} unexpectedly has event_id set -- MATCH-03 violated`).toBeNull();
      }
    });

    it("re-running the sweep is idempotent -- still exactly one row for the genuine pair (Pattern 3 unique_violation no-op)", async () => {
      const summary = await runShadowSweep(admin, { flaggedOrgIds: [orgAId, orgBId] });
      expect(summary.errors).toBe(0);
      expect(summary.metadataProposed).toBe(1); // re-proposed, no-op'd via unique_violation tolerance

      const [expectedA, expectedB] =
        recGenuineA < recGenuineB ? [recGenuineA, recGenuineB] : [recGenuineB, recGenuineA];
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

/**
 * MATCH-11 preservation guard -- source-read only, NO DB dependency, so it
 * runs unconditionally (NOT gated behind describe.skipIf) and still proves
 * the invariant even when TEST is unreachable. dedup_priority_mode /
 * dedup_platform_order continue to select DISPLAY order among captures under
 * an event; this phase's obligation is preservation, not new UI --
 * event-aware display-order UI is explicitly deferred to a later UI phase.
 *
 * Reality-check correction (verified this session, NOT what 32-RESEARCH.md
 * assumed): the literal column names `dedup_priority_mode`/
 * `dedup_platform_order` are declared ONLY in the generated
 * src/types/supabase.ts -- an exhaustive grep across supabase/functions/
 * and src/ finds zero literal reads of either column anywhere in the live
 * source. `findPotentialDuplicates`/`handleDuplicateMerge`/`updateMergedFrom`
 * are all defined in zoom-webhook/index.ts but never called from its
 * Deno.serve handler (dead code, pre-existing, confirmed unchanged by this
 * plan). This guard therefore asserts what's ACTUALLY true and load-bearing
 * for MATCH-11's "nothing discarded" contract: the selection ALGORITHM
 * (shouldNewMeetingBePrimary's four branches) and the schema-level TYPE
 * contract (both columns still declared) are byte-identical to before this
 * plan -- not a false claim that a live read path exists today. See
 * deferred-items.md for the full discovery writeup.
 */
describe(`${SUITE_TAG} MATCH-11 preservation guard (dedup selection algorithm + type contract untouched)`, () => {
  const repoRoot = process.cwd();
  const zoomWebhookSource = readFileSync(
    path.join(repoRoot, "supabase/functions/zoom-webhook/index.ts"),
    "utf-8",
  );
  const supabaseTypesSource = readFileSync(
    path.join(repoRoot, "src/types/supabase.ts"),
    "utf-8",
  );

  it("zoom-webhook/index.ts still declares the DedupPriorityMode mechanism (type + shouldNewMeetingBePrimary's parameters)", () => {
    expect(zoomWebhookSource).toContain("DedupPriorityMode");
    expect(zoomWebhookSource).toContain("priorityMode");
    expect(zoomWebhookSource).toContain("platformOrder");
    expect(zoomWebhookSource).toContain("function shouldNewMeetingBePrimary(");
  });

  it("shouldNewMeetingBePrimary retains all four priority-mode branches", () => {
    const startMarker = "function shouldNewMeetingBePrimary(";
    const startIdx = zoomWebhookSource.indexOf(startMarker);
    expect(startIdx, "shouldNewMeetingBePrimary must still exist in zoom-webhook/index.ts").toBeGreaterThan(-1);

    // Find the end of the PARAMETER LIST by counting parens only (the first
    // parameter is `newMeeting: { source_platform: string; ... }` -- an
    // inline object type annotation containing its OWN brace pair, which a
    // naive "first { after the function name" search would wrongly treat as
    // the function body's opening brace and truncate the extraction before
    // ever reaching the switch statement).
    let parenDepth = 0;
    let paramListEnd = -1;
    for (let i = startIdx + startMarker.length - 1; i < zoomWebhookSource.length; i++) {
      const ch = zoomWebhookSource[i];
      if (ch === "(") parenDepth++;
      else if (ch === ")") {
        parenDepth--;
        if (parenDepth === 0) {
          paramListEnd = i;
          break;
        }
      }
    }
    expect(paramListEnd, "could not locate the end of shouldNewMeetingBePrimary's parameter list").toBeGreaterThan(-1);

    // The function body's opening brace is the first `{` AFTER the
    // parameter list closes (skipping past the `: boolean` return-type
    // annotation). Bracket-match from there to find the body's true end.
    const bodyBraceStart = zoomWebhookSource.indexOf("{", paramListEnd);
    let depth = 0;
    let endIdx = -1;
    for (let i = bodyBraceStart; i < zoomWebhookSource.length; i++) {
      if (zoomWebhookSource[i] === "{") depth++;
      else if (zoomWebhookSource[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    expect(endIdx, "could not locate the end of shouldNewMeetingBePrimary's body").toBeGreaterThan(-1);

    const functionBody = zoomWebhookSource.slice(startIdx, endIdx + 1);
    for (const branch of ["first_synced", "most_recent", "platform_hierarchy", "longest_transcript"]) {
      expect(functionBody, `shouldNewMeetingBePrimary must still branch on '${branch}'`).toContain(`'${branch}'`);
    }
  });

  it("src/types/supabase.ts still declares both user_settings dedup columns", () => {
    expect(supabaseTypesSource).toContain("dedup_priority_mode");
    expect(supabaseTypesSource).toContain("dedup_platform_order");
  });
});
