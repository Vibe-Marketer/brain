import { describe, expect, it } from 'vitest';
import { parseFirefliesTranscriptIds } from '../fireflies-import';

describe('parseFirefliesTranscriptIds', () => {
  it('splits comma and newline separated ids, trimming whitespace', () => {
    expect(parseFirefliesTranscriptIds('  abc123, def456\n ghi789  ')).toEqual([
      'abc123',
      'def456',
      'ghi789',
    ]);
  });

  it('drops blanks and preserves first occurrence order', () => {
    expect(parseFirefliesTranscriptIds('\nabc123,,abc123\n\ndef456,  ')).toEqual([
      'abc123',
      'def456',
    ]);
  });
});
