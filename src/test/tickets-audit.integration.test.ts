/**
 * Tickets audit-trail integration test (Phase 11, TKT-01/TKT-04).
 *
 * Verifies at the REAL database engine (test project only — see
 * supabase/CLAUDE.md "Running integration tests safely"):
 *
 *   1. ISC-7 — INSERT with an invalid `status` value is rejected by the
 *      Postgres enum (`ticket_status`), even under the service-role client.
 *   2. ISC-8 — UPDATE of tickets.status (new → triaged) writes exactly one
 *      ticket_events row via the AFTER UPDATE OF status SECURITY DEFINER
 *      trigger, with event_type 'status_change', old_value 'new',
 *      new_value 'triaged'.
 *   3. ISC-8 (service-role path) — the audit row is written even when the
 *      update runs under service-role (RLS bypassed; trigger still fires),
 *      and actor_id is NULL because auth.uid() is NULL for service-role.
 *   4. 11-05 hardening — the ticket_messages INSERT policy gates author_type
 *      by role (migration 20260611140000): a non-admin reporter inserting
 *      author_type 'admin' or 'agent' on their OWN ticket is rejected by
 *      RLS (42501); author_type 'user' succeeds. 'agent' is reserved for
 *      service-role writes.
 *
 * Gated: excluded from `npm test` (vitest.config.ts integration exclude);
 * runs via `npm run test:integration` against a dedicated test project.
 * Skips cleanly when the test-project env vars are absent.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-11-02 tickets-audit]";

// Anon key for the RLS spoof tests (sign in as the temp reporter). Optional —
// the author_type tests skip cleanly when it is absent (mirrors
// rls-regression.test.ts).
const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";
const anonAuthAvailable = integrationDbReachable && Boolean(TEST_ANON_KEY);

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ticket enum enforcement + status audit trail`,
  () => {
    const admin = makeIntegrationClient(); // service-role (test project)

    let userId = "";
    let ticketId = "";
    let userEmail = "";
    let userPassword = "";
    let reporterClient: SupabaseClient | null = null;

    beforeAll(async () => {
      const stamp = Date.now();
      const email = `phase11-tickets-${stamp}@callvault.test`;
      const password = `phase11-tickets-${stamp}-pwd!`;
      userEmail = email;
      userPassword = password;

      // Temp reporter user (donor pattern: tickets FK auth.users).
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (created.error || !created.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser failed: ${created.error?.message}`,
        );
      }
      userId = created.data.user.id;

      // One ticket fixture owned by the temp user, status defaults to 'new'.
      const ticket = await admin
        .from("tickets")
        .insert({
          reporter_id: userId,
          type: "bug",
          severity: "medium",
          context: { suite: SUITE_TAG },
        })
        .select("id, status")
        .single();
      if (ticket.error || !ticket.data) {
        throw new Error(
          `${SUITE_TAG} insert ticket fixture failed: ${ticket.error?.message}`,
        );
      }
      ticketId = ticket.data.id as string;
      if (ticket.data.status !== "new") {
        throw new Error(
          `${SUITE_TAG} expected default status 'new', got '${ticket.data.status}'`,
        );
      }
    }, 60_000);

    /** Lazily sign the temp reporter in via the anon key (non-admin JWT). */
    async function getReporterClient(): Promise<SupabaseClient> {
      if (reporterClient) return reporterClient;
      const client = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const signIn = await client.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });
      if (signIn.error) {
        throw new Error(`${SUITE_TAG} reporter sign-in failed: ${signIn.error.message}`);
      }
      reporterClient = client;
      return client;
    }

    afterAll(async () => {
      // Sign the reporter session out before fixture cleanup.
      try {
        await reporterClient?.auth.signOut();
      } catch (err) {
        console.warn(`${SUITE_TAG} reporter sign-out threw:`, err);
      }

      // Cleanup contract: temp rows only; each step absorbs failures.
      // Deleting the ticket cascades to ticket_messages + ticket_events.
      try {
        if (ticketId) {
          await admin.from("tickets").delete().eq("id", ticketId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} ticket cleanup threw:`, err);
      }

      // RPC sweep removes the temp @callvault.test auth user + cascades.
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

    it("ISC-7: rejects INSERT with an invalid status value at the database", async () => {
      const { error } = await admin.from("tickets").insert({
        reporter_id: userId,
        type: "bug",
        severity: "medium",
        status: "not_a_status",
        context: { suite: SUITE_TAG },
      });

      expect(
        error,
        `${SUITE_TAG} expected enum violation, but the INSERT succeeded`,
      ).not.toBeNull();
      // Postgres enum violation: 22P02 invalid_text_representation.
      expect(`${error?.code} ${error?.message}`).toMatch(
        /22P02|invalid input value for enum/i,
      );
    });

    it("ISC-8: status UPDATE new→triaged writes one status_change ticket_events row", async () => {
      const update = await admin
        .from("tickets")
        .update({ status: "triaged" })
        .eq("id", ticketId);
      expect(
        update.error,
        `${SUITE_TAG} status update failed: ${update.error?.message}`,
      ).toBeNull();

      const events = await admin
        .from("ticket_events")
        .select("event_type, old_value, new_value, actor_id")
        .eq("ticket_id", ticketId)
        .eq("event_type", "status_change");
      expect(
        events.error,
        `${SUITE_TAG} ticket_events select failed: ${events.error?.message}`,
      ).toBeNull();

      expect(
        events.data?.length ?? 0,
        `${SUITE_TAG} expected exactly 1 status_change event, got ${events.data?.length ?? 0}`,
      ).toBe(1);
      expect(events.data?.[0]?.event_type).toBe("status_change");
      expect(events.data?.[0]?.old_value).toBe("new");
      expect(events.data?.[0]?.new_value).toBe("triaged");
    });

    it("ISC-8 (service-role): audit row written with NULL actor_id under service-role", async () => {
      // The trigger is SECURITY DEFINER, so it fires regardless of RLS;
      // auth.uid() is NULL under the service-role client.
      const events = await admin
        .from("ticket_events")
        .select("actor_id")
        .eq("ticket_id", ticketId)
        .eq("event_type", "status_change");
      expect(events.error).toBeNull();
      expect(events.data?.length ?? 0).toBe(1);
      expect(
        events.data?.[0]?.actor_id,
        `${SUITE_TAG} service-role transitions must record actor_id NULL`,
      ).toBeNull();
    });

    // ------------------------------------------------------------------
    // 11-05 hardening: author_type spoofing (migration 20260611140000).
    // A non-admin reporter must NOT be able to insert ticket_messages rows
    // claiming author_type 'admin' or 'agent' — even on their own ticket.
    // These run from the reporter's anon-key JWT, so they require
    // VITE_SUPABASE_TEST_ANON_KEY and skip cleanly without it.
    // ------------------------------------------------------------------
    it.skipIf(!anonAuthAvailable)(
      "11-05: non-admin INSERT with author_type 'admin' is rejected by RLS",
      async () => {
        const reporter = await getReporterClient();
        const { error } = await reporter.from("ticket_messages").insert({
          ticket_id: ticketId,
          author_type: "admin",
          author_id: userId,
          body: `${SUITE_TAG} spoofed admin message — must be rejected`,
        });

        expect(
          error,
          `${SUITE_TAG} expected RLS rejection of author_type='admin' spoof, but the INSERT succeeded`,
        ).not.toBeNull();
        // 42501: new row violates row-level security policy.
        expect(`${error?.code} ${error?.message}`).toMatch(
          /42501|row-level security/i,
        );
      },
    );

    it.skipIf(!anonAuthAvailable)(
      "11-05: non-admin INSERT with author_type 'agent' is rejected by RLS (service-role reserved)",
      async () => {
        const reporter = await getReporterClient();
        const { error } = await reporter.from("ticket_messages").insert({
          ticket_id: ticketId,
          author_type: "agent",
          author_id: userId,
          body: `${SUITE_TAG} spoofed agent message — must be rejected`,
        });

        expect(
          error,
          `${SUITE_TAG} expected RLS rejection of author_type='agent' spoof, but the INSERT succeeded`,
        ).not.toBeNull();
        expect(`${error?.code} ${error?.message}`).toMatch(
          /42501|row-level security/i,
        );
      },
    );

    it.skipIf(!anonAuthAvailable)(
      "11-05: non-admin INSERT with author_type 'user' on own ticket still succeeds",
      async () => {
        const reporter = await getReporterClient();
        const { data, error } = await reporter
          .from("ticket_messages")
          .insert({
            ticket_id: ticketId,
            author_type: "user",
            author_id: userId,
            body: `${SUITE_TAG} legitimate user message`,
          })
          .select("id")
          .single();

        expect(
          error,
          `${SUITE_TAG} legitimate author_type='user' insert failed: ${error?.message}`,
        ).toBeNull();
        expect(data?.id).toBeTruthy();
        // Cleanup is covered by afterAll: deleting the ticket cascades to
        // ticket_messages.
      },
    );
  },
);
