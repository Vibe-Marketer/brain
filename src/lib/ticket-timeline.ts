/**
 * Unified ticket activity timeline (TKT-DETAIL).
 *
 * Merges the THREE lifecycle sources the autopilot writes — ticket_events,
 * ticket_messages, and runner_runs — into one chronological, plain-English
 * narrative: "opened → started working → wrote a fix → ready for approval →
 * went live". Pure + framework-free so it is unit-testable and reusable.
 *
 * Designed against the REAL event vocabulary the engine emits (verified against
 * production ticket_events): status_change, run_started, created, benign_closed,
 * rate_limit_defer, claim_released, fix_prepared, tier2_digest_queued,
 * tier2_escalation_routed, approval, rejection. None of these (except
 * status_change/created) were mapped before — they fell through to a generic
 * title-case prettify. This builder gives each a real sentence and strips the
 * machine noise (redundant run_started, retry-loop churn) so a non-developer
 * reads what actually happened, not a wall of enums.
 */
import {
  RiAddCircleLine,
  RiArrowGoBackLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCloseCircleLine,
  RiErrorWarningLine,
  RiGitCommitLine,
  RiPlayCircleLine,
  RiShieldCheckLine,
  RiThumbUpLine,
  RiTimeLine,
  RiUserSharedLine,
} from "@remixicon/react";
import {
  escalationReason,
  humanizeStatus,
  isEscalationMessage,
  stripAnsi,
} from "@/lib/ticket-display";
import type { TicketEvent, TicketMessage } from "@/services/tickets.service";
import type { RunnerRun } from "@/services/admin-dashboard.service";

export type TimelineTone =
  | "neutral"
  | "progress"
  | "success"
  | "warning"
  | "danger"
  | "human";

export interface TimelineEntry {
  /** Stable de-dupe / React key. */
  id: string;
  /** ISO timestamp the entry happened at. */
  at: string;
  icon: typeof RiCheckLine;
  tone: TimelineTone;
  /** One plain-English sentence — never a raw enum. */
  title: string;
  /** Optional longer body (reason, note preview) shown under the title. */
  detail?: string;
  /** Optional fix metadata surfaced inline (diff_stat / short sha). */
  diffStat?: string | null;
  fixSha?: string | null;
}

const EVIDENCE_HEADER = "# Autopilot fix evidence";
const TIER2_DIGEST_HEADER = "# Tier-2 resolution digest";

function ts(value: string | null | undefined): number {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isNaN(n) ? 0 : n;
}

/** First non-empty line of a body, trimmed for a one-glance preview. */
function firstLine(body: string | null | undefined, max = 140): string {
  if (!body) return "";
  const line = stripAnsi(body)
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith("#"));
  if (!line) return "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** Map one ticket_event to a timeline entry, or null to drop it as noise. */
function fromEvent(event: TicketEvent): TimelineEntry | null {
  const base = { id: `ev-${event.id}`, at: event.created_at };
  switch (event.event_type) {
    case "created":
      return { ...base, icon: RiAddCircleLine, tone: "neutral", title: "Ticket opened" };

    case "status_change": {
      const to = event.new_value;
      const from = event.old_value;
      if (to === "in_progress") {
        return { ...base, icon: RiPlayCircleLine, tone: "progress", title: "Autopilot started working on it" };
      }
      if (to === "awaiting_approval") {
        return { ...base, icon: RiCheckboxCircleLine, tone: "warning", title: "Fix ready — waiting for approval" };
      }
      if (to === "resolved") {
        return { ...base, icon: RiCheckLine, tone: "success", title: "Resolved and deployed" };
      }
      if (to === "rejected") {
        return { ...base, icon: RiCloseCircleLine, tone: "danger", title: "Fix was turned down" };
      }
      if (to === "escalated") {
        return { ...base, icon: RiUserSharedLine, tone: "warning", title: "Handed off for a closer look" };
      }
      if (to === "new" && from && from !== "triaged") {
        // escalated/awaiting_approval/in_progress -> new = a retry requeue.
        return { ...base, icon: RiArrowGoBackLine, tone: "neutral", title: "Requeued to try again" };
      }
      // Any other transition: plain, never raw.
      return {
        ...base,
        icon: RiTimeLine,
        tone: "neutral",
        title: `Status: ${humanizeStatus(from)} → ${humanizeStatus(to)}`,
      };
    }

    case "fix_prepared":
      return { ...base, icon: RiGitCommitLine, tone: "progress", title: "Wrote a fix" };

    case "rate_limit_defer":
      return { ...base, icon: RiTimeLine, tone: "warning", title: "Paused — hit an AI rate limit, will retry" };

    case "benign_closed":
      return {
        ...base,
        icon: RiShieldCheckLine,
        tone: "success",
        title: "Reviewed and closed — no fix needed",
        detail: event.new_value ?? undefined,
      };

    case "tier2_escalation_routed":
    case "tier2_digest_queued":
      return { ...base, icon: RiUserSharedLine, tone: "warning", title: "Escalated to deeper (Tier 2) investigation" };

    case "approval":
      return { ...base, icon: RiThumbUpLine, tone: "success", title: "You approved the fix" };

    case "rejection":
      return { ...base, icon: RiCloseCircleLine, tone: "danger", title: "You rejected the fix" };

    // Pure machine-internal churn — represented by the surrounding entries.
    case "run_started":
    case "claim_released":
      return null;

    default:
      return null;
  }
}

