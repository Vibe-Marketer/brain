/**
 * Routing engine for import routing rules.
 * Evaluates org-level routing rules against an incoming ConnectorRecord
 * and returns the first matching destination (first-match-wins).
 *
 * This module has no side effects beyond DB reads.
 * All writes are done by the caller (connector-pipeline.ts).
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { ConnectorRecord } from './connector-pipeline.ts';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Destination resolved by the routing engine.
 * Includes trace metadata so the caller can record which rule fired.
 */
export interface RoutingDestination {
  vaultId: string;
  folderId: string | null;
  matchedRuleId: string;
  matchedRuleName: string;
}

/**
 * Shape of a routing rule row from import_routing_rules.
 */
interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: RoutingCondition[];
  logic_operator: 'AND' | 'OR';
  target_vault_id: string;
  target_folder_id: string | null;
}

/**
 * A single condition within a routing rule's conditions JSONB array.
 */
interface RoutingCondition {
  field: 'title' | 'source' | 'duration' | 'participant' | 'tag' | 'date';
  operator: string;
  value: string | number;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * resolveRoutingDestination: Evaluates org routing rules against an incoming record.
 *
 * Queries import_routing_rules for the bank ordered by priority (ascending).
 * Evaluates each enabled rule's conditions against the record.
 * Returns the first matching rule's destination, or null if no rules match.
 *
 * @param supabase  Supabase client (service role — reads rules bypassing per-user RLS)
 * @param bankId    Organization (bank) to load rules for
 * @param record    Normalized connector record to evaluate conditions against
 * @returns         RoutingDestination for the first matching rule, or null
 */
export async function resolveRoutingDestination(
  supabase: SupabaseClient,
  bankId: string,
  record: ConnectorRecord,
): Promise<RoutingDestination | null> {
  // Query active rules for this bank ordered by priority ascending (lowest first)
  const { data: rules, error } = await supabase
    .from('import_routing_rules')
    .select('id, name, priority, conditions, logic_operator, target_vault_id, target_folder_id')
    .eq('bank_id', bankId)
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (error) {
    console.error('[routing-engine] Failed to load routing rules (failing open):', error);
    // Fail open — a rules query failure should never block an import
    return null;
  }

  if (!rules || rules.length === 0) {
    return null;
  }

  // Evaluate each rule in priority order; return on first match
  for (const rule of rules as RoutingRule[]) {
    if (evaluateRule(rule, record)) {
      return {
        vaultId: rule.target_vault_id,
        folderId: rule.target_folder_id,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
      };
    }
  }

  return null;
}

// ============================================================================
// RULE EVALUATION (not exported — internal logic only)
// ============================================================================

/**
 * evaluateRule: Determines whether a rule's conditions match a record.
 * Applies AND/OR logic across all conditions per rule.
 */
function evaluateRule(rule: RoutingRule, record: ConnectorRecord): boolean {
  const conditions = rule.conditions ?? [];

  // A rule with no conditions matches nothing (prevents accidental catch-alls)
  if (conditions.length === 0) {
    return false;
  }

  if (rule.logic_operator === 'OR') {
    return conditions.some((condition) => evaluateCondition(condition, record));
  }

  // Default: AND — all conditions must match
  return conditions.every((condition) => evaluateCondition(condition, record));
}

/**
 * evaluateCondition: Evaluates a single condition against a record.
 * Dispatches to field-specific evaluators based on condition.field.
 */
function evaluateCondition(condition: RoutingCondition, record: ConnectorRecord): boolean {
  switch (condition.field) {
    case 'title':
      return evaluateString(record.title ?? '', condition.operator, String(condition.value));

    case 'source':
      return evaluateString(record.source_app ?? '', condition.operator, String(condition.value));

    case 'duration': {
      const duration = record.duration ?? 0;
      return evaluateNumber(duration, condition.operator, Number(condition.value));
    }

    case 'participant': {
      const participants = extractParticipants(record);
      // Participant conditions check if any participant matches the value
      return participants.some((p) =>
        evaluateString(p, condition.operator, String(condition.value))
      );
    }

    case 'tag': {
      // Tags are stored in source_metadata.tags as string array
      const tags = extractTags(record);
      return tags.some((t) =>
        evaluateString(t, condition.operator, String(condition.value))
      );
    }

    case 'date': {
      const startTime = record.recording_start_time;
      if (!startTime) return false;
      const recordDate = new Date(startTime);
      const conditionDate = new Date(String(condition.value));
      if (isNaN(conditionDate.getTime()) || isNaN(recordDate.getTime())) return false;
      return evaluateDateOperator(recordDate, condition.operator, conditionDate);
    }

    default:
      // Unknown field type — fail safe (no match)
      console.warn('[routing-engine] Unknown condition field:', condition.field);
      return false;
  }
}

// ============================================================================
// FIELD EVALUATORS
// ============================================================================

/**
 * evaluateString: Case-insensitive string comparison.
 * Supported operators: contains, not_contains, equals, starts_with, ends_with
 */
function evaluateString(actual: string, operator: string, expected: string): boolean {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();

  switch (operator) {
    case 'contains':
      return a.includes(e);
    case 'not_contains':
      return !a.includes(e);
    case 'equals':
      return a === e;
    case 'not_equals':
      return a !== e;
    case 'starts_with':
      return a.startsWith(e);
    case 'ends_with':
      return a.endsWith(e);
    default:
      console.warn('[routing-engine] Unknown string operator:', operator);
      return false;
  }
}

/**
 * evaluateNumber: Numeric comparison.
 * Supported operators: greater_than, less_than, equals, greater_than_or_equal, less_than_or_equal
 */
function evaluateNumber(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case 'greater_than':
      return actual > expected;
    case 'less_than':
      return actual < expected;
    case 'equals':
      return actual === expected;
    case 'greater_than_or_equal':
      return actual >= expected;
    case 'less_than_or_equal':
      return actual <= expected;
    default:
      console.warn('[routing-engine] Unknown number operator:', operator);
      return false;
  }
}

