/**
 * Import Sources Service
 *
 * CRUD operations for the import_sources table and related data.
 * Each row represents a connected source (Fathom, Zoom, YouTube, file-upload)
 * for a specific user — active/inactive toggle, last sync time, error state.
 *
 * Pattern: flat exported async functions, same as recordings.service.ts.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  canRetryFailedImport,
  getConnectorSyncFunctionName,
} from "@/lib/connector-sync-functions";
import { getSourceLabel } from "@/lib/source-labels";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportSource {
  id: string;
  user_id: string;
  source_app: string;
  is_active: boolean;
  account_email: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  connection_metadata: Record<string, unknown> | null;
  webhook_path_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportSourceWithCount extends ImportSource {
  call_count: number;
}

export interface FailedImport {
  source_app: string;
  failed_external_id: string;
  error_message: string | null;
  sync_job_id: string;
  /** Call title looked up from fathom_raw_calls (may be null if never partially synced) */
  title: string | null;
}

// ---------------------------------------------------------------------------
// Source queries
// ---------------------------------------------------------------------------

export async function getImportSources(): Promise<ImportSource[]> {
  // import_sources are user-scoped, NOT org-scoped — connected accounts shared across orgs (ORG-05)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  const { data: sourceRows, error: sourceError } = await supabase
    .from("import_sources")
    .select(
      "id, user_id, source_app, is_active, account_email, last_sync_at, error_message, connection_metadata, webhook_path_token, created_at, updated_at",
    )
    .order("source_app", { ascending: true });

  if (sourceError) {
    throw new Error(`Failed to fetch import sources: ${sourceError.message}`);
  }

  return sourceRows ?? [];
}

/**
 * Returns a mapping of source_app -> call count for the current org.
 * Counts from the recordings table scoped to both user and organization.
 * organizationId is required to ensure counts reflect only the current org (ORG-01).
 */
