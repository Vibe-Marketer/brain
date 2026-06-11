/**
 * Ticket approval service (14-04) — the client half of APPR-02.
 *
 * Approve/reject route through the deployed `ticket-approval` Edge Function
 * (14-01): the function verifies the caller's JWT, checks has_role(caller,
 * 'ADMIN') server-side, writes the dispatcher-recognized approval/rejection
 * `ticket_events` row with the verified admin actor_id, and audits to
 * admin_audit_log. There is NO client INSERT path into ticket_events
 * (service-role-only RLS, T-14-15) — only this functions.invoke bridge.
 *
 * Contract (14-01-SUMMARY "Next Phase Readiness"):
 *   POST { ticket_id, action: 'approve' | 'reject', reason? }
 *   200  { success: true, action, ticket_id }
 *   4xx/5xx { success: false, error }
 *
 * Approve does NOT change ticket status — the dispatcher recognizes the
 * approval event at its next poll (status must still be awaiting_approval),
 * then merges and advances. Reject sets status 'rejected' server-side and
 * posts the reason as an admin ticket_message.
 */
import { supabase } from "@/integrations/supabase/client";

interface TicketApprovalResponse {
  success: boolean;
  action?: "approve" | "reject";
  ticket_id?: string;
  error?: string;
}

/**
 * Extract the function's `{ error }` payload when supabase-js wraps a non-2xx
 * response in a FunctionsHttpError (the error envelope is on the Response,
 * not the thrown message). Falls back to the raw message.
 */
async function describeInvokeError(error: unknown, fallback: string): Promise<string> {
  const maybeContext = (error as { context?: unknown })?.context;
  if (maybeContext instanceof Response) {
    try {
      const payload = (await maybeContext.clone().json()) as TicketApprovalResponse;
      if (payload?.error) return payload.error;
    } catch {
      // non-JSON body — fall through to the message
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Record an admin approval of an awaiting_approval ticket. The dispatcher
 * merges the held branch and advances status on its next poll — this call
 * does NOT locally resolve the ticket.
 */
export async function approveTicket(ticketId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<TicketApprovalResponse>(
    "ticket-approval",
    { body: { ticket_id: ticketId, action: "approve" } },
  );

  if (error) {
    throw new Error(`Failed to approve ticket: ${await describeInvokeError(error, "request failed")}`);
  }
  if (!data?.success) {
    throw new Error(`Failed to approve ticket: ${data?.error ?? "unknown error"}`);
  }
}

/**
 * Record an admin rejection with a required reason. The function posts the
 * reason as an admin ticket_message and moves the ticket to 'rejected'; the
 * dispatcher closes the held branch without merging.
 */
export async function rejectTicket(ticketId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new Error("Failed to reject ticket: a reason is required");
  }

  const { data, error } = await supabase.functions.invoke<TicketApprovalResponse>(
    "ticket-approval",
    { body: { ticket_id: ticketId, action: "reject", reason: trimmed } },
  );

  if (error) {
    throw new Error(`Failed to reject ticket: ${await describeInvokeError(error, "request failed")}`);
  }
  if (!data?.success) {
    throw new Error(`Failed to reject ticket: ${data?.error ?? "unknown error"}`);
  }
}
