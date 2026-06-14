/**
 * Ticket class recurrence integration test (Phase 22 / REC-01 / REC-02).
 *
 * HARD CONTRACT:
 *   - TEST project only — integration-setup reads *_TEST_* env vars with no
 *     production fallback.
 *   - describe.skipIf cleanly skips when TEST env is unset.
 *   - Every created row is cleaned up in afterAll with best-effort isolation.
 *
 * Run: npm run test:integration -- ticket-classes
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationDbReachable,
  makeIntegrationClient,
} from "@/test/integration-setup";

const SUITE_TAG = "[phase-22-01 ticket-classes]";
const RUN_ID = Math.random().toString(16).slice(2, 10);

type TicketClassMetric = {
  class_key: string;
  source: string;
  error_class: string;
  fingerprint_root: string;
  status: string;
  resolved_count_30d: number;
  occurrence_count_30d: number;
  fresh_ticket_rate_30d: number;
  baseline_rate_30d: number | null;
  post_fix_rate_30d: number | null;
  structural_ticket_id: string | null;
  structural_fix_landed_at: string | null;
  killed_at: string | null;
  context: Record<string, unknown>;
};

type TicketRow = {
  id: string;
  context: Record<string, unknown>;
};

function resolvedTicket(source: "sentry" | "nightly_qa", fingerprint: string, extra: Record<string, unknown> = {}) {
  return {
    reporter_id: null,
    type: "bug",
    severity: "medium",
    status: "resolved",
    source,
    fingerprint,
    context: {
      error_class: "Phase22RecurringError",
      marker: SUITE_TAG,
      run_id: RUN_ID,
      ...extra,
    },
    occurrence_count: 1,
    last_seen_at: new Date().toISOString(),
  };
}

async function fetchTicketClass(svc: SupabaseClient, classKey: string): Promise<TicketClassMetric> {
  const { data, error } = await svc
    .from("ticket_classes")
    .select("*")
    .eq("class_key", classKey)
    .single();
  expect(error).toBeNull();
  return data as TicketClassMetric;
}

describe.skipIf(!integrationDbReachable)(
  `${SUITE_TAG} recurrence rollup + structural lifecycle`,
  () => {
    const svc: SupabaseClient = makeIntegrationClient();
    const createdTicketIds = new Set<string>();
    const classKeys = new Set<string>();
    let rpcAvailable = true;

    beforeAll(async () => {
      const { error } = await svc.rpc("ticket_class_metrics");
      if (error && /Could not find the function|function .* does not exist|schema cache/i.test(error.message)) {
        rpcAvailable = false;
        console.warn(
          `${SUITE_TAG} ticket_class RPCs unavailable on the test project ` +
            `(run \`supabase db push --linked\` against the test ref). Error: ${error.message}`,
        );
      }
    });

    afterAll(async () => {
      for (const classKey of classKeys) {
        try {
          const { data } = await svc
            .from("ticket_classes")
            .select("structural_ticket_id")
            .eq("class_key", classKey);
          for (const row of data ?? []) {
            if (row.structural_ticket_id) createdTicketIds.add(row.structural_ticket_id as string);
          }
        } catch { /* best-effort */ }
      }

      for (const id of createdTicketIds) {
        try {
          await svc.from("ticket_events").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
        try {
          await svc.from("ticket_messages").delete().eq("ticket_id", id);
        } catch { /* best-effort */ }
      }

      try {
        await svc.from("ticket_classes").delete().in("class_key", [...classKeys]);
      } catch { /* best-effort */ }

      for (const id of createdTicketIds) {
        try {
          await svc.from("tickets").delete().eq("id", id);
        } catch { /* best-effort */ }
      }
    });

    it("keeps colliding bare fingerprint roots source-namespaced", async () => {
      if (!rpcAvailable) return;

      const collisionRoot = `phase22-collision-${RUN_ID}`;
      const { data, error } = await svc
        .from("tickets")
        .insert([
          resolvedTicket("sentry", `${collisionRoot}:aaaaaaaa`, { error_class: "CollisionError" }),
          resolvedTicket("nightly_qa", `${collisionRoot}:bbbbbbbb`, { error_class: "CollisionError" }),
        ])
        .select("id");
      expect(error).toBeNull();
      for (const row of data ?? []) createdTicketIds.add(row.id);

      const { error: rollupError } = await svc.rpc("rollup_ticket_classes");
      expect(rollupError).toBeNull();

      const sentryKey = `source:sentry:error:collisionerror:fingerprint:sentry:${collisionRoot}`;
      const qaKey = `source:nightly_qa:error:collisionerror:fingerprint:nightly_qa:${collisionRoot}`;
      classKeys.add(sentryKey);
      classKeys.add(qaKey);

      const { data: classes, error: classError } = await svc
        .from("ticket_classes")
        .select("class_key, source, fingerprint_root")
        .in("class_key", [sentryKey, qaKey]);
      expect(classError).toBeNull();
      expect(classes ?? []).toHaveLength(2);
      expect(classes?.map((row) => row.class_key).sort()).toEqual([qaKey, sentryKey].sort());
      expect(classes?.find((row) => row.source === "sentry")?.fingerprint_root).toBe(`sentry:${collisionRoot}`);
      expect(classes?.find((row) => row.source === "nightly_qa")?.fingerprint_root).toBe(`nightly_qa:${collisionRoot}`);
    });

    it("creates one structural task at threshold and does not duplicate on rerollup", async () => {
      if (!rpcAvailable) return;

      const root = `phase22-threshold-${RUN_ID}`;
      const classKey = `source:sentry:error:phase22recurringerror:fingerprint:sentry:${root}`;
      classKeys.add(classKey);

      const { data, error } = await svc
        .from("tickets")
        .insert([
          resolvedTicket("sentry", `${root}:11111111`),
          resolvedTicket("sentry", `${root}:22222222`),
          resolvedTicket("sentry", `${root}:33333333`),
        ])
        .select("id");
      expect(error).toBeNull();
      for (const row of data ?? []) createdTicketIds.add(row.id);

      const { error: firstRollupError } = await svc.rpc("rollup_ticket_classes");
      expect(firstRollupError).toBeNull();
      const first = await fetchTicketClass(svc, classKey);
      expect(first.occurrence_count_30d).toBeGreaterThanOrEqual(3);
      expect(first.status).toBe("structural_fix_queued");
      expect(first.structural_ticket_id).toBeTruthy();
      expect(first.baseline_rate_30d).toBeGreaterThan(0);
      createdTicketIds.add(first.structural_ticket_id as string);

      const { error: secondRollupError } = await svc.rpc("rollup_ticket_classes");
      expect(secondRollupError).toBeNull();
      const { data: afterSecond } = await svc
        .from("tickets")
        .select("id, context")
        .eq("type", "task")
        .eq("source", "internal")
        .eq("context->>ticket_class_key", classKey);
      expect(afterSecond ?? []).toHaveLength(1);
      expect((afterSecond?.[0]?.context as Record<string, unknown> | undefined)?.recurrence_action).toBe(
        "tier2_digest_queued",
      );
      expect((afterSecond?.[0]?.context as Record<string, unknown> | undefined)?.recurrence_action).not.toBe(
        "tier2_auto_fix_queued",
      );
    });

    it("preserves baseline and measures post-fix rate after landing", async () => {
      if (!rpcAvailable) return;

      const root = `phase22-lifecycle-${RUN_ID}`;
      const classKey = `source:nightly_qa:error:phase22recurringerror:fingerprint:nightly_qa:${root}`;
      classKeys.add(classKey);

      const { data, error } = await svc
        .from("tickets")
        .insert([
          resolvedTicket("nightly_qa", `${root}:44444444`),
          resolvedTicket("nightly_qa", `${root}:55555555`),
          resolvedTicket("nightly_qa", `${root}:66666666`),
        ])
        .select("id");
      expect(error).toBeNull();
      for (const row of data ?? []) createdTicketIds.add(row.id);

      const { error: firstRollupError } = await svc.rpc("rollup_ticket_classes");
      expect(firstRollupError).toBeNull();
      const queued = await fetchTicketClass(svc, classKey);
      expect(queued.structural_ticket_id).toBeTruthy();
      expect(queued.baseline_rate_30d).toBeGreaterThan(0);
      expect(queued.post_fix_rate_30d).toBeNull();
      createdTicketIds.add(queued.structural_ticket_id as string);
      const baseline = queued.baseline_rate_30d;

      const { data: taskBefore } = await svc
        .from("tickets")
        .select("id, context")
        .eq("id", queued.structural_ticket_id)
        .single();
      const task = taskBefore as TicketRow | null;
      const { error: landError } = await svc
        .from("tickets")
        .update({
          status: "resolved",
          context: {
            ...(task?.context ?? {}),
            deploy_signal: "verified-stable",
          },
        })
        .eq("id", queued.structural_ticket_id);
      expect(landError).toBeNull();

      const { error: landedRollupError } = await svc.rpc("rollup_ticket_classes");
      expect(landedRollupError).toBeNull();
      const landed = await fetchTicketClass(svc, classKey);
      expect(landed.structural_fix_landed_at).toBeTruthy();
      expect(landed.baseline_rate_30d).toBe(baseline);
      expect(landed.post_fix_rate_30d).toBeLessThan(baseline ?? 0);
      expect(["landed", "killed"]).toContain(landed.status);

      const { error: rerollupError } = await svc.rpc("rollup_ticket_classes");
      expect(rerollupError).toBeNull();
      const rerolled = await fetchTicketClass(svc, classKey);
      expect(rerolled.baseline_rate_30d).toBe(baseline);
      expect(rerolled.post_fix_rate_30d).toBeLessThan(baseline ?? 0);
      expect(["landed", "killed"]).toContain(rerolled.status);
    });
  },
);
