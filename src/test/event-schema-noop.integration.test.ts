/**
 * EVT-03 byte-identical regression test (Phase 30, Plan 03).
 *
 * Proves that get_workspace_recordings, global_search, MCP search_calls, and
 * MCP ask_call return byte-identical output while `recordings.event_id` /
 * `call_participants.event_id` / `.role` / `.has_confirmed_speech` are NULL
 * across the board -- the only state that exists in Phase 30 (the Phase 31+
 * matching engine that populates these columns hasn't landed yet).
 *
 * "Byte-identical" here means: the JSON key set returned by each path does
 * NOT gain event_id / role / has_confirmed_speech. All four read paths use
 * explicit column lists (never `select('*')`) on recordings/call_participants
 * (confirmed by a repo-wide sweep -- see 30-03-SUMMARY.md), so an added
 * column is structurally invisible unless a path's query is rewritten to
 * request it. This test is the proof, not a guess.
 *
 * Runs under the project's default jsdom test environment (matching
 * rls-regression.test.ts's convention) even though this suite only calls
 * Supabase RPCs/queries and never touches window/document -- src/test/setup.ts
 * unconditionally references `window`, so a per-file `node` environment
 * override would break global setup rather than skip it.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and
 * supabase/CLAUDE.md "Running integration tests safely". No fallback to
 * production-like env vars.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-30-03 event-schema-noop]";

// The exact 18-column RETURNS TABLE shape from get_workspace_recordings
// (supabase/migrations/20260618160000_recordings_canonical_ai_title.sql).
// event_id is NOT in this list -- if it ever leaks in, this assertion fails.
const GET_WORKSPACE_RECORDINGS_KEYS = [
  "entry_id",
  "entry_folder_id",
  "id",
  "fathom_provider_id",
  "organization_id",
  "owner_user_id",
  "title",
  "summary",
  "global_tags",
  "source_app",
  "source_metadata",
  "duration",
  "recording_start_time",
  "recording_end_time",
  "created_at",
  "synced_at",
  "ai_generated_title",
  "total_count",
].sort();

// global_search's row shape (supabase/migrations/20260309200013_global_search_rpc.sql).
const GLOBAL_SEARCH_ROW_KEYS = [
  "entity_type",
  "entity_id",
  "title",
  "subtitle",
  "metadata",
  "relevance_score",
].sort();

// global_search's per-'call' jsonb_build_object metadata shape. NOTE: the
// live function (last redefined 20260610121000_rename_legacy_recording_id_to_fathom_provider_id.sql)
// uses fathom_provider_id here, not legacy_recording_id -- the column itself
// was renamed project-wide before this phase; global_search's metadata key
// tracks that rename (this is a pre-existing key name, not something Phase 30
// changed).
const GLOBAL_SEARCH_CALL_METADATA_KEYS = [
  "source_app",
  "recording_start_time",
  "created_at",
  "duration",
  "fathom_provider_id",
  "workspace_id",
].sort();

// MCP search_calls.ts org-scope path's exact join select:
// .from('workspace_entries').select('recordings!inner(id, title, recording_start_time, summary)')
const SEARCH_CALLS_ORG_SCOPE_RECORDING_KEYS = [
  "id",
  "title",
  "recording_start_time",
  "summary",
].sort();

// MCP ask_call.ts's exact recordings select: .select('id, title, full_transcript')
const ASK_CALL_RECORDING_KEYS = ["id", "title", "full_transcript"].sort();

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} EVT-03 byte-identical while event_id IS NULL`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let orgId = "";
    let userId = "";
    let userEmail = "";
    let workspaceId = "";
    let recordingAId = "";
    let recordingBId = "";

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      const stamp = Date.now();
      userEmail = `phase30-evtnoop-${stamp}@callvault.test`;
      const userPassword = `phase30-evtnoop-${stamp}-pwd!`;

      // 1. One fixture user.
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

      // 2. One organization. tr_ensure_home_workspace auto-creates a
      //    "Home Workspace" (is_home=TRUE) on org INSERT -- read its id
      //    rather than creating a second workspace.
      const org = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (org.error || !org.data) {
        throw new Error(`${SUITE_TAG} insert org failed: ${org.error?.message}`);
      }
      orgId = org.data.id as string;

      await admin.from("organization_memberships").insert({
        organization_id: orgId,
        user_id: userId,
        role: "organization_owner",
      });

      const ws = await admin
        .from("workspaces")
        .update({ name: `${SUITE_TAG} ws ${stamp}` })
        .eq("organization_id", orgId)
        .eq("is_home", true)
        .select("id")
        .single();
      if (ws.error || !ws.data) {
        throw new Error(
          `${SUITE_TAG} fetch/rename home workspace failed: ${ws.error?.message}`,
        );
      }
      workspaceId = ws.data.id as string;

      // global_search's workspace-scoped branch checks workspace_memberships
      // (not organization_memberships) before returning anything -- without
      // this row the RPC silently returns zero rows rather than erroring.
      const wsMembership = await admin.from("workspace_memberships").insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: "workspace_owner",
      });
      if (wsMembership.error) {
        throw new Error(
          `${SUITE_TAG} insert workspace_memberships failed: ${wsMembership.error.message}`,
        );
      }

      // 3. Two recordings, event_id left at its NULL default -- the only
      //    state this phase's migration produces (Phase 31+ populates it).
      const recA = await admin
        .from("recordings")
        .insert({
          organization_id: orgId,
          owner_user_id: userId,
          title: `${SUITE_TAG} rec A ${stamp}`,
          summary: `${SUITE_TAG} summary A`,
          full_transcript: `${SUITE_TAG} transcript A -- hello from participant A.`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recA.error || !recA.data) {
        throw new Error(
          `${SUITE_TAG} insert recording A failed: ${recA.error?.message}`,
        );
      }
      recordingAId = recA.data.id as string;

      const recB = await admin
        .from("recordings")
        .insert({
          organization_id: orgId,
          owner_user_id: userId,
          title: `${SUITE_TAG} rec B ${stamp}`,
          summary: `${SUITE_TAG} summary B`,
          full_transcript: `${SUITE_TAG} transcript B -- hello from participant B.`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recB.error || !recB.data) {
        throw new Error(
          `${SUITE_TAG} insert recording B failed: ${recB.error?.message}`,
        );
      }
      recordingBId = recB.data.id as string;

      // 4. workspace_entries linking (EVT-07 join target for all four paths).
      // tr_auto_create_default_workspace_entry (AFTER INSERT ON recordings)
      // already inserted these rows automatically -- it routes every new
      // recording into its organization's is_default workspace, which for a
      // freshly created org is the same is_home workspace fetched above
      // (ensure_home_workspace() sets both flags). Confirm rather than
      // re-insert (a manual insert here would collide with the trigger's own
      // ON CONFLICT DO NOTHING insert and fail on the unique constraint).
      const entryCheck = await admin
        .from("workspace_entries")
        .select("recording_id")
        .eq("workspace_id", workspaceId)
        .in("recording_id", [recordingAId, recordingBId]);
      if (entryCheck.error) {
        throw new Error(
          `${SUITE_TAG} verify auto-created workspace_entries failed: ${entryCheck.error.message}`,
        );
      }
      if ((entryCheck.data?.length ?? 0) !== 2) {
        throw new Error(
          `${SUITE_TAG} expected tr_auto_create_default_workspace_entry to have linked both recordings into workspace ${workspaceId}, found ${entryCheck.data?.length ?? 0}`,
        );
      }

      // 5. call_participants rows -- role/has_confirmed_speech left at their
      //    NULL defaults (not set), exactly mirroring Phase 30's post-migration
      //    state.
      const participantA = await admin.from("call_participants").insert({
        recording_id: recordingAId,
        organization_id: orgId,
        email: "evtnoop-participant-a@example.com",
        name: "EVT Noop Participant A",
        participant_type: "attendee",
      });
      if (participantA.error) {
        throw new Error(
          `${SUITE_TAG} insert call_participants A failed: ${participantA.error.message}`,
        );
      }
      const participantB = await admin.from("call_participants").insert({
        recording_id: recordingBId,
        organization_id: orgId,
        email: "evtnoop-participant-b@example.com",
        name: "EVT Noop Participant B",
        participant_type: "speaker",
      });
      if (participantB.error) {
        throw new Error(
          `${SUITE_TAG} insert call_participants B failed: ${participantB.error.message}`,
        );
      }
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      // Deleting recordings cascades call_participants + workspace_entries
      // (both FK recording_id ON DELETE CASCADE). Deleting the organization
      // cascades workspaces (-> workspace_memberships) + organization_memberships
      // + any remaining recordings (organization_id ON DELETE CASCADE). Belt
      // and suspenders: absorb each step's failure so one FK hiccup doesn't
      // strand the rest (supabase/CLAUDE.md cleanup contract).
      try {
        if (recordingAId) {
          await admin.from("recordings").delete().eq("id", recordingAId);
        }
        if (recordingBId) {
          await admin.from("recordings").delete().eq("id", recordingBId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} recording cleanup threw:`, err);
      }

      try {
        if (orgId) {
          await admin.from("organizations").delete().eq("id", orgId);
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

    it("fixture recordings have event_id IS NULL (the only state Phase 30 produces)", async () => {
      const { data, error } = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recordingAId, recordingBId]);

      expect(error).toBeNull();
      expect(data?.length ?? 0).toBe(2);
      for (const row of data ?? []) {
        expect(
          row.event_id,
          `recording ${row.id} unexpectedly has event_id set -- fixture assumption broken`,
        ).toBeNull();
      }
    });

    it("get_workspace_recordings returns the unchanged 18-column shape, no event_id key", async () => {
      const { data, error } = await admin.rpc("get_workspace_recordings", {
        p_workspace_id: workspaceId,
        p_limit: 10,
        p_offset: 0,
      });

      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const ourRows = rows.filter(
        (r) => r.id === recordingAId || r.id === recordingBId,
      );
      expect(ourRows.length).toBe(2);

      for (const row of ourRows) {
        const keys = Object.keys(row).sort();
        expect(
          keys,
          "get_workspace_recordings row key set changed shape",
        ).toEqual(GET_WORKSPACE_RECORDINGS_KEYS);
        expect(keys).not.toContain("event_id");
        expect(keys).not.toContain("role");
        expect(keys).not.toContain("has_confirmed_speech");
      }
    });

    it("global_search (workspace-scoped -- the same call MCP search_calls makes) returns unchanged jsonb shape, no event_id key", async () => {
      const { data, error } = await admin.rpc("global_search", {
        query_text: "",
        filter_user_id: userId,
        filter_workspace_id: workspaceId,
        match_count: 20,
      });

      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const callRows = rows.filter(
        (r) =>
          r.entity_type === "call" &&
          (r.entity_id === recordingAId || r.entity_id === recordingBId),
      );
      expect(callRows.length).toBe(2);

      for (const row of callRows) {
        const keys = Object.keys(row).sort();
        expect(keys, "global_search row key set changed shape").toEqual(
          GLOBAL_SEARCH_ROW_KEYS,
        );
        expect(keys).not.toContain("event_id");

        const metadataKeys = Object.keys(
          row.metadata as Record<string, unknown>,
        ).sort();
        expect(
          metadataKeys,
          "global_search 'call' metadata key set changed shape",
        ).toEqual(GLOBAL_SEARCH_CALL_METADATA_KEYS);
        expect(metadataKeys).not.toContain("event_id");
      }
    });

    it("MCP search_calls org-scope path (workspace_entries -> recordings!inner join) returns unchanged shape, no event_id key", async () => {
      // Exact replica of supabase/functions/mcp-server/tools/read/search_calls.ts's
      // org-scope title-search query.
      const { data, error } = await admin
        .from("workspace_entries")
        .select("recordings!inner(id, title, recording_start_time, summary)")
        .in("workspace_id", [workspaceId])
        .filter("recordings.title", "ilike", "%[phase-30-03%")
        .limit(10);

      expect(error).toBeNull();
      const rows = (data ?? []) as unknown as Array<{
        recordings: Record<string, unknown>;
      }>;
      expect(rows.length).toBe(2);

      for (const row of rows) {
        const keys = Object.keys(row.recordings).sort();
        expect(
          keys,
          "search_calls org-scope join row key set changed shape",
        ).toEqual(SEARCH_CALLS_ORG_SCOPE_RECORDING_KEYS);
        expect(keys).not.toContain("event_id");
      }
    });

    it("MCP ask_call recordings select (id, title, full_transcript) through the workspace_entries membership check returns unchanged shape, no event_id key", async () => {
      // Step 1: the exact membership check ask_call.ts performs before
      // touching recordings at all.
      const membership = await admin
        .from("workspace_entries")
        .select("recording_id")
        .eq("recording_id", recordingAId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      expect(membership.error).toBeNull();
      expect(membership.data).not.toBeNull();

      // Step 2: ask_call.ts's exact recordings select.
      const { data, error } = await admin
        .from("recordings")
        .select("id, title, full_transcript")
        .eq("id", recordingAId)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      const keys = Object.keys(data as Record<string, unknown>).sort();
      expect(keys, "ask_call recordings select key set changed shape").toEqual(
        ASK_CALL_RECORDING_KEYS,
      );
      expect(keys).not.toContain("event_id");
    });
  },
);
