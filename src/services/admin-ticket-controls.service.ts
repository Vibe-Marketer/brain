/**
 * Admin queue controls (14-02) — priority quick-set + URGENT toggle.
 *
 * Direct table UPDATE through the admin session: tickets.priority/urgent are
 * already admin+service-role-only (13-01 Part B verification — the only
 * UPDATE policy on tickets is admin-gated). No Edge Function needed.
 *
 * NOTE: deliberately a NEW file — tickets.service.ts / useTickets.ts are
 * owned by 15-03 and must not be touched by Phase 14 waves 1-2.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TicketQueueControlsPatch {
  priority?: number;
  urgent?: boolean;
}

export interface TicketQueueControlsRow {
  id: string;
  priority: number;
  urgent: boolean;
}

/**
 * Update a ticket's queue-control columns. Throws on error AND on a
 * zero-row result — RLS silently yields 0 rows for non-admin callers, and
 * that must surface as a failure, not a silent no-op.
 */
export async function updateTicketQueueControls(
  ticketId: string,
  patch: TicketQueueControlsPatch
): Promise<TicketQueueControlsRow> {
  const update: TicketQueueControlsPatch = {};
  if (patch.priority !== undefined) {
    update.priority = Math.trunc(patch.priority);
  }
  if (patch.urgent !== undefined) {
    update.urgent = patch.urgent;
  }
  if (Object.keys(update).length === 0) {
    throw new Error("Failed to update queue controls: empty patch");
  }

  const { data, error } = await supabase
    .from("tickets")
    .update(update)
    .eq("id", ticketId)
    .select("id, priority, urgent");

  if (error) {
    throw new Error(`Failed to update queue controls: ${error.message}`);
  }
  const row = (data ?? [])[0];
  if (!row) {
    // RLS-blocked (non-admin) or missing ticket — both are failures.
    throw new Error("Failed to update queue controls");
  }
  return row as TicketQueueControlsRow;
}

/** Outcomes that mean the daemon already determined it can't fix this without a
 * human changing the ticket first. Re-forcing these into the urgent lane just
 * makes the daemon fail the same way again, on a loop, starving the real queue. */
const UNFIXABLE_OUTCOME_PREFIXES = ["skipped:known-unfixable", "needs-human:"];

/**
 * "Work now" — force a ticket to the very front of the autopilot's queue and
 * clear anything holding it back. The claimer (autopilot/src/lib/claim.ts
 * selectNextTicket) only claims status='new' with attempts under the cap and no
 * future next_attempt_at, ordered urgent DESC, priority DESC. So we set:
 *   status='new', next_attempt_at=null  → eligible immediately
 *   urgent=true, priority=3             → head of the queue
 * The urgent/human lane also bypasses the budget cap and quiet hours, so this is
 * the strongest pull a browser can make. The daemon claims it on its next poll
 * (~5 min) — the browser can't kickstart launchd directly.
 *
 * `attempts` is deliberately left untouched (not reset to 0): resetting it let
 * this button force an infinite retry loop on tickets the daemon had already
 * flagged unfixable, because it also cleared the attempt-cap backoff every
 * time. See 2026-07-29 incident — ticket c0396dc0 got reclaimed 3x in 13h.
 */
export async function workTicketNow(ticketId: string): Promise<TicketQueueControlsRow> {
  const { data: lastRun } = await supabase
    .from("runner_runs")
    .select("outcome")
    .eq("ticket_id", ticketId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    lastRun?.outcome &&
    UNFIXABLE_OUTCOME_PREFIXES.some((prefix) => lastRun.outcome!.startsWith(prefix))
  ) {
    throw new Error(
      `Autopilot already flagged this ticket as unfixable (${lastRun.outcome}). ` +
        `Forcing a requeue won't change the outcome — change or clarify the ticket first, or close it.`
    );
  }

  const { data, error } = await supabase
    .from("tickets")
    .update({
      status: "new",
      next_attempt_at: null,
      urgent: true,
      priority: 3,
    })
    .eq("id", ticketId)
    .select("id, priority, urgent");

  if (error) {
    throw new Error(`Failed to queue ticket: ${error.message}`);
  }
  const row = (data ?? [])[0];
  if (!row) {
    throw new Error("Failed to queue ticket");
  }
  return row as TicketQueueControlsRow;
}