/** Map a ticket_message to a timeline entry, or null when shown elsewhere. */
function fromMessage(message: TicketMessage): TimelineEntry | null {
  const base = { id: `msg-${message.id}`, at: message.created_at };
  const body = message.body ?? "";

  if (message.author_type === "user") {
    return {
      ...base,
      icon: RiUserSharedLine,
      tone: "human",
      title: "Customer added a note",
      detail: firstLine(body),
    };
  }

  if (message.author_type === "agent") {
    // The structured evidence bundle is rendered in full by TicketEvidence —
    // don't duplicate it as a noisy timeline blob.
    if (body.trimStart().startsWith(EVIDENCE_HEADER)) return null;
    if (body.trimStart().startsWith(TIER2_DIGEST_HEADER)) return null;
    if (isEscalationMessage(body)) {
      return {
        ...base,
        icon: RiErrorWarningLine,
        tone: "warning",
        title: "Autopilot got stuck",
        detail: escalationReason(body),
      };
    }
    return {
      ...base,
      icon: RiUserSharedLine,
      tone: "progress",
      title: "Autopilot note",
      detail: firstLine(body),
    };
  }

  // admin / other
  return {
    ...base,
    icon: RiUserSharedLine,
    tone: "human",
    title: "Support added a note",
    detail: firstLine(body),
  };
}

/** A runner_run that produced a real fix becomes a "wrote a fix" entry. */
function fromRun(run: RunnerRun): TimelineEntry | null {
  if (!run.fix_sha) return null;
  return {
    id: `run-${run.id}`,
    at: run.finished_at ?? run.started_at,
    icon: RiGitCommitLine,
    tone: "progress",
    title: "Wrote a fix",
    diffStat: run.diff_stat,
    fixSha: run.fix_sha,
  };
}

/**
 * Collapse CONSECUTIVE identical-title entries into one with a "×N" suffix.
 * Kills the retry churn (the same ticket bouncing new→in_progress→new every
 * poll for days) without hiding that it happened. Only adjacent output entries
 * merge, so anything that interleaves breaks the run.
 */
function collapseRepeats(entries: TimelineEntry[]): TimelineEntry[] {
  const baseTitle = (t: string) => t.replace(/ ×\d+$/, "");
  const out: Array<TimelineEntry & { _count?: number }> = [];
  for (const entry of entries) {
    const prev = out[out.length - 1];
    if (prev && baseTitle(prev.title) === baseTitle(entry.title) && !entry.detail && !entry.diffStat) {
      const count = (prev._count ?? 1) + 1;
      prev._count = count;
      prev.title = `${baseTitle(entry.title)} ×${count}`;
      prev.at = entry.at; // advance to most-recent occurrence
      continue;
    }
    out.push({ ...entry });
  }
  return out;
}

/**
 * Build the merged, plain-English timeline. Newest entries last (chronological);
 * the caller may reverse for newest-first display.
 */
export function buildTicketTimeline(
  events: TicketEvent[] = [],
  messages: TicketMessage[] = [],
  runs: RunnerRun[] = [],
): TimelineEntry[] {
  const raw: TimelineEntry[] = [];
  // A runner_run with a fix_sha is the richer "Wrote a fix" entry (carries the
  // diff + sha), so the bare fix_prepared event is redundant — drop it.
  const hasRunFix = runs.some((r) => r.fix_sha);
  for (const e of events) {
    if (hasRunFix && e.event_type === "fix_prepared") continue;
    const entry = fromEvent(e);
    if (entry) raw.push(entry);
  }
  for (const m of messages) {
    const entry = fromMessage(m);
    if (entry) raw.push(entry);
  }
  for (const r of runs) {
    const entry = fromRun(r);
    if (entry) raw.push(entry);
  }

  raw.sort((a, b) => ts(a.at) - ts(b.at) || a.id.localeCompare(b.id));
  return collapseRepeats(raw);
}
