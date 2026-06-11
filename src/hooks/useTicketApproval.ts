/**
 * Ticket approval mutations (14-04) — APPR-02 client half.
 *
 * NEW file by design: useTickets.ts is owned by 15-03. Query keys are
 * invalidated by shape — ['tickets'] list prefix, ['ticket', id] detail, and
 * the admin dashboard key (the Needs-You queue surfaces awaiting_approval
 * tickets) — the same shapes the rest of the app uses.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approveTicket, rejectTicket } from "@/services/ticket-approval.service";
import { queryKeys } from "@/lib/query-config";

function useInvalidateTicketViews() {
  const queryClient = useQueryClient();
  return (ticketId: string) => {
    queryClient.invalidateQueries({ queryKey: ["tickets"] });
    queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
  };
}

export function useApproveTicket() {
  const invalidate = useInvalidateTicketViews();
  return useMutation({
    mutationFn: (ticketId: string) => approveTicket(ticketId),
    onSuccess: (_data, ticketId) => {
      invalidate(ticketId);
      // Status stays awaiting_approval until the dispatcher advances it; the
      // dialog shows the "merges on next poll" note rather than a fake resolve.
      toast.success("Approval recorded");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to approve ticket"),
  });
}

export function useRejectTicket() {
  const invalidate = useInvalidateTicketViews();
  return useMutation({
    mutationFn: ({ ticketId, reason }: { ticketId: string; reason: string }) =>
      rejectTicket(ticketId, reason),
    onSuccess: (_data, { ticketId }) => {
      invalidate(ticketId);
      toast.success("Ticket rejected");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Failed to reject ticket"),
  });
}
