import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  RiAlarmWarningLine,
  RiCheckLine,
  RiCloseLine,
  RiFileTextLine,
  RiLoader2Line,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { useApproveTicket, useRejectTicket } from "@/hooks/useTicketApproval";
import { useUpdateTicketQueueControls } from "@/hooks/useAdminTicketControls";
import { useRunnerRunsForTicket } from "@/hooks/useAdminDashboard";
import { useUserRole } from "@/hooks/useUserRole";
import { TicketEvidence } from "@/components/admin/TicketEvidence";
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
  describeTicketEvent,
  getAuthorLabel,
  stripAnsi,
  isEscalationMessage,
  escalationReason,
} from "@/lib/ticket-display";
import type {
  AttachmentDescriptor,
  TicketStatus,
} from "@/services/tickets.service";

/** Reject-reason length bound — mirrors the Edge Function's zod max (14-01). */
const REJECT_REASON_MAX = 2000;

/** Priority quick-set presets (queue claim order is urgent DESC, priority DESC). */
const PRIORITY_PRESETS = [0, 1, 2, 3] as const;

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
  const { isAdmin } = useUserRole();
  const approveTicket = useApproveTicket();
  const rejectTicket = useRejectTicket();
  const updateQueueControls = useUpdateTicketQueueControls();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const ticket = detail?.ticket;
  const runTicketId = isAdmin && open ? (ticket?.id ?? ticketId) : null;
  const { data: runnerRuns = [] } = useRunnerRunsForTicket(runTicketId);
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

  // Admin-only surfaces. Reporter-facing rendering is byte-identical to 15-03
  // because every block below gates on isAdmin (the same role the status
  // Select already implicitly trusts — the server is the real control).
  const hasAgentEvidence = (detail?.messages ?? []).some(
    (message) => message.author_type === "agent",
  );
  const hasRunEvidence = isAdmin && runnerRuns.length > 0;
  const isAwaitingApproval = ticket?.status === "awaiting_approval";
  const showApprovalBar = isAdmin && isAwaitingApproval;
  // Approval is recorded as an event; the dispatcher advances status on its
  // next poll. Once approved, surface the waiting note instead of the buttons.
  const approvalRecorded = approveTicket.isSuccess;

  const currentPriority = ((ticket as { priority?: number } | undefined)?.priority) ?? 0;
  const currentUrgent = ((ticket as { urgent?: boolean } | undefined)?.urgent) ?? false;

  const rejectReasonValid =
    rejectReason.trim().length >= 1 && rejectReason.trim().length <= REJECT_REASON_MAX;

  const handleApprove = () => {
    if (!ticket) return;
    approveTicket.mutate(ticket.id, { onSuccess: () => setApproveOpen(false) });
  };

  const handleReject = () => {
    if (!ticket || !rejectReasonValid) return;
    rejectTicket.mutate(
      { ticketId: ticket.id, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason("");
        },
      },
    );
  };

  const handlePriorityChange = (value: string) => {
    if (!ticket) return;
    const priority = Number(value);
    if (priority === currentPriority) return;
    updateQueueControls.mutate({ ticketId: ticket.id, patch: { priority } });
  };

  const handleUrgentToggle = (checked: boolean) => {
    if (!ticket) return;
    updateQueueControls.mutate({ ticketId: ticket.id, patch: { urgent: checked } });
  };

  return (
    <>
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

            {/* Admin queue controls: priority quick-set + URGENT toggle (14-04) */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="ticket-detail-priority" className="text-xs text-muted-foreground">
                    Priority
                  </Label>
                  <Select
                    value={String(currentPriority)}
                    onValueChange={handlePriorityChange}
                    disabled={updateQueueControls.isPending}
                  >
                    <SelectTrigger id="ticket-detail-priority" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_PRESETS.map((preset) => (
                        <SelectItem key={preset} value={String(preset)}>
                          {preset}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <RiAlarmWarningLine
                    className={`h-4 w-4 ${currentUrgent ? "text-vibe-orange" : "text-muted-foreground"}`}
                    aria-hidden="true"
                  />
                  <Label htmlFor="ticket-detail-urgent" className="text-xs text-muted-foreground">
                    URGENT
                  </Label>
                  <Switch
                    id="ticket-detail-urgent"
                    checked={currentUrgent}
                    onCheckedChange={handleUrgentToggle}
                    disabled={updateQueueControls.isPending}
                    aria-label="Toggle URGENT"
                  />
                </div>
              </div>
            )}

            {/* Admin approval bar — awaiting_approval tickets only (14-04, APPR-02) */}
            {showApprovalBar && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                {approvalRecorded ? (
                  <p className="flex items-center gap-2 text-xs text-foreground">
                    <RiCheckLine className="h-4 w-4 text-vibe-orange" aria-hidden="true" />
                    Approval recorded — dispatcher merges on next poll (≤5 min). Status updates
                    when the merge lands.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setApproveOpen(true)}
                      disabled={approveTicket.isPending}
                    >
                      <RiCheckLine className="mr-1 h-4 w-4" aria-hidden="true" />
                      APPROVE FIX
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setRejectOpen(true)}
                      disabled={rejectTicket.isPending}
                    >
                      <RiCloseLine className="mr-1 h-4 w-4" aria-hidden="true" />
                      REJECT
                    </Button>
                  </div>
                )}
              </div>
            )}

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

            {/* Agent fix evidence (14-04, APPR-01) — renders only when an
                agent-authored evidence message exists; ordinary support
                tickets show nothing new (15-03 zero-regression truth). */}
            {(hasAgentEvidence || hasRunEvidence) && (
              <TicketEvidence
                messages={detail.messages}
                runnerRuns={hasRunEvidence ? runnerRuns : []}
                events={detail.events}
              />
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
                    const escalation = isEscalationMessage(message.body);
                    return (
                      <div key={message.id} className="rounded-lg border border-border p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {getAuthorLabel(message.author_type)}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatRelative(message.created_at)}
                          </span>
                        </div>
                        {escalation ? (
                          // The autopilot got stuck. Lead with plain English so a
                          // non-developer knows it's NOT theirs to fix — the raw
                          // developer notes stay collapsed.
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 rounded-md border border-vibe-orange/30 bg-vibe-orange/10 p-2.5">
                              <RiAlarmWarningLine className="mt-0.5 h-4 w-4 shrink-0 text-vibe-orange" aria-hidden="true" />
                              <div className="text-xs text-foreground">
                                <span className="font-semibold">The autopilot got stuck and couldn't fix this on its own.</span>{" "}
                                You don't need to fix it yourself — hand it to a developer or an agent (just say
                                "work this ticket"). What it ran into: {escalationReason(message.body)}.
                              </div>
                            </div>
                            <details>
                              <summary className="cursor-pointer select-none text-xs text-muted-foreground">
                                Technical details (for a developer)
                              </summary>
                              <pre className="mt-1 max-h-64 overflow-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap text-foreground">
                                {stripAnsi(message.body)}
                              </pre>
                            </details>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm text-foreground">{stripAnsi(message.body)}</p>
                        )}
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
                      <span className="text-foreground">{describeTicketEvent(event)}</span>
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

      {/* Approve confirmation — explicit merge-consequence text (T-14-14) */}
      <AlertDialog open={approveOpen} onOpenChange={setApproveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this fix?</AlertDialogTitle>
            <AlertDialogDescription>
              The dispatcher will merge and push the held branch on its next cycle (≤5 min).
              The ticket stays in “awaiting approval” until the merge lands.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveTicket.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove} disabled={approveTicket.isPending}>
              {approveTicket.isPending ? "Recording…" : "Approve fix"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject — required reason, posted to the thread; dispatcher closes the branch */}
      <AlertDialog
        open={rejectOpen}
        onOpenChange={(next) => {
          setRejectOpen(next);
          if (!next) setRejectReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this fix</AlertDialogTitle>
            <AlertDialogDescription>
              The reason is posted to the ticket thread and the dispatcher closes the held
              branch without merging. A reason is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1">
            <Label htmlFor="ticket-reject-reason" className="text-xs text-muted-foreground">
              Rejection reason
            </Label>
            <Textarea
              id="ticket-reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              maxLength={REJECT_REASON_MAX}
              rows={3}
              placeholder="Why is this fix being rejected?"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejectTicket.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={!rejectReasonValid || rejectTicket.isPending}
            >
              {rejectTicket.isPending ? "Rejecting…" : "Reject fix"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
