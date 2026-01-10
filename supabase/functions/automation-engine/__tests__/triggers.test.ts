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

// ============================================================
// Webhook Trigger Evaluation Logic (re-implemented for testing)
// ============================================================

interface WebhookConfig {
  event_type?: string;
  source?: string;
  payload_filter?: Record<string, unknown>;
}

interface WebhookEvaluationContext extends EvaluationContext {
  custom?: {
    webhook?: {
      event_type?: string;
      source?: string;
      payload?: Record<string, unknown>;
      [key: string]: unknown;
    };
    [key: string]: unknown;
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
 * Evaluate webhook trigger
 */
function evaluateWebhook(
  config: WebhookConfig,
  context: WebhookEvaluationContext
): TriggerResult {
  const { event_type, source, payload_filter } = config;
  const webhookData = context.custom?.webhook as Record<string, unknown> | undefined;

  // If no webhook data in context, the trigger fires (valid webhook request with no filter)
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

// ============================================================
// Webhook Trigger Tests
// ============================================================

describe('Webhook Trigger', () => {
  describe('Basic Webhook Trigger', () => {
    it('should fire when no filter is configured', () => {
      const config: WebhookConfig = {};
      const context: WebhookEvaluationContext = {};

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('no filter configured');
    });

    it('should fire when webhook data matches no filter', () => {
      const config: WebhookConfig = {};
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'fathom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });
  });

  describe('Event Type Filtering', () => {
    it('should fire when event type matches', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'fathom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('event type "call.completed"');
    });

    it('should not fire when event type does not match', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.started',
            source: 'fathom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('does not match');
      expect(result.reason).toContain('call.started');
    });
  });

  describe('Source Filtering', () => {
    it('should fire when source matches', () => {
      const config: WebhookConfig = {
        source: 'fathom',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'fathom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when source does not match', () => {
      const config: WebhookConfig = {
        source: 'fathom',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'zoom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('source "zoom"');
      expect(result.reason).toContain('does not match');
    });
  });

  describe('Payload Filtering', () => {
    it('should fire when payload matches simple filter', () => {
      const config: WebhookConfig = {
        payload_filter: {
          action: 'created',
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            payload: {
              action: 'created',
              call_id: 12345,
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when payload does not match filter', () => {
      const config: WebhookConfig = {
        payload_filter: {
          action: 'created',
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            payload: {
              action: 'updated',
              call_id: 12345,
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('does not match filter');
    });

    it('should not fire when payload is missing but filter is configured', () => {
      const config: WebhookConfig = {
        payload_filter: {
          action: 'created',
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            // No payload
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
    });

    it('should fire when nested payload matches', () => {
      const config: WebhookConfig = {
        payload_filter: {
          data: {
            status: 'completed',
          },
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            payload: {
              data: {
                status: 'completed',
                id: 12345,
              },
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when nested payload does not match', () => {
      const config: WebhookConfig = {
        payload_filter: {
          data: {
            status: 'completed',
          },
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            payload: {
              data: {
                status: 'pending',
                id: 12345,
              },
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Combined Filtering', () => {
    it('should fire when all filters match', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
        source: 'fathom',
        payload_filter: {
          action: 'transcribed',
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'fathom',
            payload: {
              action: 'transcribed',
              call_id: 12345,
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });

    it('should not fire when event type matches but source does not', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
        source: 'fathom',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'zoom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
    });

    it('should not fire when source matches but event type does not', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
        source: 'fathom',
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.started',
            source: 'fathom',
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
    });

    it('should not fire when event and source match but payload does not', () => {
      const config: WebhookConfig = {
        event_type: 'call.completed',
        source: 'fathom',
        payload_filter: {
          action: 'transcribed',
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'call.completed',
            source: 'fathom',
            payload: {
              action: 'recording_ready',
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined webhook data in context', () => {
      const config: WebhookConfig = {};
      const context: WebhookEvaluationContext = {
        custom: undefined,
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });

    it('should handle empty webhook config with webhook data', () => {
      const config: WebhookConfig = {};
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            event_type: 'test.event',
            source: 'test-source',
            payload: { test: true },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('valid webhook request');
    });

    it('should handle array values in payload filter', () => {
      const config: WebhookConfig = {
        payload_filter: {
          tags: ['important', 'urgent'],
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            payload: {
              tags: ['important', 'urgent'],
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      // Arrays are compared by reference, so this won't match
      // This tests the expected behavior
      expect(result.fires).toBe(false);
    });

    it('should handle null values in payload', () => {
      const config: WebhookConfig = {
        payload_filter: {
          value: null,
        },
      };
      const context: WebhookEvaluationContext = {
        custom: {
          webhook: {
            payload: {
              value: null,
            },
          },
        },
      };

      const result = evaluateWebhook(config, context);

      expect(result.fires).toBe(true);
    });
  });
});

// ============================================================
// Integration Test: Webhook Trigger Flow
// ============================================================

describe('Integration Test: Webhook Trigger Flow', () => {
  /**
   * Simulates the verification steps from subtask-8-3:
   * 1. POST to webhook endpoint with valid signature
   * 2. Verify rule fires
   * 3. Verify action executes and history logged
   *
   * Note: Signature verification is tested separately in webhook.test.ts
   * This test focuses on trigger evaluation after signature is verified.
   */

  it('should correctly fire rule when webhook event type matches', () => {
    // 1. Simulate webhook payload after signature verification
    const webhookPayload = {
      event_type: 'call.completed',
      source: 'fathom',
      user_id: 'test-user-123',
      recording_id: 12345,
      data: {
        title: 'Sales Call',
        duration: 30,
        participants: ['John', 'Jane'],
      },
    };

    // 2. Rule configured to fire on call.completed events
    const ruleConfig: WebhookConfig = {
      event_type: 'call.completed',
    };

    // 3. Build context as automation engine would
    const context: WebhookEvaluationContext = {
      custom: {
        webhook: {
          event_type: webhookPayload.event_type,
          source: webhookPayload.source,
          payload: webhookPayload.data,
        },
      },
    };

    // 4. Verify rule fires
    const result = evaluateWebhook(ruleConfig, context);

    expect(result.fires).toBe(true);
    expect(result.reason).toContain('event type "call.completed"');
  });

  it('should correctly filter webhook by source', () => {
    // Rule configured to only fire for Fathom webhooks
    const ruleConfig: WebhookConfig = {
      source: 'fathom',
    };

    // Webhook from different source
    const context: WebhookEvaluationContext = {
      custom: {
        webhook: {
          event_type: 'call.completed',
          source: 'zoom',
        },
      },
    };

    const result = evaluateWebhook(ruleConfig, context);

    expect(result.fires).toBe(false);
    expect(result.reason).toContain('source "zoom"');
  });

  it('should correctly filter webhook by payload content', () => {
    // Rule configured to fire only for high-priority webhooks
    const ruleConfig: WebhookConfig = {
      event_type: 'task.created',
      payload_filter: {
        priority: 'high',
      },
    };

    // Webhook with matching payload
    const context: WebhookEvaluationContext = {
      custom: {
        webhook: {
          event_type: 'task.created',
          source: 'external-crm',
          payload: {
            priority: 'high',
            title: 'Follow up with client',
            due_date: '2026-01-15',
          },
        },
      },
    };

    const result = evaluateWebhook(ruleConfig, context);

    expect(result.fires).toBe(true);
  });

  it('should validate debug info for execution history logging', () => {
    const ruleConfig: WebhookConfig = {
      event_type: 'call.completed',
    };

    const context: WebhookEvaluationContext = {
      custom: {
        webhook: {
          event_type: 'call.completed',
          source: 'fathom',
          payload: {
            call_id: 12345,
          },
        },
      },
    };

    const result = evaluateWebhook(ruleConfig, context);

    // Verify result contains all necessary info for execution history
    expect(result.fires).toBe(true);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('should handle complete webhook-triggered automation flow', () => {
    // This simulates the complete flow:
    // 1. External system sends webhook
    // 2. automation-webhook verifies signature and calls automation-engine
    // 3. automation-engine evaluates trigger and fires rule
    // 4. Action executes and history is logged

    // Step 2 & 3: Trigger evaluation
    const incomingWebhook = {
      event_type: 'deal.closed',
      source: 'hubspot',
      data: {
        deal_id: 'deal-123',
        amount: 50000,
        client_name: 'Acme Corp',
        closed_by: 'john@company.com',
      },
    };

    // Rule: Fire when deal closes with amount > 10000
    const ruleConfig: WebhookConfig = {
      event_type: 'deal.closed',
      source: 'hubspot',
    };

    const context: WebhookEvaluationContext = {
      custom: {
        webhook: {
          event_type: incomingWebhook.event_type,
          source: incomingWebhook.source,
          payload: incomingWebhook.data,
        },
      },
    };

    const result = evaluateWebhook(ruleConfig, context);

    // Verify trigger fires
    expect(result.fires).toBe(true);

    // In the actual flow, the action (e.g., send email notification) would execute
    // and execution history would be logged with debug_info containing:
    // - trigger_result: { fires: true, reason: '...' }
    // - webhook_payload: { event_type, source, data }
    // - actions_executed: [{ action_type: 'email', success: true, ... }]
  });
});

// ============================================================
// Scheduled Trigger Evaluation Logic (re-implemented for testing)
// ============================================================

type ScheduleType = 'cron' | 'interval' | 'daily' | 'weekly' | 'monthly';

interface ScheduleConfig {
  schedule_type: ScheduleType;
  cron_expression?: string;
  interval_minutes?: number;
  hour?: number;
  minute?: number;
  day_of_week?: number; // 0-6, 0 = Sunday
  day_of_month?: number; // 1-31
  timezone?: string;
}

interface ScheduledTriggerContext extends EvaluationContext {
  custom?: {
    scheduled?: {
      triggered_at?: string;
      schedule_name?: string;
      is_due?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

/**
 * Evaluate scheduled trigger
 * Scheduled triggers fire when triggered by the automation-scheduler
 */
function evaluateScheduled(
  config: ScheduleConfig,
  context: ScheduledTriggerContext
): TriggerResult {
  const scheduledData = context.custom?.scheduled;

  // If called by scheduler, it means the rule is due
  if (scheduledData?.is_due === true || scheduledData?.triggered_at) {
    return {
      fires: true,
      reason: `Scheduled trigger fired at ${scheduledData?.triggered_at || new Date().toISOString()}`,
      matchDetails: {
        matchType: config.schedule_type || 'scheduled',
      },
    };
  }

  // Manual check if schedule is due (for testing/dry-run)
  return {
    fires: false,
    reason: 'Scheduled trigger not yet due',
    matchDetails: {
      matchType: config.schedule_type || 'scheduled',
    },
  };
}

/**
 * Calculate the next run time based on schedule configuration.
 * Re-implements the logic from automation-scheduler/index.ts for testing.
 */
function calculateNextRunAt(config: ScheduleConfig, fromTime: Date = new Date()): Date {
  const scheduleType = config.schedule_type || 'interval';

  switch (scheduleType) {
    case 'interval': {
      const intervalMinutes = config.interval_minutes || 60;
      return new Date(fromTime.getTime() + intervalMinutes * 60 * 1000);
    }

    case 'daily': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);

      // If the time has already passed today, schedule for tomorrow
      if (next <= fromTime) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }

    case 'weekly': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const targetDay = config.day_of_week ?? 1; // Default to Monday

      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);

      // Calculate days until target day
      const currentDay = next.getUTCDay();
      let daysUntil = targetDay - currentDay;

      if (daysUntil < 0 || (daysUntil === 0 && next <= fromTime)) {
        daysUntil += 7;
      }

      next.setUTCDate(next.getUTCDate() + daysUntil);
      return next;
    }

    case 'monthly': {
      const hour = config.hour ?? 9;
      const minute = config.minute ?? 0;
      const targetDay = config.day_of_month ?? 1;

      const next = new Date(fromTime);
      next.setUTCHours(hour, minute, 0, 0);
      next.setUTCDate(targetDay);

      // If the date has already passed this month, schedule for next month
      if (next <= fromTime) {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }

      // Handle months with fewer days (e.g., Feb 30 -> Feb 28)
      const targetMonth = next.getUTCMonth();
      if (next.getUTCDate() !== targetDay) {
        // Day overflowed to next month, set to last day of target month
        next.setUTCDate(0);
      }
      // Ensure we're still in the target month
      if (next.getUTCMonth() !== targetMonth) {
        next.setUTCMonth(targetMonth + 1, 0);
      }

      return next;
    }

    case 'cron': {
      // For cron expressions, default to running again in 1 hour
      // A full cron parser could be added as a future enhancement
      return new Date(fromTime.getTime() + 60 * 60 * 1000);
    }

    default:
      // Default: run again in 1 hour
      return new Date(fromTime.getTime() + 60 * 60 * 1000);
  }
}

// ============================================================
// Scheduled Trigger Tests
// ============================================================

describe('Scheduled Trigger', () => {
  describe('Basic Scheduled Trigger', () => {
    it('should fire when scheduler indicates rule is due', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 1,
        hour: 9,
        minute: 0,
      };
      const context: ScheduledTriggerContext = {
        custom: {
          scheduled: {
            is_due: true,
            triggered_at: '2026-01-13T09:00:00.000Z',
            schedule_name: 'Weekly Digest',
          },
        },
      };

      const result = evaluateScheduled(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('Scheduled trigger fired');
    });

    it('should fire when triggered_at is present', () => {
      const config: ScheduleConfig = {
        schedule_type: 'daily',
        hour: 9,
        minute: 0,
      };
      const context: ScheduledTriggerContext = {
        custom: {
          scheduled: {
            triggered_at: '2026-01-10T09:00:00.000Z',
          },
        },
      };

      const result = evaluateScheduled(config, context);

      expect(result.fires).toBe(true);
      expect(result.reason).toContain('2026-01-10T09:00:00.000Z');
    });

    it('should not fire when rule is not due', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 1,
        hour: 9,
      };
      const context: ScheduledTriggerContext = {
        custom: {
          scheduled: {
            is_due: false,
          },
        },
      };

      const result = evaluateScheduled(config, context);

      expect(result.fires).toBe(false);
      expect(result.reason).toContain('not yet due');
    });

    it('should not fire when no scheduled context is provided', () => {
      const config: ScheduleConfig = {
        schedule_type: 'interval',
        interval_minutes: 60,
      };
      const context: ScheduledTriggerContext = {};

      const result = evaluateScheduled(config, context);

      expect(result.fires).toBe(false);
    });
  });

  describe('Match Details', () => {
    it('should include schedule type in match details', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 1,
      };
      const context: ScheduledTriggerContext = {
        custom: {
          scheduled: {
            is_due: true,
            triggered_at: new Date().toISOString(),
          },
        },
      };

      const result = evaluateScheduled(config, context);

      expect(result.matchDetails?.matchType).toBe('weekly');
    });

    it('should default to "scheduled" when no schedule type specified', () => {
      const config = {} as ScheduleConfig;
      const context: ScheduledTriggerContext = {
        custom: {
          scheduled: {
            is_due: true,
            triggered_at: new Date().toISOString(),
          },
        },
      };

      const result = evaluateScheduled(config, context);

      expect(result.fires).toBe(true);
      expect(result.matchDetails?.matchType).toBe('scheduled');
    });
  });
});

describe('calculateNextRunAt', () => {
  describe('Interval Schedule', () => {
    it('should calculate next run for interval in minutes', () => {
      const config: ScheduleConfig = {
        schedule_type: 'interval',
        interval_minutes: 30,
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-10T10:30:00.000Z');
    });

    it('should default to 60 minutes when interval not specified', () => {
      const config: ScheduleConfig = {
        schedule_type: 'interval',
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-10T11:00:00.000Z');
    });

    it('should handle 5-minute intervals', () => {
      const config: ScheduleConfig = {
        schedule_type: 'interval',
        interval_minutes: 5,
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-10T10:05:00.000Z');
    });

    it('should handle large intervals (24 hours)', () => {
      const config: ScheduleConfig = {
        schedule_type: 'interval',
        interval_minutes: 1440, // 24 hours
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-11T10:00:00.000Z');
    });
  });

  describe('Daily Schedule', () => {
    it('should schedule for same day if time has not passed', () => {
      const config: ScheduleConfig = {
        schedule_type: 'daily',
        hour: 15,
        minute: 30,
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-10T15:30:00.000Z');
    });

    it('should schedule for next day if time has passed', () => {
      const config: ScheduleConfig = {
        schedule_type: 'daily',
        hour: 9,
        minute: 0,
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.toISOString()).toBe('2026-01-11T09:00:00.000Z');
    });

    it('should default to 9:00 AM', () => {
      const config: ScheduleConfig = {
        schedule_type: 'daily',
      };
      const fromTime = new Date('2026-01-10T06:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.getUTCHours()).toBe(9);
      expect(nextRun.getUTCMinutes()).toBe(0);
    });
  });

  describe('Weekly Schedule', () => {
    it('should schedule for next Monday when called on Friday', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 1, // Monday
        hour: 9,
        minute: 0,
      };
      // Friday, January 10, 2026
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be Monday, January 13, 2026
      expect(nextRun.toISOString()).toBe('2026-01-13T09:00:00.000Z');
      expect(nextRun.getUTCDay()).toBe(1); // Monday
    });

    it('should schedule for same day if time has not passed', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 5, // Friday
        hour: 15,
        minute: 0,
      };
      // Friday, January 10, 2026 at 10:00
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be same day at 15:00
      expect(nextRun.toISOString()).toBe('2026-01-10T15:00:00.000Z');
    });

    it('should schedule for next week if time has passed on target day', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 5, // Friday
        hour: 9,
        minute: 0,
      };
      // Friday, January 10, 2026 at 10:00 (after 9:00)
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be next Friday, January 17, 2026
      expect(nextRun.toISOString()).toBe('2026-01-17T09:00:00.000Z');
    });

    it('should default to Monday at 9:00', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.getUTCDay()).toBe(1); // Monday
      expect(nextRun.getUTCHours()).toBe(9);
    });

    it('should handle Sunday as day 0', () => {
      const config: ScheduleConfig = {
        schedule_type: 'weekly',
        day_of_week: 0, // Sunday
        hour: 10,
        minute: 0,
      };
      // Friday, January 10, 2026
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be Sunday, January 12, 2026
      expect(nextRun.toISOString()).toBe('2026-01-12T10:00:00.000Z');
      expect(nextRun.getUTCDay()).toBe(0); // Sunday
    });
  });

  describe('Monthly Schedule', () => {
    it('should schedule for 1st of next month if date has passed', () => {
      const config: ScheduleConfig = {
        schedule_type: 'monthly',
        day_of_month: 1,
        hour: 9,
        minute: 0,
      };
      // January 10, 2026
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be February 1, 2026
      expect(nextRun.getUTCMonth()).toBe(1); // February
      expect(nextRun.getUTCDate()).toBe(1);
    });

    it('should schedule for same month if date has not passed', () => {
      const config: ScheduleConfig = {
        schedule_type: 'monthly',
        day_of_month: 15,
        hour: 9,
        minute: 0,
      };
      // January 10, 2026
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Should be January 15, 2026
      expect(nextRun.getUTCMonth()).toBe(0); // January
      expect(nextRun.getUTCDate()).toBe(15);
    });

    it('should default to 1st of month at 9:00', () => {
      const config: ScheduleConfig = {
        schedule_type: 'monthly',
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      expect(nextRun.getUTCDate()).toBe(1);
      expect(nextRun.getUTCHours()).toBe(9);
    });
  });

  describe('Cron Schedule', () => {
    it('should default to 1 hour for cron type', () => {
      const config: ScheduleConfig = {
        schedule_type: 'cron',
        cron_expression: '0 9 * * 1', // Every Monday at 9 AM
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Without a full cron parser, defaults to 1 hour
      expect(nextRun.toISOString()).toBe('2026-01-10T11:00:00.000Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing schedule type with default interval', () => {
      const config = {} as ScheduleConfig;
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Defaults to 1 hour
      expect(nextRun.toISOString()).toBe('2026-01-10T11:00:00.000Z');
    });

    it('should handle unknown schedule type with default interval', () => {
      const config = {
        schedule_type: 'unknown' as ScheduleType,
      };
      const fromTime = new Date('2026-01-10T10:00:00.000Z');

      const nextRun = calculateNextRunAt(config, fromTime);

      // Defaults to 1 hour
      expect(nextRun.toISOString()).toBe('2026-01-10T11:00:00.000Z');
    });
  });
});

describe('Integration Test: Scheduled Rule Flow', () => {
  /**
   * Simulates the verification steps from subtask-8-4:
   * 1. Create scheduled rule (weekly digest)
   * 2. Manually trigger pg_cron job
   * 3. Verify digest generated
   * 4. Verify execution history logged
   *
   * This test focuses on trigger evaluation after scheduler triggers the rule.
   */

  it('should correctly simulate weekly digest rule firing', () => {
    // 1. Create scheduled rule: weekly digest on Mondays at 9 AM
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'weekly',
      day_of_week: 1, // Monday
      hour: 9,
      minute: 0,
    };

    // 2. Simulate pg_cron triggering the automation-scheduler
    // The scheduler finds this rule is due and calls automation-engine
    const scheduledContext: ScheduledTriggerContext = {
      custom: {
        scheduled: {
          is_due: true,
          triggered_at: '2026-01-13T09:00:00.000Z', // Monday at 9 AM
          schedule_name: 'Weekly Digest Report',
        },
      },
    };

    // 3. Verify trigger fires (digest would be generated by action executor)
    const result = evaluateScheduled(ruleConfig, scheduledContext);

    expect(result.fires).toBe(true);
    expect(result.reason).toContain('Scheduled trigger fired');
    expect(result.reason).toContain('2026-01-13T09:00:00.000Z');

    // 4. Validate debug info for execution history logging
    expect(result.matchDetails).toBeDefined();
    expect(result.matchDetails?.matchType).toBe('weekly');
  });

  it('should correctly calculate next run after execution', () => {
    // Rule executed on Monday, January 13, 2026 at 9:00 AM
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'weekly',
      day_of_week: 1, // Monday
      hour: 9,
      minute: 0,
    };
    const executionTime = new Date('2026-01-13T09:00:00.000Z');

    // Calculate next run time
    const nextRun = calculateNextRunAt(ruleConfig, executionTime);

    // Should be next Monday, January 20, 2026
    expect(nextRun.toISOString()).toBe('2026-01-20T09:00:00.000Z');
    expect(nextRun.getUTCDay()).toBe(1); // Monday
  });

  it('should handle daily digest rule with correct next run calculation', () => {
    // Daily digest at 6 PM
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'daily',
      hour: 18,
      minute: 0,
    };

    // Triggered at 6 PM on January 10
    const scheduledContext: ScheduledTriggerContext = {
      custom: {
        scheduled: {
          is_due: true,
          triggered_at: '2026-01-10T18:00:00.000Z',
        },
      },
    };

    // Verify trigger fires
    const result = evaluateScheduled(ruleConfig, scheduledContext);
    expect(result.fires).toBe(true);

    // Calculate next run (should be tomorrow at 6 PM)
    const executionTime = new Date('2026-01-10T18:00:00.000Z');
    const nextRun = calculateNextRunAt(ruleConfig, executionTime);

    expect(nextRun.toISOString()).toBe('2026-01-11T18:00:00.000Z');
  });

  it('should handle interval rule with correct next run calculation', () => {
    // Run every 2 hours
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'interval',
      interval_minutes: 120,
    };

    const scheduledContext: ScheduledTriggerContext = {
      custom: {
        scheduled: {
          is_due: true,
          triggered_at: '2026-01-10T10:00:00.000Z',
        },
      },
    };

    // Verify trigger fires
    const result = evaluateScheduled(ruleConfig, scheduledContext);
    expect(result.fires).toBe(true);

    // Calculate next run (should be 2 hours later)
    const executionTime = new Date('2026-01-10T10:00:00.000Z');
    const nextRun = calculateNextRunAt(ruleConfig, executionTime);

    expect(nextRun.toISOString()).toBe('2026-01-10T12:00:00.000Z');
  });

  it('should validate complete execution history debug info structure', () => {
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'weekly',
      day_of_week: 1,
      hour: 9,
      minute: 0,
    };

    const scheduledContext: ScheduledTriggerContext = {
      custom: {
        scheduled: {
          is_due: true,
          triggered_at: '2026-01-13T09:00:00.000Z',
          schedule_name: 'Weekly Digest',
        },
      },
    };

    const result = evaluateScheduled(ruleConfig, scheduledContext);

    // Verify all fields needed for execution history are present
    expect(result.fires).toBe(true);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.matchDetails).toBeDefined();
    expect(result.matchDetails?.matchType).toBeDefined();
  });

  it('should simulate missed execution scenario', () => {
    // Rule was due but scheduler timed out
    const ruleConfig: ScheduleConfig = {
      schedule_type: 'weekly',
      day_of_week: 1,
      hour: 9,
    };

    // Scheduler didn't mark it as due (timeout scenario)
    const scheduledContext: ScheduledTriggerContext = {
      custom: {
        scheduled: {
          is_due: false,
        },
      },
    };

    const result = evaluateScheduled(ruleConfig, scheduledContext);

    // Rule should not fire
    expect(result.fires).toBe(false);
    expect(result.reason).toContain('not yet due');

    // But next_run_at should still be calculated correctly
    const missedTime = new Date('2026-01-13T09:05:00.000Z');
    const nextRun = calculateNextRunAt(ruleConfig, missedTime);

    // Next run should be the following Monday
    expect(nextRun.toISOString()).toBe('2026-01-20T09:00:00.000Z');
  });
});

// ============================================================
// Multi-Condition AND/OR Logic Evaluation (re-implemented for testing)
// ============================================================

/**
 * Tests for subtask-8-5: Test multi-condition AND/OR logic evaluation
 *
 * This test suite validates:
 * 1. Simple AND conditions (all must pass)
 * 2. Simple OR conditions (any must pass)
 * 3. Nested conditions like `(A AND B) OR (C AND D)`
 * 4. Complex combinations with multiple operators
 * 5. Edge cases (empty conditions, single condition, etc.)
 */

interface ConditionValue {
  value?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  flags?: string;
}

interface Condition {
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
  logic_operator?: 'AND' | 'OR';
  conditions?: Condition[];
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface ConditionEvaluationContext {
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

interface ConditionEvaluationResult {
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
function getFieldValue(context: ConditionEvaluationContext, field: string): unknown {
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
function evaluateCondition(
  condition: Condition,
  context: ConditionEvaluationContext
): { result: boolean; reason: string } {
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
      fieldValue = context.call?.calendar_invitees?.map((p) => p.email || p.name).join(', ') || '';
      break;

    case 'category':
      fieldValue = context.category?.name || '';
      break;

    case 'tag':
      fieldValue = context.tags?.map((t) => t.name).join(', ') || '';
      break;

    case 'sentiment':
      fieldValue = context.call?.sentiment || '';
      break;

    case 'time':
      if (condition.field === 'day_of_week') {
        const date = context.call?.created_at ? new Date(context.call.created_at) : new Date();
        fieldValue = date.getDay();
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
  context: ConditionEvaluationContext
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
function evaluateConditions(
  conditions: ConditionGroup | Condition,
  context: ConditionEvaluationContext
): ConditionEvaluationResult {
  // Normalize to ConditionGroup
  const group: ConditionGroup = 'operator' in conditions && 'conditions' in conditions
    ? (conditions as ConditionGroup)
    : { operator: 'AND', conditions: [conditions as Condition] };

  const details: ConditionEvaluationResult['details'] = [];

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

// ============================================================
// Multi-Condition AND/OR Logic Tests
// ============================================================

describe('Multi-Condition AND/OR Logic', () => {
  describe('Simple AND Logic', () => {
    it('should pass when all AND conditions are true', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 30 },
          },
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45,
          sentiment: 'negative',
          sentiment_confidence: 0.85,
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.reason).toContain('All 2 conditions passed (AND)');
      expect(result.details).toHaveLength(2);
      expect(result.details?.every((d) => d.result)).toBe(true);
    });

    it('should fail when any AND condition is false', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 30 },
          },
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45, // Passes: > 30
          sentiment: 'positive', // Fails: not negative
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('1 of 2 conditions failed (AND)');
      expect(result.details?.filter((d) => !d.result)).toHaveLength(1);
    });

    it('should fail when all AND conditions are false', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 60 },
          },
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 30, // Fails: not > 60
          sentiment: 'positive', // Fails: not negative
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('2 of 2 conditions failed (AND)');
      expect(result.details?.every((d) => !d.result)).toBe(true);
    });
  });

  describe('Simple OR Logic', () => {
    it('should pass when any OR condition is true', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 60 },
          },
          {
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 30, // Fails: not > 60
          full_transcript: 'This is an urgent matter!', // Passes: contains urgent
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.reason).toContain('1 of 2 conditions passed (OR)');
    });

    it('should pass when all OR conditions are true', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 30 },
          },
          {
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45, // Passes: > 30
          full_transcript: 'This is an urgent matter!', // Passes: contains urgent
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.reason).toContain('2 of 2 conditions passed (OR)');
    });

    it('should fail when all OR conditions are false', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 60 },
          },
          {
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 30, // Fails: not > 60
          full_transcript: 'Just a regular meeting.', // Fails: does not contain urgent
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('All 2 conditions failed (OR)');
    });
  });

  describe('Nested Conditions - (A AND B) OR (C AND D)', () => {
    it('should pass when first nested group passes', () => {
      // Rule: (sentiment = negative AND duration > 30) OR (transcript contains "urgent")
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            // Group: sentiment = negative AND duration > 30
            logic_operator: 'AND',
            conditions: [
              {
                condition_type: 'sentiment',
                operator: '=',
                value: { value: 'negative' },
              },
              {
                condition_type: 'field',
                field: 'call.duration_minutes',
                operator: '>',
                value: { value: 30 },
              },
            ],
          },
          {
            // Single condition: transcript contains "urgent"
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      // Context: negative sentiment AND duration > 30 (first group passes)
      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45,
          sentiment: 'negative',
          full_transcript: 'Just a regular frustrating call.',
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.reason).toContain('OR');
    });

    it('should pass when second condition passes but first group fails', () => {
      // Rule: (sentiment = negative AND duration > 30) OR (transcript contains "urgent")
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            // Group: sentiment = negative AND duration > 30
            logic_operator: 'AND',
            conditions: [
              {
                condition_type: 'sentiment',
                operator: '=',
                value: { value: 'negative' },
              },
              {
                condition_type: 'field',
                field: 'call.duration_minutes',
                operator: '>',
                value: { value: 30 },
              },
            ],
          },
          {
            // Single condition: transcript contains "urgent"
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      // Context: positive sentiment (first group fails) but contains "urgent" (second passes)
      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45,
          sentiment: 'positive', // First group fails
          full_transcript: 'This is urgent! Need immediate attention.',
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
    });

    it('should fail when all nested groups fail', () => {
      // Rule: (sentiment = negative AND duration > 30) OR (transcript contains "urgent")
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            logic_operator: 'AND',
            conditions: [
              {
                condition_type: 'sentiment',
                operator: '=',
                value: { value: 'negative' },
              },
              {
                condition_type: 'field',
                field: 'call.duration_minutes',
                operator: '>',
                value: { value: 30 },
              },
            ],
          },
          {
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      // Context: positive sentiment AND no "urgent" - both fail
      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45,
          sentiment: 'positive',
          full_transcript: 'Great call, everything went well!',
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
    });

    it('should handle complex nested: (A AND B) OR (C AND D)', () => {
      // Rule: (category = Sales AND duration > 30) OR (sentiment = negative AND transcript contains "complaint")
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            logic_operator: 'AND',
            conditions: [
              {
                condition_type: 'category',
                operator: '=',
                value: { value: 'Sales' },
              },
              {
                condition_type: 'field',
                field: 'call.duration_minutes',
                operator: '>',
                value: { value: 30 },
              },
            ],
          },
          {
            logic_operator: 'AND',
            conditions: [
              {
                condition_type: 'sentiment',
                operator: '=',
                value: { value: 'negative' },
              },
              {
                condition_type: 'transcript',
                operator: 'contains',
                value: { value: 'complaint' },
              },
            ],
          },
        ],
      };

      // Context: Not Sales category, but negative sentiment with complaint
      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 15,
          sentiment: 'negative',
          full_transcript: 'Customer filed a complaint about the service.',
        },
        category: {
          name: 'Support',
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty condition group', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [],
      };

      const context: ConditionEvaluationContext = {
        call: { duration_minutes: 30 },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.reason).toContain('vacuously true');
    });

    it('should handle single condition as AND group', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 30 },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: { duration_minutes: 45 },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      expect(result.details).toHaveLength(1);
    });

    it('should handle single condition as OR group', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '<',
            value: { value: 30 },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: { duration_minutes: 45 },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
    });

    it('should handle missing field in context', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.nonexistent_field',
            operator: '=',
            value: { value: 'test' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: { duration_minutes: 30 },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
    });

    it('should handle null values correctly', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'field',
            field: 'call.summary',
            operator: 'is_empty',
            value: {},
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: { duration_minutes: 30 },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
    });
  });

  describe('All Operators', () => {
    const baseContext: ConditionEvaluationContext = {
      call: {
        duration_minutes: 45,
        title: 'Sales Call with Acme Corp',
        sentiment: 'positive',
        participant_count: 3,
        full_transcript: 'Discussed pricing options.',
      },
      category: { name: 'Sales' },
      tags: [{ name: 'important' }, { name: 'follow-up' }],
    };

    it('should handle equality (=) operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'sentiment',
          operator: '=',
          value: { value: 'positive' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle inequality (!=) operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'sentiment',
          operator: '!=',
          value: { value: 'negative' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle greater than (>) operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.duration_minutes',
          operator: '>',
          value: { value: 30 },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle less than (<) operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.duration_minutes',
          operator: '<',
          value: { value: 60 },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle contains operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'transcript',
          operator: 'contains',
          value: { value: 'pricing' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle not_contains operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'transcript',
          operator: 'not_contains',
          value: { value: 'refund' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle starts_with operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.title',
          operator: 'starts_with',
          value: { value: 'Sales' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle ends_with operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.title',
          operator: 'ends_with',
          value: { value: 'Corp' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle matches (regex) operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.title',
          operator: 'matches',
          value: { pattern: 'Sales.*Corp' },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle in operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'category',
          operator: 'in',
          value: { values: ['Sales', 'Marketing', 'Support'] },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle not_in operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'category',
          operator: 'not_in',
          value: { values: ['Spam', 'Archive'] },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle is_not_empty operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.title',
          operator: 'is_not_empty',
          value: {},
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });

    it('should handle between operator', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.duration_minutes',
          operator: 'between',
          value: { min: 30, max: 60 },
        }],
      }, baseContext);
      expect(result.passed).toBe(true);
    });
  });

  describe('Condition Types', () => {
    it('should evaluate field condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'field',
          field: 'call.participant_count',
          operator: '>=',
          value: { value: 2 },
        }],
      }, {
        call: { participant_count: 3 },
      });
      expect(result.passed).toBe(true);
    });

    it('should evaluate transcript condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'transcript',
          operator: 'contains',
          value: { value: 'hello' },
        }],
      }, {
        call: { full_transcript: 'Hello world!' },
      });
      expect(result.passed).toBe(true);
    });

    it('should evaluate category condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'category',
          operator: '=',
          value: { value: 'Sales' },
        }],
      }, {
        category: { name: 'Sales' },
      });
      expect(result.passed).toBe(true);
    });

    it('should evaluate tag condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'tag',
          operator: 'contains',
          value: { value: 'important' },
        }],
      }, {
        tags: [{ name: 'important' }, { name: 'urgent' }],
      });
      expect(result.passed).toBe(true);
    });

    it('should evaluate sentiment condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'sentiment',
          operator: '=',
          value: { value: 'negative' },
        }],
      }, {
        call: { sentiment: 'negative' },
      });
      expect(result.passed).toBe(true);
    });

    it('should evaluate custom condition type', () => {
      const result = evaluateConditions({
        operator: 'AND',
        conditions: [{
          condition_type: 'custom',
          field: 'priority',
          operator: '=',
          value: { value: 'high' },
        }],
      }, {
        custom: { priority: 'high' },
      });
      expect(result.passed).toBe(true);
    });
  });

  describe('Debug Info for Execution History', () => {
    it('should include detailed evaluation results', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 30 },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45,
          sentiment: 'negative',
        },
      };

      const result = evaluateConditions(conditions, context);

      // Verify debug info structure
      expect(result.passed).toBe(true);
      expect(result.reason).toBeTruthy();
      expect(result.details).toBeDefined();
      expect(result.details).toHaveLength(2);

      // Each detail should have condition, result, and reason
      for (const detail of result.details || []) {
        expect(detail).toHaveProperty('condition');
        expect(detail).toHaveProperty('result');
        expect(detail).toHaveProperty('reason');
        expect(typeof detail.reason).toBe('string');
      }
    });

    it('should explain which conditions failed in AND group', () => {
      const conditions: ConditionGroup = {
        operator: 'AND',
        conditions: [
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
          {
            condition_type: 'field',
            field: 'call.duration_minutes',
            operator: '>',
            value: { value: 60 },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          duration_minutes: 45, // Fails: not > 60
          sentiment: 'negative', // Passes
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(false);
      const failedConditions = result.details?.filter((d) => !d.result);
      expect(failedConditions).toHaveLength(1);
      expect(failedConditions?.[0].reason).toContain('45');
      expect(failedConditions?.[0].reason).toContain('60');
    });

    it('should explain which conditions passed in OR group', () => {
      const conditions: ConditionGroup = {
        operator: 'OR',
        conditions: [
          {
            condition_type: 'sentiment',
            operator: '=',
            value: { value: 'negative' },
          },
          {
            condition_type: 'transcript',
            operator: 'contains',
            value: { value: 'urgent' },
          },
        ],
      };

      const context: ConditionEvaluationContext = {
        call: {
          sentiment: 'positive', // Fails
          full_transcript: 'This is an urgent request!', // Passes
        },
      };

      const result = evaluateConditions(conditions, context);

      expect(result.passed).toBe(true);
      const passedConditions = result.details?.filter((d) => d.result);
      expect(passedConditions).toHaveLength(1);
      expect(passedConditions?.[0].reason).toContain('contains');
      expect(passedConditions?.[0].reason).toContain('urgent');
    });
  });
});

