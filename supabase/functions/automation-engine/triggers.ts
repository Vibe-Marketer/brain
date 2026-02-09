/**
 * TRIGGER EVALUATORS
 *
 * Evaluates trigger conditions for automation rules.
 * Each trigger type has specific evaluation logic and configuration options.
 *
 * Supported triggers:
 * - call_created: Fires when a new call is created
 * - transcript_phrase: Matches patterns/phrases in transcripts
 * - sentiment: Fires based on AI sentiment analysis
 * - duration: Fires based on call duration thresholds
 * - webhook: Fires on incoming webhook events
 * - scheduled: Fires on schedule (handled by automation-scheduler)
 */

import type { EvaluationContext } from './condition-evaluator.ts';

// Result of trigger evaluation
export interface TriggerResult {
  fires: boolean;
  reason: string;
  matchDetails?: {
    matchedText?: string;
    matchPosition?: number;
    matchType?: string;
    threshold?: number;
    actual?: number;
  };
}

// Trigger configuration types
export interface PhraseMatchConfig {
  pattern: string;
  match_type?: 'exact' | 'contains' | 'regex' | 'word_boundary';
  case_sensitive?: boolean;
  search_limit?: number; // Limit transcript search to first N characters
  all_patterns?: string[]; // For matching any of multiple patterns
  require_all?: boolean; // Require all patterns to match (AND logic)
}

export interface DurationConfig {
  operator: 'greater_than' | 'greater_than_or_equal' | 'less_than' | 'less_than_or_equal' | 'equal' | 'between';
  minutes: number;
  max_minutes?: number; // For 'between' operator
}

export interface SentimentConfig {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence_threshold?: number;
}

export interface WebhookConfig {
  event_type?: string;
  source?: string;
  payload_filter?: Record<string, unknown>;
}

export interface ScheduledConfig {
  schedule_type: 'cron' | 'interval';
  cron_expression?: string;
  interval_minutes?: number;
  timezone?: string;
}

/**
 * Evaluate phrase matching against transcript
 */
export function evaluatePhraseMatch(
  config: PhraseMatchConfig,
  context: EvaluationContext
): TriggerResult {
  const transcript = context.call?.full_transcript || '';
  const {
    pattern,
    match_type = 'contains',
    case_sensitive = false,
    search_limit,
    all_patterns,
    require_all = false,
  } = config;

  if (!pattern && (!all_patterns || all_patterns.length === 0)) {
    return {
      fires: false,
      reason: 'No pattern configured for phrase trigger',
    };
  }

  if (!transcript) {
    return {
      fires: false,
      reason: 'No transcript available for phrase matching',
    };
  }

  // Apply search limit if configured (for performance on large transcripts)
  const searchText = search_limit && search_limit > 0
    ? transcript.substring(0, search_limit)
    : transcript;

  // Handle multiple patterns
  if (all_patterns && all_patterns.length > 0) {
    return evaluateMultiplePatterns(all_patterns, searchText, match_type, case_sensitive, require_all);
  }

  // Single pattern evaluation
  return evaluateSinglePattern(pattern, searchText, match_type, case_sensitive);
}

/**
 * Evaluate a single pattern against text
 */
