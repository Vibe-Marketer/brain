/**
 * Admin Center dashboard service (16-01).
 *
 * Ported from worktree-admin-center and rebound to the LIVE schema:
 * - tickets / ticket lifecycle enums (Phase 11) instead of dead support_tickets
 * - runner_state read is graceful — the table ships with Phase 13, so until
 *   then the runner card reports "not deployed yet" instead of erroring
 * - deployed-SHA card compares the running bundle's commit against main HEAD
 *   via the public GitHub API (best-effort; degrades to "unavailable")
 *
 * Every value rendered from this service is a real measurement or a real
 * count — no hardcoded "Healthy" badges.
 */
import { supabase } from "@/integrations/supabase/client";
import { getAppVersion, getCommit } from "@/services/support-ticket.service";
import type {
  TicketSource,
  TicketRow,
  TicketStatus,
} from "@/services/tickets.service";
import type { Database } from "@/types/supabase";

/* ------------------------------------------------------------------ */
/* Needs You queue                                                      */
/* ------------------------------------------------------------------ */

export type NeedsYouKind = "awaiting_approval" | "escalated" | "critical_aging";

export interface NeedsYouItem {
  kind: NeedsYouKind;
  ticket: TicketRow;
}

/** Statuses that count as "still active" for the critical-aging check. */
const ACTIVE_STATUSES: TicketStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "awaiting_user",
];

/**
 * Pure helper: tag tickets that are waiting on an operator decision.
 * - awaiting_approval: the pipeline (or an admin) parked the ticket on Andrew
 * - escalated: explicitly escalated for operator attention
 * - critical_aging: a critical ticket has sat in an active status for >24h
 * A ticket gets at most one tag, in the priority order above.
 */
export function tagNeedsYou(
  tickets: TicketRow[],
  now: Date = new Date()
): NeedsYouItem[] {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;

  const items: NeedsYouItem[] = [];
  for (const ticket of tickets) {
    if (ticket.status === "awaiting_approval") {
      items.push({ kind: "awaiting_approval", ticket });
    } else if (ticket.status === "escalated") {
      items.push({ kind: "escalated", ticket });
    } else if (
      ticket.severity === "critical" &&
      ACTIVE_STATUSES.includes(ticket.status) &&
      new Date(ticket.created_at).getTime() < dayAgo
    ) {
      items.push({ kind: "critical_aging", ticket });
    }
  }
  return items;
}

/**
 * The Needs-You queue: only items awaiting an operator decision.
 * One candidate query, tagged client-side.
 */
export async function needsYouQueue(): Promise<NeedsYouItem[]> {
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .in("status", [
      "awaiting_approval",
      "escalated",
      "new",
      "triaged",
      "in_progress",
      "awaiting_user",
    ])
    .order("created_at", { ascending: false });

  if (error) throw error;

  return tagNeedsYou((data ?? []) as TicketRow[]);
}

/* ------------------------------------------------------------------ */
/* Runner heartbeat (runner_state ships with Phase 13)                  */
/* ------------------------------------------------------------------ */

export type RunnerStatus = "idle" | "claiming" | "running" | "awaiting_gate";

/** Typed shape of the single runner_state row (13-01 migration 20260611200000). */
export interface RunnerState {
  status: RunnerStatus;
  current_ticket_id: string | null;
  run_started_at: string | null;
  last_heartbeat: string | null;
  last_result: string | null;
  kill_switch: boolean;
}

/**
 * Heartbeat staleness threshold: 3× the runner's 300s poll cadence
 * (autopilot.config). Past this, the card shows "RUNNER OFFLINE".
 */
export const RUNNER_STALE_MS = 900_000;

/**
 * Pure helper: a runner with no heartbeat on record, or one older than
 * staleMs, is offline. Exported for boundary tests.
 */
