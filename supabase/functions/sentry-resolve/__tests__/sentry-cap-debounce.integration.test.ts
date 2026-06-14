/**
 * sentry cap/debounce integration test (SEN-04 / SEN-05) — real Supabase TEST project.
 *
 * Exercises the Phase 21 DB contract through service-role RPCs:
 *   1. Sentry tickets are not fixable until occurrence_count >= 3 within 15 min.
 *   2. Non-Sentry tickets remain fixable; debounce applies only to Sentry.
 *   3. record_fingerprint_fix_attempt freezes one fingerprint on the 4th
 *      real autonomous fix attempt/regression record and emits newly_frozen once.
 *   4. Resolved Sentry tickets with a successful runner_run appear in the
 *      resolve-ASAP cycle-time tracking surface.
 *
 * HARD CONTRACT (supabase/CLAUDE.md "Running integration tests safely"):
 *   - TEST project only — *_TEST_* env vars, no prod fallback.
 *   - describe.skipIf cleanly skips when the env is unset.
 *   - Every created row is cleaned up in afterAll; each cleanup step is wrapped
 *     in try/catch so reruns are idempotent.
 *
 * Run: npm run test:integration -- sentry-cap-debounce
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-21-01 sentry-cap-debounce]";
const RUN_ID = Math.random().toString(16).slice(2, 10);
const SENTRY_FP = `sentry:test-debounce-${RUN_ID}`;
const CAP_FP = `sentry:test-cap-${RUN_ID}`;
const PROBE_FP = `sentry:test-probe-cap-${RUN_ID}`;

type IngestResult = {
  ticket_id: string;
  occurrence_count: number;
  created: boolean;
};

type CapResult = {
  fingerprint: string;
  fix_attempts: number;
  frozen: boolean;
  newly_frozen: boolean;
};

type CycleMetric = {
  ticket_id: string;
  fingerprint: string | null;
  fix_at: string | null;
  resolved_at: string | null;
  cycle_time_seconds: number | null;
  resolve_asap_target_minutes: number;
  resolve_asap_met: boolean | null;
  resolve_asap_status: string;
};

function firstRow<T>(value: unknown): T {
  return (Array.isArray(value) ? value[0] : value) as T;
}

function context(extra: Record<string, unknown> = {}) {
  return {
    sentry: {
      issue_id: `test-${RUN_ID}`,
      project: "call-vault",
      title: "Phase 21 integration test issue",
      ...extra,
    },
  };
}

async function ingestSentry(
  svc: SupabaseClient,
  fingerprint: string,
  marker: string,
): Promise<IngestResult> {
  const { data, error } = await svc.rpc("ingest_sentry_ticket", {
    p_fingerprint: fingerprint,
    p_severity: "medium",
    p_context: context({ marker }),
    p_notify_title: "Sentry: phase 21 test",
    p_notify_body: "phase 21 body",
  });
  expect(error).toBeNull();
  return firstRow<IngestResult>(data);
}

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} debounce predicate + fingerprint cap + resolve metrics`,
  () => {
    const svc: SupabaseClient = makeIntegrationClient();
    const createdTicketIds = new Set<string>();
    const capFingerprints = new Set<string>([CAP_FP, PROBE_FP]);
    const runnerRunIds = new Set<string>();
    const tempUserIds: string[] = [];
    let rpcAvailable = true;

    beforeAll(async () => {
      const { error: capError } = await svc.rpc("record_fingerprint_fix_attempt", {
        p_fingerprint: PROBE_FP,
        p_cap: 3,
      });
      const { error: metricsError } = await svc.rpc("sentry_resolve_cycle_time_metrics", {
        p_target_minutes: 30,
      });

      if (capError || metricsError) {
        rpcAvailable = false;
        console.warn(
          `${SUITE_TAG} Phase 21 RPCs unavailable on the TEST project ` +
            `(run \`supabase db push --linked\` against the test ref). Error: ${
              capError?.message ?? metricsError?.message ?? "unknown"
            }`,
        );
      }
    });

    afterAll(async () => {
      for (const id of runnerRunIds) {
        try {
          await svc.from("runner_runs").delete().eq("id", id);
        } catch { /* best-effort */ }
      }

      for (const fingerprint of capFingerprints) {
        try {
          await svc.from("sentry_fingerprint_cap").delete().eq("fingerprint", fingerprint);
        } catch { /* best-effort */ }
      }

      for (const id of createdTicketIds) {
        try {
          await svc.from("ticket_events").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("user_notifications").delete()
            .filter("metadata->>ticket_id", "eq", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("runner_runs").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("tickets").delete().eq("id", id);
        } catch { /* best-effort */ }
      }

      for (const uid of tempUserIds) {
        try {
          await svc.auth.admin.deleteUser(uid);
        } catch { /* best-effort */ }
      }
    });

    it("debounces Sentry tickets until the fingerprint recurs 3 times within 15 minutes", async () => {
      if (!rpcAvailable) return;

      const first = await ingestSentry(svc, SENTRY_FP, "first");
      createdTicketIds.add(first.ticket_id);
      expect(first.created).toBe(true);
      expect(first.occurrence_count).toBe(1);

      const { data: freshFixable, error: freshError } = await svc.rpc("sentry_ticket_fixable", {
        p_ticket_id: first.ticket_id,
        p_min_occurrences: 3,
        p_window_minutes: 15,
      });
      expect(freshError).toBeNull();
      expect(freshFixable).toBe(false);

      await ingestSentry(svc, SENTRY_FP, "second");
      const third = await ingestSentry(svc, SENTRY_FP, "third");
      expect(third.occurrence_count).toBe(3);

      const { data: recurredFixable, error: recurredError } = await svc.rpc("sentry_ticket_fixable", {
        p_ticket_id: first.ticket_id,
        p_min_occurrences: 3,
        p_window_minutes: 15,
      });
      expect(recurredError).toBeNull();
      expect(recurredFixable).toBe(true);
    });

    it("does not debounce non-Sentry tickets", async () => {
      if (!rpcAvailable) return;

      const email = `qa-sentry-cap-${RUN_ID}@sentry-phase21.invalid`;
      const { data: created, error: createError } = await svc.auth.admin.createUser({
        email,
        password: `Pw-${RUN_ID}-cC3!`,
        email_confirm: true,
      });
      expect(createError).toBeNull();
      const userId = created.user!.id;
      tempUserIds.push(userId);

      const { data: ticket, error: insertError } = await svc
        .from("tickets")
        .insert({
          reporter_id: userId,
          type: "bug",
          severity: "low",
          status: "new",
          source: "manual",
          context: { test: SUITE_TAG, run_id: RUN_ID },
        })
        .select("id")
        .single();
      expect(insertError).toBeNull();
      createdTicketIds.add(ticket.id);

      const { data: fixable, error } = await svc.rpc("sentry_ticket_fixable", {
        p_ticket_id: ticket.id,
        p_min_occurrences: 3,
        p_window_minutes: 15,
      });
      expect(error).toBeNull();
      expect(fixable).toBe(true);
    });

    it("freezes one fingerprint on the 4th real fix attempt and emits newly_frozen once", async () => {
      if (!rpcAvailable) return;

      const results: CapResult[] = [];
      for (let i = 0; i < 5; i += 1) {
        const { data, error } = await svc.rpc("record_fingerprint_fix_attempt", {
          p_fingerprint: CAP_FP,
          p_cap: 3,
        });
        expect(error).toBeNull();
        results.push(firstRow<CapResult>(data));
      }

      expect(results.map((row) => row.fix_attempts)).toEqual([1, 2, 3, 4, 4]);
      expect(results.map((row) => row.frozen)).toEqual([false, false, false, true, true]);
      expect(results.map((row) => row.newly_frozen)).toEqual([false, false, false, true, false]);
      expect(results.every((row) => row.fingerprint === CAP_FP)).toBe(true);
    });

    it("tracks resolve-ASAP cycle time for resolved Sentry tickets with a successful runner run", async () => {
      if (!rpcAvailable) return;

      const seeded = await ingestSentry(svc, `sentry:test-cycle-${RUN_ID}`, "cycle-first");
      createdTicketIds.add(seeded.ticket_id);
      await ingestSentry(svc, `sentry:test-cycle-${RUN_ID}`, "cycle-second");
      await ingestSentry(svc, `sentry:test-cycle-${RUN_ID}`, "cycle-third");

      const now = new Date();
      const startedAt = new Date(now.getTime() - 90_000).toISOString();
      const finishedAt = new Date(now.getTime() - 30_000).toISOString();

      const { data: run, error: runError } = await svc
        .from("runner_runs")
        .insert({
          ticket_id: seeded.ticket_id,
          status: "merged",
          outcome: "fixed",
          gate_verdict: "pass",
          started_at: startedAt,
          finished_at: finishedAt,
          merged_at: finishedAt,
          fix_category: "sentry",
          detail: { test: SUITE_TAG, run_id: RUN_ID },
        })
        .select("id")
        .single();
      expect(runError).toBeNull();
      runnerRunIds.add(run.id);

      const resolvedAt = now.toISOString();
      const { error: updateError } = await svc
        .from("tickets")
        .update({ status: "resolved", sentry_resolved_at: resolvedAt })
        .eq("id", seeded.ticket_id);
      expect(updateError).toBeNull();

      const { data: metrics, error: metricsError } = await svc.rpc(
        "sentry_resolve_cycle_time_metrics",
        { p_target_minutes: 30 },
      );
      expect(metricsError).toBeNull();

      const metric = (metrics as CycleMetric[]).find((row) => row.ticket_id === seeded.ticket_id);
      expect(metric).toBeDefined();
      expect(metric!.fingerprint).toBe(`sentry:test-cycle-${RUN_ID}`);
      expect(metric!.fix_at).toBeTruthy();
      expect(metric!.resolved_at).toBeTruthy();
      expect(metric!.cycle_time_seconds).not.toBeNull();
      expect(metric!.cycle_time_seconds!).toBeGreaterThanOrEqual(0);
      expect(metric!.resolve_asap_target_minutes).toBe(30);
      expect(metric!.resolve_asap_met).toBe(true);
      expect(metric!.resolve_asap_status).toBe("met");
    });
  },
);
