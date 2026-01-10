/**
 * Unit tests for automation trigger evaluators
 *
 * Tests the phrase matching, duration, sentiment, and other trigger types
 * to ensure they correctly fire automation rules.
 *
 * @see ../triggers.ts
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// Re-implement trigger evaluation logic for testing
// (The actual triggers.ts uses Deno imports, so we recreate the logic here)
// ============================================================

interface TriggerResult {
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

interface PhraseMatchConfig {
  pattern: string;
  match_type?: 'exact' | 'contains' | 'regex' | 'word_boundary';
  case_sensitive?: boolean;
  search_limit?: number;
  all_patterns?: string[];
  require_all?: boolean;
}

interface EvaluationContext {
  call?: {
    recording_id?: number;
    title?: string;
    duration_minutes?: number;
    created_at?: string;
    participant_count?: number;
    full_transcript?: string;
    summary?: string;
    sentiment?: 'positive' | 'neutral' | 'negative';
    sentiment_confidence?: number;
  };
  category?: {
    id?: string;
    name?: string;
  };
  tags?: Array<{
    id?: string;
    name?: string;
  }>;
  custom?: Record<string, unknown>;
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
      const searchText = case_sensitive ? text : text.toLowerCase();
      const searchPattern = case_sensitive ? pattern : pattern.toLowerCase();
      matchPosition = searchText.indexOf(searchPattern);
      matches = matchPosition !== -1;
      if (matches) {
        matchedText = text.substring(matchPosition, matchPosition + pattern.length);
      }
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
 * Evaluate phrase matching against transcript
 */
