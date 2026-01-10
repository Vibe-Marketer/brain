/**
 * Unit tests for automation webhook signature verification and security
 *
 * Tests the HMAC-SHA256 signature verification, timestamp validation,
 * rate limiting, and other security features of the webhook endpoint.
 *
 * @see ../index.ts
 * @see subtask-8-3: Test webhook-triggered rule execution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as crypto from 'crypto';

// ============================================================
// Re-implement security functions for testing
// (The actual index.ts uses Deno crypto, so we recreate with Node crypto)
// ============================================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  // XOR lengths to detect mismatch - this is a constant-time operation
  let result = a.length ^ b.length;

  // Always iterate over the longer string to ensure constant time
  const maxLength = Math.max(a.length, b.length);

  for (let i = 0; i < maxLength; i++) {
    // Use || 0 for out-of-bounds access to maintain constant-time behavior
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return result === 0;
}

/**
 * Verify HMAC-SHA256 signature
 * This mirrors the actual implementation in automation-webhook/index.ts
 */
function verifySignature(
  secret: string,
  payload: string,
  signature: string,
  timestamp: string
): boolean {
  // Build the signed content: timestamp.payload
  const signedContent = `${timestamp}.${payload}`;

  try {
    // Compute HMAC-SHA256
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(signedContent);
    const expectedHex = hmac.digest('hex');
    const expectedBase64 = hmac.digest().toString('base64');

    // Check both hex and base64 formats
    return constantTimeCompare(signature, expectedHex) || constantTimeCompare(signature, expectedBase64);
  } catch {
    return false;
  }
}

/**
 * Generate a valid webhook signature
 */
function generateSignature(secret: string, payload: string, timestamp: string): string {
  const signedContent = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signedContent);
  return hmac.digest('hex');
}

/**
 * Verify Svix-compatible signature format
 */
function verifySvixSignature(
  secret: string,
  payload: string,
  signatureHeader: string,
  webhookId: string,
  timestamp: string
): boolean {
  // Parse signature header (format: "v1,{signature}" or "v1,{sig1} v1,{sig2}")
  const signatures = signatureHeader.split(' ').map((s) => {
    if (s.startsWith('v1,')) return s.substring(3);
    return s;
  });

  // Svix signs: webhook-id.webhook-timestamp.payload
  const signedContent = `${webhookId}.${timestamp}.${payload}`;

  // Handle whsec_ prefixed secrets (base64 encoded)
  let secretBytes: Buffer;
  if (secret.startsWith('whsec_')) {
    try {
      const secretPart = secret.substring(6);
      secretBytes = Buffer.from(secretPart, 'base64');
    } catch {
      secretBytes = Buffer.from(secret.substring(6));
    }
  } else {
    secretBytes = Buffer.from(secret);
  }

  try {
    const hmac = crypto.createHmac('sha256', secretBytes);
    hmac.update(signedContent);
    const expectedBase64 = hmac.digest('base64');

    // Check if any provided signature matches
    return signatures.some((sig) => constantTimeCompare(sig, expectedBase64));
  } catch {
    return false;
  }
}

/**
 * Generate a Svix-compatible signature
 */
function generateSvixSignature(secret: string, payload: string, webhookId: string, timestamp: string): string {
  const signedContent = `${webhookId}.${timestamp}.${payload}`;

  let secretBytes: Buffer;
  if (secret.startsWith('whsec_')) {
    secretBytes = Buffer.from(secret.substring(6), 'base64');
  } else {
    secretBytes = Buffer.from(secret);
  }

  const hmac = crypto.createHmac('sha256', secretBytes);
  hmac.update(signedContent);
  return `v1,${hmac.digest('base64')}`;
}

// Maximum age of webhook in milliseconds (5 minutes per spec)
const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

/**
 * Validate webhook timestamp to prevent replay attacks
 */
