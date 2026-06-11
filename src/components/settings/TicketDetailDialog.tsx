import { formatDistanceToNow } from "date-fns";
import { RiFileTextLine, RiLoader2Line } from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAttachmentUrl, useTicketDetail, useUpdateTicketStatus } from "@/hooks/useTickets";
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
} from "@/lib/ticket-display";
import type {
  AttachmentDescriptor,
  TicketEvent,
  TicketStatus,
} from "@/services/tickets.service";

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
  // Legacy tickets (pre 11-05) stored these at the top level; they were
  // always client-supplied and unverified — label them accordingly.
  { key: "organizationId", label: "Organization (client-claimed)" },
  { key: "workspaceId", label: "Workspace (client-claimed)" },
];

/**
 * 11-05+: client-supplied org/workspace ids are namespaced under
 * context.client_claims so nothing treats them as server-verified.
 */
const CLIENT_CLAIM_FIELDS: Array<{ key: string; label: string }> = [
  { key: "organization_id", label: "Organization (client-claimed)" },
  { key: "workspace_id", label: "Workspace (client-claimed)" },
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

/**
 * Tolerant parse of a message's attachments jsonb (15-03, D-05): only entries
 * matching the AttachmentDescriptor contract survive — unknown shapes are
 * skipped silently (render nothing rather than crash).
 */
function parseAttachments(value: unknown): AttachmentDescriptor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AttachmentDescriptor => {
    if (typeof entry !== "object" || entry === null) return false;
    const candidate = entry as Record<string, unknown>;
    return (
      (candidate.type === "screenshot" || candidate.type === "console_log") &&
      typeof candidate.path === "string" &&
      candidate.path.length > 0
    );
  });
}

/**
 * One attachment row resolved via a short-lived signed URL (private bucket —
 * public-URL access is forbidden, T-15-07/T-15-08). The img src comes
 * exclusively from createSignedUrl's return, never from descriptor strings.
 */
function AttachmentItem({ descriptor }: { descriptor: AttachmentDescriptor }) {
  const { data: signedUrl, isLoading, isError } = useAttachmentUrl(descriptor.path);

  if (isLoading) {
    return descriptor.type === "screenshot" ? (
      <Skeleton className="h-24 w-full rounded-md" />
    ) : (
      <Skeleton className="h-4 w-40 rounded" />
    );
  }

  if (isError || !signedUrl) {
    return <p className="text-xs text-muted-foreground">Attachment unavailable</p>;
  }

  if (descriptor.type === "screenshot") {
    return (
      <a href={signedUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={signedUrl}
          alt="Ticket screenshot"
          className="max-h-48 rounded-md border border-border object-contain"
        />
      </a>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs text-foreground hover:underline"
    >
      <RiFileTextLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      Console log (JSON)
    </a>
  );
}

export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const { data: detail, isLoading } = useTicketDetail(open ? ticketId : null);
  const updateStatus = useUpdateTicketStatus();

  const ticket = detail?.ticket;
  const context = (ticket?.context ?? {}) as Record<string, unknown>;
  const clientClaims = (
    typeof context.client_claims === "object" && context.client_claims !== null
      ? context.client_claims
      : {}
  ) as Record<string, unknown>;
  const contextEntries = [
    ...CONTEXT_FIELDS.map(({ key, label }) => ({ key, label, value: context[key] })),
    ...CLIENT_CLAIM_FIELDS.map(({ key, label }) => ({
      key: `client_claims.${key}`,
      label,
      value: clientClaims[key],
    })),
  ].filter(
    (entry): entry is { key: string; label: string; value: string } =>
      typeof entry.value === "string" && entry.value.length > 0,
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
                  {contextEntries.map(({ key, label, value }) => (
                    <div key={key} className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
                      <dd className="break-all text-foreground">{value}</dd>
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
                  {detail.messages.map((message) => {
                    const attachments = parseAttachments(message.attachments);
                    return (
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
                        {attachments.length > 0 && (
                          <div className="mt-2 space-y-2 border-t border-border pt-2">
                            <p className={sectionLabelClass}>Attachments</p>
                            {attachments.map((descriptor) => (
                              <AttachmentItem key={descriptor.path} descriptor={descriptor} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
