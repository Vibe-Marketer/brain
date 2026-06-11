import {
  RiBugLine,
  RiLightbulbLine,
  RiQuestionLine,
  RiTaskLine,
} from "@remixicon/react";
import type { StatusBadgeProps } from "@/components/ui/status-badge";
import type {
  TicketSeverity,
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
