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
  /** ISO datetime string (optional — computed from start + duration if omitted) */
  recording_end_time?: string;
  /** Call duration in seconds */
  duration?: number;
  /** Structured transcript segments stored on recordings.transcript_segments. */
  transcript_segments?: unknown[] | null;
  /**
   * Platform-specific metadata. Do NOT include external_id here — insertRecording()
   * merges it as the first key automatically to ensure consistent ordering.
   */
  source_metadata: Record<string, unknown>;
  /** Optional summary text. Written to recordings.summary column. */
  summary?: string | null;
  /** If omitted, insertRecording() resolves the user's personal bank automatically */
  organization_id?: string;
  /** If omitted, insertRecording() resolves the personal vault for the resolved bank */
  workspace_id?: string;
  /**
   * Destination used only when no routing rule or import routing default matches.
   * This lets connector account bindings behave as defaults without suppressing
   * more specific title/source/participant routing rules.
   */
  fallback_workspace_id?: string;
  fallback_folder_id?: string;
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
 * Queries by source_call_id column (populated from external_id since migration
 * 20260303000004) to prevent cross-source false positives. Falls back to the
 * source_metadata JSONB filter if source_call_id is null (legacy rows).
 *
 * Also returns hasWorkspaceEntries so runPipeline() can distinguish between
 * "truly imported and visible" vs "recording row exists but removed from all
 * workspaces" — the latter should be re-importable.
 *
 * Fail-open: if the query errors, logs the error and returns { isDuplicate: false }.
 * A dedup check failure should never block an import.
 */
export async function checkDuplicate(
  supabase: SupabaseClient,
  userId: string,
  sourceApp: string,
  externalId: string,
): Promise<{ isDuplicate: boolean; existingRecordingId?: string; hasWorkspaceEntries?: boolean }> {
  // Primary: query the dedicated source_call_id column (fast, indexed, no JSONB parsing)
  const { data, error } = await supabase
    .from('recordings')
    .select('id')
    .eq('owner_user_id', userId)
    .eq('source_app', sourceApp)
    .eq('source_call_id', externalId)
    .maybeSingle();

  if (error) {
    console.error('[connector-pipeline] dedup check error (failing open):', error);
    // Fail open — never block an import because of a dedup query failure
    return { isDuplicate: false };
  }

  if (!data) {
    return { isDuplicate: false };
  }

  // Recording row exists — check whether it still has workspace_entries.
  // If it was removed from all workspaces, it should be re-importable.
  const { data: entries, error: entriesError } = await supabase
    .from('workspace_entries')
    .select('recording_id')
    .eq('recording_id', data.id)
    .limit(1);

  if (entriesError) {
    console.error('[connector-pipeline] workspace_entries check error (treating as duplicate):', entriesError);
    // Fail closed on this check — if we can't verify, assume it's still imported
    return { isDuplicate: true, existingRecordingId: data.id, hasWorkspaceEntries: true };
  }

  const hasEntries = (entries?.length ?? 0) > 0;
  return {
    isDuplicate: hasEntries,
    existingRecordingId: data.id,
    hasWorkspaceEntries: hasEntries,
  };
}

async function resolveRoutingDefaultDestination(
  supabase: SupabaseClient,
  organizationId: string,
  sourceApp: string,
): Promise<{ workspaceId: string; folderId: string | null; sourceApp: string } | null> {
  const { data: defaults, error } = await supabase
    .from('import_routing_defaults')
    .select('source_app, target_workspace_id, target_folder_id')
    .eq('organization_id', organizationId)
    .in('source_app', [sourceApp, 'all']);

  if (error) {
    console.error('[connector-pipeline] Failed to load routing default (skipping):', error);
    return null;
  }

  const connectorDefault = defaults?.find((row) => row.source_app === sourceApp);
  const globalDefault = defaults?.find((row) => row.source_app === 'all');
  const defaultDest = connectorDefault ?? globalDefault;

  if (!defaultDest) return null;

  return {
    workspaceId: defaultDest.target_workspace_id,
    folderId: defaultDest.target_folder_id ?? null,
    sourceApp: defaultDest.source_app,
  };
}

