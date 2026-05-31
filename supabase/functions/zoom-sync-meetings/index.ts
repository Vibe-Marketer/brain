import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { parseVTTWithMetadata, consolidateBySpeaker, TranscriptSegment } from '../_shared/vtt-parser.ts';
import { refreshZoomOAuthTokens } from '../_shared/zoom-token-refresh.ts';
import { runPipeline } from '../_shared/connector-pipeline.ts';
import { generateFingerprint, generateFingerprintString } from '../_shared/dedup-fingerprint.ts';

import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { getDecryptedOAuthTokens } from '../_shared/oauth-encrypt.ts';
import { getDecryptedUserSettingsZoomTokens } from '../_shared/user-settings-encrypt.ts';
import {
  getRequestedWorkspaceId,
  markConnectorPartialSync,
  markConnectorReconnectRequired,
  resolveConnectorWorkspaceBinding,
  validateRequestedWorkspaceId,
} from '../_shared/connector-function-utils.ts';

// Rate limiter for API calls - conservative to avoid 429 errors
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 30;
  private readonly windowMs = 60000;

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    if (elapsed >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - elapsed;
      console.log(`Rate limit prevention: waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }
}

interface ZoomRecordingFile {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  play_url?: string;
  download_url?: string;
  status: string;
  recording_type: string;
}

interface ZoomRecordingDetail {
  uuid: string;
  id: number;
  account_id: string;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  start_time: string;
  timezone: string;
  duration: number;
  total_size: number;
  recording_count: number;
  share_url?: string;
  recording_files?: ZoomRecordingFile[];
  participant_audio_files?: Array<{
    id: string;
    recording_start: string;
    recording_end: string;
    file_name: string;
    file_type: string;
    file_extension: string;
    file_size: number;
    download_url?: string;
    status: string;
  }>;
}

/**
 * Fetches the VTT transcript content from Zoom
 */
async function fetchZoomTranscript(
  downloadUrl: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Zoom download URLs need the access token appended as query param
    const urlWithToken = `${downloadUrl}?access_token=${accessToken}`;

    const response = await ZoomClient.fetchWithRetry(urlWithToken, {
      maxRetries: 3,
    });

    if (!response.ok) {
      console.error(`Failed to download transcript: ${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return null;
  }
}

/**
 * Syncs a single Zoom meeting to the recordings table via shared connector pipeline.
 *
 * Returns:
 *   { outcome: 'synced', recordingUuid }  — new recording created; recordingUuid is the recordings.id
 *   { outcome: 'skipped' }               — already exists (duplicate)
 *   { outcome: 'failed' }                — error during sync
 */
async function syncZoomMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: string,
  meeting: ZoomRecordingDetail,
  accessToken: string,
  targetWorkspaceId?: string | null,
): Promise<{ outcome: 'synced'; recordingUuid: string } | { outcome: 'skipped' | 'failed' }> {
  try {
    console.log(`Syncing Zoom meeting ${recordingId}: ${meeting.topic}`);

    // Find transcript file
    const transcriptFile = meeting.recording_files?.find(
      file => file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
    );

    let fullTranscript = '';
    const transcriptSegments: TranscriptSegment[] = [];

    if (transcriptFile?.download_url) {
      console.log(`Downloading transcript for meeting ${recordingId}...`);
      const vttContent = await fetchZoomTranscript(transcriptFile.download_url, accessToken);

      if (vttContent) {
        const parsed = parseVTTWithMetadata(vttContent);
        const consolidated = consolidateBySpeaker(parsed.segments);

        // Build full transcript text with consolidated speaker turns
        const consolidatedSegments: string[] = [];

        for (const seg of consolidated) {
          const speaker = seg.speaker || 'Unknown';
          const timestamp = seg.start_time.split('.')[0] || '00:00:00';
          consolidatedSegments.push(`[${timestamp}] ${speaker}: ${seg.text}`);
        }

        fullTranscript = consolidatedSegments.join('\n\n');
        transcriptSegments.push(...parsed.segments);

        console.log(`Parsed ${parsed.segments.length} transcript segments for meeting ${recordingId}`);
      }
    } else {
      console.log(`No transcript file available for meeting ${recordingId}`);
    }

    // Calculate meeting times and duration
    const startTime = new Date(meeting.start_time);
    const durationSeconds = meeting.duration * 60; // Zoom reports duration in minutes

    // Extract unique speaker names from transcript segments for participant population
    const speakerNames = transcriptSegments.length > 0
      ? [...new Set(transcriptSegments.map(s => s.speaker).filter(Boolean))] as string[]
      : [];

    // Derive host name from transcript: prefer the speaker whose name matches the host email
    // prefix, or fall back to the first unique speaker. Zoom API only gives host_email, not a
    // full display name — so we infer from the VTT speaker labels when possible.
    let hostDisplayName: string | null = null;
    if (speakerNames.length > 0) {
      // The Zoom host's name typically appears in the transcript
      // If host_email is "naegele412@gmail.com", look for a speaker whose name starts similarly
      const emailPrefix = meeting.host_email?.split('@')[0]?.toLowerCase() || '';
      const matched = speakerNames.find(n => n.toLowerCase().replace(/\s+/g, '').includes(emailPrefix));
      hostDisplayName = matched || speakerNames[0];
    }

    // Build source_metadata (external_id merged as first key by insertRecording)
    // IMPORTANT: recorded_by_email and recorded_by_name must be set here so that:
    //   1. mapRecordingToMeeting (useWorkspaces.ts) populates Meeting.recorded_by_email
    //   2. CallTranscriptTab identifies the host speaker for right-side chat bubbles
    //   3. populate_participants_from_source_metadata trigger creates a 'host' call_participant row
    const sourceMetadata = {
      zoom_meeting_id: recordingId,
      zoom_numeric_id: meeting.id,
      zoom_host_email: meeting.host_email,
      zoom_host_id: meeting.host_id,
      zoom_account_id: meeting.account_id,
      zoom_share_url: meeting.share_url || null,
      zoom_timezone: meeting.timezone,
      zoom_type: meeting.type,
      // These two fields are read by mapRecordingToMeeting and the participants trigger:
      recorded_by_email: meeting.host_email || null,
      recorded_by_name: hostDisplayName,
      import_source: 'zoom-sync-meetings',
      synced_at: new Date().toISOString(),
    };

    // Calculate end time
    const endTime = new Date(startTime.getTime() + (durationSeconds * 1000));

    // Stage 5 — Run through pipeline (Dedup -> Routing -> Insert)
    const result = await runPipeline(supabase, userId, {
      external_id: recordingId,
      source_app: 'zoom',
      title: meeting.topic,
      full_transcript: fullTranscript,
      recording_start_time: startTime.toISOString(),
      recording_end_time: endTime.toISOString(),
      duration: durationSeconds,
      source_metadata: sourceMetadata,
      ...(targetWorkspaceId ? { workspace_id: targetWorkspaceId } : {}),
    });

    if (!result.success) {
      if (result.skipped) {
        console.log(`Zoom meeting ${recordingId} already exists (pipeline skipped)`);
        return { outcome: 'skipped' };
      }
      throw new Error(result.error || 'Pipeline failed');
    }

    console.log(`Successfully synced Zoom meeting ${recordingId} as recording ${result.recordingId}`);

    // Write to zoom_raw_calls for source-specific detail
    try {
      const fingerprint = await generateFingerprint({
        title: meeting.topic,
        start_time: new Date(meeting.start_time),
        duration_minutes: meeting.duration,
        participants: [meeting.host_email],
      });
      const fingerprintString = generateFingerprintString(fingerprint);

      const { error: rawError } = await supabase
        .from('zoom_raw_calls')
        .upsert({
          recording_id: result.recordingId,
          user_id: userId,
          zoom_meeting_id: String(meeting.id),
          zoom_meeting_uuid: recordingId,
          host_email: meeting.host_email,
          host_id: meeting.host_id,
          account_id: meeting.account_id,
          topic: meeting.topic,
          start_time: meeting.start_time,
          duration: durationSeconds,
          timezone: meeting.timezone,
          meeting_type: meeting.type,
          share_url: meeting.share_url || null,
          full_transcript: fullTranscript,
          meeting_fingerprint: fingerprintString,
          raw_payload: meeting,
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,zoom_meeting_uuid',
        });

      if (rawError) {
        console.error(`Error inserting zoom_raw_calls for ${recordingId} (non-blocking):`, rawError);
      }
    } catch (rawErr) {
      console.error(`Error writing zoom_raw_calls for ${recordingId} (non-blocking):`, rawErr);
    }

    // Insert transcript segments into fathom_raw_transcripts for backward compat
    if (transcriptSegments.length > 0) {
      const transcriptRows = transcriptSegments.map((segment: TranscriptSegment) => ({
        recording_id: recordingId,
        user_id: userId,
        speaker_name: segment.speaker || 'Unknown',
        speaker_email: null, // Zoom VTT doesn't include emails
        text: segment.text,
        timestamp: segment.start_time,
      }));

      const { error: transcriptError } = await supabase
        .from('fathom_raw_transcripts')
        .insert(transcriptRows);

      if (transcriptError) {
        // Non-blocking — transcript table is supplementary; recording already committed
        console.error(`Error inserting transcripts for ${recordingId} (non-blocking):`, transcriptError);
      } else {
        console.log(`Synced ${transcriptRows.length} transcript segments for Zoom meeting ${recordingId}`);
      }
    }

    // Insert transcript speakers as call_participants (type='speaker')
    // The host participant (type='host') is already created by the populate_participants_from_source_metadata
    // trigger on recordings INSERT (reads recorded_by_email from source_metadata).
    // Here we add the remaining speakers extracted from the VTT transcript.
    if (speakerNames.length > 0 && result.recordingId) {
      try {
        // Resolve organization_id for the recording (required FK on call_participants)
        const { data: rec } = await supabase
          .from('recordings')
          .select('organization_id')
          .eq('id', result.recordingId)
          .single();

        if (rec?.organization_id) {
          // Build one row per unique speaker name.
          // email is null (Zoom VTT has no emails), participant_type is 'speaker'.
          // ON CONFLICT: name-only rows have no unique constraint so use upsert-style insert
          // with WHERE NOT EXISTS to avoid duplicates on re-sync.
          // Insert non-host speakers. Name-only rows (NULL email) have no unique constraint,
          // so we check for existence first to avoid duplicates on re-sync.
          const { data: existingParticipants } = await supabase
            .from('call_participants')
            .select('name')
            .eq('recording_id', result.recordingId)
            .is('email', null);

          const existingNames = new Set(
            (existingParticipants || []).map((p: { name: string }) => p.name?.toLowerCase())
          );

          for (const speakerName of speakerNames) {
            // Skip if this speaker is already the known host (host row created by trigger)
            if (
              hostDisplayName &&
              speakerName.toLowerCase() === hostDisplayName.toLowerCase()
            ) {
              continue;
            }

            // Skip if already inserted (idempotent for re-syncs)
            if (existingNames.has(speakerName.toLowerCase())) {
              continue;
            }

            const { error: insertErr } = await supabase
              .from('call_participants')
              .insert({
                recording_id: result.recordingId,
                organization_id: rec.organization_id,
                name: speakerName,
                email: null,
                participant_type: 'speaker',
                sources: ['transcript'],
              });

            if (insertErr) {
              console.error(`Error inserting speaker participant ${speakerName} (non-blocking):`, insertErr);
            }
          }
          console.log(`Inserted ${speakerNames.length} transcript speakers as call_participants for ${recordingId}`);
        }
      } catch (participantErr) {
        console.error(`Error inserting call_participants for ${recordingId} (non-blocking):`, participantErr);
      }
    }

    return { outcome: 'synced', recordingUuid: result.recordingId! };
  } catch (error) {
    console.error(`Failed to sync Zoom meeting ${recordingId}:`, error);
    return { outcome: 'failed' };
  }
}