export function isRunnerOffline(
  lastHeartbeat: string | null,
  nowMs: number = Date.now(),
  staleMs: number = RUNNER_STALE_MS
): boolean {
  if (!lastHeartbeat) return true;
  const ts = new Date(lastHeartbeat).getTime();
  if (Number.isNaN(ts)) return true;
  return nowMs - ts > staleMs;
}

/**
 * Typed read of the runner_state singleton (id=1). Returns null when the
 * table is unreachable (relation missing / schema-cache miss) so the card
 * can keep rendering "not deployed yet" — order-tolerant by design.
 */
export async function getRunnerState(): Promise<RunnerState | null> {
  try {
    const { data, error } = await supabase
      .from("runner_state")
      .select(
        "status, current_ticket_id, run_started_at, last_heartbeat, last_result, kill_switch"
      )
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) return null;
    return data as RunnerState;
  } catch {
    return null;
  }
}

/**
 * Flip the kill switch. The 13-01 runner_state_kill_switch_guard trigger
 * guarantees kill_switch is the ONLY column an authenticated (admin) session
 * can change — any other column write is rejected server-side.
 */
export async function setKillSwitch(value: boolean): Promise<void> {
  const { error } = await supabase
    .from("runner_state")
    .update({ kill_switch: value })
    .eq("id", 1);
  if (error) {
    throw new Error(`Failed to update kill switch: ${error.message}`);
  }
}

export interface RunnerCard {
  /** false → runner_state table does not exist yet ("runner not deployed yet"). */
  available: boolean;
  /** Minutes since the runner's most recent heartbeat; null when unknown. */
  heartbeatAgeMinutes: number | null;
  /** Raw runner status/state string when the table exposes one. */
  state: string | null;
}

export async function fetchRunnerCard(): Promise<RunnerCard> {
  const state = await getRunnerState();
  if (!state) {
    return { available: false, heartbeatAgeMinutes: null, state: null };
  }
  const heartbeatAgeMinutes = state.last_heartbeat
    ? Math.max(
        Math.round((Date.now() - new Date(state.last_heartbeat).getTime()) / 60000),
        0
      )
    : null;
  return { available: true, heartbeatAgeMinutes, state: state.status };
}

/* ------------------------------------------------------------------ */
/* Runner run ledger (17-02)                                            */
/* ------------------------------------------------------------------ */

export type RunnerRun = Database["public"]["Tables"]["runner_runs"]["Row"];

const RUNNER_RUN_COLUMNS =
  "id, ticket_id, status, outcome, gate_verdict, gate_stage, duration_sec, est_cost, branch, fix_sha, diff_stat, test_cmd, test_exit, detail, started_at, finished_at, tickets_processed";

export async function fetchRunnerRuns(limit = 10): Promise<RunnerRun[]> {
  const { data, error } = await supabase
    .from("runner_runs")
    .select(RUNNER_RUN_COLUMNS)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RunnerRun[];
}

export async function fetchRunnerRunsForTicket(ticketId: string): Promise<RunnerRun[]> {
  const { data, error } = await supabase
    .from("runner_runs")
    .select(RUNNER_RUN_COLUMNS)
    .eq("ticket_id", ticketId)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RunnerRun[];
}

/* ------------------------------------------------------------------ */
/* Deployed-SHA card                                                    */
/* ------------------------------------------------------------------ */

export interface DeployInfo {
  /** Commit baked into the running bundle (VITE_COMMIT_SHA / VITE_VERCEL_GIT_COMMIT_SHA). */
  deployedSha: string | null;
}

/**
 * The deployed SHA is baked into the bundle at build time, so it is the only
 * honest, CSP-clean source the browser can show. We deliberately do NOT fetch
 * GitHub's main HEAD from the client: `connect-src` blocks api.github.com and a
 * browser-side repo call leaks the repo path. "Behind by N commits" is a CI/Vercel
 * concern, not a dashboard one — surface it there if ever needed.
 */
export async function fetchDeployInfo(): Promise<DeployInfo> {
  return { deployedSha: getCommit() ?? null };
}

