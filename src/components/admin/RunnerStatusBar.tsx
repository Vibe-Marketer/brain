/**
 * RunnerStatusBar (TKT-LIVE) — a compact, always-live autopilot status strip
 * shown ABOVE the ticket list (not buried in one dashboard card). Answers the
 * operator's first question at a glance: "is the autopilot working right now,
 * and on what?" Polls runner_state every ~10s via useRunnerState.
 *
 * States: Paused (kill switch) · Offline (stale heartbeat) · Working a ticket ·
 * Idle. When it's mid-fix, the current ticket is a one-click link into its detail.
 */
import {
  RiCheckboxBlankCircleFill,
  RiLoader2Line,
  RiPauseCircleLine,
  RiPlayCircleLine,
  RiWifiOffLine,
} from "@remixicon/react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRunnerState, useSetKillSwitch } from "@/hooks/useAdminDashboard";
import { isRunnerOffline } from "@/services/admin-dashboard.service";

interface RunnerStatusBarProps {
  /** Open a ticket's detail (the runner's current ticket) without leaving the list. */
  onOpenTicket?: (ticketId: string) => void;
}

type Tone = "live" | "idle" | "paused" | "offline";

const TONE_DOT: Record<Tone, string> = {
  live: "text-emerald-500",
  idle: "text-muted-foreground",
  paused: "text-vibe-orange",
  offline: "text-red-500",
};

/** Plain-English label for a non-paused, non-offline runner status. */
function workingLabel(status: string): string {
  switch (status) {
    case "claiming":
      return "Picking up a ticket";
    case "running":
      return "Working on a fix";
    case "awaiting_gate":
      return "Checking a fix before it ships";
    default:
      return "Watching the queue";
  }
}

export function RunnerStatusBar({ onOpenTicket }: RunnerStatusBarProps) {
  const { data: runner, isLoading } = useRunnerState();
  const setKillSwitch = useSetKillSwitch();

  // Table not deployed / unreachable — say nothing rather than a fake state.
  if (!isLoading && !runner) return null;

  const paused = runner?.kill_switch === true;
  const offline = !paused && isRunnerOffline(runner?.last_heartbeat ?? null);
  const working =
    !paused && !offline && runner?.status !== "idle" && Boolean(runner?.current_ticket_id);

  const tone: Tone = paused ? "paused" : offline ? "offline" : working ? "live" : "idle";

  let label: string;
  let Icon = RiCheckboxBlankCircleFill;
  if (isLoading) {
    label = "Checking autopilot…";
  } else if (paused) {
    label = "Autopilot paused";
    Icon = RiPauseCircleLine;
  } else if (offline) {
    label = "Autopilot offline — no recent heartbeat";
    Icon = RiWifiOffLine;
  } else if (working) {
    label = `Autopilot: ${workingLabel(runner!.status).toLowerCase()}`;
  } else {
    label = "Autopilot idle — watching the queue";
  }

  const heartbeatAge = runner?.last_heartbeat
    ? formatDistanceToNow(new Date(runner.last_heartbeat), { addSuffix: true })
    : null;

  const currentTicketId = working ? runner!.current_ticket_id : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className={cn("flex items-center gap-2 font-medium text-foreground", TONE_DOT[tone])}>
        {isLoading ? (
          <RiLoader2Line className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon
            className={cn("h-3.5 w-3.5", tone === "live" && "animate-pulse")}
            aria-hidden="true"
          />
        )}
        <span className="text-foreground">{label}</span>
      </span>

      {currentTicketId && (
        <button
          type="button"
          onClick={() => onOpenTicket?.(currentTicketId)}
          className="rounded font-medium text-vibe-orange underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vibe-orange"
        >
          View ticket #{currentTicketId.slice(0, 6)}
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        {heartbeatAge && !isLoading && (
          <span className="text-xs text-muted-foreground tabular-nums">
            last checked {heartbeatAge}
          </span>
        )}
        {!isLoading && runner && (
          <Button
            type="button"
            variant="hollow"
            size="sm"
            onClick={() => setKillSwitch.mutate(!paused)}
            disabled={setKillSwitch.isPending}
            aria-label={paused ? "Resume autopilot" : "Pause autopilot"}
          >
            {paused ? (
              <RiPlayCircleLine className="mr-1 h-4 w-4 text-emerald-500" aria-hidden="true" />
            ) : (
              <RiPauseCircleLine className="mr-1 h-4 w-4 text-vibe-orange" aria-hidden="true" />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
        )}
      </div>
    </div>
  );
}
