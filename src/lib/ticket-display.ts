import {
  RiBugLine,
  RiLightbulbLine,
  RiQuestionLine,
  RiTaskLine,
} from "@remixicon/react";
import type { StatusBadgeProps } from "@/components/ui/status-badge";
import type {
  TicketSeverity,
  TicketSource,
  TicketStatus,
  TicketType,
} from "@/services/tickets.service";

type BadgeVariant = StatusBadgeProps["variant"];

/** UI-SPEC status → StatusBadge variant mapping (locked). */
export const ticketStatusBadge: Record<TicketStatus, { variant: BadgeVariant; label: string }> = {
  new: { variant: "new", label: "New" },
  triaged: { variant: "info", label: "Triaged" },
  in_progress: { variant: "active", label: "In Progress" },
  awaiting_approval: { variant: "warning", label: "Awaiting Approval" },
  awaiting_user: { variant: "default", label: "Awaiting User" },
  resolved: { variant: "success", label: "Resolved" },
  rejected: { variant: "inactive", label: "Rejected" },
  escalated: { variant: "error", label: "Escalated" },
};

/** UI-SPEC severity → StatusBadge variant mapping (locked). */
export const ticketSeverityBadge: Record<TicketSeverity, { variant: BadgeVariant; label: string }> = {
  critical: { variant: "error", label: "Critical" },
  high: { variant: "warning", label: "High" },
  medium: { variant: "info", label: "Medium" },
  low: { variant: "default", label: "Low" },
};

export const ticketTypeMeta: Record<TicketType, { icon: typeof RiBugLine; label: string }> = {
  bug: { icon: RiBugLine, label: "Bug" },
  suggestion: { icon: RiLightbulbLine, label: "Suggestion" },
  question: { icon: RiQuestionLine, label: "Question" },
  task: { icon: RiTaskLine, label: "Task" },
};

/* ------------------------------------------------------------------ */
/* Plain-English humanizers (READABILITY DOCTRINE)                      */
/*                                                                      */
/* Everything outward-facing in tickets/admin must read like plain     */
/* English to a 9th grader — no enums, no code, no jargon. These are    */
/* the single source of truth for turning machine values into words.   */
/* ------------------------------------------------------------------ */

/** Strip ANSI escape codes (terminal colors) so captured output reads clean. */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Last-resort tidy: "run_started" -> "Run started" (never show raw enums). */
function prettify(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}

/** True if a message is the autopilot's "I got stuck / made no fix" escalation. */
export function isEscalationMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  return /Autopilot escalation|VERDICT:\s*ESCALATE|ESCALATE\b.*no changes/i.test(body);
}

/**
 * Pull a short, human-ish reason from an escalation body (the VERDICT line),
 * trimmed to one clause so it's a glance, not a wall. Always returns something
 * non-threatening — the full technical notes stay collapsed elsewhere.
 */
export function escalationReason(body: string | null | undefined): string {
  if (!body) return "the autopilot couldn't finish this on its own";
  const m = /VERDICT:\s*ESCALATE\s*[—–-]*\s*(.+)/i.exec(body);
  if (m) {
    const clause = m[1].split(/[.\n;]/)[0].trim();
    if (clause) return clause;
  }
  return "the autopilot couldn't finish this on its own";
}

/** A ticket status as a plain label (falls back to a tidy version, never raw). */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return ticketStatusBadge[status as TicketStatus]?.label ?? prettify(status);
}

/** Who wrote a message, in human terms — never the raw author_type enum. */
export function getAuthorLabel(authorType: string | null | undefined): string {
  switch (authorType) {
    case "user":
      return "Customer";
    case "agent":
      return "Autopilot";
    case "admin":
      return "Support";
    default:
      return authorType ? prettify(authorType) : "Unknown";
  }
}

const TICKET_SOURCE_LABELS = {
  manual: "Reported by a person",
  in_app_user: "Reported by a person",
  sentry: "Found by Sentry",
  nightly_qa: "Found by nightly QA",
  internal: "Internal watchdog",
  unknown: "Unknown source",
} as const satisfies Record<TicketSource, string>;

export const TICKET_SOURCE_ORDER = Object.keys(TICKET_SOURCE_LABELS) as TicketSource[];

export const TICKET_SOURCE_FILTER_OPTIONS = TICKET_SOURCE_ORDER.map((source) => ({
  source,
  label: TICKET_SOURCE_LABELS[source],
}));

/** Where a ticket came from, in human terms — never "manual"/"sentry". */
export function ticketSourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown source";
  return TICKET_SOURCE_LABELS[source as TicketSource] ?? "Unknown source";
}

const TICKET_CLASS_STATUS_LABELS: Record<string, string> = {
  watching: "Watching",
  recurring: "Recurring",
  structural_fix_queued: "Structural fix open",
  landed: "Structural fix landed",
  killed: "Killed",
};

export interface TicketClassLabelInput {
  source: string | null | undefined;
  errorClass: string | null | undefined;
}

/** Recurrence class lifecycle in operator-safe words, never raw status enums. */
export function ticketClassStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown status";
  return TICKET_CLASS_STATUS_LABELS[status] ?? prettify(status);
}

/**
 * Recurrence class target label. Deliberately omits class_key/fingerprint_root:
 * those are machine identifiers, not useful operator copy.
 */
export function ticketClassLabel(input: TicketClassLabelInput): string {
  const source = ticketSourceLabel(input.source);
  const errorClass = input.errorClass ? prettify(input.errorClass) : "Unknown error";
  return `${source} / ${errorClass} recurrence`;
}

/**
 * A ticket activity event as one plain sentence. Covers the lifecycle the
 * autopilot + admins generate; anything unmapped gets tidied, never shown raw.
 */
export function describeTicketEvent(event: {
  event_type: string;
  old_value?: string | null;
  new_value?: string | null;
}): string {
  switch (event.event_type) {
    case "created":
      return "Ticket opened";
    case "status_change":
      return `Status changed from ${humanizeStatus(event.old_value)} to ${humanizeStatus(event.new_value)}`;
    case "run_started":
      return "Autopilot started working on a fix";
    case "run_completed":
      return "Autopilot finished the fix";
    case "approval_requested":
      return "A fix is ready for your approval";
    case "approved":
      return "You approved the fix";
    case "rejected":
      return "The fix was turned down";
    case "escalated":
      return "Handed off for a closer look";
    case "merged":
      return "The fix went live";
    default:
      return prettify(event.event_type);
  }
}