export async function getImportCounts(
  organizationId: string,
): Promise<Record<string, number>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user || !organizationId) return {};

  // Direct query instead of RPC so we can filter by both user and org.
  // The legacy get_import_counts RPC only accepts p_user_id and would return
  // counts across all orgs — not suitable for multi-org users.
  const { data, error } = await supabase
    .from("recordings")
    .select("source_app")
    .eq("owner_user_id", user.id)
    .eq("organization_id", organizationId)
    .not("source_app", "is", null);

  const counts: Record<string, number> = {};
  if (!error && Array.isArray(data)) {
    for (const row of data as { source_app: string | null }[]) {
      if (row.source_app) {
        counts[row.source_app] = (counts[row.source_app] || 0) + 1;
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Toggles the is_active flag for an import source.
 * Also bumps updated_at so the sync engine knows to re-read the row.
 */
export async function toggleSourceActive(
  sourceId: string,
  isActive: boolean,
): Promise<ImportSource> {
  const { data, error } = await supabase
    .from("import_sources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", sourceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to toggle source: ${error.message}`);
  }

  return data;
}

/**
 * Upserts an import source row.
 * Called when a user connects a new OAuth source — creates the row if it
 * doesn't exist, updates account_email if it already does.
 *
 * For sources that support multi-account (like Fathom), the row is pre-created
 * by the OAuth flow, so this primarily updates account_email.
 * For single-account sources, falls back to upsert by (user_id, source_app).
 */
export async function upsertImportSource(source: {
  source_app: string;
  account_email?: string;
  source_id?: string;
}): Promise<ImportSource> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Must be authenticated to connect a source");

  // If sourceId provided (multi-account flow), update that specific row
  if (source.source_id) {
    const { data, error } = await supabase
      .from("import_sources")
      .update({
        account_email: source.account_email ?? null,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.source_id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update import source: ${error.message}`);
    }

    return data;
  }

  // Legacy single-account path: insert or find existing
  // First check if a row already exists
  const { data: existing } = await supabase
    .from("import_sources")
    .select("*")
    .eq("user_id", user.id)
    .eq("source_app", source.source_app)
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("import_sources")
      .update({
        account_email: source.account_email ?? existing.account_email,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update import source: ${error.message}`);
    return data;
  }

  // No existing row — insert new
  const { data, error } = await supabase
    .from("import_sources")
    .insert({
      user_id: user.id,
      source_app: source.source_app,
      account_email: source.account_email ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create import source: ${error.message}`);
  }

  return data;
}

/**
 * Uploads a file to the file-upload-transcribe edge function for Whisper transcription.
 * Returns the new recording ID so the UI can navigate to it.
 *
 * Per locked decision: 25MB limit is enforced client-side before calling this.
 */
export async function uploadFile(file: File): Promise<{ recordingId: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const { data, error } = await supabase.functions.invoke(
    "file-upload-transcribe",
    {
      body: formData,
    },
  );

  if (error) {
    throw new Error(`File upload failed: ${error.message}`);
  }

  if (!data?.recordingId) {
    throw new Error("File upload succeeded but no recording ID returned");
  }

  return { recordingId: data.recordingId as string };
}

/**
 * Disconnects an import source.
 * 1. Looks up the source to determine which app it is
 * 2. Clears the OAuth tokens from user_settings (edge functions read tokens from there)
 * 3. Deletes the import_sources row
 * Per locked decision: imported calls are kept; only future syncs stop.
 */
export async function disconnectImportSource(sourceId: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("Not authenticated");

  // Look up the source to know which connector-specific legacy fields must be
  // cleared by the shared disconnect RPC.
  const { data: source, error: sourceError } = await supabase
    .from("import_sources")
    .select("source_app")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();

  if (sourceError || !source) {
    throw new Error(sourceError?.message ?? "Import source not found");
  }

  const { error } = await supabase.rpc("disconnect_connector_source", {
    p_source_app: source.source_app,
    p_source_id: sourceId,
  });

  if (error) {
    throw new Error(`Failed to disconnect source: ${error.message}`);
  }
}

/**
 * Retries a single failed import by dispatching through the shared connector
 * sync-function contract. File uploads cannot be retried automatically because
 * the original file is not available to the browser after the failed attempt.
 */
export async function retryFailedImport(
  sourceApp: string,
  failedExternalId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!canRetryFailedImport(sourceApp)) {
    return {
      success: false,
      error: `${getSourceLabel(sourceApp)} imports cannot be retried automatically.`,
    };
  }

  const fnName = getConnectorSyncFunctionName(sourceApp);
  if (!fnName) {
    return { success: false, error: `Unknown source: ${sourceApp}` };
  }

  const { error } = await supabase.functions.invoke(fnName, {
    body: { singleCallId: failedExternalId },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetches failed imports from sync_jobs where failed_ids array is non-empty.
 * organizationId scopes the "already synced" check so we only show failures
 * relevant to the current org — not false-positives from other orgs (ORG-01).
 * Note: sync_jobs table has no organization_id column, so we scope indirectly
 * by filtering the synced recordings check to the current org.
 */
export async function getFailedImports(
  organizationId: string,
): Promise<FailedImport[]> {
  const { data, error } = await supabase
    .from("sync_jobs")
    .select("id, failed_ids, error, type")
    .not("failed_ids", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    logger.warn("Failed to fetch failed imports", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Get user once — use cached session to avoid N+1 /auth/v1/user requests
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return [];

  // Get all synced external_ids scoped to current org to filter out false-positives.
  // Without org scoping, a call synced in org A would suppress the failure in org B.
  // Check BOTH source_metadata.external_id and legacy_recording_id
  const { data: syncedRecs } = await supabase
    .from("recordings")
    .select("source_metadata, legacy_recording_id")
    .eq("owner_user_id", user.id)
    .eq("organization_id", organizationId);

  const syncedIds = new Set<string>();
  if (syncedRecs) {
    for (const r of syncedRecs) {
      const extId = (r.source_metadata as any)?.external_id;
      if (extId) syncedIds.add(String(extId));
      if ((r as any).legacy_recording_id)
        syncedIds.add(String((r as any).legacy_recording_id));
    }
  }

  // Collect all failed external IDs first, then batch-lookup titles
  const allFailedIds: string[] = [];
  const jobs = data as any[];
  for (const job of jobs) {
    if (!job.failed_ids || job.failed_ids.length === 0) continue;
    for (const externalId of job.failed_ids) {
      const extStr = String(externalId);
      if (!syncedIds.has(extStr)) allFailedIds.push(extStr);
    }
  }

  // Batch lookup titles from fathom_raw_calls for Fathom failures
  const titleMap = new Map<string, string>();
  if (allFailedIds.length > 0) {
    const numericIds = allFailedIds
      .map(Number)
      .filter((n) => Number.isFinite(n));

    if (numericIds.length > 0) {
      const { data: rawCalls } = await supabase
        .from("fathom_raw_calls")
        .select("recording_id, title")
        .in("recording_id", numericIds)
        .eq("user_id", user.id);

      if (rawCalls) {
        for (const rc of rawCalls) {
          titleMap.set(String(rc.recording_id), rc.title);
        }
      }
    }
  }

  // Flatten: one FailedImport per failed external_id
  const results: FailedImport[] = [];
  for (const job of jobs) {
    if (!job.failed_ids || job.failed_ids.length === 0) continue;

    for (const externalId of job.failed_ids) {
      const extStr = String(externalId);
      if (syncedIds.has(extStr)) continue;

      const type = job.type?.toLowerCase();
      const sourceApp = type === "sync" || !type ? "fathom" : type;

      results.push({
        source_app: sourceApp,
        failed_external_id: extStr,
        error_message: job.error,
        sync_job_id: job.id,
        title: titleMap.get(extStr) ?? null,
      });
    }
  }

  // Final dedupe by external_id (only show the most recent failure for a specific call)
  const dedupedMap = new Map<string, FailedImport>();
  for (const res of results) {
    if (!dedupedMap.has(res.failed_external_id)) {
      dedupedMap.set(res.failed_external_id, res);
    }
  }

  return Array.from(dedupedMap.values());
}

export async function clearFailedImports(input: {
  syncJobId?: string;
  failedExternalIds?: string[];
  clearAll?: boolean;
}): Promise<{ success: boolean; clearedCount?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("clear-failed-imports", {
    body: input,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if ((data as { error?: string } | null)?.error) {
    return { success: false, error: (data as { error: string }).error };
  }

  return {
    success: Boolean((data as { success?: boolean } | null)?.success),
    clearedCount: (data as { clearedCount?: number } | null)?.clearedCount ?? 0,
  };
}
