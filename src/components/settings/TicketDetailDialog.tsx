import { formatDistanceToNow } from "date-fns";
import { RiLoader2Line } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTicketDetail, useUpdateTicketStatus } from "@/hooks/useTickets";
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
} from "@/components/settings/TicketTable";
import type { TicketEvent, TicketStatus } from "@/services/tickets.service";

interface TicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
}

const TICKET_STATUSES: TicketStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "awaiting_approval",
  "awaiting_user",
  "resolved",
  "rejected",
  "escalated",
];

/** Context JSONB keys captured by send-support-ticket, in display order. */
const CONTEXT_FIELDS: Array<{ key: string; label: string }> = [
  { key: "url", label: "URL" },
  { key: "appVersion", label: "App Version" },
  { key: "commit", label: "Commit" },
  { key: "userAgent", label: "User Agent" },
  { key: "organizationId", label: "Organization" },
  { key: "workspaceId", label: "Workspace" },
];

function describeEvent(event: TicketEvent): string {
  if (event.event_type === "created") return "Ticket created";
  if (event.event_type === "status_change") {
    return `Status changed: ${event.old_value ?? "—"} → ${event.new_value ?? "—"}`;
  }
  return event.event_type.replace(/_/g, " ");
}

const formatRelative = (dateString: string) => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDistanceToNow(date, { addSuffix: true });
};

const sectionLabelClass =
  "text-[10px] uppercase tracking-wide text-muted-foreground/60";

export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const { data: detail, isLoading } = useTicketDetail(open ? ticketId : null);
  const updateStatus = useUpdateTicketStatus();

  const ticket = detail?.ticket;
  const context = (ticket?.context ?? {}) as Record<string, unknown>;
  const contextEntries = CONTEXT_FIELDS.filter(
    ({ key }) => typeof context[key] === "string" && (context[key] as string).length > 0,
  );

  const typeLabel = ticket ? (ticketTypeMeta[ticket.type]?.label ?? ticket.type) : "";
  const shortId = ticket ? ticket.id.slice(0, 6) : "";
  const statusBadge = ticket ? ticketStatusBadge[ticket.status] : null;
  const severityBadge = ticket ? ticketSeverityBadge[ticket.severity] : null;

  const handleStatusChange = (value: string) => {
    if (!ticket || value === ticket.status) return;
    updateStatus.mutate({ ticketId: ticket.id, status: value as TicketStatus });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading || !ticket ? (
          <div className="flex items-center justify-center py-12">
            <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {typeLabel} · #{shortId}
              </DialogTitle>
            </DialogHeader>

            {/* Focal point: status + severity badges, plus admin status control */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {statusBadge && (
                  <StatusBadge variant={statusBadge.variant} label={statusBadge.label} />
                )}
                {severityBadge && (
                  <StatusBadge variant={severityBadge.variant} label={severityBadge.label} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="ticket-detail-status" className="text-xs text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={ticket.status}
                  onValueChange={handleStatusChange}
                  disabled={updateStatus.isPending}
                >
                  <SelectTrigger id="ticket-detail-status" className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {ticketStatusBadge[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Captured context */}
            {contextEntries.length > 0 && (
              <div className="space-y-2">
                <p className={sectionLabelClass}>Context</p>
                <dl className="space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                  {contextEntries.map(({ key, label }) => (
                    <div key={key} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="break-all text-foreground">{String(context[key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* Messages */}
            <div className="space-y-2">
              <p className={sectionLabelClass}>Messages</p>
              {detail.messages.length === 0 ? (
                <p className="text-xs text-muted-foreground">No messages on this ticket.</p>
              ) : (
                <div className="space-y-3">
                  {detail.messages.map((message) => (
                    <div key={message.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground capitalize">
                          {message.author_type}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatRelative(message.created_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{message.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity event timeline (TKT-04 surface) */}
            <div className="space-y-2">
              <p className={sectionLabelClass}>Activity</p>
              {detail.events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {detail.events.map((event) => (
                    <div key={event.id} className="flex items-start gap-2 text-xs">
                      <span
                        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="text-foreground">{describeEvent(event)}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                        {formatRelative(event.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