/**
 * evaluateDateOperator: Date comparison.
 * Supported operators: after, before, on
 */
function evaluateDateOperator(actual: Date, operator: string, expected: Date): boolean {
  switch (operator) {
    case 'after':
      return actual > expected;
    case 'before':
      return actual < expected;
    case 'on': {
      // Same calendar day comparison (ignores time)
      return (
        actual.getFullYear() === expected.getFullYear() &&
        actual.getMonth() === expected.getMonth() &&
        actual.getDate() === expected.getDate()
      );
    }
    default:
      console.warn('[routing-engine] Unknown date operator:', operator);
      return false;
  }
}

// ============================================================================
// METADATA EXTRACTORS
// ============================================================================

/**
 * extractParticipants: Extracts participant emails/names from source_metadata.
 * Checks calendar_invitees (array of {email?, name?} objects) and
 * participants (array of strings) for broad connector compatibility.
 */
function extractParticipants(record: ConnectorRecord): string[] {
  const meta = record.source_metadata ?? {};
  const result: string[] = [];

  // calendar_invitees: [{email?: string, name?: string, ...}]
  const invitees = meta['calendar_invitees'];
  if (Array.isArray(invitees)) {
    for (const invitee of invitees) {
      if (typeof invitee === 'object' && invitee !== null) {
        if (typeof invitee['email'] === 'string') result.push(invitee['email']);
        if (typeof invitee['name'] === 'string') result.push(invitee['name']);
      } else if (typeof invitee === 'string') {
        result.push(invitee);
      }
    }
  }

  // participants: [string, ...] — simpler flat array
  const participants = meta['participants'];
  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (typeof p === 'string') result.push(p);
    }
  }

  return result;
}

/**
 * extractTags: Extracts tags from source_metadata.
 * Checks tags and global_tags fields for compatibility with different connectors.
 */
function extractTags(record: ConnectorRecord): string[] {
  const meta = record.source_metadata ?? {};
  const result: string[] = [];

  const tags = meta['tags'];
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === 'string') result.push(t);
    }
  }

  const globalTags = meta['global_tags'];
  if (Array.isArray(globalTags)) {
    for (const t of globalTags) {
      if (typeof t === 'string') result.push(t);
    }
  }

  return result;
}
