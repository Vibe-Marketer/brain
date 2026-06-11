import { supabase } from "@/integrations/supabase/client";

/**
 * Merged admin audit trail (16-03 / ADMC-06).
 *
 * Ported from worktree-admin-center, rebound to a MERGED actor/action/target
 * trail over two live append-only sources:
 *   - `admin_audit_log` (16-02): privileged user actions (role change, password
 *     reset, revoke/restore) — actor_user_id / action / target_type / target_id
 *     / metadata.
 *   - `ticket_events` (11-03): ticket lifecycle (created, status_change) —
 *     actor_id / event_type / old_value / new_value, scoped to a ticket.
 *
 * Both are normalized into one `AuditLog` shape so the Admin Center Audit
 * section renders a single chronological trail with an action filter. Each
 * source enforces its own RLS (admin SELECT) — this read works only for admins.
 */
export interface AuditLog {
  /** Stable per-row id, namespaced by source so merged keys never collide. */
  id: string;
  /** Where the row came from. */
  source: "admin_audit_log" | "ticket_events";
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  /** Resolved client-side from user_profiles for display. */
  actor_email: string | null;
}

export interface AuditLogFilters {
  action?: string;
}

interface AdminAuditRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface TicketEventRow {
  id: string;
  ticket_id: string;
  actor_id: string | null;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

/** Normalize an admin_audit_log row into the unified shape. */
function fromAdminAudit(r: AdminAuditRow): Omit<AuditLog, "actor_email"> {
  return {
    id: `aal:${r.id}`,
    source: "admin_audit_log",
    actor_user_id: r.actor_user_id,
    action: r.action,
    target_type: r.target_type,
    target_id: r.target_id,
    metadata: r.metadata,
    created_at: r.created_at,
  };
}

/** Normalize a ticket_events row into the unified shape. */
function fromTicketEvent(r: TicketEventRow): Omit<AuditLog, "actor_email"> {
  // Prefix the action so a merged "all actions" list distinguishes ticket
  // lifecycle events from privileged admin actions.
  const action = `ticket_${r.event_type}`;
  const metadata: Record<string, unknown> = {};
  if (r.old_value !== null) metadata.old_value = r.old_value;
  if (r.new_value !== null) metadata.new_value = r.new_value;
  return {
    id: `te:${r.id}`,
    source: "ticket_events",
    actor_user_id: r.actor_id,
    action,
    target_type: "ticket",
    target_id: r.ticket_id,
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
    created_at: r.created_at,
  };
}

export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  // Pull both sources in parallel (each admin-gated by its own RLS).
  const [adminRes, ticketRes] = await Promise.all([
    supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("ticket_events")
      .select("id, ticket_id, actor_id, event_type, old_value, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (adminRes.error) throw adminRes.error;
  if (ticketRes.error) throw ticketRes.error;

  const merged: Array<Omit<AuditLog, "actor_email">> = [
    ...((adminRes.data ?? []) as AdminAuditRow[]).map(fromAdminAudit),
    ...((ticketRes.data ?? []) as TicketEventRow[]).map(fromTicketEvent),
  ];

  // Action filter applies across both sources.
  const filtered = filters.action
    ? merged.filter((r) => r.action === filters.action)
    : merged;

  // Single chronological trail, newest first.
  filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // Cap the merged view so a busy ticket stream can't bury admin actions.
  const capped = filtered.slice(0, 200);

  // Resolve actor emails so the trail shows who did it.
  const actorIds = [
    ...new Set(capped.map((r) => r.actor_user_id).filter((id): id is string => !!id)),
  ];

  const emailMap = new Map<string, string | null>();
  if (actorIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("user_profiles")
      .select("user_id, email")
      .in("user_id", actorIds);

    if (profilesError) throw profilesError;

    for (const p of profiles ?? []) {
      emailMap.set(p.user_id, p.email);
    }
  }

  return capped.map((r) => ({
    ...r,
    actor_email: r.actor_user_id ? emailMap.get(r.actor_user_id) ?? null : null,
  }));
}

/** Distinct action names across both sources for the audit filter dropdown. */
export async function fetchAuditActions(): Promise<string[]> {
  const [adminRes, ticketRes] = await Promise.all([
    supabase
      .from("admin_audit_log")
      .select("action")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("ticket_events")
      .select("event_type")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (adminRes.error) throw adminRes.error;
  if (ticketRes.error) throw ticketRes.error;

  const actions = new Set<string>();
  for (const row of (adminRes.data ?? []) as Array<{ action: string }>) {
    if (row.action) actions.add(row.action);
  }
  for (const row of (ticketRes.data ?? []) as Array<{ event_type: string }>) {
    if (row.event_type) actions.add(`ticket_${row.event_type}`);
  }
  return [...actions].sort();
}