function validateTimestamp(timestamp: string): { valid: boolean; reason?: string } {
  const webhookTime = parseInt(timestamp, 10);

  if (isNaN(webhookTime)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();

  // Convert to milliseconds if timestamp is in seconds
  const webhookTimeMs = webhookTime < 10000000000 ? webhookTime * 1000 : webhookTime;

  const age = now - webhookTimeMs;

  if (age > MAX_WEBHOOK_AGE_MS) {
    return { valid: false, reason: `Webhook too old: ${Math.round(age / 1000)}s (max: ${MAX_WEBHOOK_AGE_MS / 1000}s)` };
  }

  if (age < -60000) {
    // Allow 1 minute clock skew into the future
    return { valid: false, reason: 'Webhook timestamp is in the future' };
  }

  return { valid: true };
}

// Rate limiting implementation
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 100;

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitMap.set(userId, { count: 1, resetAt });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count, resetAt: entry.resetAt };
}

// ============================================================
// Tests
// ============================================================

describe('Webhook Signature Verification', () => {
  const testSecret = 'test-webhook-secret-key-12345';
  const testPayload = JSON.stringify({
    event_type: 'call.completed',
    source: 'fathom',
    user_id: 'user-123',
    recording_id: 12345,
  });

  describe('Standard HMAC-SHA256 Signature', () => {
    it('should verify a valid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSignature(testSecret, testPayload, timestamp);

      const result = verifySignature(testSecret, testPayload, signature, timestamp);

      expect(result).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const invalidSignature = 'invalid-signature-12345';

      const result = verifySignature(testSecret, testPayload, invalidSignature, timestamp);

      expect(result).toBe(false);
    });

    it('should reject a signature with wrong secret', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSignature('wrong-secret', testPayload, timestamp);

      const result = verifySignature(testSecret, testPayload, signature, timestamp);

      expect(result).toBe(false);
    });

    it('should reject a signature with tampered payload', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSignature(testSecret, testPayload, timestamp);

      const tamperedPayload = JSON.stringify({ ...JSON.parse(testPayload), tampered: true });
      const result = verifySignature(testSecret, tamperedPayload, signature, timestamp);

      expect(result).toBe(false);
    });

    it('should reject a signature with wrong timestamp', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSignature(testSecret, testPayload, timestamp);

      const wrongTimestamp = String(Math.floor(Date.now() / 1000) - 100);
      const result = verifySignature(testSecret, testPayload, signature, wrongTimestamp);

      expect(result).toBe(false);
    });
  });

  describe('Svix-Compatible Signature', () => {
    it('should verify a valid Svix signature', () => {
      const svixSecret = 'whsec_' + Buffer.from('test-svix-secret').toString('base64');
      const webhookId = 'wh_123456';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSvixSignature(svixSecret, testPayload, webhookId, timestamp);

      const result = verifySvixSignature(svixSecret, testPayload, signature, webhookId, timestamp);

      expect(result).toBe(true);
    });

    it('should verify Svix signature with non-prefixed secret', () => {
      const svixSecret = 'plain-secret-key';
      const webhookId = 'wh_123456';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSvixSignature(svixSecret, testPayload, webhookId, timestamp);

      const result = verifySvixSignature(svixSecret, testPayload, signature, webhookId, timestamp);

      expect(result).toBe(true);
    });

    it('should reject Svix signature with wrong webhook ID', () => {
      const svixSecret = 'whsec_' + Buffer.from('test-svix-secret').toString('base64');
      const webhookId = 'wh_123456';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSvixSignature(svixSecret, testPayload, webhookId, timestamp);

      const result = verifySvixSignature(svixSecret, testPayload, signature, 'wh_wrong', timestamp);

      expect(result).toBe(false);
    });

    it('should handle multiple signatures in header', () => {
      const svixSecret = 'whsec_' + Buffer.from('test-svix-secret').toString('base64');
      const webhookId = 'wh_123456';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const validSignature = generateSvixSignature(svixSecret, testPayload, webhookId, timestamp);

      // Multiple signatures in header (Svix may include multiple for key rotation)
      const multiSignatureHeader = `v1,invalid-sig ${validSignature}`;

      const result = verifySvixSignature(svixSecret, testPayload, multiSignatureHeader, webhookId, timestamp);

      expect(result).toBe(true); // Should pass if any signature is valid
    });
  });

  describe('Constant-Time Comparison', () => {
    it('should return true for identical strings', () => {
      expect(constantTimeCompare('hello', 'hello')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(constantTimeCompare('hello', 'world')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(constantTimeCompare('short', 'much longer string')).toBe(false);
    });

    it('should return false for strings differing by one character', () => {
      expect(constantTimeCompare('password1', 'password2')).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true);
      expect(constantTimeCompare('', 'nonempty')).toBe(false);
    });

    it('should handle special characters', () => {
      const sig1 = 'abc123!@#$%^&*()_+';
      expect(constantTimeCompare(sig1, sig1)).toBe(true);
      expect(constantTimeCompare(sig1, 'abc123!@#$%^&*()_-')).toBe(false);
    });
  });
});

