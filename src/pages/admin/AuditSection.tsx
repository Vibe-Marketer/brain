/**
 * Admin Center Audit section (16-03 / ADMC-06) — ported from
 * worktree-admin-center, rebound to a MERGED actor/action/target trail over
 * `admin_audit_log` (privileged user actions) + `ticket_events` (ticket
 * lifecycle). See admin-audit.service.ts for the merge.
 *
 * Action filter spans both sources; metadata is collapsible per row.
 */
import React, { useState } from "react";
import { RiHistoryLine } from "@remixicon/react";
import { useAuditLogs, useAuditActions } from "@/hooks/useAuditLogs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function sourceBadge(source: "admin_audit_log" | "ticket_events") {
  if (source === "ticket_events") {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground text-[10px]">
        ticket
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange text-[10px]">
      admin
    </Badge>
  );
}

export default function AuditSection() {
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data: logs, isLoading, error } = useAuditLogs(
    actionFilter !== "all" ? { action: actionFilter } : undefined,
  );
  const { data: actions } = useAuditActions();

  const filtered = (logs ?? []).filter((log) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      log.action.toLowerCase().includes(q) ||
      (log.actor_email?.toLowerCase().includes(q) ?? false) ||
      (log.target_type?.toLowerCase().includes(q) ?? false) ||
      (log.target_id?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
          Audit Log
        </h2>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger aria-label="Filter by action">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {(actions ?? []).map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-64">
            <Input
              placeholder="Search actor, action, target…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-sm text-destructive">
          Failed to load audit log.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 mb-4">
            <RiHistoryLine className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No audit entries</p>
          <p className="text-xs text-muted-foreground mt-1">
            Admin and ticket actions will appear here as they happen.
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-muted/50 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{sourceBadge(log.source)}</td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <span className="block truncate text-foreground">
                      {log.actor_email ?? shortId(log.actor_user_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {log.target_type ? (
                      <>
                        {log.target_type}{" "}
                        <code className="text-xs">{shortId(log.target_id)}</code>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    {log.metadata && Object.keys(log.metadata).length > 0 ? (
                      <details>
                        <summary className="text-xs text-muted-foreground cursor-pointer select-none truncate">
                          {JSON.stringify(log.metadata).slice(0, 60)}
                          {JSON.stringify(log.metadata).length > 60 ? "…" : ""}
                        </summary>
                        <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-48 mt-1">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
