/**
 * RLS Regression Test (SEC-04C, Phase 38).
 *
 * Cross-org isolation safety net. Creates 2 orgs (A, B), one user per org,
 * one recording + workspace + folder per org via service-role. Then signs in
 * as each user (anon JWT) and asserts Org B's JWT cannot read Org A's rows
 * across every user-facing table.
 *
 * Hits a REAL Supabase DB. Skipped cleanly when
 * SUPABASE_TEST_SERVICE_ROLE_KEY (or fallback SUPABASE_SERVICE_ROLE_KEY) is
 * not set (CI without secrets stays green).
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

const TEST_URL =
  process.env.VITE_SUPABASE_TEST_URL || process.env.VITE_SUPABASE_URL || "";
const TEST_ANON_KEY =
  process.env.VITE_SUPABASE_TEST_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "";

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
    | "recording_id"
    | "workspace_id"
    | "folder_id";
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

    let clientA: SupabaseClient;
    let clientB: SupabaseClient;

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY (or *_TEST_*) env vars`,
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
      const wsA = await admin
        .from("workspaces")
        .insert({
          organization_id: orgAId,
          name: "Home A",
          workspace_type: "team",
          is_home: true,
        })
        .select("id")
        .single();
      if (wsA.error || !wsA.data) {
        throw new Error(
          `${SUITE_TAG} insert workspace A failed: ${wsA.error?.message}`,
        );
      }
      workspaceAId = wsA.data.id as string;

      const wsB = await admin
        .from("workspaces")
        .insert({
          organization_id: orgBId,
          name: "Home B",
          workspace_type: "team",
          is_home: true,
        })
        .select("id")
        .single();
      if (wsB.error || !wsB.data) {
        throw new Error(
          `${SUITE_TAG} insert workspace B failed: ${wsB.error?.message}`,
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
      // Single-call cleanup via cleanup_test_fixture_users() SQL helper.
      // The previous per-table delete chain was silently failing on every
      // run because the prevent_last_workspace_owner trigger blocks
      // workspace_memberships cascades. The helper disables that trigger
      // for its own transaction, sweeps every fixture user matching the
      // @callvault.test pattern, and lets all FK cascades fire cleanly.
      // p_max_age_minutes=0 ignores age — safe because the WHERE clause
      // only ever matches test-domain emails.
      try {
        const { error } = await admin.rpc("cleanup_test_fixture_users", {
          p_max_age_minutes: 0,
        });
        if (error) {
          // eslint-disable-next-line no-console
          console.warn(
            `${SUITE_TAG} cleanup_test_fixture_users RPC failed:`,
            error.message,
          );
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`${SUITE_TAG} cleanup threw:`, err);
      }
    }, 60_000);

    // For each table, attempt the cross-org read from BOTH directions.
    for (const { table, filterColumn } of CROSS_ORG_TABLES) {
      it(`Org B cannot read Org A rows from ${table}`, async () => {
        const filterValue =
          filterColumn === "organization_id"
            ? orgAId
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
