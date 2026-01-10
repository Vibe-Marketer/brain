/**
 * CONDITION EVALUATOR
 *
 * Evaluates complex condition trees with AND/OR logic for automation rules.
 * Supports various condition types: field, transcript, participant, category, tag, sentiment, time.
 */

// Type definitions for conditions
export interface ConditionValue {
  value?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  flags?: string;
}

export interface Condition {
  // For leaf conditions
  field?: string;
  operator?:
    | '='
    | '!='
    | '>'
    | '>='
    | '<'
    | '<='
    | 'contains'
    | 'not_contains'
    | 'starts_with'
    | 'ends_with'
    | 'matches'
    | 'not_matches'
    | 'in'
    | 'not_in'
    | 'is_empty'
    | 'is_not_empty'
    | 'between';
  value?: ConditionValue;
  condition_type?: 'field' | 'transcript' | 'participant' | 'category' | 'tag' | 'sentiment' | 'time' | 'custom';

  // For group conditions (AND/OR)
  logic_operator?: 'AND' | 'OR';
  conditions?: Condition[];
}

export interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

// Context data provided for condition evaluation
export interface EvaluationContext {
  // Call data
  call?: {
    recording_id?: number;
    title?: string;
    duration_minutes?: number;
    created_at?: string;
    participant_count?: number;
    calendar_invitees?: Array<{ email?: string; name?: string }>;
    full_transcript?: string;
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentiment_confidence?: number;
  };
  // Category assignment
  category?: {
    id?: string;
    name?: string;
  };
  // Tag assignments
  tags?: Array<{
    id?: string;
    name?: string;
  }>;
  // Custom fields
  custom?: Record<string, unknown>;
}

export interface EvaluationResult {
  passed: boolean;
  reason: string;
  details?: Array<{
    condition: Condition;
    result: boolean;
    reason: string;
  }>;
}

/**
 * Get a value from the evaluation context by field name
 */