/* ------------------------------------------------------------------ */
/* Dashboard stats                                                      */
/* ------------------------------------------------------------------ */

type TicketSourceMetricsRpcRow =
  Database["public"]["Functions"]["ticket_source_metrics"]["Returns"][number];
type AutopilotTrustMetricsRpcRow =
  Database["public"]["Functions"]["autopilot_trust_metrics"]["Returns"][number];

export interface TicketSourceMetrics {
  source: TicketSource;
  volume: number;
  resolved: number;
  fixRate: number;
  averageCycleTimeHours: number | null;
}

export type AutopilotTrustRung = "manual" | "eligible" | "auto";

export interface AutopilotTrustMetric {
  category: string;
  rung: AutopilotTrustRung;
  completedFixes: number;
  survivedFixes: number;
  reopenedFixes: number;
  deferredRuns: number;
  survivalRate: number;
  eligible: boolean;
  canaryDueCount: number;
  canaryFailedCount: number;
  threshold: number;
  minFixes: number;
}

export interface AutopilotTrustMutationInput {
  category: string;
  reason?: string;
}

interface AutopilotTrustAdminResponse {
  success?: boolean;
  error?: string;
  category?: string;
  action?: "promote_auto" | "demote_manual" | "reset_eligible";
  old_rung?: AutopilotTrustRung;
  new_rung?: AutopilotTrustRung;
}

export interface AdminDashboardStats {
  usersByRole: { ADMIN: number; TEAM: number; PRO: number; FREE: number };
  totalUsers: number;
  ticketsByStatus: Record<TicketStatus, number>;
  totalTickets: number;
  ticketsLast7d: number;
  sourceMetrics: TicketSourceMetrics[];
  trustMetrics: AutopilotTrustMetric[];
  runner: RunnerCard;
  deploy: DeployInfo;
  health: {
    /** Measured round-trip of a trivial SELECT, in milliseconds. */
    db: number;
    appVersion: string;
  };
}

