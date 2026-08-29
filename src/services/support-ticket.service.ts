import { supabase } from '@/integrations/supabase/client';

const TICKET_ATTACHMENTS_BUCKET = 'ticket-attachments';

export type TicketAttachmentKind = 'screenshot' | 'console_log';

/**
 * Storage path reference persisted into ticket_messages.attachments (D-04).
 * Paths only — never inline base64. Shape per 15-RESEARCH Pattern 4.
 */
export interface AttachmentDescriptor {
  type: TicketAttachmentKind;
  bucket: typeof TICKET_ATTACHMENTS_BUCKET;
  path: string;
  mime: string;
  size_bytes: number;
  captured_at: string;
}

/**
 * Ticket types the customer support form exposes. A subset of the full
 * ticket_type enum — Bug feeds the autopilot loop; feature_request /
 * improvement are the human backlog. Defaults to bug when omitted.
 */
export type SupportTicketType = 'bug' | 'feature_request' | 'improvement';

interface SubmitSupportTicketParams {
  message: string;
  /** Customer-chosen type; defaults to 'bug' at the edge when omitted. */
  type?: SupportTicketType;
  replyEmail?: string;
  userId?: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  /** Pre-dialog problem-view capture plus any pasted/uploaded screenshots; uploaded at submit time only (Pitfall 4). */
  screenshots?: Array<{ blob: Blob; capturedAt: number }>;
  /**
   * Serialized console ring buffer (D-03) — derived from useDebugPanel()
   * messages at submit time. An empty-entries buffer is still uploaded: a
   * ticket with zero console history is itself signal.
   */
  consoleBuffer?: { blob: Blob };
}

interface SupportTicketPayload {
  message: string;
  type?: SupportTicketType;
  replyEmail?: string;
  url: string;
  userAgent: string;
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  appVersion?: string;
  commit?: string;
  attachments?: AttachmentDescriptor[];
}

/** Shared with tickets.service createTicket — keep a single copy (11-04). */
export function getAppVersion(): string | undefined {
  return import.meta.env.VITE_APP_VERSION as string | undefined;
}

/** Shared with tickets.service createTicket — keep a single copy (11-04). */
export function getCommit(): string | undefined {
  return (import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA) as string | undefined;
}

const KIND_DEFAULTS: Record<TicketAttachmentKind, { extension: string; mime: string }> = {
  screenshot: { extension: 'jpg', mime: 'image/jpeg' },
  console_log: { extension: 'json', mime: 'application/json' },
};

/**
 * Uploads one ticket attachment into the private ticket-attachments bucket
 * under the reporter's own folder (`${userId}/...` — storage RLS enforces the
 * prefix; the Edge Function re-validates it server-side, T-15-01/02).
 */
export async function uploadTicketAttachment(
  userId: string,
  blob: Blob,
  kind: TicketAttachmentKind,
  capturedAt?: number,
): Promise<AttachmentDescriptor> {
  const defaults = KIND_DEFAULTS[kind];
  const mime = blob.type || defaults.mime;
  const path = `${userId}/${crypto.randomUUID()}.${defaults.extension}`;

  const { error } = await supabase.storage
    .from(TICKET_ATTACHMENTS_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: false });

  if (error) {
    throw error;
  }

  return {
    type: kind,
    bucket: TICKET_ATTACHMENTS_BUCKET,
    path,
    mime,
    size_bytes: blob.size,
    captured_at: new Date(capturedAt ?? Date.now()).toISOString(),
  };
}

export async function submitSupportTicket(
  params: SubmitSupportTicketParams,
): Promise<{ ticketId?: string }> {
  const payload: SupportTicketPayload = {
    message: params.message,
    url: window.location.href,
    userAgent: window.navigator.userAgent,
  };

  if (params.type) payload.type = params.type;
  if (params.replyEmail) payload.replyEmail = params.replyEmail;
  if (params.userId) payload.userId = params.userId;
  if (params.organizationId) payload.organizationId = params.organizationId;
  if (params.workspaceId) payload.workspaceId = params.workspaceId;

  const appVersion = getAppVersion();
  const commit = getCommit();
  if (appVersion) payload.appVersion = appVersion;
  if (commit) payload.commit = commit;

  // Uploads happen ONLY at submit time (blobs held in memory until then —
  // Pitfall 4 orphan policy). Upload failure never blocks the ticket: the
  // attachments are additive context, the message is the payload. Without a
  // userId there is no own-folder prefix, so skip uploads (the Edge
  // Function requires a JWT anyway). Order: screenshots first, console second
  // — either may be absent.
  if (params.userId) {
    const attachments: AttachmentDescriptor[] = [];

    for (const screenshot of params.screenshots ?? []) {
      try {
        attachments.push(
          await uploadTicketAttachment(
            params.userId,
            screenshot.blob,
            'screenshot',
            screenshot.capturedAt,
          ),
        );
      } catch (error) {
        console.error('Ticket screenshot upload failed — submitting without it:', error);
      }
    }

    if (params.consoleBuffer) {
      try {
        attachments.push(
          await uploadTicketAttachment(params.userId, params.consoleBuffer.blob, 'console_log'),
        );
      } catch (error) {
        console.error('Ticket console-log upload failed — submitting without it:', error);
      }
    }

    if (attachments.length > 0) {
      payload.attachments = attachments;
    }
  }

  const { data, error } = await supabase.functions.invoke<{
    success: boolean;
    ticketId?: string;
  }>('send-support-ticket', {
    body: payload,
  });

  if (error) {
    throw error;
  }

  const ticketId =
    typeof data?.ticketId === 'string' && data.ticketId.length > 0 ? data.ticketId : undefined;

  return { ticketId };
}
