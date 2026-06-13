import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  useAdminDashboard,
  useNeedsYou,
  useRunnerRuns,
  useRunnerState,
  useSetKillSwitch,
} from "@/hooks/useAdminDashboard";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ticketTypeMeta, ticketSeverityBadge } from "@/lib/ticket-display";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
  RiEyeLine,
  RiRobot2Line,
  RiTimeLine,
  RiPlayCircleFill,
  RiPauseCircleFill,
} from "@remixicon/react";
import {
  isRunnerOffline,
  type NeedsYouKind,
  type RunnerRun,
} from "@/services/admin-dashboard.service";

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                  */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  // span, not a heading element — always rendered inside CardTitle (an h3),
  // so an <h3> here would be invalid <h3>-in-<h3> DOM nesting.
  return (
    <span className="font-montserrat font-extrabold uppercase tracking-wide text-sm text-foreground">
      {children}
    </span>
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

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "running";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}

function runLabel(run: RunnerRun): string {
  return run.outcome ?? run.status ?? "unknown";
}

function runVerdict(run: RunnerRun): { label: string; className: string } {
  const gatePassed = run.gate_verdict === "pass";
  const testsPassed = run.test_exit === 0;
  if (gatePassed && testsPassed) {
    return {
      label: "Pass",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }
  if (
    run.gate_verdict === "fail" ||
    (run.test_exit !== null && run.test_exit !== 0) ||
    run.status === "failed" ||
    run.outcome === "failed"
  ) {
    return {
      label: "Fail",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }
  return {
    label: "Open",
    className: "border-border bg-muted/60 text-muted-foreground",
  };
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
/* Runner ops (14-02 — live runner_state + kill switch)                 */
/* ------------------------------------------------------------------ */

/** The dispatcher polls on this cadence (launchd run interval). */
const POLL_INTERVAL_SEC = 300;

const sectionLabelClass =
  "text-[10px] uppercase tracking-wide text-muted-foreground/60";

/** Human label for when the runner next wakes up, derived from last heartbeat. */
function nextCheckLabel(lastHeartbeat: string | null): string {
  if (!lastHeartbeat) return "shortly";
  const next = new Date(lastHeartbeat).getTime() + POLL_INTERVAL_SEC * 1000;
  const ms = next - Date.now();
  if (ms <= 0) return "any moment now";
  const mins = Math.ceil(ms / 60000);
  return mins <= 1 ? "in under a minute" : `in ~${mins} min`;
}

function RunnerOpsCard() {
  const { data: runner, isLoading } = useRunnerState();
  const { data: runs, isLoading: runsLoading } = useRunnerRuns(5);
  const { isAdmin } = useUserRole();
  const killSwitchMutation = useSetKillSwitch();
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();
  // confirmTarget holds the DESIRED autopilot-on state (true = turn ON).
  const [confirmTarget, setConfirmTarget] = React.useState<boolean | null>(null);

  const armed = runner ? !runner.kill_switch : false;
  const offline = runner ? isRunnerOffline(runner.last_heartbeat) : false;
  // The one status that matters, loud: on / paused / offline-while-armed.
  const mode: "on" | "paused" | "offline" = !armed
    ? "paused"
    : offline
      ? "offline"
      : "on";

  const banner = {
    on: {
      Icon: RiPlayCircleFill,
      box: "border-emerald-500/30 bg-emerald-500/10",
      tone: "text-emerald-600 dark:text-emerald-400",
      title: "AUTOPILOT ON",
      sub: `Working your ticket backlog — next check ${runner ? nextCheckLabel(runner.last_heartbeat) : "shortly"}.`,
    },
    paused: {
      Icon: RiPauseCircleFill,
      box: "border-vibe-orange/30 bg-vibe-orange/10",
      tone: "text-vibe-orange",
      title: "AUTOPILOT PAUSED",
      sub: "Not claiming any tickets. Turn it on to start clearing the backlog.",
    },
    offline: {
      Icon: RiAlarmWarningLine,
      box: "border-destructive/30 bg-destructive/10",
      tone: "text-destructive",
      title: "RUNNER OFFLINE",
      sub: "Autopilot is on, but the dispatcher process isn't checking in. Nothing runs until it's back.",
    },
  }[mode];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Autopilot</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : !runner ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RiRobot2Line className="h-4 w-4" />
            not deployed yet
          </div>
        ) : (
          <>
            {/* LOUD status banner — the one thing you should see at a glance */}
            <div className={`flex items-center gap-3 rounded-lg border p-4 ${banner.box}`}>
              <banner.Icon className={`h-9 w-9 shrink-0 ${banner.tone}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-montserrat text-lg font-extrabold uppercase tracking-wide ${banner.tone}`}>
                    {banner.title}
                  </span>
                  {mode === "on" && (
                    <span className="relative flex h-2.5 w-2.5" aria-hidden>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{banner.sub}</p>
              </div>
            </div>

            {/* The toggle — clearly labeled, with explicit ON / OFF */}
            {isAdmin && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">
                    {armed ? "Turn autopilot off" : "Turn autopilot on"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {armed
                      ? "Stop claiming new tickets"
                      : "Start claiming and fixing tickets (each fix waits for your approval)"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      armed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    }`}
                  >
                    {armed ? "On" : "Off"}
                  </span>
                  <Switch
                    checked={armed}
                    disabled={killSwitchMutation.isPending}
                    onCheckedChange={(nextOn) => setConfirmTarget(nextOn)}
                    aria-label="Autopilot on/off"
                  />
                </div>
              </div>
            )}

            {/* Secondary detail — current ticket + heartbeat */}
            <div className="space-y-2 px-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current ticket</span>
                {runner.current_ticket_id ? (
                  <button
                    type="button"
                    onClick={() => {
                      openTicket(runner.current_ticket_id!);
                      navigate("/admin/tickets");
                    }}
                    className="font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-sm"
                  >
                    {runner.current_ticket_id.slice(0, 8)}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">none</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last check-in</span>
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {runner.last_heartbeat
                    ? relativeTime(runner.last_heartbeat)
                    : "no heartbeat on record"}
                </span>
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className={sectionLabelClass}>Recent runs</p>
                {runs && runs.length > 0 && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    newest first
                  </span>
                )}
              </div>
              {runsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : !runs || runs.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No runs recorded yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => {
                    const verdict = runVerdict(run);
                    const row = (
                      <div className="rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={verdict.className}>
                            {verdict.label}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                            {runLabel(run)}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {relativeTime(run.started_at)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
                          <div className="min-w-0">
                            <span className="block text-muted-foreground">Gate</span>
                            <span className="block truncate text-foreground">
                              {run.gate_verdict ?? "unknown"}
                              {run.gate_stage ? ` · ${run.gate_stage}` : ""}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-muted-foreground">Duration</span>
                            <span className="block truncate text-foreground tabular-nums">
                              {formatDuration(run.duration_sec)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-muted-foreground">Budget est.</span>
                            <span className="block truncate text-foreground">
                              {run.est_cost ?? "not recorded"}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="block text-muted-foreground">Fix SHA</span>
                            <span className="block truncate font-mono text-foreground tabular-nums">
                              {shortSha(run.fix_sha)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );

                    return run.ticket_id ? (
                      <button
                        key={run.id}
                        type="button"
                        onClick={() => {
                          openTicket(run.ticket_id!);
                          navigate("/admin/tickets");
                        }}
                        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-lg"
                      >
                        {row}
                      </button>
                    ) : (
                      <div key={run.id}>{row}</div>
                    );
                  })}
                </div>
              )}
            </div>

            <AlertDialog
              open={confirmTarget !== null}
              onOpenChange={(open) => {
                if (!open) setConfirmTarget(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {confirmTarget ? "Turn autopilot ON?" : "Pause autopilot?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {confirmTarget
                      ? `The runner claims its first ticket on the next check (${nextCheckLabel(runner.last_heartbeat)}). Every fix still waits for your approval before it goes live.`
                      : "The runner stops claiming new tickets within one poll cycle (~5 min). Anything already mid-fix finishes."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (confirmTarget !== null) {
                        // confirmTarget is desired autopilot-on; kill_switch is the inverse.
                        killSwitchMutation.mutate(!confirmTarget);
                      }
                      setConfirmTarget(null);
                    }}
                  >
                    {confirmTarget ? "Turn on" : "Pause"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
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
      <RunnerOpsCard />

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
                  <SectionHeading>Tickets</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Headline: what actually needs you vs. what's already done —
                    so a big resolved count never makes the list look busy. */}
                {(() => {
                  const t = stats.ticketsByStatus;
                  const needsYou =
                    t.new + t.triaged + t.in_progress + t.awaiting_approval + t.awaiting_user + t.escalated;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-vibe-orange/30 bg-vibe-orange/10 p-3">
                        <div className="text-2xl font-bold tabular-nums text-vibe-orange">{needsYou}</div>
                        <div className="text-xs text-muted-foreground">Need attention</div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="text-2xl font-bold tabular-nums text-foreground">{t.resolved}</div>
                        <div className="text-xs text-muted-foreground">Resolved</div>
                      </div>
                    </div>
                  );
                })()}
                {/* Detail breakdown — secondary. */}
                <div className="space-y-1.5 border-t border-border pt-2">
                  <StatRow label="New" value={stats.ticketsByStatus.new} />
                  <StatRow label="Escalated" value={stats.ticketsByStatus.escalated} />
                  <StatRow label="Awaiting Approval" value={stats.ticketsByStatus.awaiting_approval} />
                  <StatRow label="In Progress" value={stats.ticketsByStatus.in_progress} />
                  <StatRow label="Triaged" value={stats.ticketsByStatus.triaged} />
                  <StatRow label="Awaiting User" value={stats.ticketsByStatus.awaiting_user} />
                </div>
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
            {/* Deployment — the commit baked into the running bundle */}
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

                {/* Runner row replaced by the dedicated RunnerOpsCard (14-02) —
                    live runner_state with kill switch, above the stat grids. */}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
