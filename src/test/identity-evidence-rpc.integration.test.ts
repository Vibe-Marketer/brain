/**
 * IDENT-08 redacted-evidence regression test (Phase 34, Plan 02).
 *
 * Proves get_identity_evidence(p_identity_id) returns ONLY
 * (alias_type, confidence, evidence) -- never the raw `value` column (email
 * PII) -- and that this holds for a non-owner caller too, since the RPC is
 * SECURITY DEFINER + GRANT EXECUTE TO authenticated (deliberately broad: the
 * redacted payload is safe for any viewer who can already see the speaker
 * label). Also proves the redaction is the actual security boundary, not an
 * accidental side effect of identity_aliases' own RLS: a non-owner is denied
 * a DIRECT select on identity_aliases (owner-only SELECT policy) but still
 * receives the redacted evidence via the RPC.
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

    it("non-owner: get_identity_evidence still returns the redacted row, never the raw email (redaction is the boundary, not RLS)", async () => {
      // First prove the boundary this RPC exists to route around: a direct
      // select on identity_aliases by a non-owner returns ZERO rows (owner-only
      // SELECT policy) -- if this returned >0, the RPC's redaction wouldn't be
      // the operative security control.
      const direct = await nonOwnerClient
        .from("identity_aliases")
        .select("*")
        .eq("identity_id", identityId);
      expect(direct.error).toBeNull();
      expect(
        direct.data?.length ?? 0,
        `RLS LEAK: non-owner directly read ${direct.data?.length ?? 0} identity_aliases row(s) -- expected owner-only SELECT to deny this`,
      ).toBe(0);

      // Yet the redacted RPC still succeeds for the same non-owner caller.
      const { data, error } = await nonOwnerClient.rpc(
        "get_identity_evidence",
        { p_identity_id: identityId },
      );
      expect(error).toBeNull();
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      expect(rows.length).toBe(1);

      const row = rows[0];
      const keys = Object.keys(row).sort();
      expect(keys).toEqual(EVIDENCE_ROW_KEYS);
      expect(keys).not.toContain("value");
      expect(keys).not.toContain("email");
      expect(row.evidence).toBe("verified email");

      const serialized = JSON.stringify(rows);
      expect(
        serialized,
        "non-owner get_identity_evidence payload must never contain the raw seeded email",
      ).not.toContain(secretEmail);
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
