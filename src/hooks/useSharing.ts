import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateCallListCaches, queryKeys } from '@/lib/query-config'
import {
  createShareLink as createShareLinkService,
  fetchSharedCall,
  getShareAccessLog,
  listShareLinks,
  listSharedWithMe,
  revokeShareLink as revokeShareLinkService,
} from '@/services/sharing.service'
import type {
  CreateShareLinkInput,
  ShareAccessLogWithUser,
  ShareLink,
  SharedCallStatus,
  SharingStatus,
} from '@/types/sharing'

interface UseSharingOptions {
  recordingId: string | null
  userId?: string
  enabled?: boolean
}

interface UseSharingResult {
  shareLinks: ShareLink[]
  isLoadingLinks: boolean
  sharingStatus: SharingStatus
  createShareLink: (input: CreateShareLinkInput) => Promise<ShareLink>
  revokeShareLink: (linkId: string) => Promise<void>
  isCreating: boolean
  isRevoking: boolean
  getAccessLog: (linkId: string) => Promise<ShareAccessLogWithUser[]>
}

export function useSharing(options: UseSharingOptions): UseSharingResult {
  const { recordingId, userId, enabled = true } = options
  const queryClient = useQueryClient()
  const linksKey = recordingId
    ? queryKeys.sharing.links(recordingId)
    : queryKeys.sharing.links('unresolved')

  const { data: shareLinks = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: linksKey,
    queryFn: () => listShareLinks(recordingId!, userId!),
    enabled: enabled && !!recordingId && !!userId,
  })

  const activeCount = shareLinks.filter((link) => link.status === 'active').length
  const sharingStatus: SharingStatus = {
    hasShareLinks: activeCount > 0,
    shareLinkCount: activeCount,
    visibleToTeam: false,
    visibleToManager: false,
  }

  const createMutation = useMutation({
    mutationFn: (input: CreateShareLinkInput) => createShareLinkService(input),
    onSuccess: (link) => {
      queryClient.setQueryData<ShareLink[]>(
        linksKey,
        (current = []) => [link, ...current],
      )
    },
    onSettled: () => {
      if (recordingId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.sharing.links(recordingId),
        })
      }
      invalidateCallListCaches(queryClient)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (linkId: string) => revokeShareLinkService(linkId),
    onSettled: () => {
      if (recordingId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.sharing.links(recordingId),
        })
      }
      invalidateCallListCaches(queryClient)
    },
  })

  return {
    shareLinks,
    isLoadingLinks,
    sharingStatus,
    createShareLink: createMutation.mutateAsync,
    revokeShareLink: revokeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isRevoking: revokeMutation.isPending,
    getAccessLog: getShareAccessLog,
  }
}

interface UseSharedCallOptions {
  token: string | null
  userId?: string
}

export interface UseSharedCallResult {
  data: SharedCallStatus
  refetch: () => void
}

export function useSharedCall(options: UseSharedCallOptions): UseSharedCallResult {
  const { token, userId } = options
  const { data, isLoading, refetch } = useQuery<SharedCallStatus>({
    queryKey: queryKeys.sharing.byToken(token ?? 'missing'),
    queryFn: () => fetchSharedCall(token!, !!userId),
    enabled: !!token,
  })

  let resolved: SharedCallStatus
  if (!token) {
    resolved = { status: 'not-found' }
  } else if (isLoading) {
    resolved = { status: 'loading' }
  } else {
    resolved = data ?? { status: 'error', message: 'Unknown error' }
  }

  return { data: resolved, refetch }
}

interface UseAccessLogOptions {
  linkId: string | null
  enabled?: boolean
}

interface UseAccessLogResult {
  accessLog: ShareAccessLogWithUser[]
  isLoading: boolean
  refetch: () => void
}

export function useAccessLog(options: UseAccessLogOptions): UseAccessLogResult {
  const { linkId, enabled = true } = options
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: queryKeys.sharing.accessLog(linkId ?? 'missing'),
    queryFn: () => getShareAccessLog(linkId!),
    enabled: enabled && !!linkId,
  })

  return { accessLog: data, isLoading, refetch }
}

export function useSharedWithMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharing.sharedWithMe(),
    queryFn: () => listSharedWithMe(false),
    enabled,
  })
}
