/**
 * TicketActivityTimeline (TKT-DETAIL) — the plain-English "what the autopilot
 * did" narrative, merged from ticket_events + ticket_messages + runner_runs via
 * buildTicketTimeline. Replaces the old raw status_change-only "Activity" list.
 *
 * SECURITY: every string renders as a React text node — no dangerouslySetInnerHTML,
 * no markdown-to-HTML. Hostile ticket/repo content can never become live DOM.
 */
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { buildTicketTimeline, type TimelineTone } from "@/lib/ticket-timeline";
import type { TicketEvent, TicketMessage } from "@/services/tickets.service";
import type { RunnerRun } from "@/services/admin-dashboard.service";

interface TicketActivityTimelineProps {
  events: TicketEvent[];
  messages: TicketMessage[];
  runs?: RunnerRun[];
}

const formatRelative = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
};

/** Icon color per tone — vibe-orange reserved for the structural warning accent. */
const TONE_ICON: Record<TimelineTone, string> = {
  neutral: "text-muted-foreground",
  progress: "text-blue-500",
  success: "text-emerald-500",
  warning: "text-vibe-orange",
  danger: "text-red-500",
  human: "text-foreground",
};

export function TicketActivityTimeline({ events, messages, runs = [] }: TicketActivityTimelineProps) {
  // Newest-first reads best in a detail pane (most-recent action on top).
  const entries = buildTicketTimeline(events, messages, runs).reverse();

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry, idx) => {
        const Icon = entry.icon;
        const isLast = idx === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3">
            {/* Connector rail */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-6 h-[calc(100%+0.25rem)] w-px bg-border"
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card",
                TONE_ICON[entry.tone],
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{entry.title}</p>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatRelative(entry.at)}
                </span>
              </div>
              {entry.detail && (
                <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                  {entry.detail}
                </p>
              )}
              {(entry.diffStat || entry.fixSha) && (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {entry.fixSha && (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums text-foreground">
                      {entry.fixSha.slice(0, 10)}
                    </code>
                  )}
                  {entry.diffStat && (
                    <span className="whitespace-pre-wrap break-words font-mono">
                      {entry.diffStat.split("\n").pop()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
