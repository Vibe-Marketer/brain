import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { runPipeline, type PipelineResult } from './connector-pipeline.ts';
import {
  canonicalToConnectorRecord,
  type CanonicalConnectorOptions,
  type CanonicalRecording,
} from './canonical-recording.ts';

export type { CanonicalRecording, CanonicalTranscriptTurn } from './canonical-recording.ts';

export interface RunCanonicalConnectorOptions extends CanonicalConnectorOptions {
  organizationId?: string | null;
  workspaceId?: string | null;
  folderId?: string | null;
  fallbackWorkspaceId?: string | null;
  fallbackFolderId?: string | null;
}

/**
 * Inserts a vendor-normalized recording through the existing CallVault pipeline.
 *
 * New vendors should call this instead of writing to `recordings` directly. The
 * result is a normal `recordings` row plus workspace routing, dedup, and source
 * metadata in the same shape Fathom/Zoom already produce.
 */
export async function runCanonicalConnectorPipeline(
  supabase: SupabaseClient,
  userId: string,
  recording: CanonicalRecording,
  options: RunCanonicalConnectorOptions,
): Promise<PipelineResult> {
  const connectorRecord = canonicalToConnectorRecord(recording, options);
  return runPipeline(supabase, userId, connectorRecord);
}
