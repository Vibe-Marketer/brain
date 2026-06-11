import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useAdminDashboard, useNeedsYou } from "@/hooks/useAdminDashboard";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ticketTypeMeta, ticketSeverityBadge } from "@/lib/ticket-display";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
  RiEyeLine,
  RiTimeLine,
} from "@remixicon/react";
import type { NeedsYouKind } from "@/services/admin-dashboard.service";

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                  */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
      {children}
    </h3>
  );
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

function shortSha(sha: string | null): string {
  return sha ? sha.slice(0, 7) : "unknown";
}

const NEEDS_YOU_META: Record<
  NeedsYouKind,
  { label: string; className: string; Icon: typeof RiEyeLine }
> = {
  awaiting_approval: {
    label: "awaiting-approval",
    className: "border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange",
    Icon: RiEyeLine,
  },
  escalated: {
    label: "escalated",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: RiAlarmWarningLine,
  },
  critical_aging: {
    label: "critical-aging",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: RiTimeLine,
  },
};

/* ------------------------------------------------------------------ */
/* Needs You                                                            */
/* ------------------------------------------------------------------ */

function NeedsYouCard() {
  const { data: items, isLoading } = useNeedsYou();
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Needs You</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <RiCheckboxCircleLine className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Nothing needs you. Close the tab.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map(({ kind, ticket }) => {
              const meta = NEEDS_YOU_META[kind];
              const typeMeta = ticketTypeMeta[ticket.type] ?? ticketTypeMeta.bug;
              const TypeIcon = typeMeta.icon;
              const severity =
                ticketSeverityBadge[ticket.severity] ?? ticketSeverityBadge.medium;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => {
                    openTicket(ticket.id);
                    navigate("/admin/tickets");
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-md px-2 -mx-2"
                >
                  <Badge variant="outline" className={meta.className}>
                    <meta.Icon className="mr-1 h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <span className="flex items-center gap-2 flex-1 truncate text-sm text-foreground">
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    {typeMeta.label}
                  </span>
                  <StatusBadge variant={severity.variant} label={severity.label} />
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {relativeTime(ticket.created_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Stat cards                                                           */
/* ------------------------------------------------------------------ */

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                              */
/* ------------------------------------------------------------------ */

export default function DashboardSection() {
  const { data: stats, isLoading, error } = useAdminDashboard();

  return (
    <div className="space-y-6">
      <NeedsYouCard />

      {error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Dashboard stats failed to load. Retrying in the background.
          </CardContent>
        </Card>
      ) : isLoading || !stats ? (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
        </>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>Users by Role</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <StatRow label="Admin" value={stats.usersByRole.ADMIN} />
                <StatRow label="Team" value={stats.usersByRole.TEAM} />
                <StatRow label="Pro" value={stats.usersByRole.PRO} />
                <StatRow label="Free" value={stats.usersByRole.FREE} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>Tickets by Status</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <StatRow label="New" value={stats.ticketsByStatus.new} />
                <StatRow label="Triaged" value={stats.ticketsByStatus.triaged} />
                <StatRow label="In Progress" value={stats.ticketsByStatus.in_progress} />
                <StatRow label="Awaiting Approval" value={stats.ticketsByStatus.awaiting_approval} />
                <StatRow label="Awaiting User" value={stats.ticketsByStatus.awaiting_user} />
                <StatRow label="Resolved" value={stats.ticketsByStatus.resolved} />
                <StatRow label="Rejected" value={stats.ticketsByStatus.rejected} />
                <StatRow label="Escalated" value={stats.ticketsByStatus.escalated} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>Tickets Last 7d</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground tabular-nums">
                  {stats.ticketsLast7d}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  New tickets created in the last 7 days ({stats.totalTickets} total).
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Deployment — what's actually running vs main HEAD */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>Deployment</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Deployed commit</span>
                  <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                    {shortSha(stats.deploy.deployedSha)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">main HEAD</span>
                  {stats.deploy.mainHeadSha ? (
                    <span className="font-mono text-xs font-medium text-foreground tabular-nums">
                      {shortSha(stats.deploy.mainHeadSha)}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">
                      unavailable from browser
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {stats.deploy.inSync === null ? (
                    <span className="text-xs font-medium text-muted-foreground">
                      comparison unavailable
                    </span>
                  ) : stats.deploy.inSync ? (
                    <span className="text-xs font-medium text-green-500">
                      deployed = main HEAD
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-amber-500">
                      deploy behind main — check Vercel
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">App version</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {stats.health.appVersion}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* System health — every value is a real measurement */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>System Health</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">DB round-trip</span>
                  <span
                    className={
                      "font-medium tabular-nums " +
                      (stats.health.db < 300
                        ? "text-green-500"
                        : stats.health.db < 1000
                          ? "text-amber-500"
                          : "text-destructive")
                    }
                  >
                    {stats.health.db} ms
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Runner</span>
                  {!stats.runner.available ? (
                    <span className="font-medium text-muted-foreground">
                      not deployed yet
                    </span>
                  ) : stats.runner.heartbeatAgeMinutes === null ? (
                    <span className="font-medium text-muted-foreground">
                      no heartbeat on record
                    </span>
                  ) : stats.runner.heartbeatAgeMinutes > 45 ? (
                    <span className="font-medium text-destructive tabular-nums">
                      silent — check launchd ({stats.runner.heartbeatAgeMinutes}m)
                    </span>
                  ) : (
                    <span className="font-medium text-foreground tabular-nums">
                      heartbeat {stats.runner.heartbeatAgeMinutes}m ago
                      {stats.runner.state ? ` · ${stats.runner.state}` : ""}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
