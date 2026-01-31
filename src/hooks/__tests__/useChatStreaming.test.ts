/**
 * useChatStreaming Tests
 * 
 * Tests for streaming state management hook including:
 * - Rate limit detection and cooldown
 * - Reconnection state tracking
 * - Error detection helpers
 * - Throttled error logging
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useChatStreaming,
  isRateLimitError,
  isStreamingInterruptionError,
  extractRetryAfterSeconds,
  throttledErrorLog,
  ERROR_LOG_INTERVAL_MS,
  MAX_RECONNECT_ATTEMPTS,
  BASE_RECONNECT_DELAY,
} from '../useChatStreaming';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '@/lib/logger';

describe('useChatStreaming', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have isRateLimited=false initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.isRateLimited).toBe(false);
    });

    it('should have rateLimitCooldownEnd=null initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.rateLimitCooldownEnd).toBeNull();
    });

    it('should have rateLimitSeconds=0 initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.rateLimitSeconds).toBe(0);
    });

    it('should have reconnectAttemptDisplay=0 initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.reconnectAttemptDisplay).toBe(0);
    });

    it('should have isReconnecting=false initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should have empty incompleteMessageIds initially', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.incompleteMessageIds.size).toBe(0);
    });

    it('should export MAX_RECONNECT_ATTEMPTS constant', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.MAX_RECONNECT_ATTEMPTS).toBe(MAX_RECONNECT_ATTEMPTS);
      expect(MAX_RECONNECT_ATTEMPTS).toBe(3);
    });

    it('should export BASE_RECONNECT_DELAY constant', () => {
      const { result } = renderHook(() => useChatStreaming());
      expect(result.current.BASE_RECONNECT_DELAY).toBe(BASE_RECONNECT_DELAY);
      expect(BASE_RECONNECT_DELAY).toBe(1000);
    });
  });

  describe('Rate Limit State', () => {
    it('should set rate limit cooldown correctly', () => {
      const { result } = renderHook(() => useChatStreaming());
      const endTime = Date.now() + 30000; // 30 seconds from now

      act(() => {
        result.current.setRateLimitCooldown(endTime, 30);
      });

      expect(result.current.rateLimitCooldownEnd).toBe(endTime);
      expect(result.current.rateLimitSeconds).toBe(30);
      expect(result.current.isRateLimited).toBe(true);
    });

    it('should clear rate limit cooldown correctly', () => {
      const { result } = renderHook(() => useChatStreaming());
      const endTime = Date.now() + 30000;

      act(() => {
        result.current.setRateLimitCooldown(endTime, 30);
      });

      expect(result.current.isRateLimited).toBe(true);

      act(() => {
        result.current.clearRateLimitCooldown();
      });

      expect(result.current.rateLimitCooldownEnd).toBeNull();
      expect(result.current.rateLimitSeconds).toBe(0);
      expect(result.current.isRateLimited).toBe(false);
    });

    it('should call onRateLimitEnd callback when clearing', () => {
      const onRateLimitEnd = vi.fn();
      const { result } = renderHook(() => useChatStreaming({ onRateLimitEnd }));

      act(() => {
        result.current.setRateLimitCooldown(Date.now() + 30000, 30);
      });

      act(() => {
        result.current.clearRateLimitCooldown();
      });

      expect(onRateLimitEnd).toHaveBeenCalledTimes(1);
    });

    it('should compute isRateLimited based on cooldown end time', () => {
      const { result } = renderHook(() => useChatStreaming());

      // Set cooldown in the future
      act(() => {
        result.current.setRateLimitCooldown(Date.now() + 30000, 30);
      });
      expect(result.current.isRateLimited).toBe(true);

      // Set cooldown in the past
      act(() => {
        result.current.setRateLimitCooldown(Date.now() - 1000, 30);
      });
      expect(result.current.isRateLimited).toBe(false);
    });
  });

  describe('Reconnection State', () => {
    it('should track reconnect attempts via ref', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.reconnectAttemptsRef.current = 2;
      });

      expect(result.current.reconnectAttemptsRef.current).toBe(2);
    });

    it('should track reconnect attempt display via state', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.setReconnectAttemptDisplay(2);
      });

      expect(result.current.reconnectAttemptDisplay).toBe(2);
    });

    it('should track isReconnecting state', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.setIsReconnecting(true);
      });

      expect(result.current.isReconnecting).toBe(true);

      act(() => {
        result.current.setIsReconnecting(false);
      });

      expect(result.current.isReconnecting).toBe(false);
    });

    it('should track last user message via ref', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.lastUserMessageRef.current = 'test message';
      });

      expect(result.current.lastUserMessageRef.current).toBe('test message');
    });

    it('should reset reconnection state correctly', () => {
      const { result } = renderHook(() => useChatStreaming());

      // Set up some state
      act(() => {
        result.current.reconnectAttemptsRef.current = 2;
        result.current.setReconnectAttemptDisplay(2);
        result.current.setIsReconnecting(true);
        result.current.lastUserMessageRef.current = 'test';
        result.current.setIncompleteMessageIds(new Set(['msg-1', 'msg-2']));
        result.current.handledErrorRef.current = new Error('test');
      });

      // Reset
      act(() => {
        result.current.resetReconnectionState();
      });

      expect(result.current.reconnectAttemptsRef.current).toBe(0);
      expect(result.current.reconnectAttemptDisplay).toBe(0);
      expect(result.current.isReconnecting).toBe(false);
      expect(result.current.lastUserMessageRef.current).toBeNull();
      expect(result.current.incompleteMessageIds.size).toBe(0);
      expect(result.current.handledErrorRef.current).toBeNull();
    });
  });

  describe('Incomplete Message Tracking', () => {
    it('should add incomplete message IDs', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.setIncompleteMessageIds(new Set(['msg-1', 'msg-2']));
      });

      expect(result.current.incompleteMessageIds.has('msg-1')).toBe(true);
      expect(result.current.incompleteMessageIds.has('msg-2')).toBe(true);
      expect(result.current.incompleteMessageIds.size).toBe(2);
    });

    it('should clear incomplete message IDs', () => {
      const { result } = renderHook(() => useChatStreaming());

      act(() => {
        result.current.setIncompleteMessageIds(new Set(['msg-1']));
      });

      act(() => {
        result.current.setIncompleteMessageIds(new Set());
      });

      expect(result.current.incompleteMessageIds.size).toBe(0);
    });
  });

  describe('Handled Error Tracking', () => {
    it('should track handled errors via ref', () => {
      const { result } = renderHook(() => useChatStreaming());
      const error = new Error('Test error');

      act(() => {
        result.current.handledErrorRef.current = error;
      });

      expect(result.current.handledErrorRef.current).toBe(error);
    });
  });
});

describe('isRateLimitError', () => {
  it('should detect "rate limit" in error message', () => {
    expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('API rate limit reached'))).toBe(true);
  });

  it('should detect "too many requests" in error message', () => {
    expect(isRateLimitError(new Error('Too many requests'))).toBe(true);
    expect(isRateLimitError(new Error('Error: too many requests, try again later'))).toBe(true);
  });

  it('should detect "429" in error message', () => {
    expect(isRateLimitError(new Error('HTTP 429'))).toBe(true);
    expect(isRateLimitError(new Error('Status code: 429'))).toBe(true);
    expect(isRateLimitError('Error 429: Rate limited')).toBe(true);
  });

  it('should be case-insensitive', () => {
    expect(isRateLimitError(new Error('RATE LIMIT exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Too Many Requests'))).toBe(true);
  });

  it('should return false for non-rate-limit errors', () => {
    expect(isRateLimitError(new Error('Network error'))).toBe(false);
    expect(isRateLimitError(new Error('Timeout'))).toBe(false);
    expect(isRateLimitError(new Error('Internal server error'))).toBe(false);
  });

  it('should handle string errors', () => {
    expect(isRateLimitError('rate limit exceeded')).toBe(true);
    expect(isRateLimitError('regular error')).toBe(false);
  });

  it('should handle non-string/non-Error values', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
    expect(isRateLimitError(123)).toBe(false);
  });
});

describe('isStreamingInterruptionError', () => {
  it('should detect abort errors by name', () => {
    const error = new Error('Request aborted');
    error.name = 'AbortError';
    expect(isStreamingInterruptionError(error)).toBe(true);
  });

  it('should detect "aborted" in message', () => {
    expect(isStreamingInterruptionError(new Error('Request was aborted'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Aborted by user'))).toBe(true);
  });

  it('should detect network errors', () => {
    expect(isStreamingInterruptionError(new Error('Network error occurred'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Network request failed'))).toBe(true);
  });

  it('should detect fetch failures', () => {
    expect(isStreamingInterruptionError(new Error('Failed to fetch'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Fetch failed'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Load failed'))).toBe(true);
  });

  it('should detect connection errors', () => {
    expect(isStreamingInterruptionError(new Error('Connection refused'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('ECONNRESET'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('ECONNREFUSED'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('ETIMEDOUT'))).toBe(true);
  });

  it('should detect socket errors', () => {
    expect(isStreamingInterruptionError(new Error('Socket closed'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Socket hang up'))).toBe(true);
  });

  it('should detect stream errors', () => {
    expect(isStreamingInterruptionError(new Error('Stream ended unexpectedly'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Readable stream error'))).toBe(true);
  });

  it('should return false for non-interruption errors', () => {
    expect(isStreamingInterruptionError(new Error('Rate limit exceeded'))).toBe(false);
    expect(isStreamingInterruptionError(new Error('Invalid request'))).toBe(false);
    expect(isStreamingInterruptionError(new Error('Server error'))).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isStreamingInterruptionError(new Error('NETWORK ERROR'))).toBe(true);
    expect(isStreamingInterruptionError(new Error('Connection Reset'))).toBe(true);
  });

  it('should handle string errors', () => {
    expect(isStreamingInterruptionError('network error')).toBe(true);
    expect(isStreamingInterruptionError('regular error')).toBe(false);
  });
});

describe('extractRetryAfterSeconds', () => {
  it('should extract retry-after from "retry after X seconds" format', () => {
    expect(extractRetryAfterSeconds(new Error('Please retry after 30 seconds'))).toBe(30);
    expect(extractRetryAfterSeconds(new Error('Retry after 60 seconds'))).toBe(60);
  });

  it('should extract retry-after from "retry-after: X" format', () => {
    expect(extractRetryAfterSeconds(new Error('retry-after: 45'))).toBe(45);
    expect(extractRetryAfterSeconds(new Error('Retry-After: 120'))).toBe(120);
  });

  it('should extract from "wait Xs" format', () => {
    expect(extractRetryAfterSeconds(new Error('Please wait 15s'))).toBe(15);
    expect(extractRetryAfterSeconds(new Error('wait 30 s'))).toBe(30);
  });

  it('should extract from "X seconds" format', () => {
    expect(extractRetryAfterSeconds(new Error('Try again in 20 seconds'))).toBe(20);
    expect(extractRetryAfterSeconds(new Error('Wait 45 second before retry'))).toBe(45);
  });

  it('should cap at 300 seconds (5 minutes)', () => {
    expect(extractRetryAfterSeconds(new Error('retry after 600 seconds'))).toBe(30); // Falls through to default
  });

  it('should return 30 seconds as default', () => {
    expect(extractRetryAfterSeconds(new Error('Rate limited'))).toBe(30);
    expect(extractRetryAfterSeconds(new Error('No retry info'))).toBe(30);
  });

  it('should handle string errors', () => {
    expect(extractRetryAfterSeconds('retry after 25 seconds')).toBe(25);
    expect(extractRetryAfterSeconds('no retry info')).toBe(30);
  });
});

describe('throttledErrorLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should log error immediately on first call', () => {
    throttledErrorLog('test-error', 'Test error message');
    expect(logger.error).toHaveBeenCalledWith('Test error message');
  });

  it('should throttle subsequent calls within interval', () => {
    throttledErrorLog('throttle-test', 'Message 1');
    throttledErrorLog('throttle-test', 'Message 2');
    throttledErrorLog('throttle-test', 'Message 3');

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Message 1');
  });

  it('should allow logging after interval passes', () => {
    throttledErrorLog('interval-test', 'First message');
    expect(logger.error).toHaveBeenCalledTimes(1);

    // Advance time beyond the interval
    vi.advanceTimersByTime(ERROR_LOG_INTERVAL_MS + 100);

    throttledErrorLog('interval-test', 'Second message');
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenLastCalledWith('Second message');
  });

  it('should track different error types separately', () => {
    throttledErrorLog('error-type-1', 'Error type 1');
    throttledErrorLog('error-type-2', 'Error type 2');

    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('should pass additional arguments to logger', () => {
    const extraData = { code: 500 };
    throttledErrorLog('args-test', 'Error with data', extraData);
    expect(logger.error).toHaveBeenCalledWith('Error with data', extraData);
  });

  it('should use ERROR_LOG_INTERVAL_MS constant (5000ms)', () => {
    expect(ERROR_LOG_INTERVAL_MS).toBe(5000);

    throttledErrorLog('const-test', 'First');

    // Just before interval
    vi.advanceTimersByTime(4999);
    throttledErrorLog('const-test', 'Second');
    expect(logger.error).toHaveBeenCalledTimes(1);

    // At interval
    vi.advanceTimersByTime(2);
    throttledErrorLog('const-test', 'Third');
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
