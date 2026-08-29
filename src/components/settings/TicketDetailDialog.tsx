import { useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  RiAlarmWarningLine,
  RiAttachment2,
  RiCloseLine,
  RiFileTextLine,
  RiFlashlightLine,
  RiLoader2Line,
  RiSendPlaneLine,
} from "@remixicon/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useAddTicketMessage,
  useAttachmentUrl,
  useTicketDetail,
  useUpdateTicketStatus,
} from "@/hooks/useTickets";
import { useUpdateTicketQueueControls, useWorkTicketNow } from "@/hooks/useAdminTicketControls";
import { useRunnerRunsForTicket } from "@/hooks/useAdminDashboard";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { TicketEvidence } from "@/components/admin/TicketEvidence";
import { TicketActivityTimeline } from "@/components/admin/TicketActivityTimeline";
import { RevertControl } from "@/components/admin/RevertControl";
import { ClosureGateBanner } from "@/components/admin/ClosureGateBanner";
import { extractDeployedFixSha } from "@/lib/ticket-revert";
import { evaluateClosureGate } from "@/lib/ticket-closure-gate";
import {
  ticketStatusBadge,
  ticketSeverityBadge,
  ticketTypeMeta,
  getAuthorLabel,
  stripAnsi,
  isEscalationMessage,
  escalationReason,
} from "@/lib/ticket-display";
import {
  REPORTER_ATTACHMENT_MIME_TYPES,
  TICKET_MESSAGE_MAX,
  type AttachmentDescriptor,
  type TicketStatus,
} from "@/services/tickets.service";

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

/** Max attach size in bytes — mirrors the ticket-attachments bucket cap (5MB). */
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Composer at the bottom of the messages thread: a note textarea + optional
 * proof image + Send. Available to the REPORTER (not gated behind isAdmin) —
 * this is the whole point of the feature. On submit it inserts a
 * ticket_messages row (author_type='user') and links the uploaded image.
 */
function AddNoteComposer({ ticketId }: { ticketId: string }) {
  const { user } = useAuth();
  const addMessage = useAddTicketMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= TICKET_MESSAGE_MAX && !!user;
  const isSending = addMessage.isPending;

  const handlePickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0] ?? null;
    if (!picked) return;
    if (picked.size > ATTACHMENT_MAX_BYTES) {
      toast.error("That image is over the 5MB limit");
      event.target.value = "";
      return;
    }
    if (!REPORTER_ATTACHMENT_MIME_TYPES.includes(picked.type as never)) {
      toast.error("Attach a PNG, JPG, or WebP image");
      event.target.value = "";
      return;
    }
    setFile(picked);
  };

  const handleSend = () => {
    if (!canSend || !user) return;
    addMessage.mutate(
      { ticketId, userId: user.id, body: trimmed, file },
      {
        onSuccess: () => {
          setBody("");
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      },
    );
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <Label htmlFor="add-ticket-note" className={sectionLabelClass}>
        Add to this ticket
      </Label>
      <p className="text-xs text-muted-foreground">
        The autopilot reads new notes on its next run — use this to steer it
        (point it at the cause, rule out a path, add proof).
      </p>
      <Textarea
        id="add-ticket-note"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={TICKET_MESSAGE_MAX}
        rows={3}
        placeholder="Add a note, context, or proof…"
        disabled={isSending}
      />
      {file && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5 text-foreground">
            <RiAttachment2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            disabled={isSending}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Remove attachment"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={REPORTER_ATTACHMENT_MIME_TYPES.join(",")}
          onChange={handlePickFile}
          className="hidden"
          aria-hidden="true"
        />
        <Button
          type="button"
          variant="hollow"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
        >
          <RiAttachment2 className="mr-1 h-4 w-4" aria-hidden="true" />
          Attach image
        </Button>
        <Button type="button" size="sm" onClick={handleSend} disabled={!canSend || isSending}>
          {isSending ? (
            <RiLoader2Line className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RiSendPlaneLine className="mr-1 h-4 w-4" aria-hidden="true" />
          )}
          {isSending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

export function TicketDetailDialog({ open, onOpenChange, ticketId }: TicketDetailDialogProps) {
  const { data: detail, isLoading } = useTicketDetail(open ? ticketId : null);
  const updateStatus = useUpdateTicketStatus();
  const { isAdmin } = useUserRole();
  const updateQueueControls = useUpdateTicketQueueControls();
  const workNow = useWorkTicketNow();

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

  // Auto-deploy world: a resolved ticket that pushed a fix to main gets an UNDO
  // affordance (git revert <sha>) instead of the old approval gate.
  const deployedFixSha =
    isAdmin && ticket?.status === "resolved"
      ? extractDeployedFixSha(runnerRuns, detail?.messages ?? [])
      : null;

  // GSD b36e673c: falsifiable closure gate — surfaces whether a resolved
  // ticket's fix actually reproduced, verified, deployed, and survived its
  // observation window, instead of trusting the status label alone.
  const closureGate =
    isAdmin && ticket?.status === "resolved" ? evaluateClosureGate(runnerRuns) : null;

  const currentPriority = ((ticket as { priority?: number } | undefined)?.priority) ?? 0;
  const currentUrgent = ((ticket as { urgent?: boolean } | undefined)?.urgent) ?? false;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        {isLoading || !ticket ? (
          <div className="flex items-center justify-center py-12">
            <DialogTitle className="sr-only">Loading ticket</DialogTitle>
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
                {!["resolved", "rejected"].includes(ticket.status) && (
                  <Button
                    type="button"
                    variant="hollow"
                    size="sm"
                    className="ml-auto"
                    onClick={() => workNow.mutate(ticket.id)}
                    disabled={workNow.isPending}
                  >
                    {workNow.isPending ? (
                      <RiLoader2Line className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RiFlashlightLine className="mr-1 h-4 w-4 text-vibe-orange" aria-hidden="true" />
                    )}
                    Work now
                  </Button>
                )}
              </div>
            )}

            {/* Falsifiable closure gate (GSD b36e673c) — shown before the undo
                control so "resolved" reads as a claim you can check, not a
                fact. */}
            {closureGate && <ClosureGateBanner result={closureGate} />}

            {/* Undo control — fixes auto-deploy now, so a resolved ticket gets
                a one-click `git revert <sha>` instead of an approval gate. */}
            {deployedFixSha && <RevertControl fixSha={deployedFixSha} />}

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

              {/* Composer — reporter (and admin) adds a note / context / proof
                  to an EXISTING ticket. Deliberately NOT gated on isAdmin. */}
              <AddNoteComposer ticketId={ticket.id} />
            </div>

            {/* Unified plain-English activity timeline (TKT-DETAIL): merges
                ticket_events + messages + runner_runs into one narrative. */}
            <div className="space-y-2">
              <p className={sectionLabelClass}>Activity</p>
              <TicketActivityTimeline
                events={detail.events}
                messages={detail.messages}
                runs={isAdmin ? runnerRuns : []}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
