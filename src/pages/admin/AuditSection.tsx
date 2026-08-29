/**
 * Admin Center Audit section (16-03 / ADMC-06) — a MERGED actor/action/target
 * trail over `admin_audit_log` (privileged user actions) + `ticket_events`
 * (ticket lifecycle). See admin-audit.service.ts for the merge.
 *
 * Every row is rendered as a plain-English sentence ("Moved status from New →
 * Resolved"), NOT raw metadata JSON. The humanizer below maps the real action
 * vocabulary (verified against the live tables) to readable summaries.
 */
import React, { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";
import { RiHistoryLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";
import { useAuditLogs, useAuditActions } from "@/hooks/useAuditLogs";
import type { AuditLog } from "@/services/admin-audit.service";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ------------------------------------------------------------------ */
/* Humanizers — turn action + metadata into a plain sentence           */
/* ------------------------------------------------------------------ */

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/** "in_progress" -> "In progress", "ADMIN" -> "Admin". */
function pretty(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "—";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** A readable label for the action filter dropdown. */
function actionLabel(action: string): string {
  const map: Record<string, string> = {
    ticket_created: "Ticket opened",
    ticket_status_change: "Ticket status changed",
    ticket_run_started: "Autopilot started a fix",
    ticket_run_completed: "Autopilot finished a fix",
    update_ticket_status: "Ticket status changed (admin)",
    manage_user_change_role: "Role changed",
    manage_user_revoke_access: "Access revoked",
    manage_user_restore_access: "Access restored",
    manage_user_reset_password: "Password reset sent",
  };
  if (map[action]) return map[action];
  // Legacy freeform actions are already sentences.
  if (action.includes(" ")) return action;
  return action.replace(/^ticket_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** The plain-English summary of what happened in this row. */
function describeAction(log: AuditLog): string {
  const m = log.metadata ?? {};
  switch (log.action) {
    case "ticket_created":
      return "Opened the ticket";
    case "ticket_status_change":
      return `Moved status from ${pretty(m.old_value)} → ${pretty(m.new_value)}`;
    case "ticket_run_started":
      return "Autopilot started working a fix";
    case "ticket_run_completed":
      return "Autopilot finished the fix";
    case "update_ticket_status":
      return `Changed ticket status from ${pretty(m.previous_status)} → ${pretty(m.new_status)}`;
    case "manage_user_change_role":
      return `Changed role to ${typeof m.new_role === "string" ? m.new_role : "—"}`;
    case "manage_user_revoke_access":
      return "Revoked this user's access";
    case "manage_user_restore_access":
      return "Restored this user's access";
    case "manage_user_reset_password":
      return "Sent a password reset";
    default:
      // Legacy freeform actions ("Changed user role to ADMIN") are already
      // human sentences — show them verbatim; machine-ish ones get tidied.
      return log.action.includes(" ") ? log.action : actionLabel(log.action);
  }
}

/** An optional mono detail to append (branch name, ticket/user ref). */
function actionDetail(log: AuditLog): string | null {
  const m = log.metadata ?? {};
  if (log.action === "ticket_run_started" && typeof m.new_value === "string") {
    return m.new_value;
  }
  if (log.target_type === "ticket" && log.target_id) return `#${log.target_id.slice(0, 8)}`;
  if (log.target_type === "user" && log.target_id) return shortId(log.target_id);
  return null;
}

function sourceBadge(source: AuditLog["source"]) {
  if (source === "ticket_events") {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-[10px]">
        Ticket
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange text-[10px]">
      Admin
    </Badge>
  );
}

function relTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function absTime(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, yyyy 'at' HH:mm");
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/* Section                                                              */
/* ------------------------------------------------------------------ */

export default function AuditSection() {
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();
  const { data: logs, isLoading, error } = useAuditLogs(
    actionFilter !== "all" ? { action: actionFilter } : undefined,
  );
  const { data: actions } = useAuditActions();

  const filtered = (logs ?? []).filter((log) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      describeAction(log).toLowerCase().includes(q) ||
      (log.actor_email?.toLowerCase().includes(q) ?? false) ||
      (log.target_type?.toLowerCase().includes(q) ?? false) ||
      (log.target_id?.toLowerCase().includes(q) ?? false)
    );
  });
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
            Activity Log
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Everything that happened, in plain language — who did what, and when.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-52">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger aria-label="Filter by action">
                <SelectValue placeholder="All activity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activity</SelectItem>
                {(actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {actionLabel(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Input
              placeholder="Search who or what…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-destructive">
          Failed to load the activity log.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
            <RiHistoryLine className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nothing here yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Admin and ticket activity will show up here as it happens.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>What</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((log) => {
                const actor = log.actor_email ?? "Autopilot";
                const detail = actionDetail(log);
                const isTicketRow = log.target_type === "ticket" && !!log.target_id;
                const openLinkedTicket = () => {
                  if (!log.target_id) return;
                  openTicket(log.target_id);
                  navigate("/admin/tickets");
                };

                return (
                  <TableRow
                    key={log.id}
                    className={isTicketRow ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={isTicketRow ? openLinkedTicket : undefined}
                    role={isTicketRow ? "button" : undefined}
                    tabIndex={isTicketRow ? 0 : undefined}
                    onKeyDown={isTicketRow ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openLinkedTicket();
                      }
                    } : undefined}
                  >
                    <TableCell className="tabular-nums" title={absTime(log.created_at)}>
                      {relTime(log.created_at)}
                    </TableCell>
                    <TableCell className="font-semibold">{actor}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-foreground">{describeAction(log)}</span>
                        {detail && (
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {detail}
                          </code>
                        )}
                        {sourceBadge(log.source)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.target_type === "ticket" && log.target_id ? (
                        <code className="font-mono text-xs text-foreground">
                          #{log.target_id.slice(0, 8)}
                        </code>
                      ) : log.target_type === "user" && log.target_id ? (
                        <code className="font-mono text-xs text-foreground">
                          {shortId(log.target_id)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length > pageSize && (
            <PaginationControls
              page={page}
              pageSize={pageSize}
              totalCount={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
