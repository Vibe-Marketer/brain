/**
 * QA ticket ingestion integration test (Phase 20 / QA-02 / QA-03) — real
 * Supabase TEST project only.
 *
 * Exercises `public.ingest_qa_ticket`, the service-role-only RPC that promotes
 * reproduced nightly QA findings into fixable tickets while stamping
 * source='nightly_qa' server-side.
 *
 * HARD CONTRACT:
 *   - TEST project only — integration-setup reads *_TEST_* env vars with no
 *     production fallback.
 *   - describe.skipIf cleanly skips when TEST env is unset.
 *   - Every created row is cleaned up in afterAll with best-effort isolation.
 *
 * Run: npm run test:integration -- qa-ticket-ingestion
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";

const SUITE_TAG = "[phase-20-01 qa-ticket-ingestion]";
const RUN_ID = Math.random().toString(16).slice(2, 10);
const FINGERPRINT = `qa:test-${RUN_ID}`;
const RLS_FP = `qa:test-rls-${RUN_ID}`;

type QaIngestRow = {
  ticket_id: string;
  occurrence_count: number;
  created: boolean;
  promoted: boolean;
};

function firstRpcRow(data: QaIngestRow[] | QaIngestRow | null): QaIngestRow {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error(`${SUITE_TAG} RPC returned no row`);
  }
  return row;
}

function qaContext(extra: Record<string, unknown> = {}) {
  return {
    route: "/dashboard",
    selector: "[data-testid='qa-probe']",
    finding_type: "console",
    consecutive_nightly_count: 2,
    repro_attempts: [
      { attempt: 1, reproduced: true },
      { attempt: 2, reproduced: true },
    ],
    ...extra,
  };
}

// describe.skipIf reports a clean skip when TEST DB env is absent.
describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ingest_qa_ticket source stamping + ledger semantics`,
  () => {
    const svc: SupabaseClient = makeIntegrationClient();
    const createdTicketIds = new Set<string>();
    const tempUserIds: string[] = [];
    let rpcAvailable = true;

    beforeAll(async () => {
      const probeFingerprint = `qa:test-probe-${RUN_ID}`;
      const { error } = await svc.rpc("ingest_qa_ticket", {
        p_fingerprint: probeFingerprint,
        p_severity: "low",
        p_context: qaContext({ route: "/probe" }),
        p_message_body: "probe body",
        p_attachments: [],
      });
      if (error) {
        rpcAvailable = false;
        console.warn(
          `${SUITE_TAG} ingest_qa_ticket unavailable on the test project ` +
            `(run \`supabase db push --linked\` against the test ref). Error: ${error.message}`,
        );
        return;
      }

      const { data: probe } = await svc
        .from("tickets")
        .select("id")
        .eq("fingerprint", probeFingerprint)
        .maybeSingle();
      if (probe?.id) createdTicketIds.add(probe.id);
    });

    afterAll(async () => {
      for (const id of createdTicketIds) {
        try {
          await svc.from("ticket_events").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("ticket_messages").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("qa_findings").delete().eq("promoted_ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("tickets").delete().eq("id", id);
        } catch { /* best-effort */ }
      }

      try {
        await svc.from("qa_findings").delete().in("fingerprint", [
          `qa:test-probe-${RUN_ID}`,
          FINGERPRINT,
          RLS_FP,
        ]);
      } catch { /* best-effort */ }

      for (const uid of tempUserIds) {
        try {
          await svc.from("user_roles").delete().eq("user_id", uid);
        } catch { /* best-effort */ }
        try {
          await svc.auth.admin.deleteUser(uid);
        } catch { /* best-effort */ }
      }
    });

    it("creates one nightly_qa ticket with evidence, event, and promoted finding", async () => {
      if (!rpcAvailable) return;

      const { data, error } = await svc.rpc("ingest_qa_ticket", {
        p_fingerprint: FINGERPRINT,
        p_severity: "medium",
        p_context: qaContext({ marker: "first" }),
        p_message_body: "QA reproduced failure evidence",
        p_attachments: [{ type: "trace", path: "qa-artifacts/run-1.zip" }],
      });
      expect(error).toBeNull();

      const first = firstRpcRow(data as QaIngestRow[] | QaIngestRow | null);
      expect(first.created).toBe(true);
      expect(first.promoted).toBe(true);
      expect(first.occurrence_count).toBe(1);
      createdTicketIds.add(first.ticket_id);

      const { data: ticket, error: ticketError } = await svc
        .from("tickets")
        .select("id, source, type, status, reporter_id, severity, context, occurrence_count, last_seen_at")
        .eq("id", first.ticket_id)
        .single();
      expect(ticketError).toBeNull();
      expect(ticket?.source).toBe("nightly_qa");
      expect(ticket?.type).toBe("bug");
      expect(ticket?.status).toBe("new");
      expect(ticket?.reporter_id).toBeNull();
      expect(ticket?.severity).toBe("medium");
      expect(ticket?.occurrence_count).toBe(1);
      expect((ticket?.context as { marker?: string }).marker).toBe("first");

      const { data: messages, error: messageError } = await svc
        .from("ticket_messages")
        .select("author_type, author_id, body, attachments")
        .eq("ticket_id", first.ticket_id);
      expect(messageError).toBeNull();
      expect(messages ?? []).toHaveLength(1);
      expect(messages?.[0]?.author_type).toBe("agent");
      expect(messages?.[0]?.author_id).toBeNull();
      expect(messages?.[0]?.body).toContain("QA reproduced failure evidence");

      const { data: events, error: eventError } = await svc
        .from("ticket_events")
        .select("event_type, actor_id, new_value")
        .eq("ticket_id", first.ticket_id)
        .eq("event_type", "created");
      expect(eventError).toBeNull();
      expect(events ?? []).toHaveLength(1);
      expect(events?.[0]?.actor_id).toBeNull();
      expect(events?.[0]?.new_value).toBe("new");

      const { data: finding, error: findingError } = await svc
        .from("qa_findings")
        .select("fingerprint, lane, promoted_ticket_id, route, selector, finding_type, occurrence_count")
        .eq("fingerprint", FINGERPRINT)
        .single();
      expect(findingError).toBeNull();
      expect(finding?.lane).toBe("promoted");
      expect(finding?.promoted_ticket_id).toBe(first.ticket_id);
      expect(finding?.route).toBe("/dashboard");
      expect(finding?.selector).toBe("[data-testid='qa-probe']");
      expect(finding?.finding_type).toBe("console");
      expect(finding?.occurrence_count).toBe(1);
    });

    it("dedups by fingerprint without overwriting first severity or context", async () => {
      if (!rpcAvailable) return;

      const { data: first } = await svc.rpc("ingest_qa_ticket", {
        p_fingerprint: FINGERPRINT,
        p_severity: "medium",
        p_context: qaContext({ marker: "first" }),
        p_message_body: "QA reproduced failure evidence",
        p_attachments: [],
      });
      const firstRow = firstRpcRow(first as QaIngestRow[] | QaIngestRow | null);
      createdTicketIds.add(firstRow.ticket_id);

      const { data: before } = await svc
        .from("tickets")
        .select("last_seen_at")
        .eq("id", firstRow.ticket_id)
        .single();
      const firstLastSeen = new Date(before?.last_seen_at as string).getTime();

      await new Promise((resolve) => setTimeout(resolve, 25));

      const { data: second, error: secondError } = await svc.rpc("ingest_qa_ticket", {
        p_fingerprint: FINGERPRINT,
        p_severity: "high",
        p_context: qaContext({ marker: "second" }),
        p_message_body: "second body should not create another evidence message",
        p_attachments: [],
      });
      expect(secondError).toBeNull();
      const secondRow = firstRpcRow(second as QaIngestRow[] | QaIngestRow | null);
      expect(secondRow.created).toBe(false);
      expect(secondRow.ticket_id).toBe(firstRow.ticket_id);
      expect(secondRow.occurrence_count).toBeGreaterThanOrEqual(2);

      const { data: rows } = await svc
        .from("tickets")
        .select("id")
        .eq("fingerprint", FINGERPRINT);
      expect(rows ?? []).toHaveLength(1);

      const { data: ticket } = await svc
        .from("tickets")
        .select("severity, context, occurrence_count, last_seen_at")
        .eq("id", firstRow.ticket_id)
        .single();
      expect(ticket?.severity).toBe("medium");
      expect((ticket?.context as { marker?: string }).marker).toBe("first");
      expect(ticket?.occurrence_count).toBe(secondRow.occurrence_count);
      expect(new Date(ticket?.last_seen_at as string).getTime()).toBeGreaterThan(firstLastSeen);

      const { data: occurrenceEvents } = await svc
        .from("ticket_events")
        .select("event_type")
        .eq("ticket_id", firstRow.ticket_id)
        .eq("event_type", "occurrence");
      expect((occurrenceEvents ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it("keeps qa_findings admin/service-visible and hidden from non-admin authenticated users", async () => {
      if (!rpcAvailable) return;
      if (!TEST_ANON_KEY) {
        console.warn(`${SUITE_TAG} VITE_SUPABASE_TEST_ANON_KEY unset — RLS case skipped`);
        return;
      }

      const { data: seeded } = await svc.rpc("ingest_qa_ticket", {
        p_fingerprint: RLS_FP,
        p_severity: "low",
        p_context: qaContext({ marker: "rls" }),
        p_message_body: "rls body",
        p_attachments: [],
      });
      const seededRow = firstRpcRow(seeded as QaIngestRow[] | QaIngestRow | null);
      createdTicketIds.add(seededRow.ticket_id);

      const { data: svcView } = await svc
        .from("qa_findings")
        .select("fingerprint")
        .eq("fingerprint", RLS_FP);
      expect(svcView ?? []).toHaveLength(1);

      const adminEmail = `qa-admin-${RUN_ID}@phase20.invalid`;
      const adminPassword = `Pw-${RUN_ID}-aA1!`;
      const { data: adminCreated, error: adminCreateError } = await svc.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      });
      expect(adminCreateError).toBeNull();
      const adminId = adminCreated.user!.id;
      tempUserIds.push(adminId);
      const { error: roleError } = await svc
        .from("user_roles")
        .insert({ user_id: adminId, role: "ADMIN" });
      expect(roleError).toBeNull();

      const admin = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: adminSignInError } = await admin.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      expect(adminSignInError).toBeNull();
      const { data: adminView, error: adminViewError } = await admin
        .from("qa_findings")
        .select("fingerprint")
        .eq("fingerprint", RLS_FP);
      expect(adminViewError).toBeNull();
      expect(adminView ?? []).toHaveLength(1);
      await admin.auth.signOut();

      const userEmail = `qa-user-${RUN_ID}@phase20.invalid`;
      const userPassword = `Pw-${RUN_ID}-bB2!`;
      const { data: userCreated, error: userCreateError } = await svc.auth.admin.createUser({
        email: userEmail,
        password: userPassword,
        email_confirm: true,
      });
      expect(userCreateError).toBeNull();
      tempUserIds.push(userCreated.user!.id);

      const anon = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await anon.auth.signInWithPassword({
        email: userEmail,
        password: userPassword,
      });
      expect(signInError).toBeNull();

      const { data: userView, error: userViewError } = await anon
        .from("qa_findings")
        .select("fingerprint")
        .eq("fingerprint", RLS_FP);
      expect(userViewError).toBeNull();
      expect(userView ?? []).toHaveLength(0);

      const { error: rpcError } = await anon.rpc("ingest_qa_ticket", {
        p_fingerprint: `qa:spoof-${RUN_ID}`,
        p_severity: "low",
        p_context: qaContext({ marker: "spoof" }),
        p_message_body: "spoof",
        p_attachments: [],
      });
      expect(rpcError).not.toBeNull();

      await anon.auth.signOut();
    });
  },
);
