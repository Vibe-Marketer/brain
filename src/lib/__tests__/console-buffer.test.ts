import { describe, expect, it } from 'vitest';
import type { DebugMessage } from '@/components/debug-panel';
import {
  deriveConsoleBuffer,
  serializeConsoleBuffer,
  type ConsoleBufferEntry,
} from '@/lib/console-buffer';

function makeMessage(overrides: Partial<DebugMessage> = {}): DebugMessage {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    timestamp: overrides.timestamp ?? Date.now(),
    type: overrides.type ?? 'info',
    message: overrides.message ?? 'a message',
    ...overrides,
  };
}

/** jsdom's Blob has no .text() — read via FileReader instead. */
function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

/** Builds `count` messages with strictly increasing timestamps starting at base. */
function makeSeries(
  count: number,
  base: number,
  type: DebugMessage['type'],
  prefix: string,
): DebugMessage[] {
  return Array.from({ length: count }, (_, i) =>
    makeMessage({ id: `${prefix}-${i}`, timestamp: base + i, type, message: `${prefix} ${i}` }),
  );
}

describe('deriveConsoleBuffer (D-03)', () => {
  it('caps at 100, retaining ALL errors plus the most recent non-errors, timestamp ascending', () => {
    // 150 mixed entries: 30 errors interleaved among 120 non-errors
    const nonErrors = makeSeries(120, 1000, 'info', 'info');
    const errors = makeSeries(30, 1500, 'error', 'err');
    const mixed = [...nonErrors, ...errors].sort(() => 0.5 - Math.random());

    const result = deriveConsoleBuffer(mixed);

    expect(result).toHaveLength(100);
    const errorEntries = result.filter((e) => e.type === 'error');
    expect(errorEntries).toHaveLength(30);

    // Remaining 70 slots are the MOST RECENT non-errors (info 50..119)
    const nonErrorEntries = result.filter((e) => e.type !== 'error');
    expect(nonErrorEntries).toHaveLength(70);
    const nonErrorTimestamps = nonErrorEntries.map((e) => e.timestamp).sort((a, b) => a - b);
    expect(nonErrorTimestamps[0]).toBe(1050); // info-50 is the oldest survivor
    expect(nonErrorTimestamps[69]).toBe(1119);

    // Final output is sorted by timestamp ascending
    const timestamps = result.map((e) => e.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it('returns the 100 most recent errors when there are more than 100 errors', () => {
    const errors = makeSeries(120, 2000, 'error', 'err');

    const result = deriveConsoleBuffer(errors);

    expect(result).toHaveLength(100);
    expect(result.every((e) => e.type === 'error')).toBe(true);
    // Most recent 100: timestamps 2020..2119
    expect(result[0].timestamp).toBe(2020);
    expect(result[99].timestamp).toBe(2119);
  });

  it('returns all entries when there are fewer than 100', () => {
    const messages = [
      makeMessage({ id: 'a', timestamp: 3, type: 'info' }),
      makeMessage({ id: 'b', timestamp: 1, type: 'error' }),
      makeMessage({ id: 'c', timestamp: 2, type: 'warning' }),
    ];

    const result = deriveConsoleBuffer(messages);

    expect(result).toHaveLength(3);
    expect(result.map((e) => e.timestamp)).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty input (empty console is still a clean submit)', () => {
    expect(deriveConsoleBuffer([])).toEqual([]);
  });

  it('respects a custom cap', () => {
    const messages = makeSeries(10, 100, 'info', 'info');
    expect(deriveConsoleBuffer(messages, 5)).toHaveLength(5);
  });

  it('strips heavy fields and keeps only the allowlisted shape', () => {
    const message = makeMessage({
      id: 'heavy',
      timestamp: 42,
      type: 'network',
      source: 'fetch',
      message: 'request failed',
      stack: 'Error: request failed\n  at fetch',
      httpStatus: 500,
      url: 'https://api.example.com/x',
      responseBody: 'SECRET DB ERROR TEXT',
      appStateSnapshot: { url: 'https://x', timestamp: 1, recentActions: ['a'] },
      details: 'extra details',
      rawMessage: { big: 'object' },
    });

    const [entry] = deriveConsoleBuffer([message]);

    expect(entry).toEqual({
      timestamp: 42,
      type: 'network',
      source: 'fetch',
      message: 'request failed',
      stack: 'Error: request failed\n  at fetch',
      httpStatus: 500,
      url: 'https://api.example.com/x',
    });
    expect(entry).not.toHaveProperty('responseBody');
    expect(entry).not.toHaveProperty('appStateSnapshot');
    expect(entry).not.toHaveProperty('rawMessage');
    expect(entry).not.toHaveProperty('details');
  });

  it('omits optional fields that are absent rather than emitting undefined keys', () => {
    const [entry] = deriveConsoleBuffer([
      makeMessage({ id: 'bare', timestamp: 7, type: 'info', message: 'plain' }),
    ]);

    expect(entry).toEqual({ timestamp: 7, type: 'info', message: 'plain' });
    expect(Object.keys(entry)).not.toContain('stack');
    expect(Object.keys(entry)).not.toContain('httpStatus');
    expect(Object.keys(entry)).not.toContain('url');
    expect(Object.keys(entry)).not.toContain('source');
  });

  it('truncates message to 500 chars and stack to 2000 chars', () => {
    const [entry] = deriveConsoleBuffer([
      makeMessage({
        id: 'long',
        timestamp: 1,
        type: 'error',
        message: 'm'.repeat(600),
        stack: 's'.repeat(2500),
      }),
    ]);

    expect(entry.message).toHaveLength(500);
    expect(entry.message).toBe('m'.repeat(500));
    expect(entry.stack).toHaveLength(2000);
    expect(entry.stack).toBe('s'.repeat(2000));
  });
});

describe('serializeConsoleBuffer (D-03)', () => {
  it('returns an application/json Blob whose parsed content round-trips the entries', async () => {
    const entries: ConsoleBufferEntry[] = [
      { timestamp: 1, type: 'error', message: 'boom', stack: 'Error: boom' },
      { timestamp: 2, type: 'info', message: 'ok', source: 'console', httpStatus: 200 },
    ];

    const blob = serializeConsoleBuffer(entries);

    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await readBlobText(blob)) as { capturedAt: string; entries: ConsoleBufferEntry[] };
    expect(parsed.entries).toEqual(entries);
    expect(typeof parsed.capturedAt).toBe('string');
    expect(Number.isNaN(Date.parse(parsed.capturedAt))).toBe(false);
  });

  it('serializes an empty buffer as an empty entries array (never an error)', async () => {
    const blob = serializeConsoleBuffer([]);
    const parsed = JSON.parse(await readBlobText(blob)) as { entries: ConsoleBufferEntry[] };
    expect(parsed.entries).toEqual([]);
  });
});
