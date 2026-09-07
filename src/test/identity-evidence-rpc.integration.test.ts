/**
 * IDENT-08 redacted-evidence regression test (Phase 34, Plan 02), updated for
 * the CR-01/WR-02 gap-closure fix (Phase 34 code review, 34-REVIEW.md).
 *
 * Proves get_identity_evidence(p_identity_id) returns ONLY
 * (alias_type, confidence, evidence) -- never the raw `value` column (email
 * PII) -- for an authorized (owner) caller, and now that it DENIES entirely
 * (zero rows) for a caller with no ownership/participation/speaker link to
 * the identity (CR-01 fix: gated by user_can_view_identity(p_identity_id,
 * auth.uid()), replacing the prior "any authenticated user" behavior). Also
 * proves a non-owner is denied a DIRECT select on identity_aliases
 * (owner-only SELECT policy) -- the RPC's own authz check, not that policy,
 * is what now gates access.
 *
 * Also proves the WR-02 fix: user_can_view_identity() now has a working
 * speakers.identity_id branch -- a user linked to an identity ONLY via a
 * speakers row they own (no owner_user_id/call_participants/contacts link)
 * can view that identity.
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

const SUITE_TAG = "[phase-34-02 identity-evidence-rpc]";

const EVIDENCE_ROW_KEYS = ["alias_type", "confidence", "evidence"].sort();

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} IDENT-08 get_identity_evidence never leaks the raw value`,
  () => {
    const admin = makeIntegrationClient(); // service-role

    let ownerUserId = "";
    let ownerEmail = "";
    const ownerPassword = `phase34-evidence-owner-${Date.now()}-pwd!`;
    let nonOwnerUserId = "";
    let nonOwnerEmail = "";
    const nonOwnerPassword = `phase34-evidence-nonowner-${Date.now()}-pwd!`;

    let identityId = "";
    let verifiedAliasId = "";
    let candidateAliasId = "";
    let speakerId = "";
    let secretEmail = "";

    let ownerClient: SupabaseClient;
    let nonOwnerClient: SupabaseClient;

    beforeAll(async () => {
      if (!TEST_URL || !TEST_ANON_KEY) {
        throw new Error(
          `${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY env vars (dedicated test project only -- no prod fallback)`,
        );
      }

      const stamp = Date.now();
      ownerEmail = `phase34-evidence-owner-${stamp}@callvault.test`;
      nonOwnerEmail = `phase34-evidence-nonowner-${stamp}@callvault.test`;
      secretEmail = `identity-secret-${stamp}@example.com`;

      const createOwner = await admin.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
      });
      if (createOwner.error || !createOwner.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser owner failed: ${createOwner.error?.message}`,
        );
      }
      ownerUserId = createOwner.data.user.id;

      const createNonOwner = await admin.auth.admin.createUser({
        email: nonOwnerEmail,
        password: nonOwnerPassword,
        email_confirm: true,
      });
      if (createNonOwner.error || !createNonOwner.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser non-owner failed: ${createNonOwner.error?.message}`,
        );
      }
      nonOwnerUserId = createNonOwner.data.user.id;

      const identity = await admin
        .from("identities")
        .insert({ owner_user_id: ownerUserId, display_name: `${SUITE_TAG} Person` })
        .select("id")
        .single();
      if (identity.error || !identity.data) {
        throw new Error(
          `${SUITE_TAG} insert identities failed: ${identity.error?.message}`,
        );
      }
      identityId = identity.data.id as string;

      const verifiedAlias = await admin
        .from("identity_aliases")
        .insert({
          identity_id: identityId,
          alias_type: "email",
          value: secretEmail,
          verified: true,
          confidence: 1.0,
          evidence: "verified email",
        })
        .select("id")
        .single();
      if (verifiedAlias.error || !verifiedAlias.data) {
        throw new Error(
          `${SUITE_TAG} insert verified identity_aliases row failed: ${verifiedAlias.error?.message}`,
        );
      }
      verifiedAliasId = verifiedAlias.data.id as string;

      // Unverified candidate signal (display-name variant) -- must NEVER
      // auto-link (IDENT-02) and must NOT appear in get_identity_evidence's
      // output (the RPC filters WHERE verified = true).
      const candidateAlias = await admin
        .from("identity_aliases")
        .insert({
          identity_id: identityId,
          alias_type: "display_name",
          value: "Some Display Name Variant",
          verified: false,
          confidence: 0.4,
          evidence: "display-name variant candidate, unverified",
        })
        .select("id")
        .single();
      if (candidateAlias.error || !candidateAlias.data) {
        throw new Error(
          `${SUITE_TAG} insert candidate identity_aliases row failed: ${candidateAlias.error?.message}`,
        );
      }
      candidateAliasId = candidateAlias.data.id as string;

      ownerClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      nonOwnerClient = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const signInOwner = await ownerClient.auth.signInWithPassword({
        email: ownerEmail,
        password: ownerPassword,
      });
      if (signInOwner.error) {
        throw new Error(
          `${SUITE_TAG} signIn owner failed: ${signInOwner.error.message}`,
        );
      }

      const signInNonOwner = await nonOwnerClient.auth.signInWithPassword({
        email: nonOwnerEmail,
        password: nonOwnerPassword,
      });
      if (signInNonOwner.error) {
        throw new Error(
          `${SUITE_TAG} signIn non-owner failed: ${signInNonOwner.error.message}`,
        );
      }
    }, 60_000);

    afterAll(async () => {
      if (!integrationDbReachable) return;

      try {
        if (speakerId) {
          await admin.from("speakers").delete().eq("id", speakerId);
        }
        if (verifiedAliasId) {
          await admin.from("identity_aliases").delete().eq("id", verifiedAliasId);
        }
        if (candidateAliasId) {
          await admin.from("identity_aliases").delete().eq("id", candidateAliasId);
        }
        if (identityId) {
          await admin.from("identities").delete().eq("id", identityId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} fixture cleanup threw:`, err);
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

    it("owner: get_identity_evidence returns keys exactly {alias_type, confidence, evidence}, no value/email key, only the verified row", async () => {
      const { data, error } = await ownerClient.rpc("get_identity_evidence", {
        p_identity_id: identityId,
      });
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      expect(rows.length).toBe(1); // only the verified row -- candidate excluded

      const row = rows[0];
      const keys = Object.keys(row).sort();
      expect(keys, "get_identity_evidence row key set").toEqual(
        EVIDENCE_ROW_KEYS,
      );
      expect(keys).not.toContain("value");
      expect(keys).not.toContain("email");
      expect(row.alias_type).toBe("email");
      expect(row.evidence).toBe("verified email");

      const serialized = JSON.stringify(rows);
      expect(
        serialized,
        "get_identity_evidence payload must never contain the raw seeded email",
      ).not.toContain(secretEmail);
    });

    it("non-owner: get_identity_evidence denies entirely -- zero rows, not a redacted row (CR-01 fix)", async () => {
      // First prove the boundary this RPC exists to route around: a direct
      // select on identity_aliases by a non-owner returns ZERO rows (owner-only
      // SELECT policy) -- if this returned >0, the RPC's own authz check
      // wouldn't be the only operative security control.
      const direct = await nonOwnerClient
        .from("identity_aliases")
        .select("*")
        .eq("identity_id", identityId);
      expect(direct.error).toBeNull();
      expect(
        direct.data?.length ?? 0,
        `RLS LEAK: non-owner directly read ${direct.data?.length ?? 0} identity_aliases row(s) -- expected owner-only SELECT to deny this`,
      ).toBe(0);

      // CR-01 fix: get_identity_evidence is now gated by
      // user_can_view_identity(p_identity_id, auth.uid()) -- a caller with no
      // ownership/participation/speaker link to this identity gets zero rows,
      // not a redacted-but-present row.
      const { data, error } = await nonOwnerClient.rpc(
        "get_identity_evidence",
        { p_identity_id: identityId },
      );
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      expect(
        rows.length,
        "CR-01 IDOR: non-owner get_identity_evidence should return zero rows for an identity they have no relationship to",
      ).toBe(0);
    });

    it("speakers-only link: a user with only a speakers.identity_id row (no owner/participant/contact link) CAN view the identity via user_can_view_identity (WR-02 fix)", async () => {
      const { data: canView, error: canViewError } = await admin.rpc(
        "user_can_view_identity",
        { p_identity_id: identityId, p_user_id: nonOwnerUserId },
      );
      expect(canViewError).toBeNull();
      expect(
        canView,
        "WR-02: before linking, the non-owner has no relationship to the identity",
      ).toBe(false);

      const speaker = await admin
        .from("speakers")
        .insert({
          user_id: nonOwnerUserId,
          name: `${SUITE_TAG} speaker`,
          identity_id: identityId,
        })
        .select("id")
        .single();
      if (speaker.error || !speaker.data) {
        throw new Error(
          `${SUITE_TAG} insert speakers fixture failed: ${speaker.error?.message}`,
        );
      }
      speakerId = speaker.data.id as string;

      const { data: canViewAfter, error: canViewAfterError } =
        await admin.rpc("user_can_view_identity", {
          p_identity_id: identityId,
          p_user_id: nonOwnerUserId,
        });
      expect(canViewAfterError).toBeNull();
      expect(
        canViewAfter,
        "WR-02 fix: a user linked only via speakers.identity_id should now be able to view the identity",
      ).toBe(true);
    });

    it("the unverified display_name candidate alias is excluded from get_identity_evidence's output", async () => {
      const { data, error } = await ownerClient.rpc("get_identity_evidence", {
        p_identity_id: identityId,
      });
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      expect(rows.some((r) => r.alias_type === "display_name")).toBe(false);
    });
  },
);
