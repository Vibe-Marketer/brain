import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type SpeakerRow = {
  name: string;
  email: string | null;
  participant_type: 'speaker';
};

function normalize(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function upsertSpeakerRows(existing: SpeakerRow[], incoming: Array<{ name: string; email?: string | null }>): SpeakerRow[] {
  const byKey = new Map<string, SpeakerRow>();

  for (const row of existing) {
    byKey.set(`${normalize(row.name)}|${normalize(row.email)}`, row);
  }

  for (const row of incoming) {
    const key = `${normalize(row.name)}|${normalize(row.email ?? null)}`;
    byKey.set(key, {
      name: row.name.trim(),
      email: row.email ?? null,
      participant_type: 'speaker',
    });
  }

  return Array.from(byKey.values());
}

describe('set_speakers idempotency contract (Wave 0)', () => {
  it('set_speakers module is wired for canonical participant upsert and ambiguity feedback', () => {
    const registrySource = readFileSync(
      resolve(__dirname, '../tools/registry.ts'),
      'utf-8',
    );
    const toolSource = readFileSync(
      resolve(__dirname, '../tools/write/set_speakers.ts'),
      'utf-8',
    );

    expect(registrySource).toContain("import { setSpeakersTool } from './write/set_speakers.ts';");
    expect(registrySource).toContain('setSpeakersTool');
    expect(toolSource).toContain("definition: { name: 'set_speakers' }");
    expect(toolSource).toContain('resolveTargetWorkspace');
    expect(toolSource).toContain('verifyRecordingInWorkspace');
    expect(toolSource).toContain("from('call_participants')");
    expect(toolSource).toContain("participant_type: 'speaker'");
    expect(toolSource).toContain('unresolved');
    expect(toolSource).toContain('ambiguous');
  });

  it('does not create duplicate speaker participant rows for equivalent repeated payloads', () => {
    const first = upsertSpeakerRows([], [
      { name: 'Jane Doe', email: 'jane@example.com' },
    ]);
    const second = upsertSpeakerRows(first, [
      { name: '  Jane Doe  ', email: 'JANE@example.com' },
    ]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(second[0]).toEqual({
      name: 'Jane Doe',
      email: 'JANE@example.com',
      participant_type: 'speaker',
    });
  });

  it('keeps participant_type locked to speaker across repeated upserts', () => {
    const rows = upsertSpeakerRows([], [
      { name: 'A', email: 'a@example.com' },
      { name: 'A', email: 'a@example.com' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].participant_type).toBe('speaker');
  });
});
