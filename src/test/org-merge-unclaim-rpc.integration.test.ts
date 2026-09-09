/**
 * ORG-03 integration proof (Phase 36, Plan 02, Task 3).
 *
 * Proves merge_organizations_atomic / unclaim_organization_domain_atomic
 * against a REAL Supabase DB:
 *  - non-platform-admin p_admin_user_id -> RAISEs 'Access denied', no mutation
 *  - platform admin (has_role ADMIN) merge sets ONLY the losing org's
 *    canonical_organization_id/merged_at/merged_by -- recordings.organization_id
 *    and both orgs' organization_memberships rows are byte-unchanged
 *  - clearing canonical_organization_id/merged_at/merged_by fully restores
 *    original state (reversibility)
 *  - the chain-prevention trigger (20260908140000) rejects merging INTO an
 *    already-merged org, and rejects merging an org other orgs already
 *    point to -- proven end-to-end THROUGH the RPC, not just the trigger
 *    in isolation
 *  - unclaim_organization_domain_atomic: same has_role gate, admin deletes
 *    the organization_domains row, non-admin is rejected and the row survives
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and supabase/CLAUDE.md
 * "Running integration tests safely". No fallback to production-like env vars.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeIntegrationClient, integrationDbReachable } from "@/test/integration-setup";

const SUITE_TAG = "[phase-36-02 org-merge-unclaim-rpc]";

type MembershipRow = { organization_id: string; user_id: string; role: string };

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ORG-03 merge + unclaim admin RPCs`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    const stamp = Date.now();

    // Platform-admin authority is BY PARAMETER (has_role), never org
    // membership -- this user is deliberately a member of NONE of the test
    // orgs below, proving the gate really is has_role(user, 'ADMIN') and not
    // is_organization_admin_or_owner (36-RESEARCH.md Pitfall 5).
    let platformAdminUserId = "";
    let platformAdminEmail = "";

    // A plain authenticated user with no user_roles row at all -- used to
    // prove the "Access denied" path for both RPCs.
    let nonAdminUserId = "";
    let nonAdminEmail = "";

    // Main merge/reversal fixture.
    let orgLosingId = "";
    let orgWinningId = "";
    let recordingLosingId = "";
    let membershipLosingUserId = "";
    let membershipWinningUserId = "";

    // Chain-prevention fixture: chainM1 is merged into chainM2 (via the RPC
    // itself -- a legitimate merge, not a raw UPDATE) so that chainM1 is
    // already a "loser" and chainM2 is already a "winner" (pointed at by
    // chainM1). chainM3/chainM4 are fresh, never-merged orgs used as the
    // attempted counterpart in each of the two chain-rejection directions.
    let chainM1Id = "";
    let chainM2Id = "";
    let chainM3Id = "";
    let chainM4Id = "";

    // Unclaim fixture: a claimed domain living on orgWinningId (chosen
    // because orgWinningId is never itself merged/unmerged by this suite,
    // so its own membership/pointer state stays irrelevant background for
    // these two tests).
    let domainToUnclaimId = "";

    beforeAll(async () => {
      if (!integrationDbReachable) return;

      platformAdminEmail = `phase36-02-admin-${stamp}@callvault.test`;
      nonAdminEmail = `phase36-02-nonadmin-${stamp}@callvault.test`;

      // 1. Create the two auth users.
      const createAdmin = await admin.auth.admin.createUser({
        email: platformAdminEmail,
        password: `phase36-02-admin-${stamp}-pwd!`,
        email_confirm: true,
      });
      if (createAdmin.error || !createAdmin.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser platform admin failed: ${createAdmin.error?.message}`,
        );
      }
      platformAdminUserId = createAdmin.data.user.id;

      const createNonAdmin = await admin.auth.admin.createUser({
        email: nonAdminEmail,
        password: `phase36-02-nonadmin-${stamp}-pwd!`,
        email_confirm: true,
      });
      if (createNonAdmin.error || !createNonAdmin.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser non-admin failed: ${createNonAdmin.error?.message}`,
        );
      }
      nonAdminUserId = createNonAdmin.data.user.id;

      // 2. Grant platform ADMIN role via user_roles -- has_role() is the
      // ONLY authority mechanism these RPCs check (never
      // organization_memberships).
      const roleGrant = await admin.from("user_roles").insert({
        user_id: platformAdminUserId,
        role: "ADMIN",
      });
      if (roleGrant.error) {
        throw new Error(
          `${SUITE_TAG} grant ADMIN role failed: ${roleGrant.error.message}`,
        );
      }

      // 3. Main merge/reversal fixture: two orgs, each with its own
      // organization_owner membership row, plus one recording on the
      // losing org.
      const orgLosing = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Losing Org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgLosing.error || !orgLosing.data) {
        throw new Error(
          `${SUITE_TAG} insert losing org failed: ${orgLosing.error?.message}`,
        );
      }
      orgLosingId = orgLosing.data.id as string;

      const orgWinning = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Winning Org ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (orgWinning.error || !orgWinning.data) {
        throw new Error(
          `${SUITE_TAG} insert winning org failed: ${orgWinning.error?.message}`,
        );
      }
      orgWinningId = orgWinning.data.id as string;

      const createLosingOwner = await admin.auth.admin.createUser({
        email: `phase36-02-losing-owner-${stamp}@callvault.test`,
        password: `phase36-02-losing-owner-${stamp}-pwd!`,
        email_confirm: true,
      });
      if (createLosingOwner.error || !createLosingOwner.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser losing-org owner failed: ${createLosingOwner.error?.message}`,
        );
      }
      membershipLosingUserId = createLosingOwner.data.user.id;

      const createWinningOwner = await admin.auth.admin.createUser({
        email: `phase36-02-winning-owner-${stamp}@callvault.test`,
        password: `phase36-02-winning-owner-${stamp}-pwd!`,
        email_confirm: true,
      });
      if (createWinningOwner.error || !createWinningOwner.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser winning-org owner failed: ${createWinningOwner.error?.message}`,
        );
      }
      membershipWinningUserId = createWinningOwner.data.user.id;

      const membershipLosing = await admin.from("organization_memberships").insert({
        organization_id: orgLosingId,
        user_id: membershipLosingUserId,
        role: "organization_owner",
      });
      if (membershipLosing.error) {
        throw new Error(
          `${SUITE_TAG} insert losing-org membership failed: ${membershipLosing.error.message}`,
        );
      }

      const membershipWinning = await admin.from("organization_memberships").insert({
        organization_id: orgWinningId,
        user_id: membershipWinningUserId,
        role: "organization_owner",
      });
      if (membershipWinning.error) {
        throw new Error(
          `${SUITE_TAG} insert winning-org membership failed: ${membershipWinning.error.message}`,
        );
      }

      const recordingLosing = await admin
        .from("recordings")
        .insert({
          organization_id: orgLosingId,
          owner_user_id: membershipLosingUserId,
          title: `${SUITE_TAG} losing-org recording`,
          source_app: "manual",
        })
        .select("id")
        .single();
      if (recordingLosing.error || !recordingLosing.data) {
        throw new Error(
          `${SUITE_TAG} insert losing-org recording failed: ${recordingLosing.error?.message}`,
        );
      }
      recordingLosingId = recordingLosing.data.id as string;

      // 4. Chain-prevention fixture: chainM1 -> chainM2 (a real, legitimate
      // merge via the RPC under test), plus two fresh orgs for the two
      // rejection directions.
      const chainM1 = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Chain M1 ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (chainM1.error || !chainM1.data) {
        throw new Error(
          `${SUITE_TAG} insert chain M1 org failed: ${chainM1.error?.message}`,
        );
      }
      chainM1Id = chainM1.data.id as string;

      const chainM2 = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Chain M2 ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (chainM2.error || !chainM2.data) {
        throw new Error(
          `${SUITE_TAG} insert chain M2 org failed: ${chainM2.error?.message}`,
        );
      }
      chainM2Id = chainM2.data.id as string;

      const chainM3 = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Chain M3 ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (chainM3.error || !chainM3.data) {
        throw new Error(
          `${SUITE_TAG} insert chain M3 org failed: ${chainM3.error?.message}`,
        );
      }
      chainM3Id = chainM3.data.id as string;

      const chainM4 = await admin
        .from("organizations")
        .insert({ name: `${SUITE_TAG} Chain M4 ${stamp}`, type: "business" })
        .select("id")
        .single();
      if (chainM4.error || !chainM4.data) {
        throw new Error(
          `${SUITE_TAG} insert chain M4 org failed: ${chainM4.error?.message}`,
        );
      }
      chainM4Id = chainM4.data.id as string;

      const seedChainMerge = await admin.rpc("merge_organizations_atomic", {
        p_losing_org_id: chainM1Id,
        p_winning_org_id: chainM2Id,
        p_admin_user_id: platformAdminUserId,
      });
      if (seedChainMerge.error) {
        throw new Error(
          `${SUITE_TAG} seed chain M1->M2 merge failed: ${seedChainMerge.error.message}`,
        );
      }

      // 5. Unclaim fixture: a claimed domain on orgWinningId.
      const domainToUnclaim = await admin
        .from("organization_domains")
        .insert({
          organization_id: orgWinningId,
          domain: `phase36-02-unclaim-${stamp}.test`,
          claimed_by: membershipWinningUserId,
        })
        .select("id")
        .single();
      if (domainToUnclaim.error || !domainToUnclaim.data) {
        throw new Error(
          `${SUITE_TAG} insert domain-to-unclaim fixture failed: ${domainToUnclaim.error?.message}`,
        );
      }
      domainToUnclaimId = domainToUnclaim.data.id as string;
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      try {
        if (domainToUnclaimId) {
          const { error } = await admin
            .from("organization_domains")
            .delete()
            .eq("id", domainToUnclaimId);
          if (error) {
            console.warn(`${SUITE_TAG} organization_domains delete failed:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organization_domains cleanup threw:`, err);
      }

      // recordings has a protective BEFORE DELETE trigger
      // (protect_recording_delete / prevent_recording_hard_delete) that
      // blocks a hard delete while the recording is still linked via
      // workspace_entries -- every new recording is auto-filed into its
      // org's Home Workspace by the auto_home_workspace_entry trigger on
      // INSERT (Phase 31 P01 root-caused this exact same class of silent
      // cleanup failure: "Fixed by deleting workspace_entries first +
      // checking .error on every cleanup step"). Delete workspace_entries
      // FIRST, and check .error explicitly -- supabase-js does not throw on
      // a Postgres error, it returns { error }, so a bare try/catch with no
      // .error check silently swallows exactly this failure (confirmed live
      // during this task: 3 orphaned "Losing Org" rows were left in TEST
      // before this fix, because the recording delete failed silently here
      // and that undeleted recording then blocked the org's own CASCADE
      // delete below in the very same silent way).
      try {
        if (recordingLosingId) {
          const entriesDelete = await admin
            .from("workspace_entries")
            .delete()
            .eq("recording_id", recordingLosingId);
          if (entriesDelete.error) {
            console.warn(
              `${SUITE_TAG} workspace_entries delete failed:`,
              entriesDelete.error.message,
            );
          }
          const recordingDelete = await admin
            .from("recordings")
            .delete()
            .eq("id", recordingLosingId);
          if (recordingDelete.error) {
            console.warn(
              `${SUITE_TAG} recordings delete failed:`,
              recordingDelete.error.message,
            );
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} recordings cleanup threw:`, err);
      }

      // Clear canonical_organization_id on every org this suite may have
      // merged before deleting them -- belt-and-suspenders in case any
      // individual test assertion failed mid-way and left a pointer set
      // (the chain-prevention trigger only guards INSERT/UPDATE of the
      // column, not DELETE of the row, so this isn't strictly required for
      // the deletes below to succeed, but keeps intent explicit).
      try {
        const idsToClear = [orgLosingId, chainM1Id].filter(Boolean);
        if (idsToClear.length > 0) {
          const { error } = await admin
            .from("organizations")
            .update({ canonical_organization_id: null, merged_at: null, merged_by: null })
            .in("id", idsToClear);
          if (error) {
            console.warn(`${SUITE_TAG} clear canonical_organization_id failed:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} clear canonical_organization_id cleanup threw:`, err);
      }

      try {
        const orgIds = [orgLosingId, orgWinningId, chainM1Id, chainM2Id, chainM3Id, chainM4Id].filter(
          Boolean,
        );
        for (const id of orgIds) {
          const { error } = await admin.from("organizations").delete().eq("id", id);
          if (error) {
            console.warn(`${SUITE_TAG} organizations delete failed for ${id}:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err);
      }

      try {
        if (platformAdminUserId) {
          const { error } = await admin
            .from("user_roles")
            .delete()
            .eq("user_id", platformAdminUserId);
          if (error) {
            console.warn(`${SUITE_TAG} user_roles delete failed:`, error.message);
          }
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} user_roles cleanup threw:`, err);
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

    it("merge_organizations_atomic: non-admin p_admin_user_id is rejected (Access denied), no mutation", async () => {
      const { data, error } = await admin.rpc("merge_organizations_atomic", {
        p_losing_org_id: orgLosingId,
        p_winning_org_id: orgWinningId,
        p_admin_user_id: nonAdminUserId,
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("Access denied");

      const org = await admin
        .from("organizations")
        .select("canonical_organization_id, merged_at, merged_by")
        .eq("id", orgLosingId)
        .single();
      expect(org.error).toBeNull();
      expect(
        org.data?.canonical_organization_id,
        "a rejected (non-admin) merge attempt must not set the pointer",
      ).toBeNull();
    });

    it("merge_organizations_atomic: platform admin merge sets the pointer; recordings.organization_id and both orgs' membership rows are byte-unchanged", async () => {
      // Capture the exact pre-merge state of everything the merge RPC must
      // NOT touch.
      const recordingBefore = await admin
        .from("recordings")
        .select("organization_id")
        .eq("id", recordingLosingId)
        .single();
      expect(recordingBefore.error).toBeNull();

      const membershipsBefore = await admin
        .from("organization_memberships")
        .select("organization_id, user_id, role")
        .in("organization_id", [orgLosingId, orgWinningId])
        .order("organization_id", { ascending: true });
      expect(membershipsBefore.error).toBeNull();
      const membershipsBeforeSorted = (membershipsBefore.data as MembershipRow[]).sort(
        (a, b) => a.organization_id.localeCompare(b.organization_id),
      );

      const { data, error } = await admin.rpc("merge_organizations_atomic", {
        p_losing_org_id: orgLosingId,
        p_winning_org_id: orgWinningId,
        p_admin_user_id: platformAdminUserId,
      });
      expect(error).toBeNull();
      expect(data).toBeNull(); // RETURNS void

      const orgAfter = await admin
        .from("organizations")
        .select("canonical_organization_id, merged_at, merged_by")
        .eq("id", orgLosingId)
        .single();
      expect(orgAfter.error).toBeNull();
      expect(orgAfter.data?.canonical_organization_id).toBe(orgWinningId);
      expect(orgAfter.data?.merged_at).not.toBeNull();
      expect(orgAfter.data?.merged_by).toBe(platformAdminUserId);

      // Non-destructive: recordings.organization_id byte-unchanged.
      const recordingAfter = await admin
        .from("recordings")
        .select("organization_id")
        .eq("id", recordingLosingId)
        .single();
      expect(recordingAfter.error).toBeNull();
      expect(
        recordingAfter.data?.organization_id,
        "merge must never rewrite recordings.organization_id",
      ).toBe(recordingBefore.data?.organization_id);
      expect(recordingAfter.data?.organization_id).toBe(orgLosingId);

      // Non-destructive: both orgs' organization_memberships rows
      // byte-unchanged (same rows, same roles -- no reconciliation, no
      // new/removed rows).
      const membershipsAfter = await admin
        .from("organization_memberships")
        .select("organization_id, user_id, role")
        .in("organization_id", [orgLosingId, orgWinningId])
        .order("organization_id", { ascending: true });
      expect(membershipsAfter.error).toBeNull();
      const membershipsAfterSorted = (membershipsAfter.data as MembershipRow[]).sort(
        (a, b) => a.organization_id.localeCompare(b.organization_id),
      );
      expect(
        JSON.stringify(membershipsAfterSorted),
        "merge must never touch organization_memberships",
      ).toBe(JSON.stringify(membershipsBeforeSorted));
    });

    it("clearing canonical_organization_id/merged_at/merged_by fully restores original state", async () => {
      const clear = await admin
        .from("organizations")
        .update({ canonical_organization_id: null, merged_at: null, merged_by: null })
        .eq("id", orgLosingId);
      expect(clear.error).toBeNull();

      const orgAfterClear = await admin
        .from("organizations")
        .select("canonical_organization_id, merged_at, merged_by")
        .eq("id", orgLosingId)
        .single();
      expect(orgAfterClear.error).toBeNull();
      expect(orgAfterClear.data?.canonical_organization_id).toBeNull();
      expect(orgAfterClear.data?.merged_at).toBeNull();
      expect(orgAfterClear.data?.merged_by).toBeNull();

      // Reversal restored the pre-merge state exactly: still one recording
      // on orgLosingId, still one membership row per org.
      const recordingAfterClear = await admin
        .from("recordings")
        .select("organization_id")
        .eq("id", recordingLosingId)
        .single();
      expect(recordingAfterClear.error).toBeNull();
      expect(recordingAfterClear.data?.organization_id).toBe(orgLosingId);

      const membershipsAfterClear = await admin
        .from("organization_memberships")
        .select("id")
        .in("organization_id", [orgLosingId, orgWinningId]);
      expect(membershipsAfterClear.error).toBeNull();
      expect(membershipsAfterClear.data?.length).toBe(2);
    });

    it("chain-prevention: rejects merging INTO an already-merged organization", async () => {
      // chainM1Id is already merged into chainM2Id (seeded in beforeAll via
      // a real merge_organizations_atomic call) -- chainM1Id's own
      // canonical_organization_id is non-NULL, so it cannot be a merge
      // target.
      const { data, error } = await admin.rpc("merge_organizations_atomic", {
        p_losing_org_id: chainM3Id,
        p_winning_org_id: chainM1Id,
        p_admin_user_id: platformAdminUserId,
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("itself merged");

      const chainM3After = await admin
        .from("organizations")
        .select("canonical_organization_id")
        .eq("id", chainM3Id)
        .single();
      expect(chainM3After.error).toBeNull();
      expect(
        chainM3After.data?.canonical_organization_id,
        "a rejected chain-into-merged attempt must not set the pointer",
      ).toBeNull();
    });

    it("chain-prevention: rejects merging an organization that other organizations already point to", async () => {
      // chainM2Id already has chainM1Id pointing its
      // canonical_organization_id at it -- chainM2Id cannot itself become a
      // "loser" (it is already a "winner").
      const { data, error } = await admin.rpc("merge_organizations_atomic", {
        p_losing_org_id: chainM2Id,
        p_winning_org_id: chainM4Id,
        p_admin_user_id: platformAdminUserId,
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("already point to");

      const chainM2After = await admin
        .from("organizations")
        .select("canonical_organization_id")
        .eq("id", chainM2Id)
        .single();
      expect(chainM2After.error).toBeNull();
      expect(
        chainM2After.data?.canonical_organization_id,
        "a rejected reverse-chain attempt must not set the pointer",
      ).toBeNull();
    });

    it("unclaim_organization_domain_atomic: non-admin p_admin_user_id is rejected (Access denied), row survives", async () => {
      const { data, error } = await admin.rpc("unclaim_organization_domain_atomic", {
        p_domain_id: domainToUnclaimId,
        p_admin_user_id: nonAdminUserId,
      });
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.message ?? "").toContain("Access denied");

      const row = await admin
        .from("organization_domains")
        .select("id")
        .eq("id", domainToUnclaimId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "a rejected unclaim attempt must not delete the row").toBe(1);
    });

    it("unclaim_organization_domain_atomic: platform admin succeeds, row deleted", async () => {
      const { data, error } = await admin.rpc("unclaim_organization_domain_atomic", {
        p_domain_id: domainToUnclaimId,
        p_admin_user_id: platformAdminUserId,
      });
      expect(error).toBeNull();
      expect(data).toBeNull(); // RETURNS void

      const row = await admin
        .from("organization_domains")
        .select("id")
        .eq("id", domainToUnclaimId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "a successful unclaim must delete the row").toBe(0);
    });
  },
);
