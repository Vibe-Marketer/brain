/**
 * Shared connector pipeline utility.
 * Provides Stage 3 (dedup check) and Stage 5 (insert recording + vault entry)
 * for all import connectors: Fathom, Zoom, YouTube, file-upload, and future sources.
 *
 * Design: flat exported async functions — no class hierarchy.
 * Connectors call checkDuplicate() and insertRecording() instead of rolling their own DB logic.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Normalized record shape that all connectors produce before calling insertRecording().
 * Each connector is responsible for building this from its source-specific data (Stage 4: transform).
 */
export interface ConnectorRecord {
  /** Dedup key — unique per user per source_app. Examples: Fathom call ID, Zoom meeting ID, YouTube video ID, "filename-filesize" */
  external_id: string;
  /** Source platform identifier. Examples: 'fathom', 'zoom', 'youtube', 'file-upload' */
  source_app: string;
  title: string;
  full_transcript: string;
  /** ISO datetime string */
  recording_start_time: string;
  /** Call duration in seconds */
  duration?: number;
  /**
   * Platform-specific metadata. Do NOT include external_id here — insertRecording()
   * merges it as the first key automatically to ensure consistent ordering.
   */
  source_metadata: Record<string, unknown>;
  /** If omitted, insertRecording() resolves the user's personal bank automatically */
  bank_id?: string;
  /** If omitted, insertRecording() resolves the personal vault for the resolved bank */
  vault_id?: string;
}

/**
 * Result returned by runPipeline(). Covers success, skipped duplicates, and errors.
 */
export interface PipelineResult {
  success: boolean;
  recordingId?: string;
  /** True when the record already exists and was intentionally skipped (not an error) */
  skipped?: boolean;
  error?: string;
}

// ============================================================================
// STAGE 3 — DEDUP CHECK
// ============================================================================

/**
 * Stage 3: Check whether a recording with this external_id already exists for the user + source.
 *
 * Filters by owner_user_id + source_app + source_metadata->>'external_id' to prevent
 * cross-source false positives (a Zoom ID colliding with a Fathom ID of the same value).
 *
 * Fail-open: if the query errors, logs the error and returns { isDuplicate: false }.
 * A dedup check failure should never block an import.
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  userId: string,
  sourceApp: string,
  externalId: string,
): Promise<{ isDuplicate: boolean; existingRecordingId?: string }> {
  const { data, error } = await supabase
    .from('recordings')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('source_app', sourceApp)
    .filter("source_metadata->>'external_id'", 'eq', externalId)
    .maybeSingle();

  if (error) {
    console.error('[connector-pipeline] dedup check error (failing open):', error);
    // Fail open — never block an import because of a dedup query failure
    return { isDuplicate: false };
  }

  return {
    isDuplicate: !!data,
    existingRecordingId: data?.id,
  };
}

// ============================================================================
// STAGE 5 — INSERT RECORDING + VAULT ENTRY
// ============================================================================

/**
 * Stage 5: Insert a normalized record into the recordings table and create a vault_entry
 * in the user's personal vault.
 *
 * If bank_id is not provided on the record, resolves the user's personal bank via
 * bank_memberships JOIN banks WHERE type = 'personal'.
 *
 * source_metadata is written with external_id as the first key, followed by any
 * additional connector-supplied metadata, for consistent structure across sources.
 *
 * Vault entry creation is non-blocking: if vault lookup or insert fails, the error is
 * logged but the function does NOT throw. The recording is already committed at that point.
 * (Pattern established in Phase 10: "Vault entry creation non-blocking in edge functions")
 *
 * @returns { id: string } — the UUID of the newly created recording
 * @throws if bank resolution or recordings insert fails
 */
export async function insertRecording(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord,
): Promise<{ id: string }> {
  // -------------------------------------------------------------------------
  // Resolve bank_id (personal bank) if not provided by caller
  // -------------------------------------------------------------------------
  let bankId = record.bank_id;
  if (!bankId) {
    const { data: membership, error: bankError } = await supabase
      .from('bank_memberships')
      .select('banks!inner(id, type)')
      .eq('user_id', userId)
      .eq('banks.type', 'personal')
      .maybeSingle();

    if (bankError) {
      throw new Error(`[connector-pipeline] Failed to resolve personal bank: ${bankError.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankId = (membership as any)?.banks?.id;
    if (!bankId) {
      throw new Error(`[connector-pipeline] No personal bank found for user ${userId}`);
    }
  }

  // -------------------------------------------------------------------------
  // Build source_metadata with external_id as first key
  // -------------------------------------------------------------------------
  const sourceMetadata: Record<string, unknown> = {
    external_id: record.external_id,
    ...record.source_metadata,
  };

  // -------------------------------------------------------------------------
  // Insert into recordings
  // -------------------------------------------------------------------------
  const { data: newRecording, error: recordingError } = await supabase
    .from('recordings')
    .insert({
      bank_id: bankId,
      owner_user_id: userId,
      title: record.title,
      full_transcript: record.full_transcript,
      source_app: record.source_app,
      source_metadata: sourceMetadata,
      duration: record.duration ?? null,
      recording_start_time: record.recording_start_time,
      global_tags: [],
    })
    .select('id')
    .single();

  if (recordingError) {
    throw new Error(`[connector-pipeline] Failed to insert recording: ${recordingError.message}`);
  }

  // -------------------------------------------------------------------------
  // Create vault_entry in personal vault (non-blocking)
  // -------------------------------------------------------------------------
  try {
    // Use provided vault_id or resolve personal vault for this bank
    let vaultId = record.vault_id;
    if (!vaultId) {
      const { data: vault, error: vaultError } = await supabase
        .from('vaults')
        .select('id')
        .eq('bank_id', bankId)
        .eq('vault_type', 'personal')
        .maybeSingle();

      if (vaultError) {
        console.error('[connector-pipeline] Failed to lookup personal vault (non-blocking):', vaultError);
      } else {
        vaultId = vault?.id;
      }
    }

    if (vaultId) {
      const { error: entryError } = await supabase
        .from('vault_entries')
        .insert({
          vault_id: vaultId,
          recording_id: newRecording.id,
        });

      if (entryError) {
        console.error('[connector-pipeline] Failed to create vault_entry (non-blocking):', entryError);
      }
    } else {
      console.warn(`[connector-pipeline] No personal vault found for bank ${bankId} — vault_entry not created`);
    }
  } catch (vaultException) {
    // Non-blocking: log but never throw. Recording is already committed.
    console.error('[connector-pipeline] Unexpected error creating vault_entry (non-blocking):', vaultException);
  }

  return { id: newRecording.id };
}

// ============================================================================
// CONVENIENCE WRAPPER
// ============================================================================

/**
 * runPipeline: convenience wrapper that calls checkDuplicate then insertRecording.
 *
 * Returns:
 *   { success: true, recordingId }             — new recording created
 *   { success: false, skipped: true }           — duplicate silently skipped
 *   { success: false, error: "..." }            — unexpected error
 *
 * Connectors that need custom handling between stages should call checkDuplicate()
 * and insertRecording() directly instead of using this wrapper.
 */
export async function runPipeline(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord,
): Promise<PipelineResult> {
  try {
    const { isDuplicate } = await checkDuplicate(
      supabase,
      userId,
      record.source_app,
      record.external_id,
    );

    if (isDuplicate) {
      return { success: false, skipped: true };
    }

    const { id } = await insertRecording(supabase, userId, record);
    return { success: true, recordingId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[connector-pipeline] runPipeline error:', message);
    return { success: false, error: message };
  }
}
