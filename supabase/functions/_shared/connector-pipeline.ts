/**
 * Shared connector pipeline utility.
 * Provides Stage 3 (dedup check) and Stage 5 (insert recording + vault entry)
 * for all import connectors: Fathom, Zoom, YouTube, file-upload, and future sources.
 *
 * Design: flat exported async functions — no class hierarchy.
 * Connectors call checkDuplicate() and insertRecording() instead of rolling their own DB logic.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveRoutingDestination } from './routing-engine.ts';

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
  organization_id?: string;
  /** If omitted, insertRecording() resolves the personal vault for the resolved bank */
  workspace_id?: string;
  /**
   * Optional destination folder within the target vault.
   * Set by the routing engine when a matched rule specifies a target_folder_id.
   * Passed through to the workspace_entries INSERT if present.
   */
  folder_id?: string;
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
 * If organization_id is not provided on the record, resolves the user's personal bank via
 * organization_memberships JOIN organizations WHERE type = 'personal'.
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
  // Resolve organization_id (personal organization) if not provided by caller
  // -------------------------------------------------------------------------
  let organizationId = record.organization_id;
  if (!organizationId) {
    const { data: membership, error: orgError } = await supabase
      .from('organization_memberships')
      .select('organizations!inner(id, type)')
      .eq('user_id', userId)
      .eq('organizations.type', 'personal')
      .maybeSingle();

    if (orgError) {
      throw new Error(`[connector-pipeline] Failed to resolve personal organization: ${orgError.message}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    organizationId = (membership as any)?.organizations?.id;
    if (!organizationId) {
      throw new Error(`[connector-pipeline] No personal organization found for user ${userId}`);
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
      organization_id: organizationId,
      owner_user_id: userId,
      title: record.title,
      full_transcript: record.full_transcript,
      source_app: record.source_app,
      source_call_id: record.external_id,
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
  // Create workspace_entry in personal workspace (non-blocking)
  // -------------------------------------------------------------------------
  try {
    // Use provided workspace_id or resolve personal workspace for this organization
    let workspaceId = record.workspace_id;
    if (!workspaceId) {
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('workspace_type', 'personal')
        .maybeSingle();

      if (workspaceError) {
        console.error('[connector-pipeline] Failed to lookup personal workspace (non-blocking):', workspaceError);
      } else {
        workspaceId = workspace?.id;
      }
    }

    if (workspaceId) {
      const entryPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        recording_id: newRecording.id,
      };

      // Include folder_id if routing resolved a specific folder destination
      if (record.folder_id) {
        entryPayload['folder_id'] = record.folder_id;
      }

      const { error: entryError } = await supabase
        .from('workspace_entries')
        .insert(entryPayload);

      if (entryError) {
        console.error('[connector-pipeline] Failed to create workspace_entry (non-blocking):', entryError);
      }
    } else {
      console.warn(`[connector-pipeline] No personal workspace found for organization ${organizationId} — workspace_entry not created`);
    }
  } catch (workspaceException) {
    // Non-blocking: log but never throw. Recording is already committed.
    console.error('[connector-pipeline] Unexpected error creating workspace_entry (non-blocking):', workspaceException);
  }

  return { id: newRecording.id };
}

// ============================================================================
// CONVENIENCE WRAPPER
// ============================================================================

/**
 * runPipeline: convenience wrapper that calls checkDuplicate, resolves routing destination,
 * then calls insertRecording.
 *
 * Routing resolution runs between the dedup check and the insert:
 *   1. If record.workspace_id is already set (connector specified explicit destination) → skip routing
 *   2. Resolve organization_id (use record.organization_id or look up personal organization)
 *   3. Call resolveRoutingDestination() — evaluates import_routing_rules in priority order
 *   4. If a rule matches → set record.workspace_id, record.folder_id, merge routing trace into source_metadata
 *   5. If no rule matches → check import_routing_defaults for org fallback destination
 *   6. If neither → do nothing (insertRecording falls back to personal workspace — existing behavior preserved)
 *
 * Returns:
 *   { success: true, recordingId }             — new recording created
 *   { success: false, skipped: true }           — duplicate silently skipped
 *   { success: false, error: "..." }            — unexpected error
 *
 * Connectors that need custom handling between stages should call checkDuplicate()
 * and insertRecording() directly instead of using this wrapper.
 * NOTE: Direct callers of insertRecording() bypass routing — this is acceptable per design.
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

    // -------------------------------------------------------------------------
    // Routing resolution: only when connector didn't specify an explicit workspace
    // -------------------------------------------------------------------------
    // Cross-org intent is captured here so the actual insertRecording + RPC call
    // happens OUTSIDE the routing try-catch. If insertRecording were called inside
    // the routing catch, a DB error would be swallowed and fall through to the
    // normal-path insertRecording below, creating a duplicate in the source org.
    let crossOrgRouting: {
      targetOrgId: string;
      deleteAfterCopy: boolean;
      workspaceId: string | null;
    } | null = null;

    if (!record.workspace_id) {
      try {
        // Resolve organization_id for routing lookup
        let organizationId = record.organization_id;
        if (!organizationId) {
          const { data: membership, error: orgError } = await supabase
            .from('organization_memberships')
            .select('organizations!inner(id, type)')
            .eq('user_id', userId)
            .eq('organizations.type', 'personal')
            .maybeSingle();

          if (orgError) {
            console.error('[connector-pipeline] Failed to resolve organization for routing (skipping routing):', orgError);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            organizationId = (membership as any)?.organizations?.id;
          }
        }

        if (organizationId) {
          // Step 1: Try routing rules — first-match-wins
          const routing = await resolveRoutingDestination(supabase, organizationId, record);

          if (routing) {
            if (routing.targetOrganizationId) {
              // Cross-org rule: recording is inserted into source org first (no workspace override),
              // then copied to the target org via route_recording_cross_org after insert.
              // Store routing trace + cross-org marker in source_metadata for audit trail.
              record.source_metadata = {
                ...record.source_metadata,
                routed_by_rule_id: routing.matchedRuleId,
                routed_by_rule_name: routing.matchedRuleName,
                routed_at: new Date().toISOString(),
                cross_org_target_id: routing.targetOrganizationId,
              };
              // crossOrgRouting is resolved outside this closure below
            } else {
              // Same-org rule: set destination and record trace metadata
              record.workspace_id = routing.workspaceId;
              if (routing.folderId) {
                record.folder_id = routing.folderId;
              }
              record.source_metadata = {
                ...record.source_metadata,
                routed_by_rule_id: routing.matchedRuleId,
                routed_by_rule_name: routing.matchedRuleName,
                routed_at: new Date().toISOString(),
              };
            }
          } else {
            // Step 2: No rule matched — try org-level default destination
            const { data: defaultDest, error: defaultError } = await supabase
              .from('import_routing_defaults')
              .select('target_workspace_id, target_folder_id')
              .eq('organization_id', organizationId)
              .maybeSingle();

            if (defaultError) {
              console.error('[connector-pipeline] Failed to load routing default (skipping):', defaultError);
            } else if (defaultDest) {
              record.workspace_id = defaultDest.target_workspace_id;
              if (defaultDest.target_folder_id) {
                record.folder_id = defaultDest.target_folder_id;
              }
            }
            // Step 3: If no default either, do nothing — insertRecording uses personal workspace (preserved behavior)
          }

          // Capture cross-org intent — insert + RPC execute OUTSIDE this try-catch (see below)
          if (routing?.targetOrganizationId) {
            crossOrgRouting = {
              targetOrgId: routing.targetOrganizationId,
              deleteAfterCopy: routing.deleteAfterCopy,
              workspaceId: routing.workspaceId || null,
            };
          }
        }
      } catch (routingErr) {
        // Non-blocking: routing failure should never prevent an import
        console.error('[connector-pipeline] Routing resolution error (skipping routing):', routingErr);
      }
    }

    // Cross-org path: executed OUTSIDE the routing try-catch so that insertRecording
    // failures propagate to the outer catch (pipeline fails cleanly) rather than being
    // swallowed and falling through to a duplicate insert in the source org.
    if (crossOrgRouting) {
      const { id } = await insertRecording(supabase, userId, record);

      // RPC copy is non-blocking — source recording is preserved on failure
      try {
        const { error: crossOrgError } = await supabase.rpc('route_recording_cross_org', {
          p_recording_id: id,
          p_target_org_id: crossOrgRouting.targetOrgId,
          p_user_id: userId,
          p_delete_source: crossOrgRouting.deleteAfterCopy,
          p_target_workspace_id: crossOrgRouting.workspaceId,
        });
        if (crossOrgError) {
          console.error('[connector-pipeline] Cross-org routing RPC failed (non-blocking):', crossOrgError);
        }
      } catch (crossOrgErr) {
        console.error('[connector-pipeline] Cross-org routing error (non-blocking):', crossOrgErr);
      }

      return { success: true, recordingId: id };
    }

    const { id } = await insertRecording(supabase, userId, record);
    return { success: true, recordingId: id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[connector-pipeline] runPipeline error:', message);
    return { success: false, error: message };
  }
}
