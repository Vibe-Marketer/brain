/**
 * Self-audit service — the autopilot's honesty layer.
 *
 * The system spent weeks "looking busy" (closing crawler noise, flipping
 * switches) while shipping zero real fixes, with a dead Sentry pipe nobody
 * noticed. This computes plain-English, solution-shaped health signals about
 * whether the loop is ACTUALLY delivering value — and surfaces them so the
 * operator never again has to discover "it wasn't doing shit" by hand.
 *
 * Each signal follows the "surface solutions, not problems" law: a headline,
 * the measured detail, and a proposed action — never a raw metric dump.
 *
 * Pure compute (`computeSelfAudit`) is separated from the fetch so it is
 * unit-testable without a database.
 */
import { supabase } from "@/integrations/supabase/client";

export type SelfAuditStatus = "ok" | "warn" | "critical";

export interface SelfAuditSignal {
  key: string;
  status: SelfAuditStatus;
  /** One-line plain-English verdict. */
  headline: string;
  /** The measured evidence behind the verdict. */
  detail: string;
  /** What to do about it (omitted when status is ok). */
  action?: string;
  /** Compact metric for the badge (e.g. "0", "92%"). */
  metric: string;
}

export interface SelfAuditReport {
  /** Worst status across all signals — drives the overall banner. */
  overall: SelfAuditStatus;
  signals: SelfAuditSignal[];
  generatedAt: string;
}

/** Minimal shapes the compute needs — kept loose so callers can pass raw rows. */
export interface SelfAuditInputs {
  /** runner_runs rows from the last 7 days. */
  runs7d: { outcome: string | null; status: string | null }[];
  /** runner_runs rows from the last 24 hours. */
  runs24h: { outcome: string | null; status: string | null }[];
  /** tickets created in the last 7 days. */
  tickets7d: { source: string | null }[];
  /** Total count of source='sentry' tickets ever (distinguishes "never wired" from "quiet"). */
  sentryTicketsEver: number;
  /** runner_state singleton. */
  runner: { last_heartbeat: string | null; kill_switch: boolean | null } | null;
  /** "now" for deterministic testing. */
  now: Date;
}

/** A run counts as a shipped fix only when it actually merged. */
function isMerged(r: { status: string | null; outcome: string | null }): boolean {
  return r.status === "merged" || (r.outcome ?? "").startsWith("merged");
}

function isDeferred(r: { outcome: string | null }): boolean {
  return (r.outcome ?? "").startsWith("deferred");
}

/** Real user/production signal vs. self-generated crawler noise. */
const REAL_USER_SOURCES = new Set(["sentry", "in_app_user"]);
const CRAWLER_SOURCES = new Set(["nightly_qa"]);

const HEARTBEAT_STALE_MIN = 20;
const DEFER_WARN_RATIO = 0.6;

