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
    const parseBodyIndex = indexOfOrThrow('const { recordingIds, canonicalRecordingIds, auto_discover, limit, user_id: internalUserId, respectPreference } = validation.data;');
    const authIndex = indexOfOrThrow('const authResult = await authenticateRequest(req, supabase, corsHeaders);');
    const preferenceIndex = indexOfOrThrow('if (respectPreference) {');
    const callLookupIndex = indexOfOrThrow('const userHasRecordingAccess = async (');

    expect(authIndex).toBeGreaterThan(parseBodyIndex);
    expect(authIndex).toBeLessThan(preferenceIndex);
    expect(authIndex).toBeLessThan(callLookupIndex);
  });

  it('verifies recording access via owner, org admin, or workspace membership rather than a raw userId filter', () => {
    // Recording ownership (fathom_raw_calls.recording_id / recordings.id) is per-owner,
    // not per-org — shared-workspace members legitimately title calls they don't own.
    // Filtering the per-call lookup/update by `.eq('user_id', userId)` (the acting
    // user) instead of verifying access silently no-ops for non-owners: 0 rows match,
    // no error is raised, and the caller is told the title was generated when nothing
    // was saved. Only the auto-discover query (intentionally owner-scoped) and the
    // user-preference lookup may still filter on the acting user directly.
    expect(SOURCE).not.toContain("recording_id, canonical_recording_id, user_id, title, full_transcript, created_at, recorded_by_name, recorded_by_email, calendar_invitees')\n          .eq('recording_id', recordingId)\n          .eq('user_id', userId)");
    expect(SOURCE).not.toContain(".eq('recording_id', recordingId)\n          .eq('user_id', userId);");
    expect(SOURCE).not.toContain(".eq('id', canonicalId)\n          .eq('owner_user_id', userId)");
    expect(SOURCE).toContain('userHasRecordingAccess');
    expect(SOURCE).toContain('is_organization_admin_or_owner');
    expect(SOURCE).toContain('workspace_memberships');
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
