import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-config'
import {
  getTags,
  getTagById,
  getTagCounts,
  getTagCountById,
  createTag,
  updateTag,
  deleteTag,
  getTagRules,
  createTagRule,
  updateTagRule,
  deleteTagRule,
  getRecurringTitles,
} from '@/services/tags.service'
import type { TagRuleConditions } from '@/services/tags.service'

// ---------------------------------------------------------------------------
// Tag queries
// ---------------------------------------------------------------------------

export function useTags(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.list(orgId),
    queryFn: () => getTags(orgId!),
    enabled: !!orgId,
  })
}

export function useTag(tagId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.detail(tagId!),
    queryFn: () => getTagById(tagId!),
    enabled: !!tagId,
  })
}

export function useTagCounts(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.counts(orgId),
    queryFn: () => getTagCounts(orgId),
  })
}

export function useTagCountById(tagId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.counts(tagId),
    queryFn: () => getTagCountById(tagId!),
    enabled: !!tagId,
  })
}

// ---------------------------------------------------------------------------
// Tag mutations
// ---------------------------------------------------------------------------

export function useCreateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orgId, data }: { orgId: string; data: { name: string; color?: string; description?: string } }) =>
      createTag(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tagId, data }: { tagId: string; data: Partial<{ name: string; color: string; description: string | null }> }) =>
      updateTag(tagId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.detail(variables.tagId) })
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tagId: string) => deleteTag(tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.all })
    },
  })
}

// ---------------------------------------------------------------------------
// Tag Rule queries
// ---------------------------------------------------------------------------

export function useTagRules(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.rules(orgId),
    queryFn: () => getTagRules(orgId),
  })
}

// ---------------------------------------------------------------------------
// Tag Rule mutations
// ---------------------------------------------------------------------------

export function useCreateTagRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      orgId,
      data,
    }: {
      orgId: string
      data: {
        name: string
        description?: string | null
        rule_type: string
        conditions: TagRuleConditions
        tag_id?: string | null
        folder_id?: string | null
        priority?: number
        is_active?: boolean
      }
    }) => createTagRule(orgId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.rules() })
    },
  })
}

export function useUpdateTagRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      ruleId,
      data,
    }: {
      ruleId: string
      data: {
        name?: string
        description?: string | null
        rule_type?: string
        conditions?: TagRuleConditions
        tag_id?: string | null
        folder_id?: string | null
        priority?: number
        is_active?: boolean
      }
    }) => updateTagRule(ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.rules() })
    },
  })
}

export function useDeleteTagRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ruleId: string) => deleteTagRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags.rules() })
    },
  })
}

// ---------------------------------------------------------------------------
// Recurring Titles
// ---------------------------------------------------------------------------

export function useRecurringTitles(orgId?: string) {
  return useQuery({
    queryKey: queryKeys.tags.recurringTitles(orgId),
    queryFn: () => getRecurringTitles(orgId),
  })
}
