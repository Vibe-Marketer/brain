import { supabase } from '@/integrations/supabase/client';

interface SubmitSupportTicketParams {
  message: string;
  replyEmail?: string;
  userId?: string;
  organizationId?: string | null;
  workspaceId?: string | null;
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
}

function getAppVersion(): string | undefined {
  return import.meta.env.VITE_APP_VERSION as string | undefined;
}

function getCommit(): string | undefined {
  return (import.meta.env.VITE_COMMIT_SHA || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA) as string | undefined;
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

  const { error } = await supabase.functions.invoke('send-support-ticket', {
    body: payload,
  });

  if (error) {
    throw error;
  }
}
