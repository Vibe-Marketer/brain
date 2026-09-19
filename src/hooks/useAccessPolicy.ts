import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { invalidateCallListCaches, queryKeys } from '@/lib/query-config'
import { logger } from '@/lib/logger'
import { accessPolicyService } from '@/services/access-policy.service'
import type {
  AccountAccessDefault,
  RecordingAccessLevel,
  RecordingAccessPolicy,
} from '@/types/access-policy'

const ACCESS_LEVEL_LABELS: Record<RecordingAccessLevel, string> = {
  private: 'Private',
  attendees: 'Attendees',
  invitees: 'Invitees',
  organization: 'Organization',
  link: 'Anyone with link',
  public: 'Public',
}

export function useAccountAccessDefault() {
  return useQuery({
    queryKey: queryKeys.accessPolicy.accountDefault(),
    queryFn: accessPolicyService.getAccountAccessDefault,
  })
}

export function useRecordingAccessPolicy(recordingId: string) {
  return useQuery({
    queryKey: queryKeys.accessPolicy.recording(recordingId),
    queryFn: async (): Promise<RecordingAccessPolicy> => {
      const [policy, accountDefault] = await Promise.all([
        accessPolicyService.getRecordingAccessPolicy(recordingId),
        accessPolicyService.getAccountAccessDefault(),
      ])
      return {
        ...policy,
        accountDefault: accountDefault.accessLevel,
      }
    },
    enabled: recordingId.length > 0,
  })
}

export function useSetAccountAccessDefault() {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.accessPolicy.accountDefault()

  return useMutation({
    mutationFn: (accessLevel: RecordingAccessLevel) =>
      accessPolicyService.setAccountAccessDefault(accessLevel),
    onMutate: async (accessLevel) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<AccountAccessDefault>(queryKey)
      queryClient.setQueryData<AccountAccessDefault>(queryKey, { accessLevel })
      return { previous }
    },
    onSuccess: (accountDefault) => {
      queryClient.setQueryData<AccountAccessDefault>(queryKey, accountDefault)
      toast.success(`Default access set to ${ACCESS_LEVEL_LABELS[accountDefault.accessLevel]}.`)
    },
    onError: (error, _accessLevel, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
      logger.error('Failed to update account access default', error)
      toast.error("Couldn't update the default. Your previous setting is still active. Try again.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}

export function useSetRecordingAccessLevel(recordingId: string) {
  const queryClient = useQueryClient()
  const policyKey = queryKeys.accessPolicy.recording(recordingId)

  return useMutation({
    mutationFn: (accessLevel: RecordingAccessLevel) =>
      accessPolicyService.setRecordingAccessLevel(recordingId, accessLevel),
    onMutate: async (accessLevel) => {
      await queryClient.cancelQueries({ queryKey: policyKey })
      const previous = queryClient.getQueryData<RecordingAccessPolicy>(policyKey)
      if (previous) {
        queryClient.setQueryData<RecordingAccessPolicy>(policyKey, {
          ...previous,
          accessLevel,
          origin: 'custom',
        })
      }
      return { previous }
    },
    onSuccess: (policy) => {
      queryClient.setQueryData<RecordingAccessPolicy>(policyKey, (current) => ({
        accessLevel: policy.accessLevel,
        origin: policy.origin,
        accountDefault: current?.accountDefault ?? policy.accessLevel,
      }))
      toast.success('Recording access updated.')
    },
    onError: (error, _accessLevel, context) => {
      queryClient.setQueryData(policyKey, context?.previous)
      logger.error('Failed to update recording access', error)
      toast.error("Couldn't update recording access. Nothing changed. Try again.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: policyKey })
      queryClient.invalidateQueries({
        queryKey: queryKeys.accessPolicy.management(recordingId),
      })
      invalidateCallListCaches(queryClient)
    },
  })
}

export function useResetRecordingAccessLevel(recordingId: string) {
  const queryClient = useQueryClient()
  const policyKey = queryKeys.accessPolicy.recording(recordingId)

  return useMutation({
    mutationFn: () => accessPolicyService.resetRecordingAccessLevel(recordingId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: policyKey })
      const previous = queryClient.getQueryData<RecordingAccessPolicy>(policyKey)
      if (previous) {
        queryClient.setQueryData<RecordingAccessPolicy>(policyKey, {
          ...previous,
          accessLevel: previous.accountDefault,
          origin: 'default',
        })
      }
      return { previous }
    },
    onSuccess: (policy) => {
      queryClient.setQueryData<RecordingAccessPolicy>(policyKey, (current) => ({
        accessLevel: policy.accessLevel,
        origin: policy.origin,
        accountDefault: current?.accountDefault ?? policy.accessLevel,
      }))
      toast.success(`Recording access reset to ${ACCESS_LEVEL_LABELS[policy.accessLevel]}.`)
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(policyKey, context?.previous)
      logger.error('Failed to reset recording access', error)
      toast.error("Couldn't update recording access. Nothing changed. Try again.")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: policyKey })
      queryClient.invalidateQueries({
        queryKey: queryKeys.accessPolicy.management(recordingId),
      })
      invalidateCallListCaches(queryClient)
    },
  })
}
