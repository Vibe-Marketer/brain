/**
 * Unit tests for the shared OTP helpers (Phase 34, Plan 03, IDENT-03).
 *
 * Proves generateCode() draws from crypto.getRandomValues() (CSPRNG) --
 * never Math.random(), which is not cryptographically secure and would make
 * a 6-digit verification code predictable/brute-forceable in practice -- and
 * that hashCode() produces a stable, 64-char lowercase hex SHA-256 digest
 * that differs for different inputs. otp.ts does not exist yet -- this file
 * is expected to fail to even resolve its import (RED) until Task 2 creates
 * it (34-03-PLAN.md Task 1).
 */
import { describe, it, expect, vi } from 'vitest';
import { generateCode, hashCode } from '../otp.ts';

describe('[phase-34-03 otp] generateCode', () => {
  it('returns a 6-character, all-digit string', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('draws from crypto.getRandomValues (CSPRNG), never Math.random', () => {
    const cryptoSpy = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const mathRandomSpy = vi.spyOn(Math, 'random');

    generateCode();

    expect(cryptoSpy).toHaveBeenCalledTimes(1);
    // Pin the exact CSPRNG draw shape: a single 32-bit unsigned int.
    const arg = cryptoSpy.mock.calls[0]?.[0];
    expect(arg).toBeInstanceOf(Uint32Array);
    expect((arg as Uint32Array).length).toBe(1);
    expect(mathRandomSpy).not.toHaveBeenCalled();

    cryptoSpy.mockRestore();
    mathRandomSpy.mockRestore();
  });

  it('is well-distributed across 1000 draws and is always exactly 6 numeric digits', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }
    // 1,000,000 possible values across 1000 draws -- collisions should be
    // rare. A healthy majority being unique proves this isn't stuck
    // returning a constant or a narrow range.
    expect(codes.size).toBeGreaterThan(950);
  });
});

describe('[phase-34-03 otp] hashCode', () => {
  it('returns a stable 64-char lowercase hex SHA-256 digest', async () => {
    const hash = await hashCode('123456');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);

    const hashAgain = await hashCode('123456');
    expect(hashAgain).toBe(hash);
  });

  it('produces different hashes for different codes', async () => {
    const hashA = await hashCode('123456');
    const hashB = await hashCode('654321');
    expect(hashA).not.toBe(hashB);
  });
});
