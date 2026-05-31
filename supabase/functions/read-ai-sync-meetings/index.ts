import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateRequest } from '../_shared/auth.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  ConnectorRequestValidationError,
  getConnectorDateWindowMs,
  getRequestedWorkspaceId,
  json,
  resolveConnectorWorkspaceBinding,
  resolveOAuthAccessToken,
  resolveConnectorSyncIds,
  runConnectorSyncJob,
  validateRequestedWorkspaceId,
} from '../_shared/connector-function-utils.ts';
import { getMeeting, listMeetings, ReadAiClient } from '../_shared/read-ai-client.ts';
import { readAiMeetingToCanonical, type ReadAiMeeting } from '../_shared/read-ai-connector.ts';
import { runCanonicalConnectorPipeline } from '../_shared/recording-connectors.ts';
import { resolveReadAiSource } from '../_shared/read-ai-source.ts';

interface ReadAiSyncRequest {
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
const READ_AI_DETAIL_EXPAND = ['summary', 'action_items', 'topics', 'transcript', 'metrics'];

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    const body = await req.json().catch(() => ({})) as ReadAiSyncRequest;
    const source = await resolveSource(supabase, userId, body.sourceId ?? null);
    if (!source) return json({ error: 'Read.ai is not connected. Connect Read.ai first.' }, 400, corsHeaders);

    const accessToken = await resolveAccessToken(supabase, source.id, userId);
    const meetingIds = await resolveConnectorSyncIds({
      body,
      idFields: ['meetingIds', 'recordingIds'],
      fetchFallbackIds: () => fetchRecentMeetingIds(accessToken, body),
      maxBatchSize: MAX_BATCH_SIZE,
      emptyError: 'meetingIds must be provided or a date-window must return meetings.',
      tooManyError: (_count, maxBatchSize) =>
        `Too many Read.ai meetings: max ${maxBatchSize} per request.`,
    });

    const requestedWorkspaceId = getRequestedWorkspaceId(body);
    const validatedWorkspaceId = await validateRequestedWorkspaceId(supabase, userId, requestedWorkspaceId, corsHeaders);
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;
    const workspaceBinding = await resolveConnectorWorkspaceBinding({
      supabase,
      userId,
      sourceId: source.id,
      sourceApp: 'read-ai',
    });
    const importWorkspaceId = validatedWorkspaceId ?? workspaceBinding.workspaceId;

    // runConnectorSyncJob owns .from('sync_jobs') progress, finalStatus,
    // waitForCompletion, and import_sources updates after validateWorkspaceMembership.
    return await runConnectorSyncJob({
      supabase,
      userId,
      sourceId: source.id,
      ids: meetingIds,
      type: 'read-ai',
      providerLabel: 'Read.ai',
      itemLabel: 'meeting',
      importSource: 'read-ai-sync-meetings',
      waitForCompletion: body.waitForCompletion,
      corsHeaders,
      processItem: async (meetingId) => {
        const meeting = await getMeeting<ReadAiMeeting>(accessToken, meetingId, READ_AI_DETAIL_EXPAND);
        if (!meeting.end_time_ms) return { status: 'skipped' };

        const canonical = readAiMeetingToCanonical(meeting);
        const result = await runCanonicalConnectorPipeline(supabase, userId, canonical, {
          importSource: 'read-ai-sync-meetings',
          workspaceId: importWorkspaceId,
          includeRawPayload: true,
        });

        if (result.success) return { status: 'synced' };
        if (result.skipped) return { status: 'skipped' };
        return { status: 'failed', error: result.error ?? null };
      },
    });
  } catch (error) {
    console.error('Error syncing Read.ai meetings:', error);
    if (error instanceof ConnectorRequestValidationError) {
      return json({ error: error.message }, 400, corsHeaders);
    }
    return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500, corsHeaders);
  }
});

async function resolveSource(supabase: any, userId: string, sourceId: string | null): Promise<{ id: string } | null> {
  return await resolveReadAiSource(supabase, userId, sourceId);
}

async function resolveAccessToken(supabase: any, sourceId: string, userId: string): Promise<string> {
  return await resolveOAuthAccessToken({
    supabase,
    sourceId,
    userId,
    providerLabel: 'Read.ai',
    clientIdEnv: 'READAI_OAUTH_CLIENT_ID',
    clientSecretEnv: 'READAI_OAUTH_CLIENT_SECRET',
    refreshTokens: ReadAiClient.refreshTokens,
  });
}

async function fetchRecentMeetingIds(accessToken: string, body: ReadAiSyncRequest): Promise<string[]> {
  const { startMs, endMs } = getConnectorDateWindowMs(body);
  const response = await listMeetings<ReadAiMeeting>({
    token: accessToken,
    limit: 10,
    startTimeMsGte: startMs,
    startTimeMsLte: endMs,
  });
  return (response.data ?? []).filter((meeting) => Boolean(meeting.end_time_ms)).map((meeting) => meeting.id);
}
