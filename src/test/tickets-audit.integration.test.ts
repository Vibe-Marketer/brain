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
 *
 * Gated: excluded from `npm test` (vitest.config.ts integration exclude);
 * runs via `npm run test:integration` against a dedicated test project.
 * Skips cleanly when the test-project env vars are absent.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-11-02 tickets-audit]";

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ticket enum enforcement + status audit trail`,
  () => {
    const admin = makeIntegrationClient(); // service-role (test project)

    let userId = "";
    let ticketId = "";

    beforeAll(async () => {
      const stamp = Date.now();
      const email = `phase11-tickets-${stamp}@callvault.test`;

      // Temp reporter user (donor pattern: tickets FK auth.users).
      const created = await admin.auth.admin.createUser({
        email,
        password: `phase11-tickets-${stamp}-pwd!`,
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

    afterAll(async () => {
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
  },
);