function getFieldValue(context: EvaluationContext, field: string): unknown {
  const parts = field.split('.');
  let value: unknown = context;

  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Compare two values using the specified operator
 */
function compareValues(
  actual: unknown,
  operator: Condition['operator'],
  expected: ConditionValue
): { result: boolean; reason: string } {
  // Handle is_empty/is_not_empty first
  if (operator === 'is_empty') {
    const isEmpty = actual === null || actual === undefined || actual === '' ||
      (Array.isArray(actual) && actual.length === 0);
    return {
      result: isEmpty,
      reason: isEmpty ? 'Value is empty' : `Value is not empty: ${String(actual)}`,
    };
  }

  if (operator === 'is_not_empty') {
    const isNotEmpty = actual !== null && actual !== undefined && actual !== '' &&
      !(Array.isArray(actual) && actual.length === 0);
    return {
      result: isNotEmpty,
      reason: isNotEmpty ? `Value is not empty: ${String(actual)}` : 'Value is empty',
    };
  }

  // For other operators, get the comparison value
  const expectedValue = expected.value;

  // Numeric comparisons
  if (operator === '>' || operator === '>=' || operator === '<' || operator === '<=') {
    const numActual = Number(actual);
    const numExpected = Number(expectedValue);

    if (isNaN(numActual) || isNaN(numExpected)) {
      return {
        result: false,
        reason: `Cannot compare non-numeric values: ${actual} ${operator} ${expectedValue}`,
      };
    }

    let result = false;
    switch (operator) {
      case '>':
        result = numActual > numExpected;
        break;
      case '>=':
        result = numActual >= numExpected;
        break;
      case '<':
        result = numActual < numExpected;
        break;
      case '<=':
        result = numActual <= numExpected;
        break;
    }

    return {
      result,
      reason: `${numActual} ${operator} ${numExpected} is ${result}`,
    };
  }

  // Equality comparisons
  if (operator === '=') {
    const result = String(actual).toLowerCase() === String(expectedValue).toLowerCase();
    return {
      result,
      reason: result ? `${actual} equals ${expectedValue}` : `${actual} does not equal ${expectedValue}`,
    };
  }

  if (operator === '!=') {
    const result = String(actual).toLowerCase() !== String(expectedValue).toLowerCase();
    return {
      result,
      reason: result ? `${actual} does not equal ${expectedValue}` : `${actual} equals ${expectedValue}`,
    };
  }

  // String containment
  const strActual = String(actual || '').toLowerCase();

  if (operator === 'contains') {
    const result = strActual.includes(String(expectedValue).toLowerCase());
    return {
      result,
      reason: result ? `"${actual}" contains "${expectedValue}"` : `"${actual}" does not contain "${expectedValue}"`,
    };
  }

  if (operator === 'not_contains') {
    const result = !strActual.includes(String(expectedValue).toLowerCase());
    return {
      result,
      reason: result
        ? `"${actual}" does not contain "${expectedValue}"`
        : `"${actual}" contains "${expectedValue}"`,
    };
  }

  if (operator === 'starts_with') {
    const result = strActual.startsWith(String(expectedValue).toLowerCase());
    return {
      result,
      reason: result
        ? `"${actual}" starts with "${expectedValue}"`
        : `"${actual}" does not start with "${expectedValue}"`,
    };
  }

  if (operator === 'ends_with') {
    const result = strActual.endsWith(String(expectedValue).toLowerCase());
    return {
      result,
      reason: result
        ? `"${actual}" ends with "${expectedValue}"`
        : `"${actual}" does not end with "${expectedValue}"`,
    };
  }

  // Regex matching
  if (operator === 'matches' || operator === 'not_matches') {
    const pattern = expected.pattern || String(expectedValue);
    const flags = expected.flags || 'i';
    try {
      const regex = new RegExp(pattern, flags);
      const matches = regex.test(String(actual || ''));
      const result = operator === 'matches' ? matches : !matches;
      return {
        result,
        reason: result
          ? `"${actual}" ${operator === 'matches' ? 'matches' : 'does not match'} pattern "${pattern}"`
          : `"${actual}" ${operator === 'matches' ? 'does not match' : 'matches'} pattern "${pattern}"`,
      };
    } catch (e) {
      return {
        result: false,
        reason: `Invalid regex pattern: ${pattern} - ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // Array membership
  if (operator === 'in' || operator === 'not_in') {
    const values = expected.values || [];
    const actualLower = String(actual).toLowerCase();
    const isIn = values.some((v) => String(v).toLowerCase() === actualLower);
    const result = operator === 'in' ? isIn : !isIn;
    return {
      result,
      reason: result
        ? `"${actual}" is ${operator === 'in' ? 'in' : 'not in'} [${values.join(', ')}]`
        : `"${actual}" is ${operator === 'in' ? 'not in' : 'in'} [${values.join(', ')}]`,
    };
  }

  // Range check
  if (operator === 'between') {
    const numActual = Number(actual);
    const min = Number(expected.min);
    const max = Number(expected.max);

    if (isNaN(numActual) || isNaN(min) || isNaN(max)) {
      return {
        result: false,
        reason: `Cannot perform range check on non-numeric values: ${actual} between ${min} and ${max}`,
      };
    }

    const result = numActual >= min && numActual <= max;
    return {
      result,
      reason: result
        ? `${numActual} is between ${min} and ${max}`
        : `${numActual} is not between ${min} and ${max}`,
    };
  }

  return {
    result: false,
    reason: `Unknown operator: ${operator}`,
  };
}

/**
 * Evaluate a single condition against the context
 */
function evaluateCondition(condition: Condition, context: EvaluationContext): { result: boolean; reason: string } {
  // Check if this is a group condition (has nested conditions)
  if (condition.conditions && condition.logic_operator) {
    return evaluateConditionGroup(
      { operator: condition.logic_operator, conditions: condition.conditions },
      context
    );
  }

  // Leaf condition - evaluate based on type
  const conditionType = condition.condition_type || 'field';
  let fieldValue: unknown;

  switch (conditionType) {
    case 'field':
      fieldValue = getFieldValue(context, condition.field || '');
      break;

    case 'transcript':
      fieldValue = context.call?.full_transcript || '';
      break;

    case 'participant':
      // Return participant emails as comma-separated string for matching
      fieldValue = context.call?.calendar_invitees?.map((p) => p.email || p.name).join(', ') || '';
      break;

    case 'category':
      fieldValue = context.category?.name || '';
      break;

    case 'tag':
      // Return tag names as comma-separated string for matching
      fieldValue = context.tags?.map((t) => t.name).join(', ') || '';
      break;

    case 'sentiment':
      fieldValue = context.call?.sentiment || '';
      break;

    case 'time':
      // Get time-related field from call
      if (condition.field === 'day_of_week') {
        const date = context.call?.created_at ? new Date(context.call.created_at) : new Date();
        fieldValue = date.getDay(); // 0 = Sunday, 6 = Saturday
      } else if (condition.field === 'hour') {
        const date = context.call?.created_at ? new Date(context.call.created_at) : new Date();
        fieldValue = date.getHours();
      } else {
        fieldValue = getFieldValue(context, `call.${condition.field || ''}`);
      }
      break;

    case 'custom':
      fieldValue = getFieldValue(context, `custom.${condition.field || ''}`);
      break;

    default:
      return {
        result: false,
        reason: `Unknown condition type: ${conditionType}`,
      };
  }

  if (!condition.operator) {
    return {
      result: false,
      reason: 'Missing operator in condition',
    };
  }

  return compareValues(fieldValue, condition.operator, condition.value || {});
}

/**
 * Evaluate a condition group (AND/OR) recursively
 */
function evaluateConditionGroup(
  group: ConditionGroup,
  context: EvaluationContext
): { result: boolean; reason: string } {
  if (!group.conditions || group.conditions.length === 0) {
    return {
      result: true,
      reason: 'Empty condition group (vacuously true)',
    };
  }

  const results: Array<{ condition: Condition; result: boolean; reason: string }> = [];

  for (const condition of group.conditions) {
    const evaluation = evaluateCondition(condition, context);
    results.push({
      condition,
      result: evaluation.result,
      reason: evaluation.reason,
    });
  }

  let passed: boolean;
  let reason: string;

  if (group.operator === 'AND') {
    passed = results.every((r) => r.result);
    reason = passed
      ? `All ${results.length} conditions passed (AND)`
      : `Failed: ${results.filter((r) => !r.result).length} of ${results.length} conditions failed (AND)`;
  } else {
    // OR
    passed = results.some((r) => r.result);
    reason = passed
      ? `At least one condition passed: ${results.filter((r) => r.result).length} of ${results.length} (OR)`
      : `None of ${results.length} conditions passed (OR)`;
  }

  return { result: passed, reason };
}

/**
 * Main entry point: Evaluate a complete condition tree against context
 */
export function evaluateConditions(
  conditions: ConditionGroup | Condition,
  context: EvaluationContext
): EvaluationResult {
  // Normalize to ConditionGroup
  const group: ConditionGroup = 'operator' in conditions && 'conditions' in conditions
    ? (conditions as ConditionGroup)
    : { operator: 'AND', conditions: [conditions as Condition] };

  const details: EvaluationResult['details'] = [];

  // Evaluate each top-level condition
  for (const condition of group.conditions) {
    const evaluation = evaluateCondition(condition, context);
    details.push({
      condition,
      result: evaluation.result,
      reason: evaluation.reason,
    });
  }

  // Compute final result
  let passed: boolean;
  let reason: string;

  if (group.operator === 'AND') {
    passed = details.every((d) => d.result);
    reason = passed
      ? `All ${details.length} conditions passed (AND)`
      : `${details.filter((d) => !d.result).length} of ${details.length} conditions failed (AND)`;
  } else {
    passed = details.some((d) => d.result);
    reason = passed
      ? `${details.filter((d) => d.result).length} of ${details.length} conditions passed (OR)`
      : `All ${details.length} conditions failed (OR)`;
  }

  return {
    passed,
    reason,
    details,
  };
}

// Note: Trigger evaluation has been moved to triggers.ts for better organization.
// Use: import { evaluateTrigger } from './triggers.ts';
