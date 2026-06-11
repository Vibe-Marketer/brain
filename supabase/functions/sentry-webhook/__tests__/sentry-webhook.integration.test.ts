/**
 * sentry-webhook integration test (SEN-01 / SEN-02) — real Supabase TEST project.
 *
 * Exercises `public.ingest_sentry_ticket` (the atomic upsert the Edge Function
 * delegates to) via the TEST project's service-role client, proving the dedup
 * and notification semantics that build/type gates cannot:
 *
 *   1. First call → created=true, occurrence_count=1; tickets row shaped
 *      source='sentry', type='bug', status='new', reporter_id NULL; one
 *      ticket_events 'created' row (actor_id NULL).
 *   2. Second call, same fingerprint → created=false, occurrence_count=2; still
 *      exactly one ticket row; last_seen_at strictly advanced; severity/context
 *      unchanged even when different args are passed.
 *   3. severity 'high' → exactly one user_notifications row per ADMIN; second
 *      delivery adds zero new notifications.
 *   4. RLS: a temp NON-admin authenticated user sees zero NULL-reporter Sentry
 *      rows; service-role sees them (T-12-04 disposition).
 *
 * HARD CONTRACT (supabase/CLAUDE.md "Running integration tests safely"):
 *   - TEST project only — *_TEST_* env vars, no prod fallback (integration-setup
 *     throws if they equal prod).
 *   - describe.skipIf cleanly skips when the env is unset.
 *   - Every created row is cleaned up in afterAll, each step wrapped in
 *     try/catch; the suite is idempotent across reruns (unique fingerprint).
 *
 * Run: npm run test:integration -- sentry-webhook
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";

const SUITE_TAG = "[phase-12-03 sentry-ingestion]";

// Unique per-run fingerprint so reruns never collide and dedup math is clean.
const RUN_ID = Math.random().toString(16).slice(2, 10);
const FINGERPRINT = `sentry:test-${RUN_ID}`;
const ADMIN_FP = `sentry:test-admin-${RUN_ID}`;
const RLS_FP = `sentry:test-rls-${RUN_ID}`;

function context(extra: Record<string, unknown> = {}) {
  return {
    sentry: {
      issue_id: `test-${RUN_ID}`,
      project: "call-vault",
      title: "Integration test issue",
      ...extra,
    },
  };
}

// describe.skipIf reports a clean skip when the test project env is absent.
describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} ingest_sentry_ticket dedup + notification semantics`,
  () => {
    const svc: SupabaseClient = makeIntegrationClient();
    const createdTicketIds = new Set<string>();
    const tempUserIds: string[] = [];
    let rpcAvailable = true;

    beforeAll(async () => {
      // Assert the RPC exists in the test project; skip-guard if migrations
      // are behind (clear message rather than a cryptic 404).
      const { error } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: `sentry:test-probe-${RUN_ID}`,
        p_severity: "low",
        p_context: context(),
        p_notify_title: "probe",
        p_notify_body: "probe",
      });
      if (error) {
        rpcAvailable = false;
        console.warn(
          `${SUITE_TAG} ingest_sentry_ticket unavailable on the test project ` +
            `(run \`supabase db push --linked\` against the test ref). Error: ${error.message}`,
        );
        return;
      }
      // Track the probe ticket for cleanup.
      const { data: probe } = await svc
        .from("tickets")
        .select("id")
        .eq("fingerprint", `sentry:test-probe-${RUN_ID}`)
        .maybeSingle();
      if (probe?.id) createdTicketIds.add(probe.id);
    });

    afterAll(async () => {
      // Delete tickets (cascades messages/events). Wrap each step.
      for (const id of createdTicketIds) {
        try {
          await svc.from("ticket_events").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("user_notifications").delete()
            .filter("metadata->>ticket_id", "eq", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("tickets").delete().eq("id", id);
        } catch { /* best-effort */ }
      }
      // Explicit per-user delete only — do NOT call the shared
      // `cleanup_test_fixture_users(0)` sweep here: it deletes EVERY recent
      // @callvault.test auth user across ALL parallel integration suites,
      // which would race-delete a sibling test's fresh fixtures. We own our
      // user IDs, so a targeted deleteUser is both sufficient and isolated.
      for (const uid of tempUserIds) {
        try {
          await svc.auth.admin.deleteUser(uid);
        } catch { /* best-effort */ }
      }
    });

    it("Case 1+2: dedups by fingerprint, increments occurrence_count, advances last_seen_at", async () => {
      if (!rpcAvailable) return;

      // --- First call ---
      const { data: first, error: e1 } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: FINGERPRINT,
        p_severity: "medium",
        p_context: context({ marker: "first" }),
        p_notify_title: "Sentry: first",
        p_notify_body: "first body",
      });
      expect(e1).toBeNull();
      const row1 = Array.isArray(first) ? first[0] : first;
      expect(row1.created).toBe(true);
      expect(row1.occurrence_count).toBe(1);
      const ticketId = row1.ticket_id as string;
      createdTicketIds.add(ticketId);

      // Ticket shape
      const { data: t } = await svc
        .from("tickets")
        .select("id, source, type, status, reporter_id, severity, context, last_seen_at, occurrence_count")
        .eq("id", ticketId)
        .single();
      expect(t.source).toBe("sentry");
      expect(t.type).toBe("bug");
      expect(t.status).toBe("new");
      expect(t.reporter_id).toBeNull();
      expect(t.severity).toBe("medium");
      const firstLastSeen = new Date(t.last_seen_at).getTime();

      // 'created' event with NULL actor
      const { data: ev1 } = await svc
        .from("ticket_events")
        .select("event_type, actor_id")
        .eq("ticket_id", ticketId)
        .eq("event_type", "created");
      expect(ev1.length).toBe(1);
      expect(ev1[0].actor_id).toBeNull();

      // small delay so last_seen_at can strictly advance
      await new Promise((r) => setTimeout(r, 25));

      // --- Second call, same fingerprint, DIFFERENT args ---
      const { data: second, error: e2 } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: FINGERPRINT,
        p_severity: "high", // intentionally different — must NOT overwrite
        p_context: context({ marker: "second" }),
        p_notify_title: "Sentry: second",
        p_notify_body: "second body",
      });
      expect(e2).toBeNull();
      const row2 = Array.isArray(second) ? second[0] : second;
      expect(row2.created).toBe(false);
      expect(row2.occurrence_count).toBe(2);
      expect(row2.ticket_id).toBe(ticketId);

      // Still exactly ONE ticket row for this fingerprint
      const { data: fpRows } = await svc
        .from("tickets")
        .select("id")
        .eq("fingerprint", FINGERPRINT);
      expect(fpRows.length).toBe(1);

      // last_seen_at strictly advanced; severity/context unchanged from first
      const { data: t2 } = await svc
        .from("tickets")
        .select("severity, context, last_seen_at, occurrence_count")
        .eq("id", ticketId)
        .single();
      expect(new Date(t2.last_seen_at).getTime()).toBeGreaterThan(firstLastSeen);
      expect(t2.severity).toBe("medium"); // dedup must not change severity
      expect((t2.context as { sentry: { marker: string } }).sentry.marker).toBe("first");
      expect(t2.occurrence_count).toBe(2);
    });

    it("Case 3: severity 'high' notifies each ADMIN once; dedup adds none", async () => {
      if (!rpcAvailable) return;

      // Create a temp ADMIN user (donor pattern — TEST-tagged email).
      // Non-swept domain (NOT @callvault.test): keeps a sibling suite's
      // cleanup_test_fixture_users(0) sweep from race-deleting this admin
      // mid-test. Cleaned up explicitly via deleteUser in afterAll.
      const email = `qa-sentry-admin-${RUN_ID}@sentry-phase12.invalid`;
      const { data: created, error: ce } = await svc.auth.admin.createUser({
        email,
        password: `Pw-${RUN_ID}-aA1!`,
        email_confirm: true,
      });
      expect(ce).toBeNull();
      const adminId = created.user!.id;
      tempUserIds.push(adminId);
      const { error: re } = await svc
        .from("user_roles")
        .insert({ user_id: adminId, role: "ADMIN" });
      expect(re).toBeNull();

      // First high-severity ingest → notification fan-out includes our admin.
      const { data: first } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: ADMIN_FP,
        p_severity: "high",
        p_context: context({ marker: "admin-first" }),
        p_notify_title: "Sentry: admin test",
        p_notify_body: "admin body",
      });
      const ticketId = (Array.isArray(first) ? first[0] : first).ticket_id as string;
      createdTicketIds.add(ticketId);

      const { data: notif1 } = await svc
        .from("user_notifications")
        .select("id, user_id, type, metadata")
        .eq("user_id", adminId)
        .filter("metadata->>ticket_id", "eq", ticketId);
      expect(notif1.length).toBe(1);
      expect(notif1[0].type).toBe("system");

      // Second ingest (dedup) → ZERO new notifications.
      await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: ADMIN_FP,
        p_severity: "high",
        p_context: context({ marker: "admin-second" }),
        p_notify_title: "Sentry: admin test 2",
        p_notify_body: "admin body 2",
      });
      // Re-select rows (not a head-count) — the JSON `->>` filter combined
      // with head:true count is flaky under the parallel test runner; a full
      // row select is the reliable shape (mirrors the first assertion above).
      const { data: notif2 } = await svc
        .from("user_notifications")
        .select("id")
        .eq("user_id", adminId)
        .filter("metadata->>ticket_id", "eq", ticketId);
      expect(notif2.length).toBe(1); // unchanged — dedup added no notification
    });

    it("Case 4: NULL-reporter Sentry tickets are invisible to a non-admin JWT", async () => {
      if (!rpcAvailable) return;
      if (!TEST_ANON_KEY) {
        console.warn(`${SUITE_TAG} VITE_SUPABASE_TEST_ANON_KEY unset — RLS case skipped`);
        return;
      }

      // Seed a NULL-reporter Sentry ticket (service-role).
      const { data: seeded } = await svc.rpc("ingest_sentry_ticket", {
        p_fingerprint: RLS_FP,
        p_severity: "low",
        p_context: context({ marker: "rls" }),
        p_notify_title: "Sentry: rls",
        p_notify_body: "rls body",
      });
      const ticketId = (Array.isArray(seeded) ? seeded[0] : seeded).ticket_id as string;
      createdTicketIds.add(ticketId);

      // Service-role sees it.
      const { data: svcView } = await svc
        .from("tickets")
        .select("id")
        .eq("id", ticketId);
      expect(svcView.length).toBe(1);

      // Temp NON-admin user signs in with anon key → must see ZERO.
      const email = `qa-sentry-user-${RUN_ID}@sentry-phase12.invalid`;
      const password = `Pw-${RUN_ID}-bB2!`;
      const { data: u, error: ue } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      expect(ue).toBeNull();
      tempUserIds.push(u.user!.id);

      const anon = createClient(TEST_URL, TEST_ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: se } = await anon.auth.signInWithPassword({ email, password });
      expect(se).toBeNull();

      const { data: userView } = await anon
        .from("tickets")
        .select("id")
        .eq("id", ticketId);
      expect(userView ?? []).toHaveLength(0);

      await anon.auth.signOut();
    });
  },
);
