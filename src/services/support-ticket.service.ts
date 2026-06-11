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

interface SubmitSupportTicketParams {
  message: string;
  replyEmail?: string;
  userId?: string;
  organizationId?: string | null;
  workspaceId?: string | null;
  /** Pre-dialog problem-view capture; uploaded at submit time only (Pitfall 4). */
  screenshot?: { blob: Blob; capturedAt: number };
}

interface SupportTicketPayload {
  message: string;
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

export async function submitSupportTicket(params: SubmitSupportTicketParams): Promise<void> {
  const payload: SupportTicketPayload = {
    message: params.message,
    url: window.location.href,
    userAgent: window.navigator.userAgent,
  };

  if (params.replyEmail) payload.replyEmail = params.replyEmail;
  if (params.userId) payload.userId = params.userId;
  if (params.organizationId) payload.organizationId = params.organizationId;
  if (params.workspaceId) payload.workspaceId = params.workspaceId;

  const appVersion = getAppVersion();
  const commit = getCommit();
  if (appVersion) payload.appVersion = appVersion;
  if (commit) payload.commit = commit;

  // Upload happens ONLY at submit time (blob held in memory until then —
  // Pitfall 4 orphan policy). Upload failure never blocks the ticket: the
  // screenshot is additive context, the message is the payload. Without a
  // userId there is no own-folder prefix, so skip the upload (the Edge
  // Function requires a JWT anyway).
  if (params.screenshot && params.userId) {
    try {
      const descriptor = await uploadTicketAttachment(
        params.userId,
        params.screenshot.blob,
        'screenshot',
        params.screenshot.capturedAt,
      );
      payload.attachments = [descriptor];
    } catch (error) {
      console.error('Ticket screenshot upload failed — submitting without attachment:', error);
    }
  }

  const { error } = await supabase.functions.invoke('send-support-ticket', {
    body: payload,
  });

  if (error) {
    throw error;
  }
}
