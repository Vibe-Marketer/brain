/**
 * useRulePreview — Client-side rule preview evaluation.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-config';
import { useOrgContextStore } from '@/stores/orgContextStore';
import { useAuth } from '@/contexts/AuthContext';
import { useRoutingRules } from '@/hooks/useRoutingRules';
import type { RoutingCondition } from '@/types/routing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewCall {
  id: string;
  title: string | null;
  source_app: string | null;
  duration: number | null;
  recording_start_time: string | null;
  source_metadata: Record<string, unknown> | null;
  global_tags: string[] | null;
}

// ---------------------------------------------------------------------------
// Internal: fetch last 20 recordings for preview
// ---------------------------------------------------------------------------

function usePreviewCalls() {
  const { user } = useAuth();
  const activeOrgId = useOrgContextStore((s) => s.activeOrgId);

  return useQuery<PreviewCall[]>({
    queryKey: queryKeys.routingRules.preview(activeOrgId ?? undefined),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select('id, title, source_app, duration, recording_start_time, source_metadata, global_tags')
        .eq('owner_user_id', user!.id)
        .order('recording_start_time', { ascending: false })
        .limit(20);

      if (error) {
        throw new Error(`Failed to fetch preview recordings: ${error.message}`);
      }

      return (data ?? []) as PreviewCall[];
    },
    enabled: !!user && !!activeOrgId,
    staleTime: 5 * 60 * 1000, // 5 minutes — preview data rarely changes
  });
}

// ---------------------------------------------------------------------------
// Internal: evaluate a single condition against a call record
// ---------------------------------------------------------------------------

function evaluateSingleCondition(condition: RoutingCondition, call: PreviewCall): boolean {
  const { field, operator, value } = condition;

  const stringMatch = (haystack: string | null | undefined, needle: string | number, op: string): boolean => {
    const h = (haystack ?? '').toLowerCase();
    const n = String(value).toLowerCase();
    switch (op) {
      case 'contains':     return h.includes(n);
      case 'not_contains': return !h.includes(n);
      case 'equals':       return h === n;
      case 'not_equals':   return h !== n;
      case 'starts_with':  return h.startsWith(n);
      default:             return false;
    }
  };

  switch (field) {
    case 'title':
      return stringMatch(call.title, value, operator);

    case 'source':
      return stringMatch(call.source_app, value, operator);

    case 'duration': {
      const callDurationSec = call.duration ?? 0;
      const thresholdSec = Number(value) * 60;
      if (operator === 'greater_than') return callDurationSec > thresholdSec;
      if (operator === 'less_than')    return callDurationSec < thresholdSec;
      return false;
    }

    case 'participant': {
      const metadata = call.source_metadata as Record<string, unknown> | null;
      const invitees = metadata?.calendar_invitees;
      if (!Array.isArray(invitees)) return false;
      const needle = String(value).toLowerCase();
      return invitees.some((inv) => {
        const invStr = typeof inv === 'string' ? inv : JSON.stringify(inv);
        return invStr.toLowerCase().includes(needle);
      });
    }

    case 'tag': {
      const tags = call.global_tags ?? [];
      const needle = String(value).toLowerCase();
      if (operator === 'equals')       return tags.some((t) => t.toLowerCase() === needle);
      if (operator === 'not_equals')   return tags.every((t) => t.toLowerCase() !== needle);
      if (operator === 'contains')     return tags.some((t) => t.toLowerCase().includes(needle));
      if (operator === 'not_contains') return tags.every((t) => !t.toLowerCase().includes(needle));
      return false;
    }

    case 'date': {
      if (!call.recording_start_time) return false;
      const callTime = new Date(call.recording_start_time).getTime();
      const threshold = new Date(String(value)).getTime();
      if (operator === 'after')  return callTime > threshold;
      if (operator === 'before') return callTime < threshold;
      return false;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Internal: evaluate all conditions against a call (AND / OR)
// ---------------------------------------------------------------------------

export function evaluateConditionsClientSide(
  conditions: RoutingCondition[],
  logicOperator: 'AND' | 'OR',
  call: PreviewCall
): boolean {
  if (conditions.length === 0) return false;

  const activeConditions = conditions.filter((c) => String(c.value).trim() !== '');
  if (activeConditions.length === 0) return false;

  if (logicOperator === 'AND') {
    return activeConditions.every((c) => evaluateSingleCondition(c, call));
  } else {
    return activeConditions.some((c) => evaluateSingleCondition(c, call));
  }
}

// ---------------------------------------------------------------------------
// Public: useRulePreview
// ---------------------------------------------------------------------------

interface RulePreviewResult {
  matchingCount: number;
  matchingCalls: Array<{ id: string; title: string; source_app: string | null }>;
  totalChecked: number;
  isLoading: boolean;
}

/**
 * Evaluates routing conditions client-side against the user's last 20 recordings.
 */
export function useRulePreview(
  conditions: RoutingCondition[],
  logicOperator: 'AND' | 'OR'
): RulePreviewResult {
  const { data: recentCalls = [], isLoading } = usePreviewCalls();

  const result = useMemo(() => {
    const matching = recentCalls.filter((call) =>
      evaluateConditionsClientSide(conditions, logicOperator, call)
    );

    return {
      matchingCount: matching.length,
      matchingCalls: matching.map((c) => ({
        id: c.id,
        title: c.title ?? '(Untitled)',
        source_app: c.source_app,
      })),
      totalChecked: recentCalls.length,
    };
  }, [recentCalls, conditions, logicOperator]);

  return { ...result, isLoading };
}

// ---------------------------------------------------------------------------
// Public: useOverlapCheck
// ---------------------------------------------------------------------------

interface OverlapInfo {
  hasOverlap: boolean;
  overlappingRules: Array<{ ruleId: string; ruleName: string; matchCount: number }>;
}

/**
 * Checks whether any other rule with HIGHER priority (lower priority number)
 * also matches some of the same preview calls.
 */
export function useOverlapCheck(
  conditions: RoutingCondition[],
  logicOperator: 'AND' | 'OR',
  currentRuleId: string | null
): OverlapInfo {
  const { data: recentCalls = [] } = usePreviewCalls();
  const { data: allRules = [] } = useRoutingRules();

  return useMemo(() => {
    const currentMatches = new Set(
      recentCalls
        .filter((call) => evaluateConditionsClientSide(conditions, logicOperator, call))
        .map((c) => c.id)
    );

    if (currentMatches.size === 0) {
      return { hasOverlap: false, overlappingRules: [] };
    }

    const currentRule = allRules.find((r) => r.id === currentRuleId);
    const currentPriority = currentRule?.priority ?? Infinity;

    const overlapping: Array<{ ruleId: string; ruleName: string; matchCount: number }> = [];

    for (const rule of allRules) {
      if (rule.id === currentRuleId) continue;
      if (rule.priority >= currentPriority) continue;
      if (!rule.enabled) continue;

      let matchCount = 0;
      for (const call of recentCalls) {
        if (!currentMatches.has(call.id)) continue;
        if (evaluateConditionsClientSide(rule.conditions, rule.logic_operator, call)) {
          matchCount++;
        }
      }

      if (matchCount > 0) {
        overlapping.push({ ruleId: rule.id, ruleName: rule.name, matchCount });
      }
    }

    return {
      hasOverlap: overlapping.length > 0,
      overlappingRules: overlapping,
    };
  }, [recentCalls, allRules, conditions, logicOperator, currentRuleId]);
}
