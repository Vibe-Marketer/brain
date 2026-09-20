import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { toast } from 'sonner'

import { invalidateCallListCaches, queryKeys } from '@/lib/query-config'
import { logger } from '@/lib/logger'
import { eventDiscoveryService } from '@/services/event-discovery.service'
import type {
  ParticipationClaimConsumeInput,
  ParticipationInvitationInput,
} from '@/types/event-discovery'

const DEFAULT_PAGE_SIZE = 25
const CLAIM_MUTATION_SCOPE = { id: 'participation-claim' } as const

async function syncBeforeDiscoveryRead(): Promise<void> {
  await eventDiscoveryService.syncDiscoveredEventNotifications()
}

function invalidateAuthorizationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.eventDiscovery.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.identityAliases.verifiedEmails() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() })
  queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.all })
  invalidateCallListCaches(queryClient)
}

function invalidateInvitationCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  recordingId: string,
  participantId: string,
): void {
  queryClient.invalidateQueries({
    queryKey: queryKeys.eventDiscovery.invitation(recordingId, participantId),
  })
  queryClient.invalidateQueries({
    queryKey: queryKeys.eventDiscovery.invitations(recordingId),
  })
  queryClient.invalidateQueries({ queryKey: queryKeys.calls.detail(recordingId) })
  invalidateCallListCaches(queryClient)
}

export function useEventDiscoveryCount() {
  return useQuery({
    queryKey: queryKeys.eventDiscovery.count(),
    queryFn: async () => {
      await syncBeforeDiscoveryRead()
      return eventDiscoveryService.countEvents()
    },
  })
}

export function useDiscoveredEvents(limit = DEFAULT_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: queryKeys.eventDiscovery.list(limit),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      await syncBeforeDiscoveryRead()
      return eventDiscoveryService.listEvents({ limit, cursor: pageParam })
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

export function useParticipationInvitationStatus(
  recordingId: string,
  participantId: string,
) {
  return useQuery({
    queryKey: queryKeys.eventDiscovery.invitation(recordingId, participantId),
    queryFn: () => eventDiscoveryService.getParticipationInvitationStatus(participantId),
    enabled: recordingId.length > 0 && participantId.length > 0,
  })
}

export function useParticipationInvitationStatuses(
  recordingId: string,
  participantIds: string[] = [],
) {
  const stableParticipantIds = [...participantIds].sort()
  return useQuery({
    queryKey: [...queryKeys.eventDiscovery.invitations(recordingId), stableParticipantIds] as const,
    queryFn: () => eventDiscoveryService.getParticipationInvitationStatuses({
      recordingId,
      participantIds: stableParticipantIds,
    }),
    enabled: recordingId.length > 0 && stableParticipantIds.length > 0,
  })
}

export function useInspectParticipationClaim() {
  return useMutation({
    mutationKey: ['participation-claim', 'inspect'] as const,
    mutationFn: (token: string) => eventDiscoveryService.inspectParticipationClaim(token),
    scope: CLAIM_MUTATION_SCOPE,
    gcTime: 0,
    onError: () => logger.error('Participation claim inspection failed'),
  })
}

export function useConsumeParticipationClaim() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['participation-claim', 'consume'] as const,
    mutationFn: (input: ParticipationClaimConsumeInput) =>
      eventDiscoveryService.consumeParticipationClaim(input),
    scope: CLAIM_MUTATION_SCOPE,
    gcTime: 0,
    onError: () => logger.error('Participation claim completion failed'),
    onSettled: () => invalidateAuthorizationCaches(queryClient),
  })
}

function useInvitationMutation(
  recordingId: string,
  participantId: string,
  operation: 'send' | 'resend',
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['participation-invitation', operation, recordingId, participantId] as const,
    mutationFn: (input: { sendReminder: boolean }) => {
      const serviceInput: ParticipationInvitationInput = {
        recordingId,
        participantId,
        sendReminder: input.sendReminder,
      }
      return operation === 'send'
        ? eventDiscoveryService.sendParticipationInvitation(serviceInput)
        : eventDiscoveryService.resendParticipationInvitation(serviceInput)
    },
    scope: { id: `participation-invitation:${recordingId}` },
    onSuccess: () => toast.success(operation === 'send' ? 'Invitation sent.' : 'Invitation resent.'),
    onError: () => {
      logger.error(`Participation invitation ${operation} failed`)
      toast.error("Couldn't update this invitation. Try again.")
    },
    onSettled: () => invalidateInvitationCaches(queryClient, recordingId, participantId),
  })
}

export function useSendParticipationInvitation(recordingId: string, participantId: string) {
  return useInvitationMutation(recordingId, participantId, 'send')
}

export function useResendParticipationInvitation(recordingId: string, participantId: string) {
  return useInvitationMutation(recordingId, participantId, 'resend')
}

export function useCancelParticipationReminder(recordingId: string, participantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['participation-invitation', 'cancel-reminder', recordingId, participantId] as const,
    mutationFn: () => eventDiscoveryService.cancelParticipationReminder({ recordingId, participantId }),
    scope: { id: `participation-invitation:${recordingId}` },
    onSuccess: () => toast.success('Reminder canceled.'),
    onError: () => {
      logger.error('Participation reminder cancellation failed')
      toast.error("Couldn't cancel the reminder. Try again.")
    },
    onSettled: () => invalidateInvitationCaches(queryClient, recordingId, participantId),
  })
}

export function useDisconnectVerifiedEmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['eventDiscovery', 'disconnect-verified-email'] as const,
    mutationFn: (aliasId: string) => eventDiscoveryService.disconnectVerifiedEmail(aliasId),
    onError: () => logger.error('Verified email disconnect failed'),
    onSettled: () => invalidateAuthorizationCaches(queryClient),
  })
}
