/**
 * Admin queue-control mutations (14-02) — priority quick-set + URGENT toggle.
 *
 * NEW file by design: useTickets.ts is owned by 15-03. Ticket query keys are
 * invalidated by shape (['tickets'] list prefix + ['ticket', id] detail) —
 * the same shapes useTickets.ts uses.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  updateTicketQueueControls,
  workTicketNow,
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

/**
 * "Work now" — jump a ticket to the front of the autopilot queue (urgent +
 * priority 3, requeued, backoff cleared). Bypasses the budget cap via the
 * urgent lane; the daemon claims it on its next poll (~5 min).
 */
export function useWorkTicketNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: string) => workTicketNow(ticketId),
    onSuccess: (_data, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      queryClient.invalidateQueries({ queryKey: ["ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast.success("Moved to the front of the queue", {
        description:
          "The autopilot picks it up on its next check (~5 min) ahead of everything else.",
      });
    },
    onError: (err) =>
      toast.error("Couldn't queue this ticket", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      }),
  });
}