function numberOrZero(value: number | string | null): number {
  if (value === null) return 0;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function emptyStatusCounts(): Record<TicketStatus, number> {
  return {
    new: 0,
    triaged: 0,
    in_progress: 0,
    awaiting_approval: 0,
    awaiting_user: 0,
    resolved: 0,
    rejected: 0,
    escalated: 0,
  };
}

function mapTicketSourceMetricsRow(row: TicketSourceMetricsRpcRow): TicketSourceMetrics {
  return {
    source: row.source,
    volume: row.volume,
    resolved: row.resolved,
    fixRate: row.fix_rate,
    averageCycleTimeHours: row.avg_cycle_time_hours,
  };
}

function mapAutopilotTrustMetricsRow(
  row: AutopilotTrustMetricsRpcRow
): AutopilotTrustMetric {
  return {
    category: row.category,
    rung: row.rung as AutopilotTrustRung,
    completedFixes: numberOrZero(row.completed_fixes),
    survivedFixes: numberOrZero(row.survived_fixes),
    reopenedFixes: numberOrZero(row.reopened_fixes),
    deferredRuns: numberOrZero(row.deferred_runs),
    survivalRate: numberOrZero(row.survival_rate),
    eligible: Boolean(row.eligible),
    canaryDueCount: numberOrZero(row.canary_due_count),
    canaryFailedCount: numberOrZero(row.canary_failed_count),
    threshold: numberOrZero(row.threshold),
    minFixes: numberOrZero(row.min_fixes),
  };
}

export async function getTicketSourceMetrics(): Promise<TicketSourceMetrics[]> {
  const { data, error } = await supabase.rpc("ticket_source_metrics");

  if (error) {
    throw new Error(`Failed to fetch ticket source metrics: ${error.message}`);
  }

  return ((data ?? []) as TicketSourceMetricsRpcRow[]).map(mapTicketSourceMetricsRow);
}

export async function getAutopilotTrustMetrics(): Promise<AutopilotTrustMetric[]> {
  const { data, error } = await supabase.rpc("autopilot_trust_metrics");

  if (error) {
    throw new Error(`Failed to fetch autopilot trust metrics: ${error.message}`);
  }

  return ((data ?? []) as AutopilotTrustMetricsRpcRow[]).map(
    mapAutopilotTrustMetricsRow
  );
}

export function formatTicketSourceFixRate(fixRate: number): string {
  return `${Math.round(fixRate * 100)}%`;
}

export function formatTicketSourceCycleTime(hours: number | null): string {
  if (!hours || hours <= 0) return "No cycle time yet";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export function formatSurvivalRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

async function mutateAutopilotCategory(
  action: "promote_auto" | "demote_manual",
  input: AutopilotTrustMutationInput
): Promise<AutopilotTrustAdminResponse> {
  const { data, error } = await supabase.functions.invoke<AutopilotTrustAdminResponse>(
    "autopilot-trust-admin",
    {
      body: {
        category: input.category,
        action,
        reason: input.reason,
      },
    }
  );

  if (error) {
    throw new Error(`Failed to update autopilot trust: ${error.message}`);
  }
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to update autopilot trust");
  }
  return data;
}

export async function promoteAutopilotCategory(
  input: AutopilotTrustMutationInput
): Promise<AutopilotTrustAdminResponse> {
  return mutateAutopilotCategory("promote_auto", input);
}

export async function demoteAutopilotCategory(
  input: AutopilotTrustMutationInput
): Promise<AutopilotTrustAdminResponse> {
  return mutateAutopilotCategory("demote_manual", input);
}

export async function fetchDashboardStats(): Promise<AdminDashboardStats> {
  // 1. Total users — also doubles as the trivial-SELECT round-trip measurement.
  const dbPingStart = Date.now();
  const { count: totalUsers, error: usersError } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });
  const dbRoundTripMs = Date.now() - dbPingStart;
  if (usersError) throw usersError;

  // 2. Role rows — keyed on auth user id. Users without a role row count as FREE.
  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (rolesError) throw rolesError;

  const usersByRole = { ADMIN: 0, TEAM: 0, PRO: 0, FREE: 0 };
  for (const row of roleRows ?? []) {
    if (row.role === "ADMIN") usersByRole.ADMIN += 1;
    else if (row.role === "TEAM") usersByRole.TEAM += 1;
    else if (row.role === "PRO") usersByRole.PRO += 1;
  }
  usersByRole.FREE = Math.max(
    (totalUsers ?? 0) - usersByRole.ADMIN - usersByRole.TEAM - usersByRole.PRO,
    0
  );

  // 3. Ticket status breakdown — one query, counted client-side (live tickets table).
  const { data: statusRows, error: statusError } = await supabase
    .from("tickets")
    .select("status");
  if (statusError) throw statusError;

  const ticketsByStatus = emptyStatusCounts();
  for (const row of (statusRows ?? []) as Array<{ status: TicketStatus }>) {
    if (row.status in ticketsByStatus) {
      ticketsByStatus[row.status] += 1;
    }
  }
  const totalTickets = (statusRows ?? []).length;

  // 4. Tickets created in the last 7 days.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: ticketsLast7d, error: recentError } = await supabase
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .gte("created_at", sevenDaysAgo);
  if (recentError) throw recentError;

  // 5. Source/trust metrics + runner heartbeat + deployed SHA.
  const [sourceMetrics, trustMetrics, runner, deploy] = await Promise.all([
    getTicketSourceMetrics(),
    getAutopilotTrustMetrics(),
    fetchRunnerCard(),
    fetchDeployInfo(),
  ]);

  return {
    usersByRole,
    totalUsers: totalUsers ?? 0,
    ticketsByStatus,
    totalTickets,
    ticketsLast7d: ticketsLast7d ?? 0,
    sourceMetrics,
    trustMetrics,
    runner,
    deploy,
    health: {
      db: dbRoundTripMs,
      appVersion: getAppVersion() ?? "dev",
    },
  };
}
