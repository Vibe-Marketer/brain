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
