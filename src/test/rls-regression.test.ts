/**
 * RLS Regression Test (SEC-04C, Phase 38).
 *
 * Cross-org isolation safety net. Creates 2 orgs (A, B), one user per org,
 * one recording + workspace + folder per org via service-role. Then signs in
 * as each user (anon JWT) and asserts Org B's JWT cannot read Org A's rows
 * across every user-facing table.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars (VITE_SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_ROLE_KEY) are
 * not set (CI without secrets stays green). There is intentionally NO
 * fallback to production-like env vars — see integration-setup.ts and
 * supabase/CLAUDE.md "Running integration tests safely".
 *
 * On failure, the assertion message names the leaking table so the operator
 * can pin the broken RLS policy in one read.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

// Test-project-only contract: read ONLY the *_TEST_* env vars. NO fallback
// to prod-like vars — the 2026-05 incident (tests mutating prod rows) was
// caused by exactly that fallback. See supabase/CLAUDE.md.
const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";

const SUITE_TAG = "[phase-38-01 rls-regression]";

// Tables the test queries cross-org. Each entry maps a table name to the
// column that the cross-org filter pivots on (the column holding the
// Org-A identifier that Org B's JWT must not see).
//
// All user-facing tables MUST appear here. If a new user-facing table is
// added, append it to this list — the test's job is to fail loud if a
// future schema change leaves a table unprotected.
const CROSS_ORG_TABLES: ReadonlyArray<{
  table: string;
  filterColumn:
    | "organization_id"
    | "org_id"
    | "user_id"
    | "recording_id"
    | "workspace_id"
    | "folder_id"
    | "reporter_id"
    | "ticket_id";
}> = [
  { table: "recordings", filterColumn: "organization_id" },
  { table: "workspaces", filterColumn: "organization_id" },
  { table: "folders", filterColumn: "workspace_id" },
  { table: "organization_memberships", filterColumn: "organization_id" },
  { table: "workspace_entries", filterColumn: "workspace_id" },
  { table: "folder_assignments", filterColumn: "folder_id" },
  { table: "call_tag_assignments", filterColumn: "recording_id" },
  { table: "transcript_tag_assignments", filterColumn: "recording_id" },
  { table: "call_speakers", filterColumn: "recording_id" },
  { table: "call_participants", filterColumn: "recording_id" },
  { table: "mcp_tokens", filterColumn: "org_id" },
  { table: "personal_folders", filterColumn: "organization_id" },
  { table: "personal_tags", filterColumn: "organization_id" },
  { table: "personal_folder_recordings", filterColumn: "recording_id" },
  { table: "personal_tag_recordings", filterColumn: "recording_id" },
  { table: "call_notes", filterColumn: "recording_id" },
  { table: "contact_folders", filterColumn: "organization_id" },
  { table: "import_sources", filterColumn: "user_id" },
  { table: "import_routing_rules", filterColumn: "organization_id" },
  // Phase 11 ticket tables (TKT-01, ISC-4/5). tickets pivots on the
  // reporter; messages/events pivot on the parent ticket id.
  { table: "tickets", filterColumn: "reporter_id" },
  { table: "ticket_messages", filterColumn: "ticket_id" },
  { table: "ticket_events", filterColumn: "ticket_id" },
  // Phase 24 (IMP-03). sync_jobs gains org-scoped columns + an org_isolation
  // SELECT policy; this entry makes the CI gate fail loud on any cross-org leak.
  { table: "sync_jobs", filterColumn: "organization_id" },
];

// Phase 24 (24-REVIEW CR-01): tables that have RLS ENABLED but NO permissive
// policy for authenticated/anon — i.e. service-role-only, client deny-all.
// These have no organization_id pivot column, so they do NOT belong in
// CROSS_ORG_TABLES. Instead we assert that an authenticated JWT reads ZERO
// rows even when a row exists (seeded via service-role). A row leaking here
// means RLS was disabled or a permissive policy was added by mistake.
const CLIENT_DENY_TABLES: ReadonlyArray<string> = [
  "fathom_calls_orphan_report",
  // Phase 31 (MATCH-09 / SAFE-01): backend-control tables written
  // exclusively by the deterministic-resolution matcher --
  // event_match_decisions is the append-only merge-decision ledger,
  // organization_feature_flags is its per-org enable gate. Neither has a
  // client policy (RLS enabled + forced, service-role only). Registered
  // here as the canonical deny-table registry; their seed+assert lives in
  // the bespoke block near the end of this file (see
  // BESPOKE_CLIENT_DENY_TABLES below), not the generic loop immediately
  // following this array, because both need multi-column FK parents (two
  // recordings; an organization) that the generic loop's single-PK seed
  // (shaped for fathom_calls_orphan_report) cannot produce.
  "event_match_decisions",
  "organization_feature_flags",
  // Phase 34 (Plan 03 / IDENT-03): the pending-OTP ledger backing the custom
  // email-alias-verification flow. Service-role-only -- no authenticated/anon
  // policy exists at all, since it holds a hash of a short-lived secret code
  // (see supabase/migrations/20260905150000_create_identity_alias_verifications.sql).
  "identity_alias_verifications",
  // Phase 35 (Plan 03 / IDENT-04 + IDENT-05): the append-only
  // cross-recording speaker-resolution ledger written exclusively by the
  // resolve-speakers edge function (service-role). Mirrors
  // event_match_decisions exactly -- no client policy, FORCE RLS. Seeded/
  // asserted in the bespoke block below (needs identities + two recordings
  // FK parents the generic loop's single-PK seed cannot produce).
  "speaker_resolution_decisions",
];

// Deny tables whose seed+assert is handled by a bespoke block elsewhere in
// this file instead of the generic loop directly below. Both still belong
// in CLIENT_DENY_TABLES above as the canonical registry of every
// service-role-only, client-deny table this suite guarantees.
const BESPOKE_CLIENT_DENY_TABLES = new Set<string>([
  "event_match_decisions",
  "organization_feature_flags",
  "speaker_resolution_decisions",
]);

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} cross-org RLS isolation`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let orgAId = "";
    let orgBId = "";
    let userAId = "";
    let userBId = "";
    let userAEmail = "";
    let userBEmail = "";
    const userAPassword = `phase38-rls-a-${Date.now()}-pwd!`;
    const userBPassword = `phase38-rls-b-${Date.now()}-pwd!`;
    let workspaceAId = "";
    let workspaceBId = "";
    let folderAId = "";
    let folderBId = "";
    let recordingAId = "";
    let recordingBId = "";
    let personalFolderAId = "";
    let personalFolderBId = "";
    let personalTagAId = "";
    let personalTagBId = "";
    let contactFolderAId = "";
    let contactFolderBId = "";
    let importRoutingRuleAId = "";
    let importRoutingRuleBId = "";
    let ticketAId = "";
    let ticketBId = "";
    // Phase 30 (EVT-04 + SAFE-05): one events row, linked to Org A's
    // recording (ownership) and Org A's user (participation). Used only by
    // the bespoke `events` isolation block below.
    let eventAId = "";

    // Phase 34 (IDENT-01 + T-34-02-01/02): one identities row (owned by
    // User A) linked to a dedicated Org A call_participants row via
    // identity_id, plus one verified identity_aliases row on it. Used only
    // by the bespoke `identities`/`identity_aliases` isolation block near
    // the end of this file -- identities has no organization_id pivot, so
    // it cannot join the generic CROSS_ORG_TABLES loop (same reasoning as
    // the `events` block above).
    let identityAId = "";
    let identityAAliasId = "";

    // Phase 35 (Plan 03 / IDENT-04 + IDENT-05): one speaker_resolution_decisions
    // row for the bespoke deny-table isolation block near the end of this
    // file. Reuses identityAId (owner User A) + recordingAId (donor) +
    // recordingA2Id (target, already seeded in step 5f for the
    // event_match_decisions fixture) -- no new recording/identity needed.
    let speakerResolutionDecisionId = "";

    // Phase 31 (MATCH-09 + SAFE-01): fixtures for the bespoke
    // event_match_decisions + organization_feature_flags deny-table
    // isolation block near the end of this file. organization_feature_flags
    // needs an organization (reuses Org A); event_match_decisions needs a
    // SECOND Org-A recording, since a ledger row always names two distinct
    // captures (recording_id_a < recording_id_b) -- the generic
    // CLIENT_DENY_TABLES loop's single-PK seed (shaped for
    // fathom_calls_orphan_report) cannot produce either fixture.
    let recordingA2Id = "";
    let eventMatchDecisionId = "";
    let orgFeatureFlagId = "";

    // Phase 32 (SAFE-04): a SECOND, independent pair of Org-A recordings,
    // resolved into one event via apply_event_match_atomic (the actual
    // resolution RPC, not just a proposed ledger row like recordingA2Id
    // above) -- proves resolving two same-org recordings into one event
    // never widens either recording's OR that event's readable audience to
    // an unrelated org. Deliberately NOT recordingAId (already carries
    // eventAId, asserted on by the block above) or recordingA2Id
    // (deliberately left merge_proposed/unapplied for the Phase 31 block
    // below) -- two brand-new recordings so neither existing fixture's
    // assertions are disturbed.
    let recordingA3Id = "";
    let recordingA4Id = "";
    let mergedEventId = "";

    // Phase 30 gap closure (code review WR-01): a participant with NO
    // ownership and NO org-membership relationship to Org A -- only a
    // call_participants row naming them on the same recording/event as
    // participantA above. Isolates the RLS policy's participation grant
    // (CR-01) from its ownership grant, which the single-fixture block
    // above (User A: owner + org member + participant simultaneously)
    // cannot do -- User A passes even when only the ownership branch of
    // the policy actually works.
    let participantOnlyEmail = "";
    const participantOnlyPassword = `phase38-rls-participant-only-${Date.now()}-pwd!`;

    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let clientParticipantOnly: SupabaseClient;

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY env vars (dedicated test project only — no prod fallback)`,
        );
      }

      const stamp = Date.now();
      userAEmail = `phase38-rls-a-${stamp}@callvault.test`;
      userBEmail = `phase38-rls-b-${stamp}@callvault.test`;
      participantOnlyEmail = `phase38-rls-participant-only-${stamp}@callvault.test`;

      // 1. Create the two users via auth admin API.
      const createA = await admin.auth.admin.createUser({
        email: userAEmail,
        password: userAPassword,
        email_confirm: true,
      });
      if (createA.error || !createA.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser A failed: ${createA.error?.message}`,
        );
      }
      userAId = createA.data.user.id;

      const createB = await admin.auth.admin.createUser({
        email: userBEmail,
        password: userBPassword,
        email_confirm: true,
      });
      if (createB.error || !createB.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser B failed: ${createB.error?.message}`,
        );
      }
      userBId = createB.data.user.id;

      // 2. Create 2 organizations.
      const orgA = await admin
        .from("organizations")
        .insert({
          name: `${SUITE_TAG} Org A ${stamp}`,
          type: "business",
        })
        .select("id")
        .single();
      if (orgA.error || !orgA.data) {
        throw new Error(
          `${SUITE_TAG} insert org A failed: ${orgA.error?.message}`,
        );
      }
      orgAId = orgA.data.id as string;

      const orgB = await admin
        .from("organizations")
        .insert({
          name: `${SUITE_TAG} Org B ${stamp}`,
          type: "business",
        })
        .select("id")
        .single();
      if (orgB.error || !orgB.data) {
        throw new Error(
          `${SUITE_TAG} insert org B failed: ${orgB.error?.message}`,
        );
      }
      orgBId = orgB.data.id as string;

      // 3. Membership rows (owner role) so each user can see their own org.
      await admin.from("organization_memberships").insert({
        organization_id: orgAId,
        user_id: userAId,
        role: "organization_owner",
      });
      await admin.from("organization_memberships").insert({
        organization_id: orgBId,
        user_id: userBId,
        role: "organization_owner",
      });

      // 4. Workspace + folder per org.
      // The tr_ensure_home_workspace trigger auto-creates a "Home Workspace" with
      // is_home=TRUE on org INSERT. Read its id and rename it for test legibility.
      const wsA = await admin
        .from("workspaces")
        .update({ name: "Home A" })
        .eq("organization_id", orgAId)
        .eq("is_home", true)
        .select("id")
        .single();
      if (wsA.error || !wsA.data) {
        throw new Error(
          `${SUITE_TAG} fetch/rename workspace A failed: ${wsA.error?.message}`,
        );
      }
      workspaceAId = wsA.data.id as string;

      const wsB = await admin
        .from("workspaces")
        .update({ name: "Home B" })
        .eq("organization_id", orgBId)
        .eq("is_home", true)
        .select("id")
        .single();
      if (wsB.error || !wsB.data) {
        throw new Error(
          `${SUITE_TAG} fetch/rename workspace B failed: ${wsB.error?.message}`,
        );
      }
      workspaceBId = wsB.data.id as string;


      const folderA = await admin
        .from("folders")
        .insert({
          workspace_id: workspaceAId,
          organization_id: orgAId,
          user_id: userAId,
          name: "Folder A",
        })
        .select("id")
        .single();
      if (folderA.error || !folderA.data) {
        throw new Error(
          `${SUITE_TAG} insert folder A failed: ${folderA.error?.message}`,
        );
      }
      folderAId = folderA.data.id as string;

      const folderB = await admin
        .from("folders")
        .insert({
          workspace_id: workspaceBId,
          organization_id: orgBId,
          user_id: userBId,
          name: "Folder B",
        })
        .select("id")
        .single();
      if (folderB.error || !folderB.data) {
        throw new Error(
          `${SUITE_TAG} insert folder B failed: ${folderB.error?.message}`,
        );
      }
      folderBId = folderB.data.id as string;

      // 5. One recording per org so call-detail joins have a target.
      const recA = await admin
        .from("recordings")
        .insert({
          organization_id: orgAId,
          owner_user_id: userAId,
          title: `${SUITE_TAG} call A`,
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
          organization_id: orgBId,
          owner_user_id: userBId,
          title: `${SUITE_TAG} call B`,
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

      // 5b. Fixture rows for cross-org RLS assertions on user-facing tables.
      const tokenA = await admin.from("mcp_tokens").insert({
        user_id: userAId,
        org_id: orgAId,
        workspace_id: workspaceAId,
        name: "RLS A Token",
        scope: "workspace",
      });
      if (tokenA.error) {
        throw new Error(
          `${SUITE_TAG} insert mcp_tokens A failed: ${tokenA.error.message}`,
        );
      }

      const tokenB = await admin.from("mcp_tokens").insert({
        user_id: userBId,
        org_id: orgBId,
        workspace_id: workspaceBId,
        name: "RLS B Token",
        scope: "workspace",
      });
      if (tokenB.error) {
        throw new Error(
          `${SUITE_TAG} insert mcp_tokens B failed: ${tokenB.error.message}`,
        );
      }

      const personalFolderA = await admin
        .from("personal_folders")
        .insert({
          user_id: userAId,
          organization_id: orgAId,
          name: "Personal Folder A",
        })
        .select("id")
        .single();
      if (personalFolderA.error || !personalFolderA.data) {
        throw new Error(
          `${SUITE_TAG} insert personal_folders A failed: ${personalFolderA.error?.message}`,
        );
      }
      personalFolderAId = personalFolderA.data.id as string;

      const personalFolderB = await admin
        .from("personal_folders")
        .insert({
          user_id: userBId,
          organization_id: orgBId,
          name: "Personal Folder B",
        })
        .select("id")
        .single();
      if (personalFolderB.error || !personalFolderB.data) {
        throw new Error(
          `${SUITE_TAG} insert personal_folders B failed: ${personalFolderB.error?.message}`,
        );
      }
      personalFolderBId = personalFolderB.data.id as string;

      const personalTagA = await admin
        .from("personal_tags")
        .insert({
          user_id: userAId,
          organization_id: orgAId,
          name: "Personal Tag A",
          color: "#ff8800",
        })
        .select("id")
        .single();
      if (personalTagA.error || !personalTagA.data) {
        throw new Error(
          `${SUITE_TAG} insert personal_tags A failed: ${personalTagA.error?.message}`,
        );
      }
      personalTagAId = personalTagA.data.id as string;

      const personalTagB = await admin
        .from("personal_tags")
        .insert({
          user_id: userBId,
          organization_id: orgBId,
          name: "Personal Tag B",
          color: "#2563eb",
        })
        .select("id")
        .single();
      if (personalTagB.error || !personalTagB.data) {
        throw new Error(
          `${SUITE_TAG} insert personal_tags B failed: ${personalTagB.error?.message}`,
        );
      }
      personalTagBId = personalTagB.data.id as string;

      const folderRecordingA = await admin
        .from("personal_folder_recordings")
        .insert({
          user_id: userAId,
          folder_id: personalFolderAId,
          recording_id: recordingAId,
        });
      if (folderRecordingA.error) {
        throw new Error(
          `${SUITE_TAG} insert personal_folder_recordings A failed: ${folderRecordingA.error.message}`,
        );
      }

      const folderRecordingB = await admin
        .from("personal_folder_recordings")
        .insert({
          user_id: userBId,
          folder_id: personalFolderBId,
          recording_id: recordingBId,
        });
      if (folderRecordingB.error) {
        throw new Error(
          `${SUITE_TAG} insert personal_folder_recordings B failed: ${folderRecordingB.error.message}`,
        );
      }

      const tagRecordingA = await admin.from("personal_tag_recordings").insert({
        user_id: userAId,
        tag_id: personalTagAId,
        recording_id: recordingAId,
      });
      if (tagRecordingA.error) {
        throw new Error(
          `${SUITE_TAG} insert personal_tag_recordings A failed: ${tagRecordingA.error.message}`,
        );
      }

      const tagRecordingB = await admin.from("personal_tag_recordings").insert({
        user_id: userBId,
        tag_id: personalTagBId,
        recording_id: recordingBId,
      });
      if (tagRecordingB.error) {
        throw new Error(
          `${SUITE_TAG} insert personal_tag_recordings B failed: ${tagRecordingB.error.message}`,
        );
      }

      const noteA = await admin.from("call_notes").insert({
        recording_id: recordingAId,
        workspace_id: workspaceAId,
        user_id: userAId,
        content: `${SUITE_TAG} note A`,
      });
      if (noteA.error) {
        throw new Error(
          `${SUITE_TAG} insert call_notes A failed: ${noteA.error.message}`,
        );
      }

      const noteB = await admin.from("call_notes").insert({
        recording_id: recordingBId,
        workspace_id: workspaceBId,
        user_id: userBId,
        content: `${SUITE_TAG} note B`,
      });
      if (noteB.error) {
        throw new Error(
          `${SUITE_TAG} insert call_notes B failed: ${noteB.error.message}`,
        );
      }

      const contactFolderA = await admin
        .from("contact_folders")
        .insert({
          name: "Contact Folder A",
          organization_id: orgAId,
          user_id: userAId,
        })
        .select("id")
        .single();
      if (contactFolderA.error || !contactFolderA.data) {
        throw new Error(
          `${SUITE_TAG} insert contact_folders A failed: ${contactFolderA.error?.message}`,
        );
      }
      contactFolderAId = contactFolderA.data.id as string;

      const contactFolderB = await admin
        .from("contact_folders")
        .insert({
          name: "Contact Folder B",
          organization_id: orgBId,
          user_id: userBId,
        })
        .select("id")
        .single();
      if (contactFolderB.error || !contactFolderB.data) {
        throw new Error(
          `${SUITE_TAG} insert contact_folders B failed: ${contactFolderB.error?.message}`,
        );
      }
      contactFolderBId = contactFolderB.data.id as string;

      const importSourceA = await admin.from("import_sources").insert({
        user_id: userAId,
        source_app: "zoom",
        is_active: true,
      });
      if (importSourceA.error) {
        throw new Error(
          `${SUITE_TAG} insert import_sources A failed: ${importSourceA.error.message}`,
        );
      }

      const importSourceB = await admin.from("import_sources").insert({
        user_id: userBId,
        source_app: "zoom",
        is_active: true,
      });
      if (importSourceB.error) {
        throw new Error(
          `${SUITE_TAG} insert import_sources B failed: ${importSourceB.error.message}`,
        );
      }

      const importRoutingRuleA = await admin
        .from("import_routing_rules")
        .insert({
          organization_id: orgAId,
          name: "RLS Rule A",
          priority: 1,
          enabled: true,
          conditions: [],
          logic_operator: "AND",
          target_workspace_id: workspaceAId,
          target_folder_id: folderAId,
          created_by: userAId,
        })
        .select("id")
        .single();
      if (importRoutingRuleA.error || !importRoutingRuleA.data) {
        throw new Error(
          `${SUITE_TAG} insert import_routing_rules A failed: ${importRoutingRuleA.error?.message}`,
        );
      }
      importRoutingRuleAId = importRoutingRuleA.data.id as string;

      const importRoutingRuleB = await admin
        .from("import_routing_rules")
        .insert({
          organization_id: orgBId,
          name: "RLS Rule B",
          priority: 1,
          enabled: true,
          conditions: [],
          logic_operator: "AND",
          target_workspace_id: workspaceBId,
          target_folder_id: folderBId,
          created_by: userBId,
        })
        .select("id")
        .single();
      if (importRoutingRuleB.error || !importRoutingRuleB.data) {
        throw new Error(
          `${SUITE_TAG} insert import_routing_rules B failed: ${importRoutingRuleB.error?.message}`,
        );
      }
      importRoutingRuleBId = importRoutingRuleB.data.id as string;

      // 5c. Phase 11 ticket fixtures: one ticket per user, one message each,
      //     and a status update so the audit trigger seeds a ticket_events
      //     row (covers the cross-user probes on all three ticket tables).
      const ticketA = await admin
        .from("tickets")
        .insert({
          reporter_id: userAId,
          type: "bug",
          severity: "medium",
          context: { suite: SUITE_TAG },
        })
        .select("id")
        .single();
      if (ticketA.error || !ticketA.data) {
        throw new Error(
          `${SUITE_TAG} insert tickets A failed: ${ticketA.error?.message}`,
        );
      }
      ticketAId = ticketA.data.id as string;

      const ticketB = await admin
        .from("tickets")
        .insert({
          reporter_id: userBId,
          type: "bug",
          severity: "medium",
          context: { suite: SUITE_TAG },
        })
        .select("id")
        .single();
      if (ticketB.error || !ticketB.data) {
        throw new Error(
          `${SUITE_TAG} insert tickets B failed: ${ticketB.error?.message}`,
        );
      }
      ticketBId = ticketB.data.id as string;

      const messageA = await admin.from("ticket_messages").insert({
        ticket_id: ticketAId,
        author_type: "user",
        author_id: userAId,
        body: `${SUITE_TAG} ticket message A`,
      });
      if (messageA.error) {
        throw new Error(
          `${SUITE_TAG} insert ticket_messages A failed: ${messageA.error.message}`,
        );
      }

      const messageB = await admin.from("ticket_messages").insert({
        ticket_id: ticketBId,
        author_type: "user",
        author_id: userBId,
        body: `${SUITE_TAG} ticket message B`,
      });
      if (messageB.error) {
        throw new Error(
          `${SUITE_TAG} insert ticket_messages B failed: ${messageB.error.message}`,
        );
      }

      // Status updates fire the AFTER UPDATE OF status trigger, producing
      // a ticket_events row per ticket for the cross-user event probes.
      const statusA = await admin
        .from("tickets")
        .update({ status: "triaged" })
        .eq("id", ticketAId);
      if (statusA.error) {
        throw new Error(
          `${SUITE_TAG} status update ticket A failed: ${statusA.error.message}`,
        );
      }

      const statusB = await admin
        .from("tickets")
        .update({ status: "triaged" })
        .eq("id", ticketBId);
      if (statusB.error) {
        throw new Error(
          `${SUITE_TAG} status update ticket B failed: ${statusB.error.message}`,
        );
      }

      // 5d. Phase 30 (EVT-04 + SAFE-05): one events row, linked to Org A's
      //     recording (ownership, via recordings.event_id) and Org A's user
      //     (participation, via a call_participants row whose email matches
      //     userAEmail). Used only by the bespoke `events` isolation block
      //     below -- events has no org-scoping column so it cannot join the
      //     CROSS_ORG_TABLES loop (see that array's own comment).
      const eventA = await admin.from("events").insert({}).select("id").single();
      if (eventA.error || !eventA.data) {
        throw new Error(
          `${SUITE_TAG} insert events A failed: ${eventA.error?.message}`,
        );
      }
      eventAId = eventA.data.id as string;

      const linkRecordingA = await admin
        .from("recordings")
        .update({ event_id: eventAId })
        .eq("id", recordingAId);
      if (linkRecordingA.error) {
        throw new Error(
          `${SUITE_TAG} link recording A to event failed: ${linkRecordingA.error.message}`,
        );
      }

      const participantA = await admin.from("call_participants").insert({
        recording_id: recordingAId,
        organization_id: orgAId,
        email: userAEmail,
        name: "RLS A Participant",
        participant_type: "attendee",
        event_id: eventAId,
      });
      if (participantA.error) {
        throw new Error(
          `${SUITE_TAG} insert call_participants (event link) A failed: ${participantA.error.message}`,
        );
      }

      // 5e. Phase 30 gap closure (code review WR-01): the participant-only
      //     user (declared above) gets ONLY a call_participants row on
      //     recordingA/eventA -- no organization_memberships row, no owned
      //     recording. Cleanup needs no dedicated step: this row cascades
      //     away when recordingAId is deleted in afterAll step 1c, and the
      //     auth.users row is swept by cleanup_test_fixture_users (step 2
      //     below) via the shared @callvault.test domain match, same as
      //     userA/userB.
      const createParticipantOnly = await admin.auth.admin.createUser({
        email: participantOnlyEmail,
        password: participantOnlyPassword,
        email_confirm: true,
      });
      if (createParticipantOnly.error || !createParticipantOnly.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser participant-only failed: ${createParticipantOnly.error?.message}`,
        );
      }

      const participantOnly = await admin.from("call_participants").insert({
        recording_id: recordingAId,
        organization_id: orgAId,
        email: participantOnlyEmail,
        name: "RLS Participant-Only",
        participant_type: "attendee",
        event_id: eventAId,
      });
      if (participantOnly.error) {
        throw new Error(
          `${SUITE_TAG} insert call_participants (participant-only) failed: ${participantOnly.error.message}`,
        );
      }

      // 5f. Phase 31 (MATCH-09 + SAFE-01): event_match_decisions +
      //     organization_feature_flags fixtures for the bespoke deny-table
      //     isolation block near the end of this file. Both tables are
      //     service-role-only (RLS enabled, no client policy) and need FK
      //     parents the generic CLIENT_DENY_TABLES loop's single-PK seed
      //     cannot produce -- see that array's own comment and
      //     31-RESEARCH.md Pitfall 3.
      const recA2 = await admin
        .from("recordings")
        .insert({
          organization_id: orgAId,
          owner_user_id: userAId,
          title: `${SUITE_TAG} call A2 (event_match_decisions fixture)`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recA2.error || !recA2.data) {
        throw new Error(
          `${SUITE_TAG} insert recording A2 (event_match_decisions fixture) failed: ${recA2.error?.message}`,
        );
      }
      recordingA2Id = recA2.data.id as string;

      const orgFeatureFlag = await admin
        .from("organization_feature_flags")
        .insert({
          organization_id: orgAId,
          flag_key: "event_resolution",
          enabled: true,
        })
        .select("id")
        .single();
      if (orgFeatureFlag.error || !orgFeatureFlag.data) {
        throw new Error(
          `${SUITE_TAG} insert organization_feature_flags fixture failed: ${orgFeatureFlag.error?.message}`,
        );
      }
      orgFeatureFlagId = orgFeatureFlag.data.id as string;

      // recording_id_a/b must satisfy the DB's CHECK (recording_id_a <
      // recording_id_b); sort the two UUID strings for canonical ordering
      // (matches Postgres's own uuid comparison for standard
      // lowercase-hyphenated text form).
      const [orderedRecIdA, orderedRecIdB] = [recordingAId, recordingA2Id].sort();
      const eventMatchDecision = await admin
        .from("event_match_decisions")
        .insert({
          recording_id_a: orderedRecIdA,
          recording_id_b: orderedRecIdB,
          tier: "deterministic",
          decision: "merge_proposed",
          decided_by: "auto",
          applied: false,
        })
        .select("id")
        .single();
      if (eventMatchDecision.error || !eventMatchDecision.data) {
        throw new Error(
          `${SUITE_TAG} insert event_match_decisions fixture failed: ${eventMatchDecision.error?.message}`,
        );
      }
      eventMatchDecisionId = eventMatchDecision.data.id as string;

      // 5g. Phase 32 (SAFE-04): resolve a SECOND, independent pair of Org-A
      //     recordings into one event via apply_event_match_atomic (the
      //     actual resolution RPC, not just a proposed ledger row) --
      //     substrate for the SAFE-04 cross-org no-audience-widening
      //     assertions in the bespoke `events` block below. Two brand-new
      //     recordings, not recordingAId/recordingA2Id, so this fixture
      //     cannot disturb either existing block's assertions above.
      const recA3 = await admin
        .from("recordings")
        .insert({
          organization_id: orgAId,
          owner_user_id: userAId,
          title: `${SUITE_TAG} call A3 (SAFE-04 merge fixture)`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recA3.error || !recA3.data) {
        throw new Error(
          `${SUITE_TAG} insert recording A3 (SAFE-04 merge fixture) failed: ${recA3.error?.message}`,
        );
      }
      recordingA3Id = recA3.data.id as string;

      const recA4 = await admin
        .from("recordings")
        .insert({
          organization_id: orgAId,
          owner_user_id: userAId,
          title: `${SUITE_TAG} call A4 (SAFE-04 merge fixture)`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recA4.error || !recA4.data) {
        throw new Error(
          `${SUITE_TAG} insert recording A4 (SAFE-04 merge fixture) failed: ${recA4.error?.message}`,
        );
      }
      recordingA4Id = recA4.data.id as string;

      const mergedEvent = await admin.rpc("apply_event_match_atomic", {
        p_recording_id_a: recordingA3Id,
        p_recording_id_b: recordingA4Id,
        p_event_id: null,
        p_decided_by: "admin",
        p_signals: { matched_field: "phase32_safe04_fixture" },
        p_owner_user_id: userAId,
      });
      if (mergedEvent.error || !mergedEvent.data) {
        throw new Error(
          `${SUITE_TAG} apply_event_match_atomic (SAFE-04 merge fixture) failed: ${mergedEvent.error?.message}`,
        );
      }
      mergedEventId = mergedEvent.data as string;

      // 5h. Phase 34 (IDENT-01 + T-34-02-01/02): identities/identity_aliases
      //     isolation fixture. A dedicated call_participants row (NOT
      //     participantA/participantOnly above -- a fresh row so this
      //     fixture cannot disturb either existing block's assertions) on
      //     recordingAId, linked via identity_id to a new identities row
      //     owned by User A. One verified email alias on it exercises the
      //     identity_aliases owner-only SELECT policy in the same block.
      const identityA = await admin
        .from("identities")
        .insert({ owner_user_id: userAId, display_name: `${SUITE_TAG} Identity A` })
        .select("id")
        .single();
      if (identityA.error || !identityA.data) {
        throw new Error(
          `${SUITE_TAG} insert identities A fixture failed: ${identityA.error?.message}`,
        );
      }
      identityAId = identityA.data.id as string;

      const identityAAlias = await admin
        .from("identity_aliases")
        .insert({
          identity_id: identityAId,
          alias_type: "email",
          value: `phase34-rls-identity-a-${stamp}@example.com`,
          verified: true,
          confidence: 1.0,
          evidence: "verified email",
        })
        .select("id")
        .single();
      if (identityAAlias.error || !identityAAlias.data) {
        throw new Error(
          `${SUITE_TAG} insert identity_aliases A fixture failed: ${identityAAlias.error?.message}`,
        );
      }
      identityAAliasId = identityAAlias.data.id as string;

      const identityLinkedParticipant = await admin
        .from("call_participants")
        .insert({
          recording_id: recordingAId,
          organization_id: orgAId,
          email: `phase34-rls-identity-participant-${stamp}@example.com`,
          name: "RLS Identity-Linked Participant",
          participant_type: "attendee",
          identity_id: identityAId,
        });
      if (identityLinkedParticipant.error) {
        throw new Error(
          `${SUITE_TAG} insert identity-linked call_participants fixture failed: ${identityLinkedParticipant.error.message}`,
        );
      }

      // 5i. Phase 35 (Plan 03 / IDENT-04 + IDENT-05): speaker_resolution_decisions
      //     fixture for the bespoke deny-table isolation block near the end
      //     of this file. Reuses recordingAId (donor) + recordingA2Id
      //     (target, already seeded in 5f) + identityAId (already seeded
      //     just above in 5h) -- no new FK parents needed.
      const speakerResolutionDecision = await admin
        .from("speaker_resolution_decisions")
        .insert({
          donor_recording_id: recordingAId,
          donor_chunk_index: 0,
          target_recording_id: recordingA2Id,
          target_chunk_index: 0,
          identity_id: identityAId,
          tier: "propagation",
          score: 1.0,
          signals: { gap_ms: 0 },
          decision: "resolution_proposed",
          decided_by: "auto",
          applied: false,
        })
        .select("id")
        .single();
      if (speakerResolutionDecision.error || !speakerResolutionDecision.data) {
        throw new Error(
          `${SUITE_TAG} insert speaker_resolution_decisions fixture failed: ${speakerResolutionDecision.error?.message}`,
        );
      }
      speakerResolutionDecisionId = speakerResolutionDecision.data.id as string;

      // 6. Sign in all three users with their own anon-key clients so the
      //    RLS test uses real JWTs, not service-role.
      clientA = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clientB = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clientParticipantOnly = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const signInA = await clientA.auth.signInWithPassword({
        email: userAEmail,
        password: userAPassword,
      });
      if (signInA.error) {
        throw new Error(
          `${SUITE_TAG} signIn A failed: ${signInA.error.message}`,
        );
      }

      const signInB = await clientB.auth.signInWithPassword({
        email: userBEmail,
        password: userBPassword,
      });
      if (signInB.error) {
        throw new Error(
          `${SUITE_TAG} signIn B failed: ${signInB.error.message}`,
        );
      }

      const signInParticipantOnly = await clientParticipantOnly.auth.signInWithPassword({
        email: participantOnlyEmail,
        password: participantOnlyPassword,
      });
      if (signInParticipantOnly.error) {
        throw new Error(
          `${SUITE_TAG} signIn participant-only failed: ${signInParticipantOnly.error.message}`,
        );
      }
    }, 60_000);

    afterAll(async () => {
      // Belt-and-suspenders cleanup. The data-integrity incident (2026-05)
      // showed that ANY leak path eventually leaves rows in prod —
      // including this test's renamed "Home A" / "Home B" workspaces.
      // We now run BOTH paths and absorb individual failures:
      //
      //   1. Explicit per-fixture deletes (in dependency order) so the
      //      specific rows this test created/mutated are removed even if
      //      the email-pattern sweep doesn't catch them (e.g. an org
      //      without a *@callvault.test owner anymore).
      //   2. The cleanup_test_fixture_users RPC for the broader auth.users
      //      cascade — handles any rows the explicit deletes missed.
      //
      // Workspaces and recordings live on the orgs we created; deleting
      // the orgs cascades to them via FK. If an FK lacks cascade, the
      // explicit deletes above already removed the dependent rows.

      // 1a-0. Phase 11 ticket fixtures. Deleting the tickets cascades to
      //       ticket_messages and ticket_events via FK ON DELETE CASCADE.
      try {
        if (ticketAId) {
          await admin.from("tickets").delete().eq("id", ticketAId);
        }
        if (ticketBId) {
          await admin.from("tickets").delete().eq("id", ticketBId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} ticket fixture cleanup threw:`, err);
      }

      // 1a-1. Phase 30 events fixture. No cascade dependents point AT events
      //       (recordings.event_id / call_participants.event_id are both ON
      //       DELETE SET NULL, so deleting recordingA/the call_participants
      //       row later does not remove this row) -- delete it directly.
      try {
        if (eventAId) {
          await admin.from("events").delete().eq("id", eventAId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} events fixture cleanup threw:`, err);
      }

      // 1a-1b. Phase 32 (SAFE-04) merged-event fixture. No cascade dependents
      //        point AT events (recordings.event_id is ON DELETE SET NULL),
      //        so delete it directly -- mirrors the eventAId step above.
      try {
        if (mergedEventId) {
          await admin.from("events").delete().eq("id", mergedEventId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} SAFE-04 merged-event fixture cleanup threw:`, err);
      }

      // 1a-1c. Phase 34 (IDENT-01) identities/identity_aliases fixture.
      //        identity_aliases FK CASCADEs from identities, so deleting
      //        identities alone would suffice -- explicit delete of both is
      //        defense-in-depth, mirroring the event_match_decisions +
      //        organization_feature_flags pattern below. The identity-linked
      //        call_participants row cascades away with recordingAId in 1c.
      try {
        if (speakerResolutionDecisionId) {
          await admin.from("speaker_resolution_decisions").delete().eq("id", speakerResolutionDecisionId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} speaker_resolution_decisions fixture cleanup threw:`, err);
      }

      try {
        if (identityAAliasId) {
          await admin.from("identity_aliases").delete().eq("id", identityAAliasId);
        }
        if (identityAId) {
          await admin.from("identities").delete().eq("id", identityAId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} identities/identity_aliases fixture cleanup threw:`, err);
      }

      // 1a-2. Phase 31 (MATCH-09 + SAFE-01) event_match_decisions +
      //       organization_feature_flags fixtures. Both FK ON DELETE CASCADE
      //       from recordings/organizations respectively (deleted below in
      //       1c/1e), so this explicit delete is defense-in-depth -- it keeps
      //       this plan's own fixtures independently verifiable/idempotent
      //       regardless of how the recordings/organizations cleanup below
      //       behaves.
      try {
        if (eventMatchDecisionId) {
          await admin.from("event_match_decisions").delete().eq("id", eventMatchDecisionId);
        }
        if (orgFeatureFlagId) {
          await admin.from("organization_feature_flags").delete().eq("id", orgFeatureFlagId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} event_match_decisions/organization_feature_flags fixture cleanup threw:`, err);
      }

      // 1a. Tables linked to new CROSS_ORG coverage fixtures.
      try {
        if (importRoutingRuleAId) {
          await admin.from("import_routing_rules").delete().eq("id", importRoutingRuleAId);
        }
        if (importRoutingRuleBId) {
          await admin.from("import_routing_rules").delete().eq("id", importRoutingRuleBId);
        }
        if (contactFolderAId) {
          await admin.from("contact_folders").delete().eq("id", contactFolderAId);
        }
        if (contactFolderBId) {
          await admin.from("contact_folders").delete().eq("id", contactFolderBId);
        }
        if (personalFolderAId) {
          await admin.from("personal_folders").delete().eq("id", personalFolderAId);
        }
        if (personalFolderBId) {
          await admin.from("personal_folders").delete().eq("id", personalFolderBId);
        }
        if (personalTagAId) {
          await admin.from("personal_tags").delete().eq("id", personalTagAId);
        }
        if (personalTagBId) {
          await admin.from("personal_tags").delete().eq("id", personalTagBId);
        }
        if (userAId) {
          await admin.from("import_sources").delete().eq("user_id", userAId);
        }
        if (userBId) {
          await admin.from("import_sources").delete().eq("user_id", userBId);
        }
      } catch (err) {
         
        console.warn(`${SUITE_TAG} extended fixture cleanup threw:`, err);
      }

      // 1b. Folders (depend on workspace)
      try {
        if (folderAId) await admin.from("folders").delete().eq("id", folderAId);
        if (folderBId) await admin.from("folders").delete().eq("id", folderBId);
      } catch (err) {
         
        console.warn(`${SUITE_TAG} folder cleanup threw:`, err);
      }

      // 1c. Recordings
      try {
        if (recordingAId) await admin.from("recordings").delete().eq("id", recordingAId);
        if (recordingBId) await admin.from("recordings").delete().eq("id", recordingBId);
        if (recordingA2Id) await admin.from("recordings").delete().eq("id", recordingA2Id);
        if (recordingA3Id) await admin.from("recordings").delete().eq("id", recordingA3Id);
        if (recordingA4Id) await admin.from("recordings").delete().eq("id", recordingA4Id);
      } catch (err) {
         
        console.warn(`${SUITE_TAG} recording cleanup threw:`, err);
      }

      // 1d. Workspaces (these are the "Home A" / "Home B" rows the test
      //     renamed — they need to go even if the user-sweep RPC fails)
      try {
        if (workspaceAId) await admin.from("workspaces").delete().eq("id", workspaceAId);
        if (workspaceBId) await admin.from("workspaces").delete().eq("id", workspaceBId);
      } catch (err) {
         
        console.warn(`${SUITE_TAG} workspace cleanup threw:`, err);
      }

      // 1e. Organizations
      try {
        if (orgAId) await admin.from("organizations").delete().eq("id", orgAId);
        if (orgBId) await admin.from("organizations").delete().eq("id", orgBId);
      } catch (err) {
         
        console.warn(`${SUITE_TAG} org cleanup threw:`, err);
      }

      // 2. RPC sweep for auth.users + any orphaned cascades. The RPC
      // disables three protective DELETE triggers for its transaction
      // and matches only @callvault.test / @example.invalid /
      // qa-sweep-%@vibeos.com — safe by construction.
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

    // For each table, attempt the cross-org read from BOTH directions.
    for (const { table, filterColumn } of CROSS_ORG_TABLES) {
      it(`Org B cannot read Org A rows from ${table}`, async () => {
        const filterValue =
          filterColumn === "organization_id"
            ? orgAId
            : filterColumn === "org_id"
              ? orgAId
              : filterColumn === "user_id"
                ? userAId
            : filterColumn === "reporter_id"
              ? userAId
              : filterColumn === "ticket_id"
                ? ticketAId
            : filterColumn === "workspace_id"
              ? workspaceAId
              : filterColumn === "folder_id"
                ? folderAId
                : recordingAId;

        const { data, error } = await clientB
          .from(table)
          .select("*")
          .eq(filterColumn, filterValue);

        // Per Supabase: a successful query against a table the user has
        // no RLS access to returns data=[] with no error. An error means
        // the table doesn't exist / column is wrong — treat as a setup
        // bug, not a leak.
        if (error) {
          throw new Error(
            `${SUITE_TAG} setup-error querying ${table}.${filterColumn}: ${error.message}`,
          );
        }
        expect(
          data?.length ?? 0,
          `RLS LEAK: table=${table} filter=${filterColumn}=${filterValue} (Org B JWT can see ${
            data?.length ?? 0
          } Org A row(s))`,
        ).toBe(0);
      });

      it(`Org A cannot read Org B rows from ${table}`, async () => {
        const filterValue =
          filterColumn === "organization_id"
            ? orgBId
            : filterColumn === "org_id"
              ? orgBId
              : filterColumn === "user_id"
                ? userBId
            : filterColumn === "reporter_id"
              ? userBId
              : filterColumn === "ticket_id"
                ? ticketBId
            : filterColumn === "workspace_id"
              ? workspaceBId
              : filterColumn === "folder_id"
                ? folderBId
                : recordingBId;

        const { data, error } = await clientA
          .from(table)
          .select("*")
          .eq(filterColumn, filterValue);

        if (error) {
          throw new Error(
            `${SUITE_TAG} setup-error querying ${table}.${filterColumn}: ${error.message}`,
          );
        }
        expect(
          data?.length ?? 0,
          `RLS LEAK: table=${table} filter=${filterColumn}=${filterValue} (Org A JWT can see ${
            data?.length ?? 0
          } Org B row(s))`,
        ).toBe(0);
      });
    }

    // Phase 24 (24-REVIEW CR-01): client-deny tables. These have RLS enabled
    // with NO permissive policy, so an authenticated JWT must read ZERO rows
    // even when a row exists. We seed one row via service-role (which bypasses
    // RLS), assert both org clients see nothing, then clean it up.
    // Per-table seed shape for the generic CLIENT_DENY_TABLES loop below.
    // fathom_calls_orphan_report's PK is fathom_call_id (BIGINT). Phase 34's
    // identity_alias_verifications (Plan 03 / IDENT-03) has no BIGINT PK --
    // it FKs to the Supabase-managed users table via user_id instead, so it
    // needs userAId (an existing fixture user from this same describe
    // block's beforeAll) plus a unique email to satisfy UNIQUE(user_id,
    // email). Extending this function (rather than duplicating the whole
    // loop into a second bespoke block) keeps the "single canonical
    // deny-loop" property the CLIENT_DENY_TABLES comment promises, while
    // still supporting a second seed shape.
    function buildClientDenySeed(
      table: string,
      sentinelId: number,
    ): { row: Record<string, unknown>; pkColumn: string; pkValue: string | number } {
      if (table === "identity_alias_verifications") {
        return {
          row: {
            user_id: userAId,
            email: `phase38-deny-${sentinelId}@example.com`,
            code_hash: "0".repeat(64),
            expires_at: new Date(Date.now() + 600_000).toISOString(),
            attempts: 0,
          },
          pkColumn: "user_id",
          pkValue: userAId,
        };
      }
      return {
        row: { fathom_call_id: sentinelId, recording_id_bigint: sentinelId },
        pkColumn: "fathom_call_id",
        pkValue: sentinelId,
      };
    }

    for (const table of CLIENT_DENY_TABLES) {
      if (BESPOKE_CLIENT_DENY_TABLES.has(table)) continue; // seeded/asserted in the bespoke block below
      it(`authenticated JWTs cannot read service-role rows from ${table}`, async () => {
        // Seed a sentinel row via service-role. Use a high, test-only id to
        // avoid clashing with any real row.
        const sentinelId = 9_000_000_000_000 + (Date.now() % 1_000_000_000);
        const { row, pkColumn, pkValue } = buildClientDenySeed(table, sentinelId);
        const seed = await admin.from(table).insert(row);
        if (seed.error) {
          throw new Error(
            `${SUITE_TAG} setup-error seeding ${table}: ${seed.error.message}`,
          );
        }

        try {
          for (const [label, client] of [
            ["A", clientA],
            ["B", clientB],
          ] as const) {
            const { data, error } = await client
              .from(table)
              .select("*")
              .eq(pkColumn, pkValue);

            if (error) {
              throw new Error(
                `${SUITE_TAG} setup-error querying ${table} as client ${label}: ${error.message}`,
              );
            }
            expect(
              data?.length ?? 0,
              `RLS LEAK: table=${table} (authenticated client ${label} can see ${
                data?.length ?? 0
              } service-role-only row(s); expected client deny-all)`,
            ).toBe(0);
          }
        } finally {
          await admin.from(table).delete().eq(pkColumn, pkValue);
        }
      });
    }

    // ==========================================================================
    // Phase 30 (EVT-04 + SAFE-05): bespoke `events` isolation block.
    //
    // events cannot join the CROSS_ORG_TABLES loop above -- its filterColumn
    // union (organization_id | org_id | user_id | recording_id | workspace_id
    // | folder_id | reporter_id | ticket_id) has no member that applies:
    // EVT-04 deliberately forbids an organization_id column on events (it is
    // the first non-org-scoped table in this schema; visibility is granted
    // via participation or an owned capture instead, never org membership).
    // A pure negative/leak test would also pass for the wrong reason against
    // a mis-scoped deny-everyone policy, so this block asserts BOTH
    // directions: the unrelated org reads zero rows, and the actual
    // owner/participant reads exactly one row.
    //
    // call_participants' SAFE-05 half needs no new code here: it is already
    // registered in CROSS_ORG_TABLES above (filterColumn: "recording_id"),
    // and that loop's select("*") already covers the event_id/role/
    // has_confirmed_speech columns this phase's migration added.
    //
    // Gap closure (30-REVIEW.md WR-01): the two tests below only ever
    // exercised User A, who is simultaneously the recording owner, an Org A
    // member, AND the call_participants email match -- so they passed on
    // the ownership grant alone and gave zero signal about whether the
    // participation grant works in isolation. That is exactly the gap
    // 30-REVIEW.md CR-01 fell through undetected: the participation branch
    // of "participants_and_owners_can_view_events" queried call_participants
    // directly, and call_participants' own org-membership-only SELECT
    // policy silently zeroed out that subquery for any non-org-member
    // participant. The third test below isolates the participation grant
    // with a participant-only fixture (no ownership, no org-membership) and
    // proves the CR-01 fix migration (20260831020000,
    // public.user_participates_in_event) actually restores it.
    // ==========================================================================
    it("Org B (unrelated org) cannot read the event Org A owns/participates in", async () => {
      const { data, error } = await clientB
        .from("events")
        .select("*")
        .eq("id", eventAId);

      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying events as client B: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `RLS LEAK: table=events id=${eventAId} (Org B JWT, unrelated to this event, can see ${
          data?.length ?? 0
        } row(s))`,
      ).toBe(0);
    });

    it("Org A (owner + participant) reads exactly the one event it owns/participates in", async () => {
      const { data, error } = await clientA
        .from("events")
        .select("*")
        .eq("id", eventAId);

      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying events as client A: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `events RLS false-deny: table=events id=${eventAId} (Org A JWT, the owner AND participant of this event, can see ${
          data?.length ?? 0
        } row(s), expected exactly 1 -- a mis-scoped deny-everyone policy would also pass a leak-only/negative test, this positive assertion catches that)`,
      ).toBe(1);
    });

    it("a participant with no ownership/org-membership relationship still reads the event via participation alone", async () => {
      const { data, error } = await clientParticipantOnly
        .from("events")
        .select("*")
        .eq("id", eventAId);

      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying events as participant-only client: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `events RLS participation grant unreachable (30-REVIEW.md CR-01): table=events id=${eventAId} (participant-only JWT -- no ownership, no org-membership relationship to Org A -- can see ${
          data?.length ?? 0
        } row(s), expected exactly 1; this is the exact scenario the "participants_and_owners_can_view_events" participation branch exists to grant)`,
      ).toBe(1);
    });

    // ==========================================================================
    // Phase 32 (SAFE-04): cross-org no-audience-widening after resolution.
    //
    // Resolving two same-org recordings into one event via
    // apply_event_match_atomic (the real RPC, not just a proposed ledger row)
    // must never widen either recording's OR the resulting event's readable
    // audience. The events RLS boundary is unchanged by this phase (EVT-04:
    // participation/owned-capture only, never organization_id) -- this block
    // proves that boundary still holds for a genuinely MERGED pair, not just
    // a single never-merged event (the block above). Same-org-only pairing in
    // the matcher itself (event-resolver.ts findDeterministicMatches' cross-
    // org rejection, plus Plan 02's metadata-tier same-org proof) is
    // defense-in-depth at the matcher layer; this block proves the actual
    // enforcement boundary -- RLS -- holds regardless of matcher behavior.
    //
    // Per the existing event_match_decisions block's own precedent
    // (T-31-03-03): the service role first asserts the merged event + both
    // recordings ARE visible to it, so the zero-rows-from-JWT assertions
    // below cannot pass merely because the rows don't exist.
    // ==========================================================================
    it("service role sees the merged event and both merged recordings (existence proof, mirrors T-31-03-03)", async () => {
      const eventRow = await admin
        .from("events")
        .select("*")
        .eq("id", mergedEventId);
      if (eventRow.error) {
        throw new Error(
          `${SUITE_TAG} setup-error: service role could not read the SAFE-04 merged event: ${eventRow.error.message}`,
        );
      }
      expect(
        eventRow.data?.length ?? 0,
        `${SUITE_TAG} test-integrity failure: merged event id=${mergedEventId} is invisible even to the service role -- the deny assertions below would be an empty-table false pass, not a real deny proof`,
      ).toBe(1);

      const recRows = await admin
        .from("recordings")
        .select("id, event_id")
        .in("id", [recordingA3Id, recordingA4Id]);
      if (recRows.error) {
        throw new Error(
          `${SUITE_TAG} setup-error: service role could not read the SAFE-04 merged recordings: ${recRows.error.message}`,
        );
      }
      expect(
        recRows.data?.length ?? 0,
        `${SUITE_TAG} test-integrity failure: the two SAFE-04 merged recordings are not both visible to the service role`,
      ).toBe(2);
      for (const row of recRows.data ?? []) {
        expect(
          row.event_id,
          `${SUITE_TAG} test-integrity failure: recording ${row.id} does not carry the merged event_id`,
        ).toBe(mergedEventId);
      }
    });

    it("Org B (unrelated org) cannot read the merged event by id", async () => {
      const { data, error } = await clientB
        .from("events")
        .select("*")
        .eq("id", mergedEventId);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying the merged event as client B: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `RLS LEAK (SAFE-04): table=events id=${mergedEventId} (Org B JWT can see ${
          data?.length ?? 0
        } row(s) of an event resolved from two Org-A recordings -- resolution widened cross-org readable audience)`,
      ).toBe(0);
    });

    it("Org B (unrelated org) cannot read either merged recording by id", async () => {
      const { data, error } = await clientB
        .from("recordings")
        .select("*")
        .in("id", [recordingA3Id, recordingA4Id]);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying the merged recordings as client B: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `RLS LEAK (SAFE-04): table=recordings ids=${recordingA3Id},${recordingA4Id} (Org B JWT can see ${
          data?.length ?? 0
        } row(s) of Org-A recordings that were resolved into a shared event -- resolution widened cross-org readable audience)`,
      ).toBe(0);
    });

    // ==========================================================================
    // Phase 31 (MATCH-09 + SAFE-01): bespoke event_match_decisions +
    // organization_feature_flags deny-table isolation block.
    //
    // Both are registered in CLIENT_DENY_TABLES above but skipped by the
    // generic loop directly below that array (BESPOKE_CLIENT_DENY_TABLES):
    // that loop's seed shape (a single fathom_call_id PK) is
    // fathom_calls_orphan_report-specific. event_match_decisions needs TWO
    // distinct Org-A recordings satisfying recording_id_a < recording_id_b;
    // organization_feature_flags needs an organization. Fixtures
    // (recordingA2Id, eventMatchDecisionId, orgFeatureFlagId) are seeded in
    // beforeAll step 5f and torn down in afterAll -- mirrors the bespoke
    // `events` block above, the precedent for a table needing FK parents the
    // generic loops cannot seed (31-RESEARCH.md Pitfall 3).
    //
    // Per this plan's threat model (T-31-03-03): the service role first
    // asserts each seeded row IS visible to it, so the zero-rows-from-JWT
    // assertions below cannot pass merely because the table is empty.
    // ==========================================================================
    it("service role sees the seeded event_match_decisions and organization_feature_flags rows (existence proof, T-31-03-03)", async () => {
      const decisionRow = await admin
        .from("event_match_decisions")
        .select("*")
        .eq("id", eventMatchDecisionId);
      if (decisionRow.error) {
        throw new Error(
          `${SUITE_TAG} setup-error: service role could not read seeded event_match_decisions row: ${decisionRow.error.message}`,
        );
      }
      expect(
        decisionRow.data?.length ?? 0,
        `${SUITE_TAG} test-integrity failure: seeded event_match_decisions row id=${eventMatchDecisionId} is invisible even to the service role -- the deny assertion below would be an empty-table false pass, not a real deny proof`,
      ).toBe(1);

      const flagRow = await admin
        .from("organization_feature_flags")
        .select("*")
        .eq("id", orgFeatureFlagId);
      if (flagRow.error) {
        throw new Error(
          `${SUITE_TAG} setup-error: service role could not read seeded organization_feature_flags row: ${flagRow.error.message}`,
        );
      }
      expect(
        flagRow.data?.length ?? 0,
        `${SUITE_TAG} test-integrity failure: seeded organization_feature_flags row id=${orgFeatureFlagId} is invisible even to the service role -- the deny assertion below would be an empty-table false pass, not a real deny proof`,
      ).toBe(1);
    });

    it("authenticated JWTs cannot read the service-role-seeded event_match_decisions row", async () => {
      for (const [label, client] of [
        ["A", clientA],
        ["B", clientB],
      ] as const) {
        const { data, error } = await client
          .from("event_match_decisions")
          .select("*")
          .eq("id", eventMatchDecisionId);
        if (error) {
          throw new Error(
            `${SUITE_TAG} setup-error querying event_match_decisions as client ${label}: ${error.message}`,
          );
        }
        expect(
          data?.length ?? 0,
          `RLS LEAK: table=event_match_decisions id=${eventMatchDecisionId} (authenticated client ${label} can see ${
            data?.length ?? 0
          } row(s); expected client deny-all)`,
        ).toBe(0);
      }
    });

    it("authenticated JWTs cannot read the service-role-seeded organization_feature_flags row", async () => {
      for (const [label, client] of [
        ["A", clientA],
        ["B", clientB],
      ] as const) {
        const { data, error } = await client
          .from("organization_feature_flags")
          .select("*")
          .eq("id", orgFeatureFlagId);
        if (error) {
          throw new Error(
            `${SUITE_TAG} setup-error querying organization_feature_flags as client ${label}: ${error.message}`,
          );
        }
        expect(
          data?.length ?? 0,
          `RLS LEAK: table=organization_feature_flags id=${orgFeatureFlagId} (authenticated client ${label} can see ${
            data?.length ?? 0
          } row(s); expected client deny-all)`,
        ).toBe(0);
      }
    });

    // ==========================================================================
    // Phase 35 (Plan 03 / IDENT-04 + IDENT-05): bespoke speaker_resolution_decisions
    // deny-table isolation block. Mirrors the event_match_decisions block
    // above exactly -- service-role existence proof first (T-31-03-03
    // pattern), then a client-deny assertion for both orgs' JWTs.
    // ==========================================================================
    it("service role sees the seeded speaker_resolution_decisions row (existence proof)", async () => {
      const decisionRow = await admin
        .from("speaker_resolution_decisions")
        .select("*")
        .eq("id", speakerResolutionDecisionId);
      if (decisionRow.error) {
        throw new Error(
          `${SUITE_TAG} setup-error: service role could not read seeded speaker_resolution_decisions row: ${decisionRow.error.message}`,
        );
      }
      expect(
        decisionRow.data?.length ?? 0,
        `${SUITE_TAG} test-integrity failure: seeded speaker_resolution_decisions row id=${speakerResolutionDecisionId} is invisible even to the service role -- the deny assertion below would be an empty-table false pass, not a real deny proof`,
      ).toBe(1);
    });

    it("authenticated JWTs cannot read the service-role-seeded speaker_resolution_decisions row", async () => {
      for (const [label, client] of [
        ["A", clientA],
        ["B", clientB],
      ] as const) {
        const { data, error } = await client
          .from("speaker_resolution_decisions")
          .select("*")
          .eq("id", speakerResolutionDecisionId);
        if (error) {
          throw new Error(
            `${SUITE_TAG} setup-error querying speaker_resolution_decisions as client ${label}: ${error.message}`,
          );
        }
        expect(
          data?.length ?? 0,
          `RLS LEAK: table=speaker_resolution_decisions id=${speakerResolutionDecisionId} (authenticated client ${label} can see ${
            data?.length ?? 0
          } row(s); expected client deny-all)`,
        ).toBe(0);
      }
    });

    // ==========================================================================
    // Phase 34 (IDENT-01 + T-34-02-01/02): bespoke `identities`/
    // `identity_aliases` isolation block.
    //
    // identities cannot join the CROSS_ORG_TABLES loop above for the same
    // reason `events` cannot (see that block's own comment): IDENT-01/
    // 34-CONTEXT.md deliberately forbid an organization_id column on
    // identities -- it is the second non-org-scoped table in this schema,
    // after events. Visibility is participation (via a linked
    // call_participants/contacts row's organization) or ownership
    // (identities.owner_user_id) only, via the SECURITY DEFINER
    // user_can_view_identity() helper -- never organization_id, never an
    // org-admin bypass (T-34-02-03).
    //
    // identity_aliases carries PII (`value` -- e.g. a raw email) and is
    // SELECT-owner-only (T-34-02-02); Org B must read zero rows of it too.
    // A pure negative/leak test would also pass for the wrong reason against
    // a mis-scoped deny-everyone policy, so this block asserts both
    // directions on identities: the unrelated org reads zero, and the
    // actual owner/participant (User A) reads exactly one.
    // ==========================================================================
    it("Org B (unrelated org) cannot read the identity linked via Org A's call_participant", async () => {
      const { data, error } = await clientB
        .from("identities")
        .select("*")
        .eq("id", identityAId);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying identities as client B: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `RLS LEAK: table=identities id=${identityAId} (Org B JWT, unrelated to this identity, can see ${
          data?.length ?? 0
        } row(s))`,
      ).toBe(0);
    });

    it("Org A (owner + participation) reads exactly the one identity it owns/participates in", async () => {
      const { data, error } = await clientA
        .from("identities")
        .select("*")
        .eq("id", identityAId);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying identities as client A: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `identities RLS false-deny: table=identities id=${identityAId} (Org A JWT, the owner of this identity, can see ${
          data?.length ?? 0
        } row(s), expected exactly 1 -- a mis-scoped deny-everyone policy would also pass a leak-only/negative test, this positive assertion catches that)`,
      ).toBe(1);
    });

    it("Org B (unrelated org) cannot read Org A's identity_aliases row (raw PII value)", async () => {
      const { data, error } = await clientB
        .from("identity_aliases")
        .select("*")
        .eq("identity_id", identityAId);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying identity_aliases as client B: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `RLS LEAK: table=identity_aliases identity_id=${identityAId} (Org B JWT can see ${
          data?.length ?? 0
        } row(s) of Org A's identity alias, which carries raw PII in its value column)`,
      ).toBe(0);
    });

    it("Org A (owner) reads exactly its own identity_aliases row", async () => {
      const { data, error } = await clientA
        .from("identity_aliases")
        .select("*")
        .eq("identity_id", identityAId);
      if (error) {
        throw new Error(
          `${SUITE_TAG} setup-error querying identity_aliases as client A: ${error.message}`,
        );
      }
      expect(
        data?.length ?? 0,
        `identity_aliases RLS false-deny: identity_id=${identityAId} (Org A JWT, the identity owner, can see ${
          data?.length ?? 0
        } row(s), expected exactly 1)`,
      ).toBe(1);
    });
  },
);
