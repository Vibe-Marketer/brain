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
  TicketRow,
  TicketStatus,
} from "@/services/tickets.service";

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

export interface AdminDashboardStats {
  usersByRole: { ADMIN: number; TEAM: number; PRO: number; FREE: number };
  totalUsers: number;
  ticketsByStatus: Record<TicketStatus, number>;
  totalTickets: number;
  ticketsLast7d: number;
  runner: RunnerCard;
  deploy: DeployInfo;
  health: {
    /** Measured round-trip of a trivial SELECT, in milliseconds. */
    db: number;
    appVersion: string;
  };
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

  // 5. Runner heartbeat + deployed SHA (both degrade gracefully, never throw).
  const [runner, deploy] = await Promise.all([fetchRunnerCard(), fetchDeployInfo()]);

  return {
    usersByRole,
    totalUsers: totalUsers ?? 0,
    ticketsByStatus,
    totalTickets,
    ticketsLast7d: ticketsLast7d ?? 0,
    runner,
    deploy,
    health: {
      db: dbRoundTripMs,
      appVersion: getAppVersion() ?? "dev",
    },
  };
}