async function resolveOrganizationIdForRouting(
  supabase: SupabaseClient,
  userId: string,
  record: ConnectorRecord,
): Promise<string | undefined> {
  if (record.organization_id) return record.organization_id;

  const { data: membership, error } = await supabase
    .from('organization_memberships')
    .select('organizations!inner(id, type)')
    .eq('user_id', userId)
    .eq('role', 'organization_owner')
    .eq('organizations.type', 'personal')
    .maybeSingle();

  if (error) {
    console.error('[connector-pipeline] Failed to resolve organization for routing (skipping routing):', error);
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (membership as any)?.organizations?.id;
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
      .eq('role', 'organization_owner')
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
  // For Fathom calls, external_id is the integer recording ID — populate fathom_provider_id
  // so the UI can use it for AI title generation, folder assignments, and other Fathom-keyed ops.
  // Without this, mapRecordingToMeeting falls back to the UUID and Fathom-specific features break.
  const legacyRecordingId = record.source_app === 'fathom'
    ? (Number.isFinite(Number(record.external_id)) ? Number(record.external_id) : null)
    : null;

  // -------------------------------------------------------------------------
  const { data: newRecording, error: recordingError } = await supabase
    .from('recordings')
    .insert({
      organization_id: organizationId,
      owner_user_id: userId,
      title: record.title,
      full_transcript: record.full_transcript,
      summary: record.summary ?? null,
      source_app: record.source_app,
      source_call_id: record.external_id,
      source_metadata: sourceMetadata,
      transcript_segments: record.transcript_segments ?? null,
      duration: record.duration ?? null,
      recording_start_time: record.recording_start_time,
      recording_end_time: record.recording_end_time ?? null,
      global_tags: [],
      fathom_provider_id: legacyRecordingId,
    })
    .select('id')
    .single();

  if (recordingError) {
    throw new Error(`[connector-pipeline] Failed to insert recording: ${recordingError.message}`);
  }

  await insertTranscriptSpeakerParticipants(
    supabase,
    newRecording.id,
    organizationId,
    sourceMetadata,
    record.transcript_segments,
  );

  // -------------------------------------------------------------------------
  // Create workspace_entry (non-blocking)
  //
  // The DB trigger auto_home_workspace_entry always creates an entry in the
  // org's HOME workspace on recording INSERT. When the caller specified an
  // explicit workspace_id (user chose where to import), we:
  //   1. Create the entry in the chosen workspace
  //   2. Remove the auto-created HOME entry so the call isn't duplicated
  // When no workspace_id is specified, the HOME entry from the trigger is
  // the only entry and we leave it in place.
  // -------------------------------------------------------------------------
  try {
    // Use provided workspace_id or resolve personal workspace for this organization
    let workspaceId = record.workspace_id;
    const explicitWorkspace = !!record.workspace_id;

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

      // If an explicit workspace was chosen, remove the duplicate HOME entry
      // that the auto_home_workspace_entry trigger created — the call should
      // only appear in the workspace the user selected (and in All Calls).
      if (explicitWorkspace) {
        const { data: homeWs } = await supabase
          .from('workspaces')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_home', true)
          .maybeSingle();

        if (homeWs && homeWs.id !== workspaceId) {
          const { error: removeErr } = await supabase
            .from('workspace_entries')
            .delete()
            .eq('workspace_id', homeWs.id)
            .eq('recording_id', newRecording.id);

          if (removeErr) {
            console.error('[connector-pipeline] Failed to remove duplicate HOME entry (non-blocking):', removeErr);
          }
        }
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

async function insertTranscriptSpeakerParticipants(
  supabase: SupabaseClient,
  recordingId: string,
  organizationId: string,
  sourceMetadata: Record<string, unknown>,
  transcriptSegments: unknown[] | null | undefined,
): Promise<void> {
  const identities = collectTranscriptParticipantIdentities(
    transcriptSegments,
    sourceMetadata,
  );
  if (identities.length === 0) return;

  const { data: existingParticipants, error: existingError } = await supabase
    .from('call_participants')
    .select('name, email')
    .eq('recording_id', recordingId);

  if (existingError) {
    console.error('[connector-pipeline] Failed to read existing transcript speakers (non-blocking):', existingError);
    return;
  }

  const existingEmails = new Set(
    (existingParticipants ?? [])
      .map((participant: { email?: string | null }) => normalizeEmail(participant.email))
      .filter((email): email is string => Boolean(email)),
  );
  const existingNames = new Set(
    (existingParticipants ?? [])
      .map((participant: { name?: string | null }) => participant.name?.trim().toLowerCase())
      .filter((name): name is string => Boolean(name)),
  );

  for (const identity of identities) {
    const emailKey = normalizeEmail(identity.email);
    const nameKey = identity.name?.trim().toLowerCase() ?? '';
    if (emailKey && existingEmails.has(emailKey)) continue;
    if (!emailKey && nameKey && existingNames.has(nameKey)) continue;

    const { error: insertError } = await supabase
      .from('call_participants')
      .insert({
        recording_id: recordingId,
        organization_id: organizationId,
        name: identity.name,
        email: emailKey,
        participant_type: 'speaker',
        sources: ['transcript'],
      });

    if (insertError) {
      console.error(`[connector-pipeline] Failed to insert transcript participant ${identity.name ?? identity.email ?? 'unknown'} (non-blocking):`, insertError);
      continue;
    }

    if (emailKey) existingEmails.add(emailKey);
    if (nameKey) existingNames.add(nameKey);
  }
}

export interface TranscriptParticipantIdentity {
  name: string | null;
  email: string | null;
}

export function collectTranscriptParticipantIdentities(
  transcriptSegments: unknown[] | null | undefined,
  sourceMetadata: Record<string, unknown>,
): TranscriptParticipantIdentity[] {
  const identities: TranscriptParticipantIdentity[] = [];

  const addIdentity = (input: TranscriptParticipantIdentity) => {
    const email = normalizeEmail(input.email);
    const name = normalizeParticipantName(input.name, email);
    if (!email && !name) return;
    identities.push({ name, email });
  };

  if (Array.isArray(transcriptSegments)) {
    for (const segment of transcriptSegments) {
      if (!segment || typeof segment !== 'object') continue;
      const row = segment as Record<string, unknown>;
      addIdentity({
        name: stringValue(row.speaker_name),
        email: stringValue(row.speaker_email),
      });
    }
  }

  if (Array.isArray(sourceMetadata.transcript_speaker_names)) {
    for (const speakerName of sourceMetadata.transcript_speaker_names) {
      addIdentity({ name: stringValue(speakerName), email: null });
    }
  }

  if (Array.isArray(sourceMetadata.participant_emails)) {
    for (const participantEmail of sourceMetadata.participant_emails) {
      for (const email of normalizeEmailCandidates(stringValue(participantEmail))) {
        addIdentity({ name: null, email });
      }
    }
  }

  addIdentity({
    name: stringValue(sourceMetadata.recorded_by_name),
    email: stringValue(sourceMetadata.recorded_by_email),
  });

  return dedupeParticipantIdentities(identities);
}

function dedupeParticipantIdentities(
  identities: TranscriptParticipantIdentity[],
): TranscriptParticipantIdentity[] {
  const seenEmails = new Set<string>();
  const seenNames = new Set<string>();
  const result: TranscriptParticipantIdentity[] = [];

  for (const identity of identities) {
    const email = normalizeEmail(identity.email);
    const name = normalizeParticipantName(identity.name, email);
    if (!email && !name) continue;

    if (email) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      if (name) seenNames.add(name.toLowerCase());
      result.push({ name, email });
      continue;
    }

    const nameKey = name?.toLowerCase();
    if (!name || !nameKey || seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    result.push({ name, email: null });
  }

  return result;
}

function normalizeParticipantName(
  value: string | null | undefined,
  email: string | null,
): string | null {
  const name = value?.trim() ?? '';
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower === 'unknown') return null;
  if (lower === 'unknown speaker') return null;
  if (email && lower === email) return null;
  return name;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? '';
  return email && email.includes('@') && !email.includes(',') ? email : null;
}

function normalizeEmailCandidates(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter((email): email is string => Boolean(email));
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
 *   5. If no rule matches → check connector-specific default, then org fallback destination
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
    const { isDuplicate, existingRecordingId, hasWorkspaceEntries } = await checkDuplicate(
      supabase,
      userId,
      record.source_app,
      record.external_id,
    );

    if (isDuplicate) {
      return { success: false, skipped: true };
    }

    // -------------------------------------------------------------------------
    // Re-import path: recording row exists but was removed from all workspaces.
    // Instead of inserting a new recordings row (which would hit the unique
    // constraint on organization_id + source_app + source_call_id), create a
    // fresh workspace_entries row for the existing recording and return success.
    // -------------------------------------------------------------------------
    if (existingRecordingId && !hasWorkspaceEntries) {
      console.log(`[connector-pipeline] Re-import: recording ${existingRecordingId} exists but has no workspace entries — creating workspace entry`);
      try {
        let targetWorkspaceId = record.workspace_id;
        let targetFolderId = record.folder_id;

        if (!targetWorkspaceId) {
          const organizationId = await resolveOrganizationIdForRouting(supabase, userId, record);

          if (organizationId) {
            const routing = await resolveRoutingDestination(supabase, organizationId, record);

            if (routing && !routing.targetOrganizationId) {
              targetWorkspaceId = routing.workspaceId;
              targetFolderId = routing.folderId ?? undefined;
            } else {
              const defaultDest = await resolveRoutingDefaultDestination(
                supabase,
                organizationId,
                record.source_app,
              );

              if (defaultDest) {
                targetWorkspaceId = defaultDest.workspaceId;
                targetFolderId = defaultDest.folderId ?? undefined;
              }
            }
          }
        }

        if (!targetWorkspaceId && record.fallback_workspace_id) {
          targetWorkspaceId = record.fallback_workspace_id;
          targetFolderId = record.fallback_folder_id;
        }

        if (targetWorkspaceId) {
          const { error: reEntryError } = await supabase
            .from('workspace_entries')
            .insert({
              workspace_id: targetWorkspaceId,
              recording_id: existingRecordingId,
              ...(targetFolderId ? { folder_id: targetFolderId } : {}),
            });
          if (reEntryError) {
            console.error('[connector-pipeline] Re-import workspace_entry insert failed:', reEntryError);
          } else {
            console.log(`[connector-pipeline] Re-import: created workspace entry in ${targetWorkspaceId} for recording ${existingRecordingId}`);
          }
        } else {
          // No explicit workspace — resolve personal workspace and add entry there
          const { data: personalWs } = await supabase
            .from('workspaces')
            .select('id')
            .eq('workspace_type', 'personal')
            .limit(1)
            .maybeSingle();
          if (personalWs?.id) {
            await supabase.from('workspace_entries').insert({
              workspace_id: personalWs.id,
              recording_id: existingRecordingId,
            });
          }
        }
      } catch (reImportErr) {
        console.error('[connector-pipeline] Re-import workspace_entry error (non-blocking):', reImportErr);
      }
      return { success: true, recordingId: existingRecordingId };
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
        const organizationId = await resolveOrganizationIdForRouting(supabase, userId, record);

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
            // Step 2: No rule matched — try import routing default
            const defaultDest = await resolveRoutingDefaultDestination(
              supabase,
              organizationId,
              record.source_app,
            );

            if (defaultDest) {
              record.workspace_id = defaultDest.workspaceId;
              if (defaultDest.folderId) {
                record.folder_id = defaultDest.folderId;
              }
              record.source_metadata = {
                ...record.source_metadata,
                routed_by_default_source_app: defaultDest.sourceApp,
                routed_at: new Date().toISOString(),
              };
            } else if (record.fallback_workspace_id) {
              record.workspace_id = record.fallback_workspace_id;
              if (record.fallback_folder_id) {
                record.folder_id = record.fallback_folder_id;
              }
            }
          }

          // Step 3: If no routing/default/fallback destination matched,
          // do nothing — insertRecording uses personal workspace (preserved behavior).

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
