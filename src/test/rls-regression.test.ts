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
];

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

    let clientA: SupabaseClient;
    let clientB: SupabaseClient;

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY env vars (dedicated test project only — no prod fallback)`,
        );
      }

      const stamp = Date.now();
      userAEmail = `phase38-rls-a-${stamp}@callvault.test`;
      userBEmail = `phase38-rls-b-${stamp}@callvault.test`;

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

      // 6. Sign in BOTH users with their own anon-key clients so the RLS
      //    test uses real JWTs, not service-role.
      clientA = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      clientB = createClient(TEST_URL, TEST_ANON_KEY, {
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
  },
);
