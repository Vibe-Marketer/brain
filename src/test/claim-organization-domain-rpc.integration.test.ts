/**
 * ORG-02 integration proof (Phase 36, Plan 01, Task 3 -- TDD RED phase).
 *
 * Proves every outcome of claim_organization_domain / add_organization_alias /
 * remove_organization_alias against a REAL Supabase DB:
 *  - admin/owner with a verified email on the domain -> success, row stored
 *    LOWER(TRIM(...))
 *  - non-admin/non-owner member -> FORBIDDEN, no row written
 *  - blocklisted free-email domain (any case/whitespace) -> BLOCKLISTED
 *  - domain with no verified email on it -> NO_VERIFIED_EMAIL
 *  - domain already claimed by another org -> CONFLICT, response never names
 *    the holding org (T-36-01)
 *  - add_organization_alias: admin succeeds, exact duplicate CONFLICTs,
 *    non-admin FORBIDDEN
 *  - remove_organization_alias: non-admin FORBIDDEN, admin succeeds (row gone)
 *
 * Hits a REAL Supabase DB. Skipped cleanly when the dedicated test-project
 * env vars are not set -- see integration-setup.ts and supabase/CLAUDE.md
 * "Running integration tests safely". No fallback to production-like env vars.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

// Test-project-only contract: read ONLY the *_TEST_* env vars. NO fallback to
// prod-like vars -- see supabase/CLAUDE.md "Running integration tests safely".
const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";

const SUITE_TAG = "[phase-36-01 claim-organization-domain-rpc]";

type RpcResult = { success: boolean; code?: string };

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ORG-02 domain claim + alias RPCs`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    const stamp = Date.now();

    let orgAId = "";
    const orgAName = `${SUITE_TAG} Org A ${stamp}`;

    let orgHolderId = "";
    const orgHolderName = `${SUITE_TAG} Conflict Holder Org ${stamp}`;

    let adminUserId = "";
    let adminEmail = "";
    const adminPassword = `phase36-01-admin-${stamp}-pwd!`;

    let memberUserId = "";
    let memberEmail = "";
    const memberPassword = `phase36-01-member-${stamp}-pwd!`;

    let identityId = "";
    let successAliasId = "";
    let conflictAliasId = "";

    let orgAliasId = ""; // created by the add_organization_alias test, used by remove test

    // Domains: stored/compared values are always lower(trim(...)).
    const successDomain = `phase36-01-success-${stamp}.test`;
    const successDomainInputPaddedUppercase = `  ${successDomain.toUpperCase()}  `;
    const forbiddenDomain = `phase36-01-forbidden-${stamp}.test`;
    const noVerifiedDomain = `phase36-01-noverified-${stamp}.test`;
    const conflictDomain = `phase36-01-conflict-${stamp}.test`;
    const blocklistedInput = "GMAIL.COM "; // case + trailing-whitespace probe

    let adminClient: SupabaseClient;
    let memberClient: SupabaseClient;

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY env vars (dedicated test project only -- no prod fallback)`,
        );
      }

      adminEmail = `phase36-01-admin-${stamp}@callvault.test`;
      memberEmail = `phase36-01-member-${stamp}@callvault.test`;

      // 1. Create the two auth users.
      const createAdmin = await admin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });
      if (createAdmin.error || !createAdmin.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser admin failed: ${createAdmin.error?.message}`,
        );
      }
      adminUserId = createAdmin.data.user.id;

      const createMember = await admin.auth.admin.createUser({
        email: memberEmail,
        password: memberPassword,
        email_confirm: true,
      });
      if (createMember.error || !createMember.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser member failed: ${createMember.error?.message}`,
        );
      }
      memberUserId = createMember.data.user.id;

      // 2. Create Org A (the org under test) and the pre-existing conflict
      // holder org (a SEPARATE org that already holds `conflictDomain`).
      const orgA = await admin
        .from("organizations")
        .insert({ name: orgAName, type: "business" })
        .select("id")
        .single();
      if (orgA.error || !orgA.data) {
        throw new Error(
          `${SUITE_TAG} insert org A failed: ${orgA.error?.message}`,
        );
      }
      orgAId = orgA.data.id as string;

      const orgHolder = await admin
        .from("organizations")
        .insert({ name: orgHolderName, type: "business" })
        .select("id")
        .single();
      if (orgHolder.error || !orgHolder.data) {
        throw new Error(
          `${SUITE_TAG} insert conflict-holder org failed: ${orgHolder.error?.message}`,
        );
      }
      orgHolderId = orgHolder.data.id as string;

      // 3. Memberships: adminUser is organization_owner of Org A;
      // memberUser is a plain 'member' of Org A (non-admin).
      const membershipAdmin = await admin
        .from("organization_memberships")
        .insert({
          organization_id: orgAId,
          user_id: adminUserId,
          role: "organization_owner",
        });
      if (membershipAdmin.error) {
        throw new Error(
          `${SUITE_TAG} insert admin membership failed: ${membershipAdmin.error.message}`,
        );
      }

      // NOTE: 36-RESEARCH.md's Open Questions section claimed a 5-tier role
      // hierarchy (organization_owner > organization_admin > manager >
      // member > guest), but that constraint was superseded by
      // 20260330200000_align_workspace_roles_5_to_4.sql, which replaced it
      // with exactly 3 values: organization_owner, organization_admin,
      // organization_member. Confirmed live via a real check-constraint
      // violation during this task's RED phase, not from docs.
      const membershipMember = await admin
        .from("organization_memberships")
        .insert({
          organization_id: orgAId,
          user_id: memberUserId,
          role: "organization_member",
        });
      if (membershipMember.error) {
        throw new Error(
          `${SUITE_TAG} insert member membership failed: ${membershipMember.error.message}`,
        );
      }

      // 4. adminUser's identity + verified email aliases (Phase 34 spine).
      // One verified alias on successDomain (used by the success + normalize
      // test), one verified alias on conflictDomain (used by the CONFLICT
      // test) -- deliberately NONE on noVerifiedDomain or forbiddenDomain.
      const identity = await admin
        .from("identities")
        .insert({ owner_user_id: adminUserId, display_name: `${SUITE_TAG} Admin` })
        .select("id")
        .single();
      if (identity.error || !identity.data) {
        throw new Error(
          `${SUITE_TAG} insert identities failed: ${identity.error?.message}`,
        );
      }
      identityId = identity.data.id as string;

      const successAlias = await admin
        .from("identity_aliases")
        .insert({
          identity_id: identityId,
          alias_type: "email",
          value: `admin@${successDomain}`,
          verified: true,
          confidence: 1.0,
          evidence: "verified email",
        })
        .select("id")
        .single();
      if (successAlias.error || !successAlias.data) {
        throw new Error(
          `${SUITE_TAG} insert success identity_aliases row failed: ${successAlias.error?.message}`,
        );
      }
      successAliasId = successAlias.data.id as string;

      const conflictAlias = await admin
        .from("identity_aliases")
        .insert({
          identity_id: identityId,
          alias_type: "email",
          value: `admin@${conflictDomain}`,
          verified: true,
          confidence: 1.0,
          evidence: "verified email",
        })
        .select("id")
        .single();
      if (conflictAlias.error || !conflictAlias.data) {
        throw new Error(
          `${SUITE_TAG} insert conflict identity_aliases row failed: ${conflictAlias.error?.message}`,
        );
      }
      conflictAliasId = conflictAlias.data.id as string;

      // 5. Pre-seed: the conflict-holder org already holds conflictDomain
      // (donor pattern -- seeded directly via service-role, not through the
      // RPC under test).
      const holderDomain = await admin.from("organization_domains").insert({
        organization_id: orgHolderId,
        domain: conflictDomain,
        claimed_by: null,
      });
      if (holderDomain.error) {
        throw new Error(
          `${SUITE_TAG} seed conflict-holder organization_domains row failed: ${holderDomain.error.message}`,
        );
      }

      // 6. Sign in both users as anon-JWT clients (RPCs are called under
      // real auth.uid(), never service-role).
      adminClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      memberClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const signInAdmin = await adminClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (signInAdmin.error) {
        throw new Error(
          `${SUITE_TAG} signIn admin failed: ${signInAdmin.error.message}`,
        );
      }

      const signInMember = await memberClient.auth.signInWithPassword({
        email: memberEmail,
        password: memberPassword,
      });
      if (signInMember.error) {
        throw new Error(
          `${SUITE_TAG} signIn member failed: ${signInMember.error.message}`,
        );
      }
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      try {
        if (orgAliasId) {
          await admin.from("organization_aliases").delete().eq("id", orgAliasId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organization_aliases cleanup threw:`, err);
      }

      try {
        await admin.from("organization_domains").delete().eq("organization_id", orgAId);
        await admin.from("organization_domains").delete().eq("organization_id", orgHolderId);
      } catch (err) {
        console.warn(`${SUITE_TAG} organization_domains cleanup threw:`, err);
      }

      try {
        if (successAliasId) {
          await admin.from("identity_aliases").delete().eq("id", successAliasId);
        }
        if (conflictAliasId) {
          await admin.from("identity_aliases").delete().eq("id", conflictAliasId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} identity_aliases cleanup threw:`, err);
      }

      try {
        if (identityId) {
          await admin.from("identities").delete().eq("id", identityId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} identities cleanup threw:`, err);
      }

      try {
        if (orgAId) {
          await admin.from("organizations").delete().eq("id", orgAId);
        }
        if (orgHolderId) {
          await admin.from("organizations").delete().eq("id", orgHolderId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} organizations cleanup threw:`, err);
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

    it("admin/owner with a verified email on the domain can claim it; stored LOWER(TRIM(...))", async () => {
      const { data, error } = await adminClient.rpc("claim_organization_domain", {
        p_organization_id: orgAId,
        p_domain: successDomainInputPaddedUppercase,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(true);

      const row = await admin
        .from("organization_domains")
        .select("domain, organization_id, claimed_by")
        .eq("organization_id", orgAId)
        .eq("domain", successDomain);
      expect(row.error).toBeNull();
      expect(
        row.data?.length,
        "expected exactly one organization_domains row stored lower(trim(...))",
      ).toBe(1);
      expect(row.data?.[0]?.claimed_by).toBe(adminUserId);
    });

    it("non-admin/non-owner member cannot claim a domain (FORBIDDEN), no row written", async () => {
      const { data, error } = await memberClient.rpc("claim_organization_domain", {
        p_organization_id: orgAId,
        p_domain: forbiddenDomain,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("FORBIDDEN");

      const row = await admin
        .from("organization_domains")
        .select("id")
        .eq("domain", forbiddenDomain);
      expect(row.error).toBeNull();
      expect(row.data?.length, "FORBIDDEN claim must not write a row").toBe(0);
    });

    it("blocklisted free-email domain rejected regardless of case/whitespace (BLOCKLISTED)", async () => {
      const { data, error } = await adminClient.rpc("claim_organization_domain", {
        p_organization_id: orgAId,
        p_domain: blocklistedInput,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("BLOCKLISTED");

      const row = await admin
        .from("organization_domains")
        .select("id")
        .eq("domain", "gmail.com");
      expect(row.error).toBeNull();
      expect(row.data?.length, "BLOCKLISTED claim must not write a row").toBe(0);
    });

    it("domain with no verified email on it is rejected (NO_VERIFIED_EMAIL)", async () => {
      const { data, error } = await adminClient.rpc("claim_organization_domain", {
        p_organization_id: orgAId,
        p_domain: noVerifiedDomain,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("NO_VERIFIED_EMAIL");
    });

    it("domain already claimed by another org is rejected (CONFLICT); response never names the holding org", async () => {
      const { data, error } = await adminClient.rpc("claim_organization_domain", {
        p_organization_id: orgAId,
        p_domain: conflictDomain,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("CONFLICT");

      const serialized = JSON.stringify(data);
      expect(
        serialized,
        "T-36-01: CONFLICT response must never contain the holding org's id",
      ).not.toContain(orgHolderId);
      expect(
        serialized,
        "T-36-01: CONFLICT response must never contain the holding org's name",
      ).not.toContain(orgHolderName);

      // Confirm Org A never actually acquired the domain.
      const row = await admin
        .from("organization_domains")
        .select("organization_id")
        .eq("domain", conflictDomain);
      expect(row.error).toBeNull();
      expect(row.data?.length).toBe(1);
      expect(row.data?.[0]?.organization_id).toBe(orgHolderId);
    });

    it("add_organization_alias: admin/owner succeeds", async () => {
      const { data, error } = await adminClient.rpc("add_organization_alias", {
        p_organization_id: orgAId,
        p_alias: `${SUITE_TAG} Acme Alt Name ${stamp}`,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(true);

      const row = await admin
        .from("organization_aliases")
        .select("id, alias, created_by")
        .eq("organization_id", orgAId);
      expect(row.error).toBeNull();
      expect(row.data?.length).toBe(1);
      expect(row.data?.[0]?.created_by).toBe(adminUserId);
      orgAliasId = row.data?.[0]?.id as string;
    });

    it("add_organization_alias: exact duplicate within the org is rejected (CONFLICT)", async () => {
      const { data, error } = await adminClient.rpc("add_organization_alias", {
        p_organization_id: orgAId,
        p_alias: `${SUITE_TAG} Acme Alt Name ${stamp}`,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("CONFLICT");

      const row = await admin
        .from("organization_aliases")
        .select("id")
        .eq("organization_id", orgAId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "duplicate alias must not add a second row").toBe(1);
    });

    it("add_organization_alias: non-admin/non-owner member is rejected (FORBIDDEN)", async () => {
      const { data, error } = await memberClient.rpc("add_organization_alias", {
        p_organization_id: orgAId,
        p_alias: `${SUITE_TAG} Member Attempt ${stamp}`,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("FORBIDDEN");

      const row = await admin
        .from("organization_aliases")
        .select("id")
        .eq("organization_id", orgAId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "FORBIDDEN alias add must not write a row").toBe(1); // only the admin's earlier row
    });

    it("remove_organization_alias: non-admin/non-owner member is rejected (FORBIDDEN), row survives", async () => {
      expect(orgAliasId, "orgAliasId must be set by the earlier add test").toBeTruthy();

      const { data, error } = await memberClient.rpc("remove_organization_alias", {
        p_alias_id: orgAliasId,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(false);
      expect(result?.code).toBe("FORBIDDEN");

      const row = await admin
        .from("organization_aliases")
        .select("id")
        .eq("id", orgAliasId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "FORBIDDEN remove must not delete the row").toBe(1);
    });

    it("remove_organization_alias: admin/owner succeeds, row gone", async () => {
      expect(orgAliasId, "orgAliasId must be set by the earlier add test").toBeTruthy();

      const { data, error } = await adminClient.rpc("remove_organization_alias", {
        p_alias_id: orgAliasId,
      });
      expect(error).toBeNull();
      const result = data as RpcResult;
      expect(result?.success).toBe(true);

      const row = await admin
        .from("organization_aliases")
        .select("id")
        .eq("id", orgAliasId);
      expect(row.error).toBeNull();
      expect(row.data?.length, "successful remove must delete the row").toBe(0);
    });
  },
);