/**
 * Fetches recording details from Zoom API
 */
async function fetchRecordingDetails(
  recordingId: string,
  accessToken: string
): Promise<ZoomRecordingDetail | null> {
  try {
    // URL-encode the recording ID (UUIDs may contain special characters)
    const encodedId = encodeURIComponent(encodeURIComponent(recordingId));

    const response = await ZoomClient.apiRequest(
      `/meetings/${encodedId}/recordings`,
      accessToken,
      { maxRetries: 3 }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`Recording ${recordingId} not found`);
        return null;
      }
      const errorText = await response.text();
      console.error(`Error fetching recording ${recordingId}: ${response.status} - ${errorText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching recording details for ${recordingId}:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // service-role required: cross-meeting fan-out — pulls from Zoom API + writes zoom_raw_meetings + invokes downstream generate-ai-titles + auto-tag-calls.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body FIRST
    const { recordingIds = [], singleCallId, workspace_id, workspaceId, sourceId } = await req.json();

    // Support single recording retry if singleCallId provided
    const targetRecordingIds = singleCallId ? [singleCallId] : recordingIds;

    if (!Array.isArray(targetRecordingIds) || targetRecordingIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'recordingIds must be an array or singleCallId must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user from JWT
    // SEC-02A: Authenticate via shared helper (Phase 37 shared-auth migration)
    const authResult = await authenticateRequest(req, supabase as any, corsHeaders);
    if (authResult instanceof Response) return authResult;
    const userId = authResult.userId;

    // We still need the raw JWT for forwarding to downstream edge functions
    // (generate-ai-titles, auto-tag-calls) so they authenticate as the same user.
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();

    const zoomTokens = sourceId
      ? await getDecryptedOAuthTokens(supabase as any, sourceId, userId)
      : await getDecryptedUserSettingsZoomTokens(supabase, userId);

    if (!zoomTokens.access_token) {
      throw new Error('Zoom not connected. Please connect your Zoom account in Settings.');
    }

    // Determine access token to use (refresh if expired)
    let accessToken: string;
    const now = Date.now();

    if (zoomTokens.token_expires && zoomTokens.token_expires > now) {
      accessToken = zoomTokens.access_token;
      console.log('Using existing Zoom access token for sync');
    } else {
      console.log('Zoom token expired, attempting refresh...');
      if (!zoomTokens.refresh_token) {
        if (sourceId) {
          await markConnectorReconnectRequired({
            supabase,
            sourceId,
            userId,
            errorMessage: 'Zoom token expired and no refresh token available. Please reconnect in Settings.',
          });
        }
        throw new Error('Zoom token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshZoomOAuthTokens(userId, zoomTokens.refresh_token);
        console.log('Zoom token refreshed successfully for sync');
      } catch (refreshError) {
        console.error('Error refreshing Zoom token:', refreshError);
        if (sourceId) {
          await markConnectorReconnectRequired({
            supabase,
            sourceId,
            userId,
            errorMessage: 'Zoom token expired and refresh failed. Please reconnect in Settings.',
          });
        }
        throw new Error('Zoom token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    const requestedWorkspaceId = getRequestedWorkspaceId({ workspace_id, workspaceId });
    const validatedWorkspaceId = await validateRequestedWorkspaceId(supabase, userId, requestedWorkspaceId, corsHeaders);
    if (validatedWorkspaceId instanceof Response) return validatedWorkspaceId;
    let validatedVaultId: string | null = validatedWorkspaceId;
    if (!validatedVaultId && sourceId) {
      const binding = await resolveConnectorWorkspaceBinding({
        supabase,
        userId,
        sourceId,
        sourceApp: 'zoom',
      });
      validatedVaultId = binding.workspaceId;
    }

    console.log(`Syncing ${recordingIds.length} Zoom meetings`);

    // Create a sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: targetRecordingIds,
        status: 'processing',
        progress_current: 0,
        progress_total: targetRecordingIds.length,
        type: 'zoom', // Explicitly set the source type
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    console.log(`Created sync job ${jobId} for ${recordingIds.length} Zoom meetings`);

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: string[] = [];           // Zoom meeting UUIDs (external IDs)
      const syncedRecordingUuids: string[] = []; // recordings table UUIDs for post-sync operations
      const failed: string[] = [];
      let skippedCount = 0;
      const rateLimiter = new RateLimiter();

      console.log(`Background processing started for Zoom sync job ${jobId}`);

      try {
        for (const recordingId of targetRecordingIds) {
          try {
            await rateLimiter.throttle();

            console.log(`Fetching Zoom recording ${recordingId}...`);
            const recording = await fetchRecordingDetails(recordingId, accessToken);

            if (!recording) {
              console.error(`Zoom recording ${recordingId} not found or failed to fetch`);
              failed.push(recordingId);

              await supabase
                .from('sync_jobs')
                .update({
                  progress_current: synced.length + failed.length,
                  synced_ids: synced,
                  failed_ids: failed,
                })
                .eq('id', jobId);

              continue;
            }

            const outcome = await syncZoomMeeting(
              supabase,
              userId,
              recordingId,
              recording,
              accessToken,
              validatedVaultId,
            );

            if (outcome.outcome === 'synced') {
              synced.push(recordingId);
              syncedRecordingUuids.push((outcome as { outcome: 'synced'; recordingUuid: string }).recordingUuid);
              console.log(`✓ Synced Zoom ${recordingId} (${synced.length}/${recordingIds.length})`);
            } else if (outcome.outcome === 'skipped') {
              skippedCount++;
              console.log(`→ Skipped Zoom ${recordingId} (duplicate)`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync Zoom ${recordingId}`);
            }

            // Update job progress (skipped items count toward progress)
            await supabase
              .from('sync_jobs')
              .update({
                progress_current: synced.length + failed.length + skippedCount,
                synced_ids: synced,
                failed_ids: failed,
                skipped_count: skippedCount,
              })
              .eq('id', jobId);

            // Small delay between meetings to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error processing Zoom recording ${recordingId}:`, error);
            failed.push(recordingId);

            await supabase
              .from('sync_jobs')
              .update({
                progress_current: synced.length + failed.length + skippedCount,
                synced_ids: synced,
                failed_ids: failed,
                skipped_count: skippedCount,
              })
              .eq('id', jobId);
          }
        }

        // Mark job as completed with appropriate status
        const finalStatus = failed.length === 0 ? 'completed' :
                          synced.length === 0 ? 'failed' :
                          'completed_with_errors';

        await supabase
          .from('sync_jobs')
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            skipped_count: skippedCount,
          })
          .eq('id', jobId);
        if (failed.length > 0 && (synced.length > 0 || skippedCount > 0) && sourceId) {
          await markConnectorPartialSync({
            supabase,
            sourceId,
            userId,
            failedExternalIds: failed,
          });
        }

        console.log(`Zoom sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed, ${skippedCount} skipped`);

        // [DISABLED] Embedding system disabled — pipeline broken
        // if (synced.length > 0) { ... }

        // Fire-and-forget: invoke generate-ai-titles for the synced recordings
        if (synced.length > 0) {
          console.log(`Triggering AI title generation for ${synced.length} synced Zoom meetings...`);
          supabase.functions.invoke('generate-ai-titles', {
            body: {
              recordingIds: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }: { data: unknown; error: Error | null }) => {
            if (error) {
              console.error(`AI title generation failed for Zoom sync job ${jobId}:`, error);
            } else {
              console.log(`AI title generation completed for ${synced.length} Zoom meetings:`, data);
            }
          }).catch((err: Error) => {
            console.error(`AI title invocation failed for Zoom sync job ${jobId}:`, err);
          });

          // Fire-and-forget: invoke summarize-call for each synced recording UUID.
          // generate-ai-titles only handles Fathom integer IDs; Zoom recordings use UUIDs
          // and go through the `recordings` table — summarize-call supports UUID recording_id.
          console.log(`Triggering summarize-call for ${syncedRecordingUuids.length} synced Zoom recordings...`);
          for (const recordingUuid of syncedRecordingUuids) {
            supabase.functions.invoke('summarize-call', {
              body: { recording_id: recordingUuid },
              headers: { Authorization: `Bearer ${jwt}` },
            }).then(({ error }: { error: Error | null }) => {
              if (error) {
                console.error(`summarize-call failed for recording ${recordingUuid}:`, error);
              } else {
                console.log(`summarize-call completed for recording ${recordingUuid}`);
              }
            }).catch((err: Error) => {
              console.error(`summarize-call invocation error for ${recordingUuid}:`, err);
            });
          }
        }
      } catch (error) {
        console.error(`Zoom sync job ${jobId} failed:`, error);
        await supabase
          .from('sync_jobs')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            completed_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    };

    // Start background processing
    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processSyncJob());

    // Return immediately with job ID
    return new Response(
      JSON.stringify({
        success: true,
        jobId: jobId,
        message: `Sync job started for ${targetRecordingIds.length} Zoom meetings`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing Zoom meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
