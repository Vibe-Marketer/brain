import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  ConnectorRequestValidationError,
  getConnectorDateWindow,
  json,
  resolveOAuthAccessToken,
  resolveConnectorSyncIds,
  runConnectorSyncJob,
  validateWorkspaceMembership,
} from '../_shared/connector-function-utils.ts';
import { getRecording, getRecordingTranscript, listRecordings, GrainClient } from '../_shared/grain-client.ts';
import { grainRecordingToCanonical, type GrainRecording, type GrainTranscriptSegment } from '../_shared/grain-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';
import { resolveGrainSource } from '../_shared/grain-source.ts';

interface GrainSyncRequest {
  sourceId?: string | null;
  meetingIds?: string[];
  recordingIds?: string[];
  singleCallId?: string;
  createdAfter?: string | null;
  createdBefore?: string | null;
  workspace_id?: string | null;
  workspaceId?: string | null;
  waitForCompletion?: boolean;
}

const MAX_BATCH_SIZE = 50;
const GRAIN_DETAIL_INCLUDE = { participants: true, ai_summary: true, ai_action_items: true, calendar_event: true };

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as GrainSyncRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Grain is not connected. Connect Grain first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const recordingIds = await resolveConnectorSyncIds({
      body,
      idFields: ['meetingIds', 'recordingIds'],
      fetchFallbackIds: () => fetchRecentRecordingIds(accessToken, body),
      maxBatchSize: MAX_BATCH_SIZE,
      emptyError: 'recordingIds must be provided or a date-window must return recordings.',
      tooManyError: (_count, maxBatchSize) =>
        `Too many Grain recordings: max ${maxBatchSize} per request.`,
    });

    const workspaceId = body.workspace_id ?? body.workspaceId ?? null;
    // validateWorkspaceMembership checks workspace_memberships before sync_jobs are created.
    const validatedWorkspaceId = workspaceId ? await validateWorkspaceMembership(supabase, userId, workspaceId, corsHeaders) : null;
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;

    // runConnectorSyncJob owns .from('sync_jobs') progress, finalStatus,
    // waitForCompletion, and import_sources updates after validateWorkspaceMembership.
    return await runConnectorSyncJob({
      supabase,
      userId,
      sourceId: source.id,
      ids: recordingIds,
      type: 'grain',
      providerLabel: 'Grain',
      itemLabel: 'recording',
      importSource: 'grain-sync-recordings',
      waitForCompletion: body.waitForCompletion,
      corsHeaders,
      processItem: async (recordingId) => {
        const recording = await getRecording<GrainRecording>(accessToken, recordingId, GRAIN_DETAIL_INCLUDE);
        if (!recording.end_datetime) return { status: 'skipped' };

        const transcript = await getRecordingTranscript(accessToken, recordingId) as GrainTranscriptSegment[];
        const canonical = grainRecordingToCanonical({ ...recording, transcript });
        const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
          importSource: 'grain-sync-recordings',
          workspaceId: validatedWorkspaceId,
          includeRawPayload: true,
        });

        if (result.success) return { status: 'synced' };
        if (result.skipped) return { status: 'skipped' };
        return { status: 'failed', error: result.error ?? null };
      },
    });
  } catch (error) {
    console.error('Error syncing Grain meetings:', error);
    if (error instanceof ConnectorRequestValidationError) {
      return json({ error: error.message }, 400, corsHeaders);
    }
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<{ id: string } | null> {
  return await resolveGrainSource(supabase, userId, sourceId);
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  return await resolveOAuthAccessToken({
    supabase,
    sourceId,
    userId,
    providerLabel: 'Grain',
    clientIdEnv: 'GRAIN_OAUTH_CLIENT_ID',
    clientSecretEnv: 'GRAIN_OAUTH_CLIENT_SECRET',
    refreshTokens: GrainClient.refreshTokens,
  });
}

async function fetchRecentRecordingIds(accessToken: string, body: GrainSyncRequest): Promise<string[]> {
  const { start, end } = getConnectorDateWindow(body);
  const response = await listRecordings<GrainRecording>({
    token: accessToken,
    afterDateTime: start,
    beforeDateTime: end,
  });
  return (response.recordings ?? []).filter((recording) => Boolean(recording.end_datetime)).map((recording) => recording.id);
}