const worst = (a: SelfAuditStatus, b: SelfAuditStatus): SelfAuditStatus => {
  const rank: Record<SelfAuditStatus, number> = { ok: 0, warn: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
};

/**
 * Pure: turn raw measurements into honesty signals. No I/O.
 */
export function computeSelfAudit(input: SelfAuditInputs): SelfAuditReport {
  const signals: SelfAuditSignal[] = [];

  // 1. Real fixes shipped — the single number that proves the loop works.
  const merged = input.runs7d.filter(isMerged).length;
  const totalRuns = input.runs7d.length;
  if (merged === 0 && totalRuns > 0) {
    signals.push({
      key: "fixes_shipped",
      status: "critical",
      metric: "0",
      headline: "0 real fixes shipped in the last 7 days",
      detail: `The loop ran ${totalRuns} time${totalRuns === 1 ? "" : "s"} but merged nothing — it's closing or deferring tickets, not fixing them.`,
      action: "Confirm the queue holds real bugs (not crawler noise) and that the fix provider isn't rate-limited.",
    });
  } else if (merged === 0) {
    signals.push({
      key: "fixes_shipped",
      status: "warn",
      metric: "0",
      headline: "No fixes shipped, and the loop hasn't run",
      detail: "Zero merged fixes in 7 days and zero runs — the loop is idle.",
      action: "Check that autopilot is armed and tickets exist to work.",
    });
  } else {
    signals.push({
      key: "fixes_shipped",
      status: "ok",
      metric: String(merged),
      headline: `${merged} real fix${merged === 1 ? "" : "es"} shipped in 7 days`,
      detail: "The loop is closing the full claim → fix → merge cycle.",
    });
  }

  // 2. Sentry pipe — are real production errors reaching the queue at all?
  if (input.sentryTicketsEver === 0) {
    signals.push({
      key: "sentry_pipe",
      status: "critical",
      metric: "0",
      headline: "Sentry has never delivered a single error",
      detail: "0 production errors have ever been ingested. The webhook or alert rule is almost certainly disconnected — real user errors are invisible to the loop.",
      action: "Verify the Sentry alert rule fires and the integration webhook URL + secret are correct.",
    });
  } else {
    const sentry7d = input.tickets7d.filter((t) => t.source === "sentry").length;
    signals.push({
      key: "sentry_pipe",
      status: "ok",
      metric: String(sentry7d),
      headline:
        sentry7d > 0
          ? `${sentry7d} production error${sentry7d === 1 ? "" : "s"} ingested from Sentry this week`
          : "Sentry pipe is live (no new errors this week)",
      detail: "Real production errors flow into the queue.",
    });
  }

  // 3. Queue signal — is the loop chewing on real problems or its own crawl noise?
  const created = input.tickets7d.length;
  const realUser = input.tickets7d.filter((t) => REAL_USER_SOURCES.has(t.source ?? "")).length;
  const crawler = input.tickets7d.filter((t) => CRAWLER_SOURCES.has(t.source ?? "")).length;
  if (created > 0 && realUser === 0) {
    const pct = Math.round((crawler / created) * 100);
    signals.push({
      key: "queue_signal",
      status: "warn",
      metric: `${pct}%`,
      headline: "Queue is all noise, zero real-user signal",
      detail: `Of ${created} ticket${created === 1 ? "" : "s"} filed this week, ${crawler} are QA-crawler artifacts and 0 are real user/production reports.`,
      action: "Re-aim QA at real user journeys (signup, connect, import, export) and connect Sentry so real bugs lead the queue.",
    });
  } else if (created > 0) {
    signals.push({
      key: "queue_signal",
      status: "ok",
      metric: `${realUser}`,
      headline: `${realUser} real-user/production ticket${realUser === 1 ? "" : "s"} this week`,
      detail: "The queue carries genuine user and production signal.",
    });
  }

  // 4. Loop liveness — is the daemon actually alive?
  const armed = input.runner ? input.runner.kill_switch !== true : false;
  if (!input.runner) {
    signals.push({
      key: "loop_liveness",
      status: "warn",
      metric: "—",
      headline: "Autopilot state is unreadable",
      detail: "No runner_state row — the loop may have never been deployed here.",
      action: "Confirm the autopilot daemon is installed and writing heartbeats.",
    });
  } else if (!armed) {
    signals.push({
      key: "loop_liveness",
      status: "ok",
      metric: "paused",
      headline: "Autopilot is intentionally paused",
      detail: "Kill switch is on — the loop is off by choice, not failure.",
    });
  } else {
    const hb = input.runner.last_heartbeat ? new Date(input.runner.last_heartbeat).getTime() : 0;
    const ageMin = hb ? Math.round((input.now.getTime() - hb) / 60000) : Infinity;
    if (ageMin > HEARTBEAT_STALE_MIN) {
      signals.push({
        key: "loop_liveness",
        status: "critical",
        metric: Number.isFinite(ageMin) ? `${ageMin}m` : "never",
        headline: "Autopilot is armed but not breathing",
        detail: Number.isFinite(ageMin)
          ? `Last heartbeat was ${ageMin} min ago (threshold ${HEARTBEAT_STALE_MIN} min). The daemon may be dead or hung.`
          : "No heartbeat has ever been recorded while armed.",
        action: "Restart the autopilot daemon and check its launchd job.",
      });
    } else {
      signals.push({
        key: "loop_liveness",
        status: "ok",
        metric: `${ageMin}m`,
        headline: "Autopilot is armed and alive",
        detail: `Last heartbeat ${ageMin} min ago.`,
      });
    }
  }

  // 5. Work ratio — when it runs, is it actually working or just deferring?
  const n24 = input.runs24h.length;
  if (n24 > 0) {
    const deferred = input.runs24h.filter(isDeferred).length;
    const ratio = deferred / n24;
    if (ratio >= DEFER_WARN_RATIO) {
      signals.push({
        key: "work_ratio",
        status: "warn",
        metric: `${Math.round(ratio * 100)}%`,
        headline: "Most runs are deferring, not working",
        detail: `${deferred} of ${n24} runs in the last 24h deferred (usually rate limits) instead of doing work.`,
        action: "Check provider rate limits / fallback; throughput is throttled.",
      });
    }
  }

  const overall = signals.reduce<SelfAuditStatus>((acc, s) => worst(acc, s.status), "ok");
  return { overall, signals, generatedAt: input.now.toISOString() };
}

/**
 * Fetch the live measurements and compute the self-audit report.
 */
export async function getSelfAudit(): Promise<SelfAuditReport> {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [runs7dRes, runs24hRes, tickets7dRes, sentryEverRes, runnerRes] = await Promise.all([
    supabase.from("runner_runs").select("outcome,status").gte("started_at", since7d),
    supabase.from("runner_runs").select("outcome,status").gte("started_at", since24h),
    supabase.from("tickets").select("source").gte("created_at", since7d),
    supabase.from("tickets").select("id", { count: "exact", head: true }).eq("source", "sentry"),
    supabase.from("runner_state").select("last_heartbeat,kill_switch").eq("id", 1).maybeSingle(),
  ]);

  return computeSelfAudit({
    runs7d: (runs7dRes.data ?? []) as SelfAuditInputs["runs7d"],
    runs24h: (runs24hRes.data ?? []) as SelfAuditInputs["runs24h"],
    tickets7d: (tickets7dRes.data ?? []) as SelfAuditInputs["tickets7d"],
    sentryTicketsEver: sentryEverRes.count ?? 0,
    runner: (runnerRes.data ?? null) as SelfAuditInputs["runner"],
    now,
  });
}
