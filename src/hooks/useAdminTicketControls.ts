/**
 * Admin queue-control mutations (14-02) — priority quick-set + URGENT toggle.
 *
 * NEW file by design: useTickets.ts is owned by 15-03. Ticket query keys are
 * invalidated by shape (['tickets'] list prefix + ['ticket', id] detail) —
 * the same shapes useTickets.ts uses.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateTicketQueueControls,
  type TicketQueueControlsPatch,
} from "@/services/admin-ticket-controls.service";

export function useUpdateTicketQueueControls() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketId,
      patch,
    }: {
      ticketId: string;
      patch: TicketQueueControlsPatch;
    }) => updateTicketQueueControls(ticketId, patch),
    onSuccess: (_data, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
  });
}