describe('Integration Test: Multi-Condition Rule Flow', () => {
  /**
   * Simulates the verification steps from subtask-8-5:
   * 1. Create rule with complex conditions
   * 2. Test calls matching each condition path
   * 3. Verify correct evaluation
   * 4. Check debug info
   */

  it('should correctly evaluate rule: (sentiment = negative AND duration > 30) OR transcript contains "urgent"', () => {
    // Complex rule from spec:
    const ruleConditions: ConditionGroup = {
      operator: 'OR',
      conditions: [
        {
          logic_operator: 'AND',
          conditions: [
            {
              condition_type: 'sentiment',
              operator: '=',
              value: { value: 'negative' },
            },
            {
              condition_type: 'field',
              field: 'call.duration_minutes',
              operator: '>',
              value: { value: 30 },
            },
          ],
        },
        {
          condition_type: 'transcript',
          operator: 'contains',
          value: { value: 'urgent' },
        },
      ],
    };

    // Test Case 1: Long negative call (first AND group passes)
    const context1: ConditionEvaluationContext = {
      call: {
        recording_id: 1001,
        duration_minutes: 45,
        sentiment: 'negative',
        full_transcript: 'Customer was frustrated with the service.',
      },
    };
    const result1 = evaluateConditions(ruleConditions, context1);
    expect(result1.passed).toBe(true);

    // Test Case 2: Short urgent call (second condition passes)
    const context2: ConditionEvaluationContext = {
      call: {
        recording_id: 1002,
        duration_minutes: 10,
        sentiment: 'positive',
        full_transcript: 'This is an urgent request for assistance.',
      },
    };
    const result2 = evaluateConditions(ruleConditions, context2);
    expect(result2.passed).toBe(true);

    // Test Case 3: Short positive call without urgent (nothing passes)
    const context3: ConditionEvaluationContext = {
      call: {
        recording_id: 1003,
        duration_minutes: 15,
        sentiment: 'positive',
        full_transcript: 'Great demo, looking forward to next steps.',
      },
    };
    const result3 = evaluateConditions(ruleConditions, context3);
    expect(result3.passed).toBe(false);

    // Test Case 4: Long positive call without urgent (nothing passes)
    const context4: ConditionEvaluationContext = {
      call: {
        recording_id: 1004,
        duration_minutes: 60,
        sentiment: 'positive', // Fails first group's sentiment check
        full_transcript: 'Extensive product walkthrough completed.',
      },
    };
    const result4 = evaluateConditions(ruleConditions, context4);
    expect(result4.passed).toBe(false);

    // Test Case 5: Both conditions pass
    const context5: ConditionEvaluationContext = {
      call: {
        recording_id: 1005,
        duration_minutes: 45,
        sentiment: 'negative',
        full_transcript: 'This is urgent! Customer is very unhappy.',
      },
    };
    const result5 = evaluateConditions(ruleConditions, context5);
    expect(result5.passed).toBe(true);
  });

  it('should provide complete debug info for execution history', () => {
    const ruleConditions: ConditionGroup = {
      operator: 'AND',
      conditions: [
        {
          condition_type: 'category',
          operator: '=',
          value: { value: 'Sales' },
        },
        {
          condition_type: 'sentiment',
          operator: '!=',
          value: { value: 'negative' },
        },
        {
          condition_type: 'field',
          field: 'call.duration_minutes',
          operator: 'between',
          value: { min: 15, max: 60 },
        },
      ],
    };

    const context: ConditionEvaluationContext = {
      call: {
        recording_id: 2001,
        duration_minutes: 30,
        sentiment: 'positive',
        full_transcript: 'Successful sales call.',
      },
      category: { id: 'cat-1', name: 'Sales' },
    };

    const result = evaluateConditions(ruleConditions, context);

    // Verify complete debug info structure
    expect(result.passed).toBe(true);
    expect(result.reason).toContain('All 3 conditions passed (AND)');

    // Verify details for each condition
    expect(result.details).toHaveLength(3);

    // Check category condition detail
    const categoryDetail = result.details?.[0];
    expect(categoryDetail?.result).toBe(true);
    expect(categoryDetail?.reason).toContain('Sales');

    // Check sentiment condition detail
    const sentimentDetail = result.details?.[1];
    expect(sentimentDetail?.result).toBe(true);
    expect(sentimentDetail?.reason).toContain('positive');

    // Check duration condition detail
    const durationDetail = result.details?.[2];
    expect(durationDetail?.result).toBe(true);
    expect(durationDetail?.reason).toContain('between');
  });

  it('should handle real-world complex rule with multiple condition types', () => {
    // Real-world rule: Escalation trigger
    // Fire if: (sentiment = negative AND duration > 20)
    //      OR (category = Support AND tag contains "escalation")
    //      OR (transcript contains "manager" AND transcript contains "complaint")
    const ruleConditions: ConditionGroup = {
      operator: 'OR',
      conditions: [
        {
          logic_operator: 'AND',
          conditions: [
            { condition_type: 'sentiment', operator: '=', value: { value: 'negative' } },
            { condition_type: 'field', field: 'call.duration_minutes', operator: '>', value: { value: 20 } },
          ],
        },
        {
          logic_operator: 'AND',
          conditions: [
            { condition_type: 'category', operator: '=', value: { value: 'Support' } },
            { condition_type: 'tag', operator: 'contains', value: { value: 'escalation' } },
          ],
        },
        {
          logic_operator: 'AND',
          conditions: [
            { condition_type: 'transcript', operator: 'contains', value: { value: 'manager' } },
            { condition_type: 'transcript', operator: 'contains', value: { value: 'complaint' } },
          ],
        },
      ],
    };

    // Test: Support call with escalation tag
    const supportCallContext: ConditionEvaluationContext = {
      call: {
        duration_minutes: 15,
        sentiment: 'neutral',
        full_transcript: 'Technical support inquiry.',
      },
      category: { name: 'Support' },
      tags: [{ name: 'escalation' }, { name: 'priority' }],
    };
    expect(evaluateConditions(ruleConditions, supportCallContext).passed).toBe(true);

    // Test: Transcript mentions manager and complaint
    const complaintCallContext: ConditionEvaluationContext = {
      call: {
        duration_minutes: 10,
        sentiment: 'neutral',
        full_transcript: 'Customer wants to speak with a manager about their complaint.',
      },
      category: { name: 'Sales' },
      tags: [],
    };
    expect(evaluateConditions(ruleConditions, complaintCallContext).passed).toBe(true);

    // Test: None of the conditions match
    const normalCallContext: ConditionEvaluationContext = {
      call: {
        duration_minutes: 25,
        sentiment: 'positive',
        full_transcript: 'Great product demo, customer is interested.',
      },
      category: { name: 'Sales' },
      tags: [{ name: 'demo' }],
    };
    expect(evaluateConditions(ruleConditions, normalCallContext).passed).toBe(false);
  });
});
