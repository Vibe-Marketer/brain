import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useUserRole } from '@/hooks/useUserRole'
import { getTicketSourceMetrics } from '@/services/admin-dashboard.service'
import {
  addTicketMessage,
  createTicket,
  getAttachmentSignedUrl,
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  ATTACHMENT_URL_EXPIRY_SECONDS,
  TICKETS_PAGE_SIZE,
  type AddTicketMessageParams,
  type CreateTicketParams,
  type TicketDetail,
  type TicketFilters,
  type TicketMessage,
  type TicketPage,
  type TicketStatus,
} from '@/services/tickets.service'
import { queryKeys } from '@/lib/query-config'

export function useTickets(
  filters: TicketFilters = {},
  page = 1,
  pageSize = TICKETS_PAGE_SIZE,
) {
  const { session } = useAuth()
  return useQuery<TicketPage>({
    queryKey: ['tickets', filters, page, pageSize],
    queryFn: () =>
      getTickets(filters, { limit: pageSize, offset: (page - 1) * pageSize }),
    enabled: !!session,
    // Live list: the autopilot moves tickets through new -> in_progress ->
    // resolved on its own, so poll so status badges update without a refresh.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  })
}

export function useTicketDetail(ticketId: string | null) {
  const { session } = useAuth()
  return useQuery<TicketDetail>({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicketDetail(ticketId!),
    enabled: !!session && !!ticketId,
  })
}

export function useTicketSourceMetrics() {
  const { session } = useAuth()
  const { isAdmin, loading: roleLoading } = useUserRole()
  return useQuery({
    queryKey: queryKeys.admin.ticketSourceMetrics(),
    queryFn: getTicketSourceMetrics,
    enabled: !!session && !roleLoading && isAdmin,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

/**
 * Resolves a signed URL for one ticket attachment path (15-03, D-05).
 * staleTime sits under the 3600s URL expiry so a cached-but-expired URL is
 * never served to an <img>.
 */
export function useAttachmentUrl(path: string | undefined) {
  const { session } = useAuth()
  return useQuery<string>({
    queryKey: ['attachment-url', path],
    queryFn: () => getAttachmentSignedUrl(path!),
    enabled: !!session && !!path,
    staleTime: (ATTACHMENT_URL_EXPIRY_SECONDS - 300) * 1000,
  })
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: CreateTicketParams) => createTicket(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      toast.success('Ticket created')
    },
    onError: () => toast.error('Ticket could not be created'),
  })
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      updateTicketStatus(ticketId, status),
    onSuccess: (_data, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })
}

/**
 * Reporter (or admin) adds a note / context / proof to an existing ticket.
 *
 * Optimistically appends a placeholder message to the ['ticket', ticketId]
 * detail cache so the note shows instantly, then reconciles with the real row
 * on success and invalidates so any attachment renders via its signed URL.
 */
export function useAddTicketMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: AddTicketMessageParams) => addTicketMessage(params),
    onMutate: async (params) => {
      const detailKey = ['ticket', params.ticketId]
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<TicketDetail>(detailKey)

      // Optimistic placeholder. Attachments stay empty in the optimistic row
      // because the real storage path isn't known until the upload resolves;
      // onSuccess swaps in the real row (which carries the descriptor).
      const optimistic: TicketMessage = {
        id: `optimistic-${Date.now()}`,
        ticket_id: params.ticketId,
        author_type: 'user',
        author_id: params.userId,
        body: params.body.trim(),
        attachments: [],
        created_at: new Date().toISOString(),
      }

      if (previous) {
        queryClient.setQueryData<TicketDetail>(detailKey, {
          ...previous,
          messages: [...previous.messages, optimistic],
        })
      }

      return { previous, optimisticId: optimistic.id }
    },
    onError: (_error, params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['ticket', params.ticketId], context.previous)
      }
      toast.error('Could not add your note')
    },
    onSuccess: (inserted, params, context) => {
      const detailKey = ['ticket', params.ticketId]
      const current = queryClient.getQueryData<TicketDetail>(detailKey)
      if (current) {
        // Replace the optimistic placeholder with the real row.
        queryClient.setQueryData<TicketDetail>(detailKey, {
          ...current,
          messages: current.messages.map((message) =>
            message.id === context?.optimisticId ? inserted : message,
          ),
        })
      }
      toast.success('Note added')
    },
    onSettled: (_data, _error, params) => {
      // Re-sync from the server so attachment signed-URL rendering and the
      // list view both reflect the new message.
      queryClient.invalidateQueries({ queryKey: ['ticket', params.ticketId] })
    },
  })
}