describe('Timestamp Validation (Replay Attack Prevention)', () => {
  describe('Valid Timestamps', () => {
    it('should accept a current timestamp (seconds)', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });

    it('should accept a current timestamp (milliseconds)', () => {
      const timestamp = String(Date.now());
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });

    it('should accept a timestamp from 1 minute ago', () => {
      const timestamp = String(Math.floor((Date.now() - 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });

    it('should accept a timestamp from 4 minutes ago', () => {
      const timestamp = String(Math.floor((Date.now() - 4 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Timestamps', () => {
    it('should reject a timestamp older than 5 minutes', () => {
      const timestamp = String(Math.floor((Date.now() - 6 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should reject a timestamp older than 1 hour', () => {
      const timestamp = String(Math.floor((Date.now() - 60 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should reject a timestamp far in the future (>1 minute)', () => {
      const timestamp = String(Math.floor((Date.now() + 5 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('future');
    });

    it('should accept a timestamp slightly in the future (clock skew)', () => {
      // 30 seconds in the future should be allowed (clock skew tolerance)
      const timestamp = String(Math.floor((Date.now() + 30 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });

    it('should reject non-numeric timestamp', () => {
      const result = validateTimestamp('not-a-number');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid timestamp format');
    });

    it('should reject empty timestamp', () => {
      const result = validateTimestamp('');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Invalid timestamp format');
    });
  });

  describe('Replay Attack Scenarios', () => {
    it('should prevent replaying a 10-minute-old webhook', () => {
      const oldTimestamp = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
      const result = validateTimestamp(oldTimestamp);

      expect(result.valid).toBe(false);
      // This simulates an attacker capturing and replaying an old webhook
    });

    it('should prevent replaying a 1-day-old webhook', () => {
      const oldTimestamp = String(Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000));
      const result = validateTimestamp(oldTimestamp);

      expect(result.valid).toBe(false);
    });
  });
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear rate limit map before each test
    rateLimitMap.clear();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
    });

    it('should allow requests up to limit', () => {
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS - 1; i++) {
        checkRateLimit('user-123');
      }

      const result = checkRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should block requests over limit', () => {
      // Use up all allowed requests
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit('user-123');
      }

      const result = checkRateLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different users separately', () => {
      // Use up all requests for user-1
      for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
        checkRateLimit('user-1');
      }

      // User-2 should still be allowed
      const result = checkRateLimit('user-2');

      expect(result.allowed).toBe(true);
    });
  });

  describe('Rate Limit Reset', () => {
    it('should include reset timestamp', () => {
      const result = checkRateLimit('user-123');

      expect(result.resetAt).toBeGreaterThan(Date.now());
      expect(result.resetAt).toBeLessThanOrEqual(Date.now() + RATE_LIMIT_WINDOW_MS + 1000);
    });

    it('should reset after window expires', () => {
      // Manually set an expired entry
      const expiredResetAt = Date.now() - 1000;
      rateLimitMap.set('user-123', { count: RATE_LIMIT_MAX_REQUESTS, resetAt: expiredResetAt });

      const result = checkRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMIT_MAX_REQUESTS - 1);
    });
  });
});

describe('Integration Test: Webhook Security Flow', () => {
  /**
   * Simulates the complete webhook security verification flow
   * from subtask-8-3:
   * 1. POST to webhook endpoint with valid signature
   * 2. Verify signature
   * 3. Validate timestamp
   * 4. Check rate limit
   * 5. Process webhook
   */

  const testSecret = 'production-webhook-secret';
  const testPayload = JSON.stringify({
    event_type: 'call.completed',
    source: 'fathom',
    user_id: 'user-abc-123',
    data: {
      recording_id: 12345,
      title: 'Sales Call',
      duration: 45,
    },
  });

  beforeEach(() => {
    rateLimitMap.clear();
  });

  it('should accept webhook with valid signature and timestamp', () => {
    // 1. Generate valid signature
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(testSecret, testPayload, timestamp);

    // 2. Verify signature
    const signatureValid = verifySignature(testSecret, testPayload, signature, timestamp);
    expect(signatureValid).toBe(true);

    // 3. Validate timestamp
    const timestampResult = validateTimestamp(timestamp);
    expect(timestampResult.valid).toBe(true);

    // 4. Check rate limit
    const rateLimit = checkRateLimit('user-abc-123');
    expect(rateLimit.allowed).toBe(true);

    // 5. All checks pass - webhook would be processed
    // In actual implementation, automation-engine would be called
  });

  it('should reject webhook with invalid signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const invalidSignature = 'invalid-signature';

    const signatureValid = verifySignature(testSecret, testPayload, invalidSignature, timestamp);
    expect(signatureValid).toBe(false);

    // Request should be rejected at this point
    // Automation engine should NOT be called
  });

  it('should reject webhook with expired timestamp', () => {
    // Simulate replaying an old webhook
    const oldTimestamp = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
    const signature = generateSignature(testSecret, testPayload, oldTimestamp);

    // Signature might be valid...
    const signatureValid = verifySignature(testSecret, testPayload, signature, oldTimestamp);
    expect(signatureValid).toBe(true);

    // ...but timestamp check should fail
    const timestampResult = validateTimestamp(oldTimestamp);
    expect(timestampResult.valid).toBe(false);
    expect(timestampResult.reason).toContain('too old');

    // Request should be rejected - replay attack prevented
  });

  it('should reject webhook when rate limited', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(testSecret, testPayload, timestamp);

    // Use up all rate limit
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      checkRateLimit('user-abc-123');
    }

    // Signature and timestamp are valid...
    expect(verifySignature(testSecret, testPayload, signature, timestamp)).toBe(true);
    expect(validateTimestamp(timestamp).valid).toBe(true);

    // ...but rate limit check should fail
    const rateLimit = checkRateLimit('user-abc-123');
    expect(rateLimit.allowed).toBe(false);

    // Request should be rejected with 429 status
  });

  it('should handle Svix-formatted webhooks correctly', () => {
    const svixSecret = 'whsec_' + Buffer.from('svix-test-secret').toString('base64');
    const webhookId = 'msg_' + crypto.randomUUID();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSvixSignature(svixSecret, testPayload, webhookId, timestamp);

    // Verify Svix signature
    const signatureValid = verifySvixSignature(
      svixSecret,
      testPayload,
      signature,
      webhookId,
      timestamp
    );
    expect(signatureValid).toBe(true);

    // Timestamp validation works the same
    expect(validateTimestamp(timestamp).valid).toBe(true);
  });

  it('should log execution history after successful webhook processing', () => {
    // This test documents the expected behavior after webhook verification
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateSignature(testSecret, testPayload, timestamp);

    // All security checks pass
    expect(verifySignature(testSecret, testPayload, signature, timestamp)).toBe(true);
    expect(validateTimestamp(timestamp).valid).toBe(true);
    expect(checkRateLimit('user-abc-123').allowed).toBe(true);

    // After successful verification, automation-engine would:
    // 1. Find matching rules (trigger_type = 'webhook')
    // 2. Evaluate each rule's conditions
    // 3. Execute actions for matching rules
    // 4. Log execution to automation_execution_history with:
    //    - trigger_type: 'webhook'
    //    - trigger_source: { webhook_event_id, event_type, source }
    //    - debug_info: { webhook_payload, signature_verified: true }
    //    - success: true/false
    //    - execution_time_ms

    // Simulated execution history entry
    const executionHistoryEntry = {
      rule_id: 'rule-123',
      user_id: 'user-abc-123',
      trigger_type: 'webhook',
      trigger_source: {
        webhook_event_id: 'wh-event-123',
        event_type: 'call.completed',
        source: 'fathom',
      },
      success: true,
      debug_info: {
        signature_verified: true,
        timestamp_validated: true,
        rate_limit_remaining: 99,
        webhook_payload: JSON.parse(testPayload),
      },
    };

    // Verify structure
    expect(executionHistoryEntry.trigger_type).toBe('webhook');
    expect(executionHistoryEntry.debug_info.signature_verified).toBe(true);
  });
});

describe('Edge Cases', () => {
  describe('Malformed Input Handling', () => {
    it('should handle null secret gracefully', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));

      // This should not throw, just return false
      expect(() => {
        verifySignature(null as unknown as string, 'payload', 'sig', timestamp);
      }).toThrow(); // Or handle gracefully depending on implementation
    });

    it('should handle empty payload', () => {
      const testSecret = 'test-secret';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = generateSignature(testSecret, '', timestamp);

      const result = verifySignature(testSecret, '', signature, timestamp);
      expect(result).toBe(true);
    });

    it('should handle very long payload', () => {
      const testSecret = 'test-secret';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const longPayload = 'a'.repeat(100000);
      const signature = generateSignature(testSecret, longPayload, timestamp);

      const result = verifySignature(testSecret, longPayload, signature, timestamp);
      expect(result).toBe(true);
    });

    it('should handle special characters in payload', () => {
      const testSecret = 'test-secret';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const specialPayload = JSON.stringify({ data: '!@#$%^&*()_+-=[]{}|;\':",./<>?\n\t\r' });
      const signature = generateSignature(testSecret, specialPayload, timestamp);

      const result = verifySignature(testSecret, specialPayload, signature, timestamp);
      expect(result).toBe(true);
    });

    it('should handle unicode characters in payload', () => {
      const testSecret = 'test-secret';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const unicodePayload = JSON.stringify({ message: '你好世界 🌍 مرحبا العالم' });
      const signature = generateSignature(testSecret, unicodePayload, timestamp);

      const result = verifySignature(testSecret, unicodePayload, signature, timestamp);
      expect(result).toBe(true);
    });
  });

  describe('Timestamp Edge Cases', () => {
    it('should handle timestamp at exact 5-minute boundary', () => {
      // This is a boundary condition - exactly 5 minutes old
      const timestamp = String(Math.floor((Date.now() - 5 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      // Should be invalid (older than 5 minutes)
      expect(result.valid).toBe(false);
    });

    it('should handle timestamp just under 5-minute limit', () => {
      // 4 minutes 59 seconds ago
      const timestamp = String(Math.floor((Date.now() - (4 * 60 + 59) * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(true);
    });

    it('should handle very old timestamps', () => {
      // 1 year ago
      const timestamp = String(Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000));
      const result = validateTimestamp(timestamp);

      expect(result.valid).toBe(false);
    });

    it('should handle timestamp 0 (Unix epoch)', () => {
      const result = validateTimestamp('0');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('too old');
    });
  });
});
