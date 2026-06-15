/**
 * Reporter comms integration test (Phase 23, RSP-01/RSP-03).
 *
 * Real database only. Proves the DB chain that turns ticket lifecycle events
 * into customer-safe user_notifications for in-app reporters:
 *   UPDATE tickets.status -> ticket_status_audit -> ticket_events
 *   -> ticket_event_reporter_lifecycle_notify -> user_notifications.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-23-02 reporter-comms]";

const templates = {
  received: {
    title: "We received your report",
    body: "We received your report and are tracking it.",
  },
  in_progress: {
    title: "We are working on your report",
    body: "We are working on your report now.",
  },
  escalated: {
    title: "We are taking a closer look",
    body: "We are taking a closer look and will keep tracking this for you.",
  },
} as const;

type NotificationKind = keyof typeof templates;
type TicketSource = "manual" | "sentry" | "nightly_qa" | "internal" | "unknown" | "in_app_user";

const blockedCopyPattern =
  /\b(AI-powered|agent|Autopilot|Codex|Claude|LLM|model|prompt|token|runner|worktree|branch|diff|push-gate|Sentry|stack|trace|deploy SHA)\b|\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+|[a-f0-9]{40}\b/i;

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} lifecycle notification source gate`,
  () => {
    const admin = makeIntegrationClient();
    let userId = "";
    const ticketIds = new Set<string>();

    beforeAll(async () => {
      const stamp = Date.now();
      const created = await admin.auth.admin.createUser({
        email: `phase23-reporter-${stamp}@callvault.test`,
        password: `phase23-reporter-${stamp}-pwd!`,
        email_confirm: true,
      });

      if (created.error || !created.data.user) {
        throw new Error(
          `${SUITE_TAG} createUser failed: ${created.error?.message}`,
        );
      }
      userId = created.data.user.id;
    }, 60_000);

    afterEach(async () => {
      try {
        if (userId) {
          await admin.from("user_notifications").delete().eq("user_id", userId);
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} notification cleanup threw:`, err);
      }

      try {
        if (ticketIds.size > 0) {
          await admin.from("tickets").delete().in("id", Array.from(ticketIds));
          ticketIds.clear();
        }
      } catch (err) {
        console.warn(`${SUITE_TAG} ticket cleanup threw:`, err);
      }
    }, 60_000);

    afterAll(async () => {
      try {
        await admin.rpc("cleanup_test_fixture_users", {
          p_max_age_minutes: 0,
        });
      } catch (err) {
        console.warn(`${SUITE_TAG} cleanup_test_fixture_users threw:`, err);
      }
    }, 60_000);

    async function createTicket(options: {
      source?: TicketSource;
      reporterId?: string | null;
      status?: "new" | "triaged" | "in_progress" | "escalated";
    } = {}): Promise<string> {
      const insertRow: Record<string, unknown> = {
        reporter_id: options.reporterId === undefined ? userId : options.reporterId,
        type: "bug",
        severity: "medium",
        status: options.status ?? "new",
        context: { suite: SUITE_TAG, stamp: Date.now() },
      };
      if (options.source !== undefined) {
        insertRow.source = options.source;
      }

      const ticket = await admin
        .from("tickets")
        .insert(insertRow)
        .select("id")
        .single();

      if (ticket.error || !ticket.data?.id) {
        throw new Error(`${SUITE_TAG} insert ticket failed: ${ticket.error?.message}`);
      }

      const ticketId = ticket.data.id as string;
      ticketIds.add(ticketId);
      return ticketId;
    }

    async function insertCreatedEvent(ticketId: string) {
      const event = await admin.from("ticket_events").insert({
        ticket_id: ticketId,
        actor_id: null,
        event_type: "created",
        new_value: "new",
      });

      expect(
        event.error,
        `${SUITE_TAG} created event insert failed: ${event.error?.message}`,
      ).toBeNull();
    }

    async function updateStatus(
      ticketId: string,
      status: "in_progress" | "escalated" | "resolved",
    ) {
      const update = await admin
        .from("tickets")
        .update({ status })
        .eq("id", ticketId);

      expect(
        update.error,
        `${SUITE_TAG} status update to ${status} failed: ${update.error?.message}`,
      ).toBeNull();
    }

    async function selectNotifications(ticketId: string) {
      const rows = await admin
        .from("user_notifications")
        .select("type, title, body, metadata")
        .eq("user_id", userId);

      expect(
        rows.error,
        `${SUITE_TAG} notification select failed: ${rows.error?.message}`,
      ).toBeNull();

      return (rows.data ?? []).filter((row) => {
        const metadata = row.metadata as Record<string, unknown> | null;
        return metadata?.ticket_id === ticketId;
      });
    }

    async function expectExactlyOneNotification(
      ticketId: string,
      kind: NotificationKind,
    ) {
      const rows = await selectNotifications(ticketId);
      expect(
        rows.length,
        `${SUITE_TAG} expected exactly one ${kind} notification`,
      ).toBe(1);

      const row = rows[0];
      const metadata = row.metadata as Record<string, unknown> | null;
      expect(row.type).toBe("info");
      expect(row.title).toBe(templates[kind].title);
      expect(row.body).toBe(templates[kind].body);
      expect(metadata).toMatchObject({
        ticket_id: ticketId,
        kind,
        source: "in_app_user",
      });
      expect(row.title).not.toMatch(blockedCopyPattern);
      expect(row.body ?? "").not.toMatch(blockedCopyPattern);
    }

    async function expectNoNotifications(ticketId: string) {
      const rows = await selectNotifications(ticketId);
      expect(
        rows.length,
        `${SUITE_TAG} expected no customer notification for ticket ${ticketId}`,
      ).toBe(0);
    }

    it("emits exactly one locked received notification for an in-app created event", async () => {
      const ticketId = await createTicket({ source: "in_app_user" });

      await insertCreatedEvent(ticketId);

      await expectExactlyOneNotification(ticketId, "received");
    });

    it("emits exactly one locked in-progress notification through the status audit trigger chain", async () => {
      const ticketId = await createTicket({ source: "in_app_user" });

      await updateStatus(ticketId, "in_progress");

      await expectExactlyOneNotification(ticketId, "in_progress");
    });

    it("emits exactly one locked escalation reassurance through the status audit trigger chain", async () => {
      const ticketId = await createTicket({ source: "in_app_user" });

      await updateStatus(ticketId, "escalated");

      await expectExactlyOneNotification(ticketId, "escalated");
    });

    it("does not emit a notification for resolved status alone", async () => {
      const ticketId = await createTicket({ source: "in_app_user" });

      await updateStatus(ticketId, "resolved");

      await expectNoNotifications(ticketId);
    });

    it("fails closed for non-in-app sources, omitted source default, and null reporter", async () => {
      const blockedSources: Array<TicketSource | undefined> = [
        "manual",
        "sentry",
        "nightly_qa",
        "internal",
        "unknown",
        undefined,
      ];

      for (const source of blockedSources) {
        for (const action of ["created", "in_progress", "escalated"] as const) {
          const ticketId = await createTicket({ source });

          if (action === "created") {
            await insertCreatedEvent(ticketId);
          } else {
            await updateStatus(ticketId, action);
          }

          await expectNoNotifications(ticketId);
        }
      }

      for (const action of ["created", "in_progress", "escalated"] as const) {
        const ticketId = await createTicket({
          source: "in_app_user",
          reporterId: null,
        });

        if (action === "created") {
          await insertCreatedEvent(ticketId);
        } else {
          await updateStatus(ticketId, action);
        }

        await expectNoNotifications(ticketId);
      }
    });

    it("is idempotent by reporter, ticket, and notification kind", async () => {
      const ticketId = await createTicket({ source: "in_app_user" });

      await insertCreatedEvent(ticketId);
      await insertCreatedEvent(ticketId);

      await expectExactlyOneNotification(ticketId, "received");
    });
  },
);
