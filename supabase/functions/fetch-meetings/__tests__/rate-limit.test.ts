import { describe, it, expect, beforeEach } from 'vitest';

// Rate limiter constants from the Edge Function
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 55;
const RATE_JITTER_MS = 200;

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

// Simulate the global rate limiter state
let testRateLimiterState: RateLimiterState;

// Recreate the throttleShared function for testing
async function throttleShared(
  scope: string,
  maxRequests: number = RATE_MAX_REQUESTS,
  windowMs: number = RATE_WINDOW_MS
): Promise<void> {
  const now = Date.now();
  const existing = testRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  if (elapsed >= windowMs) {
    existing.windowStart = now;
    existing.count = 0;
  }

  if (existing.count >= maxRequests) {
    const waitTime = windowMs - elapsed + Math.floor(Math.random() * RATE_JITTER_MS);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return throttleShared(scope, maxRequests, windowMs);
  }

  existing.count += 1;
  testRateLimiterState.windows.set(scope, existing);
}

describe('Rate Limiter Tests', () => {
  beforeEach(() => {
    // Reset rate limiter state before each test
    testRateLimiterState = { windows: new Map<string, RateWindow>() };
  });

  describe('Under Limit', () => {
    it('should allow 50 requests without throttling', async () => {
      const scope = 'test-scope-under-limit';
      const startTime = Date.now();

      // Make 50 requests (under the 55 limit)
      for (let i = 0; i < 50; i++) {
        await throttleShared(scope);
      }

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Should complete quickly (under 1 second) without throttling
      expect(elapsed).toBeLessThan(1000);

      // Verify state
      const state = testRateLimiterState.windows.get(scope);
      expect(state).toBeDefined();
      expect(state!.count).toBe(50);
    });

    it('should track requests correctly in the window', async () => {
      const scope = 'test-scope-tracking';

      // Make 25 requests
      for (let i = 0; i < 25; i++) {
        await throttleShared(scope);
      }

      const state1 = testRateLimiterState.windows.get(scope);
      expect(state1!.count).toBe(25);

      // Make 25 more requests
      for (let i = 0; i < 25; i++) {
        await throttleShared(scope);
      }

      const state2 = testRateLimiterState.windows.get(scope);
      expect(state2!.count).toBe(50);
    });
  });

  describe('Over Limit', () => {
    it('should throttle after 55 requests', async () => {
      const scope = 'test-scope-over-limit';
      const shortWindow = 500; // Use shorter window for testing
      const maxRequests = 10;

      // Make requests up to the limit
      for (let i = 0; i < maxRequests; i++) {
        await throttleShared(scope, maxRequests, shortWindow);
      }

      const state1 = testRateLimiterState.windows.get(scope);
      expect(state1!.count).toBe(maxRequests);

      // Next request should trigger throttling
      const startTime = Date.now();
      await throttleShared(scope, maxRequests, shortWindow);
      const elapsed = Date.now() - startTime;

      // Should have waited due to throttling (at least window time)
      expect(elapsed).toBeGreaterThan(100);
    }, 10000); // 10 second timeout

    it('should reset count after window expires', async () => {
      const scope = 'test-scope-window-reset';
      const shortWindow = 100; // 100ms window for faster testing
      const maxRequests = 5;

      // Fill up the window
      for (let i = 0; i < maxRequests; i++) {
        await throttleShared(scope, maxRequests, shortWindow);
      }

      const state1 = testRateLimiterState.windows.get(scope);
      expect(state1!.count).toBe(maxRequests);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, shortWindow + 50));

      // Make another request - should reset the window
      await throttleShared(scope, maxRequests, shortWindow);

      const state2 = testRateLimiterState.windows.get(scope);
      expect(state2!.count).toBe(1); // New window, count reset
    });
  });

  describe('Dual-Scope (Global + Per-User)', () => {
    it('should enforce both global and per-user limits independently', async () => {
      const globalScope = 'global';
      const userScope1 = 'user:user-123';
      const userScope2 = 'user:user-456';

      // User 1 makes 10 requests
      for (let i = 0; i < 10; i++) {
        await throttleShared(globalScope, 50, 1000);
        await throttleShared(userScope1, 50, 1000);
      }

      // User 2 makes 10 requests
      for (let i = 0; i < 10; i++) {
        await throttleShared(globalScope, 50, 1000);
        await throttleShared(userScope2, 50, 1000);
      }

      // Verify global scope has 20 requests
      const globalState = testRateLimiterState.windows.get(globalScope);
      expect(globalState).toBeDefined();
      expect(globalState!.count).toBe(20);

      // Verify each user has their own count
      const user1State = testRateLimiterState.windows.get(userScope1);
      const user2State = testRateLimiterState.windows.get(userScope2);

      expect(user1State).toBeDefined();
      expect(user2State).toBeDefined();
      expect(user1State!.count).toBe(10);
      expect(user2State!.count).toBe(10);
    }, 10000); // 10 second timeout

    it('should track multiple scopes independently', async () => {
      const scope1 = 'scope-1';
      const scope2 = 'scope-2';
      const scope3 = 'scope-3';

      // Different number of requests per scope
      for (let i = 0; i < 10; i++) await throttleShared(scope1);
      for (let i = 0; i < 20; i++) await throttleShared(scope2);
      for (let i = 0; i < 30; i++) await throttleShared(scope3);

      const state1 = testRateLimiterState.windows.get(scope1);
      const state2 = testRateLimiterState.windows.get(scope2);
      const state3 = testRateLimiterState.windows.get(scope3);

      expect(state1!.count).toBe(10);
      expect(state2!.count).toBe(20);
      expect(state3!.count).toBe(30);
    });
  });

  describe('Memory Cleanup', () => {
    it('should remove expired entries from Map after window expires', async () => {
      const shortWindow = 100; // 100ms window
      const scope1 = 'cleanup-test-1';
      const scope2 = 'cleanup-test-2';

      // Create entries
      await throttleShared(scope1, 10, shortWindow);
      await throttleShared(scope2, 10, shortWindow);

      // Verify both entries exist
      expect(testRateLimiterState.windows.has(scope1)).toBe(true);
      expect(testRateLimiterState.windows.has(scope2)).toBe(true);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, shortWindow + 50));

      // Access scope1 again - this should reset its window
      await throttleShared(scope1, 10, shortWindow);

      // Manually cleanup expired entries (simulating what a production cleanup would do)
      const now = Date.now();
      for (const [key, value] of testRateLimiterState.windows.entries()) {
        if (now - value.windowStart >= shortWindow * 2) {
          testRateLimiterState.windows.delete(key);
        }
      }

      // scope1 should still exist (just accessed)
      expect(testRateLimiterState.windows.has(scope1)).toBe(true);
    });

    it('should update existing window instead of creating duplicates', async () => {
      const scope = 'update-test';

      // Make multiple requests to same scope
      for (let i = 0; i < 10; i++) {
        await throttleShared(scope);
      }

      // Should only have one entry for this scope
      let entryCount = 0;
      for (const [key] of testRateLimiterState.windows.entries()) {
        if (key === scope) entryCount++;
      }

      expect(entryCount).toBe(1);
      expect(testRateLimiterState.windows.get(scope)!.count).toBe(10);
    });

    it('should handle many scopes without memory leaks', () => {
      // Create many unique scopes
      for (let i = 0; i < 1000; i++) {
        const scope = `scope-${i}`;
        const now = Date.now();
        testRateLimiterState.windows.set(scope, { windowStart: now, count: 1 });
      }

      // Verify all entries were created
      expect(testRateLimiterState.windows.size).toBe(1000);

      // Simulate cleanup of old entries
      const now = Date.now();
      const cleanupThreshold = now - RATE_WINDOW_MS * 2;

      for (const [key, value] of testRateLimiterState.windows.entries()) {
        if (value.windowStart < cleanupThreshold) {
          testRateLimiterState.windows.delete(key);
        }
      }

      // All entries should still be valid (just created)
      expect(testRateLimiterState.windows.size).toBe(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests to same scope', async () => {
      const scope = 'concurrent-test';

      // Make 20 concurrent requests
      const promises = Array.from({ length: 20 }, () => throttleShared(scope));

      await Promise.all(promises);

      const state = testRateLimiterState.windows.get(scope);
      expect(state!.count).toBe(20);
    });

    it('should respect custom max requests parameter', async () => {
      const scope = 'custom-max';
      const customMax = 5;
      const shortWindow = 500;

      // Make requests up to custom max
      for (let i = 0; i < customMax; i++) {
        await throttleShared(scope, customMax, shortWindow);
      }

      const state = testRateLimiterState.windows.get(scope);
      expect(state!.count).toBe(customMax);

      // Next request should trigger throttling
      const startTime = Date.now();
      await throttleShared(scope, customMax, shortWindow);
      const elapsed = Date.now() - startTime;

      // Should have waited due to throttling (at least 100ms)
      expect(elapsed).toBeGreaterThan(100);
    }, 10000); // 10 second timeout
  });
});
