import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { parseVTTWithMetadata, consolidateBySpeaker, TranscriptSegment } from '../_shared/vtt-parser.ts';
import { generateFingerprint, generateFingerprintString } from '../_shared/dedup-fingerprint.ts';
import { refreshZoomOAuthTokens } from '../zoom-oauth-refresh/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

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
 * Syncs a single Zoom meeting to the database
 */
async function syncZoomMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: string,
  meeting: ZoomRecordingDetail,
  accessToken: string
): Promise<boolean> {
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

    // Calculate meeting times
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(startTime.getTime() + (meeting.duration * 60 * 1000));

    // Generate fingerprint for deduplication
    const fingerprint = await generateFingerprint({
      title: meeting.topic,
      start_time: startTime,
      duration_minutes: meeting.duration,
      participants: [meeting.host_email], // Zoom API doesn't easily expose participant list
    });
    const fingerprintString = generateFingerprintString(fingerprint);

    // Check if call exists and has user edits (use composite key)
    const { data: existingCall } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, summary, title_edited_by_user, summary_edited_by_user')
      .eq('recording_id', recordingId)
      .eq('user_id', userId)
      .maybeSingle();

    // Build upsert object, preserving user edits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertData: any = {
      recording_id: recordingId, // Use UUID for Zoom
      user_id: userId,
      created_at: meeting.start_time,
      recording_start_time: meeting.start_time,
      recording_end_time: endTime.toISOString(),
      url: meeting.share_url || null,
      share_url: meeting.share_url || null,
      calendar_invitees: [], // Zoom API doesn't easily provide this
      full_transcript: fullTranscript,
      recorded_by_name: null, // Zoom doesn't have equivalent field
      recorded_by_email: meeting.host_email,
      synced_at: new Date().toISOString(),
      source_platform: 'zoom',
      meeting_fingerprint: fingerprintString,
      is_primary: true, // Deduplication logic in subtask-4-3 will adjust this
    };

    // Only update title if not edited by user
    if (!existingCall?.title_edited_by_user) {
      upsertData.title = meeting.topic;
    } else {
      upsertData.title = existingCall.title;
      upsertData.title_edited_by_user = true;
    }

    // Only update summary if not edited by user
    // Zoom doesn't provide summaries, so keep existing if edited
    if (existingCall?.summary_edited_by_user) {
      upsertData.summary = existingCall.summary;
      upsertData.summary_edited_by_user = true;
    }

    // Upsert call details (use composite primary key)
    const { error: callError } = await supabase
      .from('fathom_calls')
      .upsert(upsertData, {
        onConflict: 'recording_id,user_id'
      });

    if (callError) {
      console.error(`Error upserting Zoom call ${recordingId}:`, callError);
      throw callError;
    }

    // Delete existing transcripts and insert new ones (use composite key for user isolation)
    if (transcriptSegments.length > 0) {
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', recordingId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error(`Error deleting old transcripts for ${recordingId}:`, deleteError);
      }

      const transcriptRows = transcriptSegments.map((segment: TranscriptSegment) => ({
        recording_id: recordingId,
        user_id: userId,
        speaker_name: segment.speaker || 'Unknown',
        speaker_email: null, // Zoom VTT doesn't include emails
        text: segment.text,
        timestamp: segment.start_time,
      }));

      const { error: transcriptError } = await supabase
        .from('fathom_transcripts')
        .insert(transcriptRows);

      if (transcriptError) {
        console.error(`Error inserting transcripts for ${recordingId}:`, transcriptError);
        throw transcriptError;
      }

      console.log(`Synced ${transcriptRows.length} transcript segments for Zoom meeting ${recordingId}`);
    }

    console.log(`Successfully synced Zoom meeting ${recordingId}`);
    return true;
  } catch (error) {
    console.error(`Failed to sync Zoom meeting ${recordingId}:`, error);
    return false;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body FIRST
    const { recordingIds } = await req.json();

    if (!Array.isArray(recordingIds)) {
      return new Response(
        JSON.stringify({ error: 'recordingIds must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow empty array - return success with no-op
    if (recordingIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No recordings to sync',
          jobId: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Get user's Zoom OAuth credentials
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('zoom_oauth_access_token, zoom_oauth_token_expires, zoom_oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.zoom_oauth_access_token) {
      throw new Error('Zoom not connected. Please connect your Zoom account in Settings.');
    }

    // Determine access token to use (refresh if expired)
    let accessToken: string;
    const now = Date.now();

    if (settings.zoom_oauth_token_expires && settings.zoom_oauth_token_expires > now) {
      accessToken = settings.zoom_oauth_access_token;
      console.log('Using existing Zoom access token for sync');
    } else {
      console.log('Zoom token expired, attempting refresh...');
      if (!settings.zoom_oauth_refresh_token) {
        throw new Error('Zoom token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshZoomOAuthTokens(user.id, settings.zoom_oauth_refresh_token);
        console.log('Zoom token refreshed successfully for sync');
      } catch (refreshError) {
        console.error('Error refreshing Zoom token:', refreshError);
        throw new Error('Zoom token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    console.log(`Syncing ${recordingIds.length} Zoom meetings`);

    // Create a sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: recordingIds,
        status: 'processing',
        progress_current: 0,
        progress_total: recordingIds.length,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    console.log(`Created sync job ${jobId} for ${recordingIds.length} Zoom meetings`);

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      const rateLimiter = new RateLimiter();

      console.log(`Background processing started for Zoom sync job ${jobId}`);

      try {
        for (const recordingId of recordingIds) {
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

            const success = await syncZoomMeeting(supabase, userId, recordingId, recording, accessToken);

            if (success) {
              synced.push(recordingId);
              console.log(`✓ Synced Zoom ${recordingId} (${synced.length}/${recordingIds.length})`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync Zoom ${recordingId}`);
            }

            // Update job progress
            await supabase
              .from('sync_jobs')
              .update({
                progress_current: synced.length + failed.length,
                synced_ids: synced,
                failed_ids: failed,
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
                progress_current: synced.length + failed.length,
                synced_ids: synced,
                failed_ids: failed,
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
          })
          .eq('id', jobId);

        console.log(`Zoom sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed`);

        // Automatically trigger embedding generation for successfully synced meetings
        if (synced.length > 0) {
          console.log(`Triggering embedding generation for ${synced.length} synced Zoom meetings...`);

          // Fire-and-forget: invoke embed-chunks for the synced recordings
          supabase.functions.invoke('embed-chunks', {
            body: {
              recording_ids: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }: { data: unknown; error: Error | null }) => {
            if (error) {
              console.error(`Embedding generation failed for Zoom sync job ${jobId}:`, error);
            } else {
              console.log(`Embedding generation started for ${synced.length} Zoom meetings:`, data);
            }
          }).catch((err: Error) => {
            console.error(`Embedding invocation failed for Zoom sync job ${jobId}:`, err);
          });

          // Fire-and-forget: invoke generate-ai-titles for the synced recordings
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
        message: `Sync job started for ${recordingIds.length} Zoom meetings`,
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