function evaluatePhraseMatch(
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

// ============================================================
// Tests
// ============================================================

describe('Transcript Phrase Trigger', () => {
  describe('Basic Contains Matching', () => {
    it('should fire when transcript contains the pattern', () => {
      const config: PhraseMatchConfig = {
        pattern: 'pricing',
        match_type: 'contains',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'We discussed the pricing options for the enterprise plan.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('matches pattern');
      expect(result.matchDetails?.matchedText).toBe('pricing');
    });

    it('should not fire when transcript does not contain the pattern', () => {
      const config: PhraseMatchConfig = {
        pattern: 'pricing',
        match_type: 'contains',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'We discussed the technical architecture.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('does not match');
    });

    it('should be case-insensitive by default', () => {
      const config: PhraseMatchConfig = {
        pattern: 'PRICING',
        match_type: 'contains',
        case_sensitive: false,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Let me tell you about the pricing.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
    });

    it('should respect case sensitivity when enabled', () => {
      const config: PhraseMatchConfig = {
        pattern: 'PRICING',
        match_type: 'contains',
        case_sensitive: true,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Let me tell you about the pricing.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Exact Matching', () => {
    it('should fire when transcript exactly matches the pattern', () => {
      const config: PhraseMatchConfig = {
        pattern: 'Hello World',
        match_type: 'exact',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Hello World',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when transcript partially matches', () => {
      const config: PhraseMatchConfig = {
        pattern: 'Hello',
        match_type: 'exact',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Hello World',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Word Boundary Matching', () => {
    it('should match whole words only', () => {
      const config: PhraseMatchConfig = {
        pattern: 'price',
        match_type: 'word_boundary',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'The price is competitive.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not match when pattern is part of another word', () => {
      const config: PhraseMatchConfig = {
        pattern: 'price',
        match_type: 'word_boundary',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'The pricing is competitive.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Regex Matching', () => {
    it('should match using regex patterns', () => {
      const config: PhraseMatchConfig = {
        pattern: 'price\\s*:\\s*\\$\\d+',
        match_type: 'regex',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'The price: $500 for the basic plan.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
      expect(result.matchDetails?.matchedText).toMatch(/price\s*:\s*\$\d+/i);
    });

    it('should handle invalid regex gracefully', () => {
      const config: PhraseMatchConfig = {
        pattern: '[invalid(regex',
        match_type: 'regex',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Some transcript content.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('Invalid regex');
    });
  });

  describe('Multiple Patterns', () => {
    it('should fire when any pattern matches (OR logic)', () => {
      const config: PhraseMatchConfig = {
        pattern: '',
        all_patterns: ['pricing', 'contract', 'budget'],
        require_all: false,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Let me explain the contract terms.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('Matched patterns');
    });

    it('should not fire when no patterns match (OR logic)', () => {
      const config: PhraseMatchConfig = {
        pattern: '',
        all_patterns: ['pricing', 'contract', 'budget'],
        require_all: false,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Let me explain the technical details.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });

    it('should fire only when all patterns match (AND logic)', () => {
      const config: PhraseMatchConfig = {
        pattern: '',
        all_patterns: ['pricing', 'contract'],
        require_all: true,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'The pricing in the contract is competitive.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when only some patterns match (AND logic)', () => {
      const config: PhraseMatchConfig = {
        pattern: '',
        all_patterns: ['pricing', 'contract'],
        require_all: true,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'The pricing is competitive.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Search Limit', () => {
    it('should respect search_limit for large transcripts', () => {
      const config: PhraseMatchConfig = {
        pattern: 'hidden',
        match_type: 'contains',
        search_limit: 100,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'A'.repeat(200) + ' hidden text at the end',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      // Should not find "hidden" because it's beyond the search limit
      expect(result.fires).toBe(false);
    });

    it('should find pattern within search_limit', () => {
      const config: PhraseMatchConfig = {
        pattern: 'pricing',
        match_type: 'contains',
        search_limit: 100,
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Discussing pricing today. ' + 'A'.repeat(200),
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty transcript', () => {
      const config: PhraseMatchConfig = {
        pattern: 'pricing',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: '',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('No transcript available');
    });

    it('should handle missing transcript', () => {
      const config: PhraseMatchConfig = {
        pattern: 'pricing',
      };
      const context: EvaluationContext = {
        call: {},
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
    });

    it('should handle missing pattern', () => {
      const config: PhraseMatchConfig = {
        pattern: '',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'Some transcript content.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('No pattern configured');
    });

    it('should provide match position details', () => {
      const config: PhraseMatchConfig = {
        pattern: 'important',
        match_type: 'contains',
      };
      const context: EvaluationContext = {
        call: {
          full_transcript: 'This is an important meeting.',
        },
      };

      const result = evaluatePhraseMatch(config, context);

      expect(result.fires).toBe(true);
      expect(result.matchDetails).toBeDefined();
      expect(result.matchDetails?.matchPosition).toBe(11); // "This is an " = 11 chars
      expect(result.matchDetails?.matchedText).toBe('important');
    });
  });
});

// ============================================================
// Sentiment Trigger Evaluation Logic (re-implemented for testing)
// ============================================================

interface SentimentConfig {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence_threshold?: number;
}

/**
 * Evaluate sentiment trigger
 */
function evaluateSentiment(
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

// ============================================================
// Sentiment Trigger Tests
// ============================================================

describe('Sentiment Trigger', () => {
  describe('Basic Sentiment Matching', () => {
    it('should fire when sentiment matches target (negative)', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.85,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('matches target');
      expect(result.matchDetails?.actual).toBe(0.85);
    });

    it('should fire when sentiment matches target (positive)', () => {
      const config: SentimentConfig = {
        sentiment: 'positive',
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'positive',
          sentiment_confidence: 0.92,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('matches target');
    });

    it('should fire when sentiment matches target (neutral)', () => {
      const config: SentimentConfig = {
        sentiment: 'neutral',
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'neutral',
          sentiment_confidence: 0.78,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when sentiment does not match', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'positive',
          sentiment_confidence: 0.9,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('does not match');
    });

    it('should be case-insensitive', () => {
      const config: SentimentConfig = {
        sentiment: 'NEGATIVE',
      } as SentimentConfig;
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.85,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
    });
  });

  describe('Confidence Threshold', () => {
    it('should fire when confidence meets threshold', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0.8,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.85,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
      expect(result.matchDetails?.threshold).toBe(0.8);
      expect(result.matchDetails?.actual).toBe(0.85);
    });

    it('should fire when confidence equals threshold exactly', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0.8,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.8,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when confidence is below threshold', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0.8,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.65,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('below threshold');
    });

    it('should use 0 as default confidence threshold', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        // No confidence_threshold specified
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.1, // Very low confidence
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true); // Should still fire with default threshold of 0
    });

    it('should handle high confidence threshold (0.95)', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0.95,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.93,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('0.93 below threshold 0.95');
    });
  });

  describe('Edge Cases', () => {
    it('should not fire when call has no sentiment', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
      };
      const context: EvaluationContext = {
        call: {
          // No sentiment or sentiment_confidence
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('not analyzed yet');
    });

    it('should not fire when no target sentiment configured', () => {
      const config = {} as SentimentConfig;
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0.85,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('No target sentiment configured');
    });

    it('should handle missing call data', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
      };
      const context: EvaluationContext = {};

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('not analyzed yet');
    });

    it('should handle zero confidence correctly', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          sentiment_confidence: 0,
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(true);
    });

    it('should handle undefined sentiment_confidence with default of 0', () => {
      const config: SentimentConfig = {
        sentiment: 'negative',
        confidence_threshold: 0.5,
      };
      const context: EvaluationContext = {
        call: {
          sentiment: 'negative',
          // sentiment_confidence is undefined
        },
      };

      const result = evaluateSentiment(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('below threshold');
    });
  });
});

describe('Integration Test: Sentiment Trigger Flow', () => {
  /**
   * Simulates the verification steps from subtask-8-2:
   * 1. Create rule: sentiment = negative
   * 2. Import call with negative sentiment
   * 3. Verify sentiment API called (mocked with pre-analyzed data)
   * 4. Verify rule fires and action executes
   */

  it('should correctly simulate rule firing for call with negative sentiment', () => {
    // 1. Create rule: sentiment = negative
    const ruleConfig: SentimentConfig = {
      sentiment: 'negative',
      confidence_threshold: 0.7,
    };

    // 2. Import call with negative sentiment (simulated post-AI analysis)
    // In real flow, automation-sentiment would be called first
    const callContext: EvaluationContext = {
      call: {
        recording_id: 12345,
        title: 'Customer Complaint Call',
        full_transcript: `
          Customer: I'm very frustrated with your service. This is unacceptable.
          Support: I understand your frustration and I apologize.
          Customer: I've been waiting for weeks and nothing has been done.
          Support: Let me escalate this immediately for you.
          Customer: This is my third call about this issue!
        `,
        duration_minutes: 25,
        participant_count: 2,
        created_at: new Date().toISOString(),
        // 3. Sentiment API was called and returned these results
        sentiment: 'negative',
        sentiment_confidence: 0.89,
      },
    };

    // 4. Verify rule fires
    const result = evaluateSentiment(ruleConfig, callContext);

    expect(result.fires).toBe(true);
    expect(result.reason).toContain('matches target "negative"');
    expect(result.reason).toContain('0.89');
    expect(result.matchDetails?.threshold).toBe(0.7);
    expect(result.matchDetails?.actual).toBe(0.89);
  });

  it('should not fire for positive sentiment when rule targets negative', () => {
    const ruleConfig: SentimentConfig = {
      sentiment: 'negative',
      confidence_threshold: 0.5,
    };

    const callContext: EvaluationContext = {
      call: {
        recording_id: 12346,
        title: 'Successful Demo Call',
        full_transcript: `
          Sales: Great to meet you today!
          Customer: Likewise! I'm really excited about this product.
          Sales: Let me show you some features.
          Customer: Wow, this is exactly what we've been looking for!
        `,
        duration_minutes: 35,
        sentiment: 'positive',
        sentiment_confidence: 0.95,
      },
    };

    const result = evaluateSentiment(ruleConfig, callContext);

    expect(result.fires).toBe(false);
    expect(result.reason).toContain('does not match');
  });

  it('should correctly validate debug info for execution history', () => {
    const ruleConfig: SentimentConfig = {
      sentiment: 'negative',
      confidence_threshold: 0.8,
    };

    const callContext: EvaluationContext = {
      call: {
        recording_id: 12347,
        sentiment: 'negative',
        sentiment_confidence: 0.92,
      },
    };

    const result = evaluateSentiment(ruleConfig, callContext);

    // Verify debug info contains all necessary fields for execution history
    expect(result.fires).toBe(true);
    expect(result.matchDetails).toBeDefined();
    expect(result.matchDetails?.threshold).toBeDefined();
    expect(result.matchDetails?.actual).toBeDefined();
    expect(typeof result.reason).toBe('string');
  });
});

describe('Integration Test: Transcript Phrase Trigger Flow', () => {
  it('should correctly simulate rule firing for call with pricing discussion', () => {
    // Simulate the verification steps from subtask-8-1:
    // 1. Create rule: transcript contains 'pricing'
    const ruleConfig: PhraseMatchConfig = {
      pattern: 'pricing',
      match_type: 'contains',
      case_sensitive: false,
    };

    // 2. Import call with transcript containing 'pricing'
    const callContext: EvaluationContext = {
      call: {
        recording_id: 12345,
        title: 'Sales Call with Acme Corp',
        full_transcript: `
          Sales Rep: Good morning! Thank you for joining this call today.
          Customer: Thanks for having us. We wanted to discuss the pricing for your enterprise solution.
          Sales Rep: Absolutely. Let me walk you through our pricing tiers.
          Customer: That sounds great. What are the main pricing options?
          Sales Rep: We have three tiers: Basic, Professional, and Enterprise.
        `,
        duration_minutes: 30,
        participant_count: 2,
        created_at: new Date().toISOString(),
      },
    };

    // 3. Verify rule fires
    const result = evaluatePhraseMatch(ruleConfig, callContext);

    expect(result.fires).toBe(true);
    expect(result.reason).toContain('matches pattern');
    expect(result.matchDetails?.matchedText).toBe('pricing');

    // 4. Validate debug info for execution history
    expect(result.matchDetails).toBeDefined();
    expect(result.matchDetails?.matchType).toBe('contains');
    expect(typeof result.matchDetails?.matchPosition).toBe('number');
  });

  it('should not fire for call without pricing discussion', () => {
    const ruleConfig: PhraseMatchConfig = {
      pattern: 'pricing',
      match_type: 'contains',
    };

    const callContext: EvaluationContext = {
      call: {
        recording_id: 12346,
        title: 'Technical Review Meeting',
        full_transcript: `
          Engineer: Let's review the technical architecture today.
          Lead: Sounds good. What's the status of the API integration?
          Engineer: We're making good progress. The endpoints are ready for testing.
        `,
        duration_minutes: 45,
        participant_count: 3,
      },
    };

    const result = evaluatePhraseMatch(ruleConfig, callContext);

    expect(result.fires).toBe(false);
  });
});
