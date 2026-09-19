import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { invalidateCallListCaches, queryKeys } from '@/lib/query-config'
import { logger } from '@/lib/logger'
import {
  RecordingAccessError,
  recordingAccessService,
} from '@/services/recording-access.service'
import type {
  DiscoverableRecordingCopies,
  RecordingAccessGrant,
  RecordingAccessManagement,
} from '@/types/recording-access'

function isConflict(error: unknown): boolean {
  return error instanceof RecordingAccessError && error.code === 'REQUEST_ALREADY_RESOLVED'
}

function invalidateLifecycle(
  queryClient: ReturnType<typeof useQueryClient>,
  recordingId: string,
  eventId?: string,
) {
  queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.management(recordingId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.requests(recordingId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.grants(recordingId) })
  if (eventId) {
    queryClient.invalidateQueries({ queryKey: queryKeys.accessPolicy.eventCopies(eventId) })
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() })
}

export function useEventRecordingExistence(eventId: string) {
  return useQuery({
    queryKey: queryKeys.accessPolicy.eventCopies(eventId),
    queryFn: () => recordingAccessService.getEventRecordingExistence(eventId),
    enabled: eventId.length > 0,
  })
}

export function useDiscoverableRecordingCopies(eventId: string) {
  return useQuery({
    queryKey: queryKeys.accessPolicy.eventCopies(eventId),
    queryFn: () => recordingAccessService.listDiscoverableRecordingCopies(eventId),
    enabled: eventId.length > 0,
  })
}

export function useRecordingAccessManagement(recordingId: string) {
  return useQuery({
    queryKey: queryKeys.accessPolicy.management(recordingId),
    queryFn: () => recordingAccessService.getRecordingAccessManagement(recordingId),
    enabled: recordingId.length > 0,
  })
}

export function useRequestRecordingAccess(eventId: string) {
  const queryClient = useQueryClient()
  const discoveryKey = queryKeys.accessPolicy.eventCopies(eventId)

  return useMutation({
    mutationFn: (requestTarget: string) =>
      recordingAccessService.requestRecordingAccess(requestTarget),
    onMutate: async (requestTarget) => {
      await queryClient.cancelQueries({ queryKey: discoveryKey })
      const previous = queryClient.getQueryData<DiscoverableRecordingCopies>(discoveryKey)
      if (previous) {
        queryClient.setQueryData<DiscoverableRecordingCopies>(discoveryKey, {
          ...previous,
          copies: previous.copies.map((copy) => copy.requestTarget === requestTarget
            ? { ...copy, requestState: 'pending', cooldownUntil: null }
            : copy),
        })
      }
      return { previous }
    },
    onSuccess: () => {
      toast.success('Access request sent. The recording owner has been notified.')
    },
    onError: (error, _requestTarget, context) => {
      queryClient.setQueryData(discoveryKey, context?.previous)
      logger.error('Failed to request recording access', error)
      toast.error("Couldn't send your request. Try again.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKey })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread() })
    },
  })
}

export function useApproveRecordingAccessRequest(recordingId: string, eventId?: string) {
  const queryClient = useQueryClient()
  const managementKey = queryKeys.accessPolicy.management(recordingId)

  return useMutation({
    mutationFn: (requestId: string) => recordingAccessService.approveRequest(requestId),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: managementKey })
      const previous = queryClient.getQueryData<RecordingAccessManagement>(managementKey)
      const request = previous?.requests.find((item) => item.id === requestId)
      if (previous && request) {
        const optimisticGrant: RecordingAccessGrant = {
          id: `pending:${requestId}`,
          requestId,
          granteeUserId: '',
          name: request.name,
          verifiedEmail: request.verifiedEmail,
          grantedAt: new Date().toISOString(),
          revokedAt: null,
        }
        queryClient.setQueryData<RecordingAccessManagement>(managementKey, {
          requests: previous.requests.filter((item) => item.id !== requestId),
          grants: [optimisticGrant, ...previous.grants],
        })
      }
      return { previous, request }
    },
    onSuccess: (_result, _requestId, context) => {
      toast.success(`Access approved for ${context?.request?.name ?? 'this participant'}.`)
    },
    onError: (error, _requestId, context) => {
      queryClient.setQueryData(managementKey, context?.previous)
      logger.error('Failed to approve recording access', error)
      toast.error(isConflict(error)
        ? 'This request changed. The latest status is shown.'
        : "Couldn't update this request. Nothing changed. Try again.")
    },
    onSettled: () => {
      invalidateLifecycle(queryClient, recordingId, eventId)
      invalidateCallListCaches(queryClient)
    },
  })
}

export function useDenyRecordingAccessRequest(recordingId: string, eventId?: string) {
  const queryClient = useQueryClient()
  const managementKey = queryKeys.accessPolicy.management(recordingId)

  return useMutation({
    mutationFn: (requestId: string) => recordingAccessService.denyRequest(requestId),
    onMutate: async (requestId) => {
      await queryClient.cancelQueries({ queryKey: managementKey })
      const previous = queryClient.getQueryData<RecordingAccessManagement>(managementKey)
      if (previous) {
        queryClient.setQueryData<RecordingAccessManagement>(managementKey, {
          ...previous,
          requests: previous.requests.filter((item) => item.id !== requestId),
        })
      }
      return { previous }
    },
    onSuccess: () => toast.success('Access request denied.'),
    onError: (error, _requestId, context) => {
      queryClient.setQueryData(managementKey, context?.previous)
      logger.error('Failed to deny recording access', error)
      toast.error(isConflict(error)
        ? 'This request changed. The latest status is shown.'
        : "Couldn't update this request. Nothing changed. Try again.")
    },
    onSettled: () => invalidateLifecycle(queryClient, recordingId, eventId),
  })
}

export function useRevokeRecordingAccessGrant(recordingId: string, eventId?: string) {
  const queryClient = useQueryClient()
  const managementKey = queryKeys.accessPolicy.management(recordingId)

  return useMutation({
    mutationFn: (grantId: string) => recordingAccessService.revokeGrant(grantId),
    onMutate: async (grantId) => {
      await queryClient.cancelQueries({ queryKey: managementKey })
      const previous = queryClient.getQueryData<RecordingAccessManagement>(managementKey)
      const grant = previous?.grants.find((item) => item.id === grantId)
      if (previous) {
        queryClient.setQueryData<RecordingAccessManagement>(managementKey, {
          ...previous,
          grants: previous.grants.filter((item) => item.id !== grantId),
        })
      }
      return { previous, grant }
    },
    onSuccess: (_result, _grantId, context) => {
      toast.success(`Access revoked for ${context?.grant?.name ?? 'this participant'}.`)
    },
    onError: (error, _grantId, context) => {
      queryClient.setQueryData(managementKey, context?.previous)
      logger.error('Failed to revoke recording access', error)
      toast.error("Couldn't revoke access. Nothing changed. Try again.")
    },
    onSettled: () => {
      invalidateLifecycle(queryClient, recordingId, eventId)
      invalidateCallListCaches(queryClient)
    },
  })
}
