import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getSafeUser } from "@/lib/auth-utils";

/**
 * Canonical, provider-agnostic "is this call synced?" reader.
 *
 * IMP-01: this replaces the Fathom-only `checkSyncedRecordingIds`
 * (`fathom_calls` + integer-coercion) path, which silently dropped every
 * UUID-id provider (Zoom, Fireflies, Grain, Read.ai, file-upload) because
 * their external ids are not parseable integers.
 *
 * Reads the single source of truth — `recordings.(source_app, source_call_id)`
 * — with both columns kept as TEXT end to end. External ids cross into the
 * parameterized Supabase `.in()` query as STRINGS; they are NEVER coerced to
 * numbers. Mirrors the canonical dedup contract in
 * `supabase/functions/_shared/connector-pipeline.ts:checkDuplicate`, including
 * the `workspace_entries` existence check so "removed from all workspaces →
 * re-importable" is surfaced via `hasWorkspaceEntries`.
 *
 * Fail-open: an unauthenticated caller or empty input returns an empty Map
 * without throwing, so the UI degrades to "nothing known synced" rather than
 * erroring.
 */

export type SyncStatus = {
  /** The canonical CallVault UUID (`recordings.id`) of the matched row. */
  recordingUuid: string;
  /** True when at least one `workspace_entries` row references this recording. */
  hasWorkspaceEntries: boolean;
};

export async function getSyncStatusForExternalIds(
  sourceApp: string,
  externalIds: string[],
  opts?: { organizationId?: string | null },
): Promise<Map<string, SyncStatus>> {
  const result = new Map<string, SyncStatus>();
  if (externalIds.length === 0) return result;

  const { user, error: authError } = await getSafeUser();
  if (authError || !user) return result;

  try {
    let query = supabase
      .from("recordings")
      .select("id, source_call_id")
      .eq("owner_user_id", user.id)
      .eq("source_app", sourceApp)
      .in("source_call_id", externalIds); // TEXT IN — ids stay strings, never coerced

    if (opts?.organizationId) {
      query = query.eq("organization_id", opts.organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return result;

    // Batched workspace_entries existence check (mirrors checkDuplicate's
    // re-importable semantics): a recording with zero entries can be
    // re-imported even though it physically exists in `recordings`.
    const recordingIds = data.map((r) => r.id);
    const { data: entries } = await supabase
      .from("workspace_entries")
      .select("recording_id")
      .in("recording_id", recordingIds);
    const withEntries = new Set(
      (entries ?? []).map((e) => e.recording_id),
    );

    for (const row of data) {
      if (row.source_call_id == null) continue;
      result.set(row.source_call_id, {
        recordingUuid: row.id,
        hasWorkspaceEntries: withEntries.has(row.id),
      });
    }

    return result;
  } catch (error) {
    logger.error("Error reading sync status for external ids", error);
    return result;
  }
}