function evaluateSinglePattern(
  pattern: string,
  text: string,
  match_type: string,
  case_sensitive: boolean
): TriggerResult {
  const flags = case_sensitive ? '' : 'i';
  let matches = false;
  let matchPosition = -1;
  let matchedText = '';

  switch (match_type) {
    case 'exact':
      matches = case_sensitive
        ? text === pattern
        : text.toLowerCase() === pattern.toLowerCase();
      if (matches) {
        matchPosition = 0;
        matchedText = text;
      }
      break;

    case 'contains': {
      const searchText = case_sensitive ? text : text.toLowerCase();
      const searchPattern = case_sensitive ? pattern : pattern.toLowerCase();
      matchPosition = searchText.indexOf(searchPattern);
      matches = matchPosition !== -1;
      if (matches) {
        matchedText = text.substring(matchPosition, matchPosition + pattern.length);
      }
      break;
    }

    case 'word_boundary': {
      // Match pattern as whole word (not part of another word)
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escapedPattern}\\b`, flags);
      const match = wordBoundaryRegex.exec(text);
      matches = match !== null;
      if (matches && match) {
        matchPosition = match.index;
        matchedText = match[0];
      }
      break;
    }

    case 'regex': {
      try {
        const regex = new RegExp(pattern, flags);
        const match = regex.exec(text);
        matches = match !== null;
        if (matches && match) {
          matchPosition = match.index;
          matchedText = match[0];
        }
      } catch (e) {
        return {
          fires: false,
          reason: `Invalid regex pattern: ${pattern} - ${e instanceof Error ? e.message : String(e)}`,
        };
      }
      break;
    }

    default: {
      // Default to contains
      const searchText = case_sensitive ? text : text.toLowerCase();
      const searchPattern = case_sensitive ? pattern : pattern.toLowerCase();
      matchPosition = searchText.indexOf(searchPattern);
      matches = matchPosition !== -1;
      if (matches) {
        matchedText = text.substring(matchPosition, matchPosition + pattern.length);
      }
      break;
    }
  }

  return {
    fires: matches,
    reason: matches
      ? `Transcript matches pattern "${pattern}" (${match_type})`
      : `Transcript does not match pattern "${pattern}" (${match_type})`,
    matchDetails: matches
      ? {
          matchedText,
          matchPosition,
          matchType: match_type,
        }
      : undefined,
  };
}

/**
 * Evaluate multiple patterns against text
 */
function evaluateMultiplePatterns(
  patterns: string[],
  text: string,
  match_type: string,
  case_sensitive: boolean,
  require_all: boolean
): TriggerResult {
  const results: Array<{ pattern: string; matches: boolean }> = [];

  for (const pattern of patterns) {
    const result = evaluateSinglePattern(pattern, text, match_type, case_sensitive);
    results.push({ pattern, matches: result.fires });
  }

  const matchedPatterns = results.filter((r) => r.matches).map((r) => r.pattern);
  const unmatchedPatterns = results.filter((r) => !r.matches).map((r) => r.pattern);

  if (require_all) {
    const allMatch = results.every((r) => r.matches);
    return {
      fires: allMatch,
      reason: allMatch
        ? `All ${patterns.length} patterns matched`
        : `${unmatchedPatterns.length} of ${patterns.length} patterns did not match: [${unmatchedPatterns.join(', ')}]`,
      matchDetails: {
        matchType: match_type,
      },
    };
  } else {
    const anyMatch = results.some((r) => r.matches);
    return {
      fires: anyMatch,
      reason: anyMatch
        ? `Matched patterns: [${matchedPatterns.join(', ')}]`
        : `None of ${patterns.length} patterns matched`,
      matchDetails: anyMatch
        ? {
            matchType: match_type,
          }
        : undefined,
    };
  }
}

/**
 * Evaluate duration trigger
 */
export function evaluateDuration(
  config: DurationConfig,
  context: EvaluationContext
): TriggerResult {
  const { operator = 'greater_than', minutes, max_minutes } = config;
  const actualDuration = context.call?.duration_minutes || 0;

  if (minutes === undefined || minutes === null) {
    return {
      fires: false,
      reason: 'No duration threshold configured',
    };
  }

  let matches = false;
  let description = '';

  switch (operator) {
    case 'greater_than':
      matches = actualDuration > minutes;
      description = `${actualDuration} > ${minutes}`;
      break;

    case 'greater_than_or_equal':
      matches = actualDuration >= minutes;
      description = `${actualDuration} >= ${minutes}`;
      break;

    case 'less_than':
      matches = actualDuration < minutes;
      description = `${actualDuration} < ${minutes}`;
      break;

    case 'less_than_or_equal':
      matches = actualDuration <= minutes;
      description = `${actualDuration} <= ${minutes}`;
      break;

    case 'equal':
      matches = actualDuration === minutes;
      description = `${actualDuration} === ${minutes}`;
      break;

    case 'between':
      if (max_minutes !== undefined) {
        matches = actualDuration >= minutes && actualDuration <= max_minutes;
        description = `${minutes} <= ${actualDuration} <= ${max_minutes}`;
      } else {
        matches = actualDuration >= minutes;
        description = `${actualDuration} >= ${minutes} (no max specified)`;
      }
      break;

    default:
      matches = actualDuration > minutes;
      description = `${actualDuration} > ${minutes}`;
  }

  return {
    fires: matches,
    reason: matches
      ? `Duration ${actualDuration} minutes satisfies ${operator} ${minutes} minutes`
      : `Duration ${actualDuration} minutes does not satisfy ${operator} ${minutes} minutes`,
    matchDetails: {
      threshold: minutes,
      actual: actualDuration,
    },
  };
}

/**
 * Evaluate sentiment trigger
 */
export function evaluateSentiment(
  config: SentimentConfig,
  context: EvaluationContext
): TriggerResult {
  const { sentiment: targetSentiment, confidence_threshold = 0 } = config;
  const actualSentiment = context.call?.sentiment;
  const actualConfidence = context.call?.sentiment_confidence || 0;

  if (!targetSentiment) {
    return {
      fires: false,
      reason: 'No target sentiment configured',
    };
  }

  if (!actualSentiment) {
    return {
      fires: false,
      reason: 'Call sentiment not analyzed yet',
    };
  }

  const sentimentMatches = actualSentiment.toLowerCase() === targetSentiment.toLowerCase();
  const confidenceOk = actualConfidence >= confidence_threshold;

  if (sentimentMatches && confidenceOk) {
    return {
      fires: true,
      reason: `Sentiment "${actualSentiment}" matches target "${targetSentiment}" with confidence ${actualConfidence.toFixed(2)} >= ${confidence_threshold}`,
      matchDetails: {
        threshold: confidence_threshold,
        actual: actualConfidence,
      },
    };
  }

  return {
    fires: false,
    reason: sentimentMatches
      ? `Confidence ${actualConfidence.toFixed(2)} below threshold ${confidence_threshold}`
      : `Sentiment "${actualSentiment}" does not match target "${targetSentiment}"`,
  };
}

/**
 * Evaluate webhook trigger
 * Webhooks always fire if they reach this point (signature verification happens earlier)
 */
export function evaluateWebhook(
  config: WebhookConfig,
  context: EvaluationContext
): TriggerResult {
  const { event_type, source, payload_filter } = config;
  const webhookData = context.custom?.webhook as Record<string, unknown> | undefined;

  // If no webhook data in context, the trigger didn't come from a webhook
  if (!webhookData) {
    return {
      fires: true,
      reason: 'Webhook trigger fires on valid webhook request (no filter configured)',
    };
  }

  // Check event type filter if configured
  if (event_type && webhookData.event_type !== event_type) {
    return {
      fires: false,
      reason: `Webhook event type "${webhookData.event_type}" does not match expected "${event_type}"`,
    };
  }

  // Check source filter if configured
  if (source && webhookData.source !== source) {
    return {
      fires: false,
      reason: `Webhook source "${webhookData.source}" does not match expected "${source}"`,
    };
  }

  // Check payload filter if configured
  if (payload_filter) {
    const payload = webhookData.payload as Record<string, unknown> | undefined;
    if (!matchesPayloadFilter(payload, payload_filter)) {
      return {
        fires: false,
        reason: 'Webhook payload does not match filter criteria',
      };
    }
  }

  return {
    fires: true,
    reason: event_type
      ? `Webhook trigger fires for event type "${event_type}"`
      : 'Webhook trigger fires on valid webhook request',
  };
}

/**
 * Check if payload matches filter criteria
 */
function matchesPayloadFilter(
  payload: Record<string, unknown> | undefined,
  filter: Record<string, unknown>
): boolean {
  if (!payload) return false;

  for (const [key, expectedValue] of Object.entries(filter)) {
    const actualValue = payload[key];

    // Handle nested object comparison
    if (typeof expectedValue === 'object' && expectedValue !== null && !Array.isArray(expectedValue)) {
      if (typeof actualValue !== 'object' || actualValue === null) {
        return false;
      }
      if (!matchesPayloadFilter(actualValue as Record<string, unknown>, expectedValue as Record<string, unknown>)) {
        return false;
      }
    } else if (actualValue !== expectedValue) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate scheduled trigger
 * Scheduled triggers are handled by the scheduler and always fire when evaluated
 */
export function evaluateScheduled(
  config: ScheduledConfig,
  context: EvaluationContext
): TriggerResult {
  const { schedule_type, cron_expression, interval_minutes, timezone } = config;

  // Scheduled triggers fire based on the scheduler, not conditions
  // When the scheduler calls the engine, the trigger should fire
  const scheduleDescription = schedule_type === 'cron'
    ? `cron: ${cron_expression || 'not configured'}`
    : `every ${interval_minutes || 0} minutes`;

  return {
    fires: true,
    reason: `Scheduled trigger fires on schedule (${scheduleDescription}${timezone ? `, timezone: ${timezone}` : ''})`,
  };
}

/**
 * Main entry point: Evaluate trigger based on type and configuration
 */
export function evaluateTrigger(
  triggerType: string,
  triggerConfig: Record<string, unknown>,
  context: EvaluationContext
): TriggerResult {
  switch (triggerType) {
    case 'call_created':
      // Call created trigger always fires for new calls
      return {
        fires: true,
        reason: 'Call created trigger always fires for new calls',
      };

    case 'transcript_phrase':
      return evaluatePhraseMatch(triggerConfig as PhraseMatchConfig, context);

    case 'sentiment':
      return evaluateSentiment(triggerConfig as SentimentConfig, context);

    case 'duration':
      return evaluateDuration(triggerConfig as DurationConfig, context);

    case 'webhook':
      return evaluateWebhook(triggerConfig as WebhookConfig, context);

    case 'scheduled':
      return evaluateScheduled(triggerConfig as ScheduledConfig, context);

    default:
      return {
        fires: false,
        reason: `Unknown trigger type: ${triggerType}`,
      };
  }
}
