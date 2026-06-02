import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GENERATE_AI_TITLES_PATH = path.resolve(__dirname, '..', 'index.ts');
const SOURCE = fs.readFileSync(GENERATE_AI_TITLES_PATH, 'utf8');

function indexOfOrThrow(needle: string): number {
  const index = SOURCE.indexOf(needle);
  if (index === -1) {
    throw new Error(`Missing source marker: ${needle}`);
  }
  return index;
}

describe('generate-ai-titles auth invariants', () => {
  it('authenticates normal app calls before using userId for call lookup', () => {
    const parseBodyIndex = indexOfOrThrow('const { recordingIds, auto_discover, limit, user_id: internalUserId, respectPreference } = validation.data;');
    const authIndex = indexOfOrThrow('const authResult = await authenticateRequest(req, supabase, corsHeaders);');
    const preferenceIndex = indexOfOrThrow('if (respectPreference) {');
    const callLookupIndex = indexOfOrThrow(".eq('user_id', userId)");

    expect(authIndex).toBeGreaterThan(parseBodyIndex);
    expect(authIndex).toBeLessThan(preferenceIndex);
    expect(authIndex).toBeLessThan(callLookupIndex);
  });

  it('allows internal user_id fan-out only with the service-role bearer token', () => {
    expect(SOURCE).toContain('if (internalUserId && bearerToken === supabaseServiceKey)');
    expect(SOURCE).toContain('userId = internalUserId;');
  });

  it('rejects attempts to generate titles for a different user over a user JWT', () => {
    expect(SOURCE).toContain('if (internalUserId && internalUserId !== userId)');
    expect(SOURCE).toContain('Cannot generate titles for another user');
    expect(SOURCE).toContain('{ status: 403, headers: { ...corsHeaders');
  });
});
