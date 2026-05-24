import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '../index.ts'), 'utf8');

describe('plaud-sync-recordings wiring', () => {
  it('supports a search mode without creating a sync job', () => {
    expect(source).toMatch(/mode\?: 'search' \| 'sync'/);
    expect(source).toMatch(/body\.mode === 'search'/);
    expect(source).toMatch(/searchPlaudRecordings\(supabase, userId, plaudClient, body\)/);
  });

  it('uses active workspace entries when marking Plaud files as already imported', () => {
    expect(source).toMatch(/\.eq\('source_app', 'plaud'\)/);
    expect(source).toMatch(/\.from\('workspace_entries'\)/);
    expect(source).toMatch(/syncedIds\.add\(externalId\)/);
  });
});
