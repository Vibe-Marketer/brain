import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import {
  createTicket,
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  TICKETS_PAGE_SIZE,
  type CreateTicketParams,
  type TicketDetail,
  type TicketFilters,
  type TicketPage,
  type TicketStatus,
} from '@/services/tickets.service'

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
