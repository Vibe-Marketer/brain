import React from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  useAdminDashboard,
  useAutopilotTrustMetrics,
  useDemoteAutopilotCategory,
  useNeedsYou,
  usePromoteAutopilotCategory,
  useRequeueTicketForAgent,
  useDismissTicket,
  useRunnerRuns,
  useRunnerState,
  useSelfAudit,
  useTicketClassMetrics,
  useSetFixAgent,
  useSetKillSwitch,
} from "@/hooks/useAdminDashboard";
import type { SelfAuditStatus } from "@/services/self-audit.service";
import { useUserRole } from "@/hooks/useUserRole";
import { useAdminDetailStore } from "@/stores/adminDetailStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
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
import {
  ticketClassLabel,
  ticketClassStatusLabel,
  ticketTypeMeta,
  ticketSeverityBadge,
  ticketSourceLabel,
} from "@/lib/ticket-display";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RiCheckboxCircleLine,
  RiAlarmWarningLine,
  RiEyeLine,
  RiRobot2Line,
  RiTimeLine,
  RiPlayCircleFill,
  RiPauseCircleFill,
  RiCloseLine,
  RiErrorWarningFill,
  RiPulseLine,
} from "@remixicon/react";
import {
  isRunnerOffline,
  formatSurvivalRate,
  formatTicketSourceCycleTime,
  formatTicketSourceFixRate,
  needsYouRouteLabel,
  type AutopilotTrustMetric,
  type NeedsYouKind,
  type RunnerRun,
  type TicketClassMetric,
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

function trustRungLabel(rung: AutopilotTrustMetric["rung"]): string {
  if (rung === "auto") return "Auto approval";
  if (rung === "eligible") return "Ready for review";
  return "Manual review";
}

function trustRungClassName(rung: AutopilotTrustMetric["rung"]): string {
  if (rung === "auto") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (rung === "eligible") {
    return "border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange";
  }
  return "border-border bg-muted/60 text-muted-foreground";
}

function promotionReason(metric: AutopilotTrustMetric): string {
  if (metric.eligible) return "Waiting for explicit admin promotion.";
  const remainingFixes = Math.max(metric.minFixes - metric.completedFixes, 0);
  if (remainingFixes > 0) {
    return `${remainingFixes} more matured ${remainingFixes === 1 ? "fix" : "fixes"} needed.`;
  }
  if (metric.survivalRate < metric.threshold) {
    return `Needs ${formatSurvivalRate(metric.threshold)} survival.`;
  }
  return "Needs more survival history.";
}

function formatRecurrenceRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function occurrenceLabel(count: number): string {
  return `${count} ${count === 1 ? "occurrence" : "occurrences"}`;
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

/* ------------------------------------------------------------------ */
/* Self-audit — "is this actually doing anything?"                      */
/* ------------------------------------------------------------------ */

const AUDIT_STATUS_META: Record<
  SelfAuditStatus,
  { Icon: typeof RiCheckboxCircleLine; dot: string; badge: string; ring: string }
> = {
  ok: {
    Icon: RiCheckboxCircleLine,
    dot: "text-emerald-600 dark:text-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    ring: "border-border",
  },
  warn: {
    Icon: RiAlarmWarningLine,
    dot: "text-amber-600 dark:text-amber-400",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    ring: "border-amber-500/30",
  },
  critical: {
    Icon: RiErrorWarningFill,
    dot: "text-red-600 dark:text-red-400",
    badge: "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
    ring: "border-red-500/40",
  },
};

function SelfAuditCard() {
  const { data: report, isLoading } = useSelfAudit();

  const headline =
    report?.overall === "critical"
      ? "This is not doing what it should"
      : report?.overall === "warn"
        ? "Working, with gaps worth your attention"
        : "Honestly working";

  return (
    <Card className={report ? AUDIT_STATUS_META[report.overall].ring : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <SectionHeading>Is this actually working?</SectionHeading>
          <RiPulseLine
            className={`h-4 w-4 ${report ? AUDIT_STATUS_META[report.overall].dot : "text-muted-foreground"}`}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !report ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <p
              className={`text-sm font-montserrat font-extrabold uppercase tracking-wide ${AUDIT_STATUS_META[report.overall].dot}`}
            >
              {headline}
            </p>
            <div className="divide-y divide-border">
              {report.signals.map((s) => {
                const meta = AUDIT_STATUS_META[s.status];
                return (
                  <div key={s.key} className="flex items-start gap-3 py-3">
                    <meta.Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {s.headline}
                        </span>
                        <Badge variant="outline" className={`${meta.badge} tabular-nums`}>
                          {s.metric}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
                      {s.action ? (
                        <p className="mt-1 text-xs text-foreground">
                          <span className="font-medium">Fix:</span> {s.action}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NeedsYouCard() {
  const { data: items, isLoading } = useNeedsYou();
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();
  const requeue = useRequeueTicketForAgent();
  const dismiss = useDismissTicket();

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
              const route = needsYouRouteLabel(ticket);
              const busy =
                (requeue.isPending && requeue.variables === ticket.id) ||
                (dismiss.isPending && dismiss.variables === ticket.id);
              return (
                <div
                  key={ticket.id}
                  className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-md transition-colors hover:bg-muted/60"
                >
                  <button
                    type="button"
                    onClick={() => {
                      openTicket(ticket.id);
                      navigate("/admin/tickets");
                    }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange rounded-md"
                  >
                    <Badge variant="outline" className={meta.className}>
                      <meta.Icon className="mr-1 h-3 w-3" />
                      {meta.label}
                    </Badge>
                    <span className="flex items-center gap-2 flex-1 min-w-0 text-sm text-foreground">
                      <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {typeMeta.label}
                        {route ? (
                          <span className="text-muted-foreground"> · {route}</span>
                        ) : null}
                      </span>
                    </span>
                    <StatusBadge variant={severity.variant} label={severity.label} />
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {relativeTime(ticket.created_at)}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="hollow"
                      size="sm"
                      disabled={busy}
                      onClick={() => requeue.mutate(ticket.id)}
                      title="Run the agent on this ticket"
                    >
                      <RiRobot2Line className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Run agent</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => dismiss.mutate(ticket.id)}
                      title="Dismiss — close as noise"
                      className="text-muted-foreground"
                    >
                      <RiCloseLine className="h-4 w-4" />
                      <span className="sr-only">Dismiss</span>
                    </Button>
                  </div>
                </div>
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
  const fixAgentMutation = useSetFixAgent();
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
              <div className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3 md:grid-cols-2">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {armed ? "Turn autopilot off" : "Turn autopilot on"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {armed
                        ? "Stop claiming new tickets"
                        : "Start claiming and fixing tickets (verified fixes auto-deploy)"}
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
                <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      Fix agent: {runner.fix_agent === "claude" ? "Claude" : "Codex"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {runner.fix_agent === "claude"
                        ? "Codex is the rate-limit fallback"
                        : "Claude is the rate-limit fallback"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Codex
                    </span>
                    <Switch
                      checked={runner.fix_agent === "claude"}
                      disabled={fixAgentMutation.isPending}
                      onCheckedChange={(nextClaude) =>
                        fixAgentMutation.mutate(nextClaude ? "claude" : "codex")
                      }
                      aria-label="Fix agent Claude or Codex"
                    />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Claude
                    </span>
                  </div>
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
                      ? `The runner claims its first ticket on the next check (${nextCheckLabel(runner.last_heartbeat)}). Verified low-risk fixes deploy automatically; you can undo any of them from the ticket.`
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
/* Autopilot trust/survival (19-02)                                    */
/* ------------------------------------------------------------------ */

function AutopilotTrustCard() {
  const { data: metrics, isLoading, error } = useAutopilotTrustMetrics();
  const promoteMutation = usePromoteAutopilotCategory();
  const demoteMutation = useDemoteAutopilotCategory();
  const pendingCategory =
    promoteMutation.variables?.category ?? demoteMutation.variables?.category ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Survival Trust</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Survival trust failed to load. Retrying in the background.
          </p>
        ) : !metrics || metrics.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RiCheckboxCircleLine className="h-4 w-4" />
            No matured fixes yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {metrics.map((metric) => {
              const isPending =
                pendingCategory === metric.category &&
                (promoteMutation.isPending || demoteMutation.isPending);
              return (
                <div
                  key={metric.category}
                  className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {metric.category}
                      </span>
                      <Badge variant="outline" className={trustRungClassName(metric.rung)}>
                        {trustRungLabel(metric.rung)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <div>
                        <span className="block text-muted-foreground">Survival</span>
                        <span className="block text-lg font-bold text-foreground tabular-nums">
                          {formatSurvivalRate(metric.survivalRate)}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Matured fixes</span>
                        <span className="block text-lg font-bold text-foreground tabular-nums">
                          {metric.completedFixes}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Canary failures</span>
                        <span className="block text-lg font-bold text-foreground tabular-nums">
                          {metric.canaryFailedCount}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">Defers</span>
                        <span className="block text-lg font-bold text-foreground tabular-nums">
                          {metric.deferredRuns}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="tabular-nums">{metric.survivedFixes} held</span>
                      <span className="tabular-nums">{metric.reopenedFixes} reopened</span>
                      <span className="tabular-nums">{metric.canaryDueCount} canaries due</span>
                    </div>
                  </div>
                  <div className="flex flex-col justify-center gap-2 lg:w-40">
                    {metric.rung === "eligible" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          promoteMutation.mutate({
                            category: metric.category,
                            reason: "Promoted from admin survival trust card",
                          })
                        }
                        className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Promoting" : "Promote"}
                      </button>
                    ) : metric.rung === "auto" ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          demoteMutation.mutate({
                            category: metric.category,
                            reason: "Moved to manual from admin survival trust card",
                          })
                        }
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isPending ? "Moving" : "Manual"}
                      </button>
                    ) : (
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        {promotionReason(metric)}
                      </div>
                    )}
                    {metric.rung !== "manual" && (
                      <p className="text-xs text-muted-foreground">
                        {promotionReason(metric)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Recurrence classes (22-03)                                          */
/* ------------------------------------------------------------------ */

function RecurrenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="block text-muted-foreground">{label}</span>
      <span className="block text-lg font-bold text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function recurrenceStatusClassName(status: TicketClassMetric["status"]): string {
  if (status === "killed") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "structural_fix_queued" || status === "landed") {
    return "border-vibe-orange/30 bg-vibe-orange/10 text-vibe-orange";
  }
  if (status === "recurring") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  return "border-border bg-muted/60 text-muted-foreground";
}

function RecurrenceClassesCard() {
  const { data: metrics, isLoading, error } = useTicketClassMetrics();
  const openTicket = useAdminDetailStore((s) => s.openTicket);
  const navigate = useNavigate();

  return (
    <Card data-testid="recurrence-classes-card">
      <CardHeader className="pb-3">
        <CardTitle>
          <SectionHeading>Recurrence Classes</SectionHeading>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton data-testid="recurrence-class-skeleton" className="h-20 w-full" />
            <Skeleton data-testid="recurrence-class-skeleton" className="h-20 w-full" />
            <Skeleton data-testid="recurrence-class-skeleton" className="h-20 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            Recurrence metrics failed to load. Retrying in the background.
          </p>
        ) : !metrics || metrics.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RiCheckboxCircleLine className="h-4 w-4" />
            No recurring classes yet.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {metrics.map((metric) => (
              <div
                key={metric.classKey}
                data-testid={`recurrence-class-row-${metric.classKey}`}
                className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                      {ticketClassLabel({
                        source: metric.source,
                        errorClass: metric.errorClass,
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={recurrenceStatusClassName(metric.status)}
                    >
                      {ticketClassStatusLabel(metric.status)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <RecurrenceMetric
                      label="Current rate"
                      value={formatRecurrenceRate(metric.freshTicketRate30d)}
                    />
                    <RecurrenceMetric
                      label="Baseline"
                      value={formatRecurrenceRate(metric.baselineRate30d)}
                    />
                    <RecurrenceMetric
                      label="Post-fix"
                      value={formatRecurrenceRate(metric.postFixRate30d)}
                    />
                    <RecurrenceMetric
                      label="Resolved 30d"
                      value={String(metric.resolvedCount30d)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {occurrenceLabel(metric.occurrenceCount30d)}
                    </span>
                    {metric.structuralFixLandedAt && (
                      <span className="tabular-nums">
                        Landed {relativeTime(metric.structuralFixLandedAt)}
                      </span>
                    )}
                    {metric.killedAt && (
                      <span className="tabular-nums">
                        Killed {relativeTime(metric.killedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-2 lg:w-44">
                  {metric.structuralTicketId ? (
                    <button
                      type="button"
                      onClick={() => {
                        openTicket(metric.structuralTicketId!);
                        navigate("/admin/tickets");
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange"
                    >
                      <RiEyeLine className="mr-1.5 h-3.5 w-3.5" />
                      Review structural task
                    </button>
                  ) : (
                    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Waiting for tier-2 recommendation.
                    </div>
                  )}
                </div>
              </div>
            ))}
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
      <SelfAuditCard />
      <NeedsYouCard />
      <RunnerOpsCard />
      <AutopilotTrustCard />
      <RecurrenceClassesCard />

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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>
                  <SectionHeading>Tickets by Source</SectionHeading>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.sourceMetrics.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Source metrics failed to load. Retrying in the background.
                  </p>
                ) : (
                  <div className="divide-y divide-border">
                    {stats.sourceMetrics.map((metric) => (
                      <div
                        key={metric.source}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="text-sm font-medium text-foreground">
                          {ticketSourceLabel(metric.source)}
                        </span>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:justify-end">
                          <span className="tabular-nums">{metric.volume} tickets</span>
                          <span className="tabular-nums">
                            {formatTicketSourceFixRate(metric.fixRate)} fixed
                          </span>
                          <span className="tabular-nums">
                            {formatTicketSourceCycleTime(metric.averageCycleTimeHours)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
