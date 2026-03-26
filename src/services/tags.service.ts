import { supabase } from '@/integrations/supabase/client'
import type { Tag } from '@/types/tags'

// ---------------------------------------------------------------------------
// Tags (call_tags)
// ---------------------------------------------------------------------------

export async function getTags(orgId: string): Promise<Tag[]> {
  let query = supabase
    .from('call_tags')
    .select('id, name, color, description, is_system')
    .order('name')

  if (orgId) {
    query = query.eq('organization_id', orgId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to fetch tags: ${error.message}`)
  return data as Tag[]
}

export async function getTagById(tagId: string): Promise<Tag> {
  const { data, error } = await supabase
    .from('call_tags')
    .select('id, name, color, description, is_system, created_at, updated_at')
    .eq('id', tagId)
    .single()

  if (error) throw new Error(`Failed to fetch tag: ${error.message}`)
  return data as Tag
}

export async function createTag(
  orgId: string,
  tagData: { name: string; color?: string; description?: string },
): Promise<Tag> {
  const { data, error } = await supabase
    .from('call_tags')
    .insert({
      name: tagData.name,
      color: tagData.color,
      description: tagData.description,
      is_system: false,
      ...(orgId && { organization_id: orgId }),
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create tag: ${error.message}`)
  return data as Tag
}

export async function updateTag(
  tagId: string,
  updates: Partial<{ name: string; color: string; description: string | null }>,
): Promise<void> {
  const { error } = await supabase
    .from('call_tags')
    .update(updates)
    .eq('id', tagId)

  if (error) throw new Error(`Failed to update tag: ${error.message}`)
}

export async function deleteTag(tagId: string): Promise<void> {
  const { error } = await supabase
    .from('call_tags')
    .delete()
    .eq('id', tagId)

  if (error) throw new Error(`Failed to delete tag: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Tag Counts
// ---------------------------------------------------------------------------

export async function getTagCounts(orgId?: string): Promise<Record<string, number>> {
  // orgId is accepted for cache-key scoping but the query fetches all
  // assignments visible to the current user (RLS-filtered).
  void orgId

  const { data, error } = await supabase
    .from('call_tag_assignments')
    .select('tag_id')

  if (error) throw new Error(`Failed to fetch tag counts: ${error.message}`)

  const counts: Record<string, number> = {}
  ;(data || []).forEach((assignment: { tag_id: string }) => {
    counts[assignment.tag_id] = (counts[assignment.tag_id] || 0) + 1
  })
  return counts
}

export async function getTagCountById(tagId: string): Promise<number> {
  const { count, error } = await supabase
    .from('call_tag_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId)

  if (error) throw new Error(`Failed to fetch tag count: ${error.message}`)
  return count || 0
}

// ---------------------------------------------------------------------------
// Tag Rules
// ---------------------------------------------------------------------------

export interface TagRuleConditions {
  title?: string
  contains?: string
  pattern?: string
  keywords?: string[]
  search_chars?: number
  day_of_week?: number
  hour?: number
}

export interface TagRule {
  id: string
  name: string
  description: string | null
  rule_type: string
  conditions: TagRuleConditions
  tag_id: string | null
  folder_id: string | null
  priority: number
  is_active: boolean | null
  times_applied: number | null
  last_applied_at: string | null
  created_at: string | null
}

export async function getTagRules(orgId?: string): Promise<TagRule[]> {
  void orgId

  const { data, error } = await supabase
    .from('tag_rules')
    .select('*')
    .order('priority')

  if (error) throw new Error(`Failed to fetch tag rules: ${error.message}`)
  return data as TagRule[]
}

export async function createTagRule(
  _orgId: string,
  ruleData: {
    name: string
    description?: string | null
    rule_type: string
    conditions: TagRuleConditions
    tag_id?: string | null
    folder_id?: string | null
    priority?: number
    is_active?: boolean
  },
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) throw new Error('Not authenticated')

  const { error } = await supabase.from('tag_rules').insert({
    user_id: userData.user.id,
    name: ruleData.name,
    description: ruleData.description || null,
    rule_type: ruleData.rule_type,
    tag_id: ruleData.tag_id || null,
    folder_id: ruleData.folder_id || null,
    priority: ruleData.priority ?? 100,
    conditions: ruleData.conditions,
    is_active: ruleData.is_active ?? true,
  })

  if (error) throw new Error(`Failed to create tag rule: ${error.message}`)
}

export async function updateTagRule(
  ruleId: string,
  updates: {
    name?: string
    description?: string | null
    rule_type?: string
    conditions?: TagRuleConditions
    tag_id?: string | null
    folder_id?: string | null
    priority?: number
    is_active?: boolean
  },
): Promise<void> {
  const { error } = await supabase
    .from('tag_rules')
    .update(updates)
    .eq('id', ruleId)

  if (error) throw new Error(`Failed to update tag rule: ${error.message}`)
}

export async function deleteTagRule(ruleId: string): Promise<void> {
  const { error } = await supabase
    .from('tag_rules')
    .delete()
    .eq('id', ruleId)

  if (error) throw new Error(`Failed to delete tag rule: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Recurring Titles
// ---------------------------------------------------------------------------

interface TitleCountData {
  count: number
  lastDate: string
  firstDate: string
}

export interface RecurringTitle {
  title: string
  occurrence_count: number
  last_occurrence: string
  first_occurrence: string
  current_tags: string[] | null
}

export async function getRecurringTitles(_orgId?: string): Promise<RecurringTitle[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('fathom_calls')
    .select('title')
    .eq('user_id', user.id)
    .not('title', 'is', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch recurring titles: ${error.message}`)

  const titleCounts = (data || []).reduce(
    (acc: Record<string, TitleCountData>, call: { title: string; created_at?: string }) => {
      const title = call.title
      if (!acc[title]) {
        acc[title] = { count: 0, lastDate: '', firstDate: '' }
      }
      acc[title].count++
      return acc
    },
    {},
  )

  return Object.entries(titleCounts)
    .map(([title, d]) => ({
      title,
      occurrence_count: d.count,
      last_occurrence: d.lastDate,
      first_occurrence: d.firstDate,
      current_tags: null,
    }))
    .sort((a, b) => b.occurrence_count - a.occurrence_count)
    .slice(0, 50)
}
