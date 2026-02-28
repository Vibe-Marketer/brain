import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { parseVTTWithMetadata, consolidateBySpeaker, TranscriptSegment } from '../_shared/vtt-parser.ts';
import { refreshZoomOAuthTokens } from '../zoom-oauth-refresh/index.ts';
import { checkDuplicate, insertRecording } from '../_shared/connector-pipeline.ts';

import { getCorsHeaders } from '../_shared/cors.ts';

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
 *   'synced'   — new recording created
 *   'skipped'  — already exists (duplicate)
 *   'failed'   — error during sync
 */
async function syncZoomMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: string,
  meeting: ZoomRecordingDetail,
  accessToken: string,
): Promise<'synced' | 'skipped' | 'failed'> {
  try {
    console.log(`Syncing Zoom meeting ${recordingId}: ${meeting.topic}`);

    // Stage 3 — Dedup check via shared pipeline
    // Use Zoom meeting UUID as the external_id for consistent cross-sync dedup
    const { isDuplicate } = await checkDuplicate(supabase, userId, 'zoom', recordingId);
    if (isDuplicate) {
      console.log(`Zoom meeting ${recordingId} already exists — skipping`);
      return 'skipped';
    }

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

    // Build source_metadata (external_id merged as first key by insertRecording)
    const sourceMetadata = {
      zoom_meeting_id: recordingId,
      zoom_numeric_id: meeting.id,
      zoom_host_email: meeting.host_email,
      zoom_host_id: meeting.host_id,
      zoom_account_id: meeting.account_id,
      zoom_share_url: meeting.share_url || null,
      zoom_timezone: meeting.timezone,
      zoom_type: meeting.type,
      import_source: 'zoom-sync-meetings',
      synced_at: new Date().toISOString(),
    };

    // Stage 5 — Insert via shared pipeline
    const result = await insertRecording(supabase, userId, {
      external_id: recordingId,
      source_app: 'zoom',
      title: meeting.topic,
      full_transcript: fullTranscript,
      recording_start_time: startTime.toISOString(),
      duration: durationSeconds,
      source_metadata: sourceMetadata,
    });

    console.log(`Successfully synced Zoom meeting ${recordingId} as recording ${result.id}`);

    // Insert transcript segments into fathom_transcripts for backward compat
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
        .from('fathom_transcripts')
        .insert(transcriptRows);

      if (transcriptError) {
        // Non-blocking — transcript table is supplementary; recording already committed
        console.error(`Error inserting transcripts for ${recordingId} (non-blocking):`, transcriptError);
      } else {
        console.log(`Synced ${transcriptRows.length} transcript segments for Zoom meeting ${recordingId}`);
      }
    }

    return 'synced';
  } catch (error) {
    console.error(`Failed to sync Zoom meeting ${recordingId}:`, error);
    return 'failed';
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body FIRST
    const { recordingIds, vault_id } = await req.json();

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

    // Validate vault membership once at the top if vault_id provided
    let validatedVaultId: string | null = null;
    if (vault_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('vault_memberships')
        .select('id')
        .eq('vault_id', vault_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        console.error('Error checking vault membership:', membershipError);
      } else if (!membership) {
        console.warn(`User ${user.id} is not a member of vault ${vault_id}, ignoring vault_id`);
      } else {
        validatedVaultId = vault_id;
        console.log(`Vault ${vault_id} membership validated for user ${user.id}`);
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
      let skippedCount = 0;
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

            const outcome = await syncZoomMeeting(
              supabase,
              userId,
              recordingId,
              recording,
              accessToken,
            );

            if (outcome === 'synced') {
              synced.push(recordingId);
              console.log(`✓ Synced Zoom ${recordingId} (${synced.length}/${recordingIds.length})`);

              // Create vault entry if vault_id was validated
              if (validatedVaultId) {
                try {
                  // Look up recording UUID by external_id in source_metadata
                  const { data: rec } = await supabase
                    .from('recordings')
                    .select('id')
                    .eq('owner_user_id', userId)
                    .eq('source_app', 'zoom')
                    .filter("source_metadata->>'external_id'", 'eq', recordingId)
                    .maybeSingle();

                  if (rec?.id) {
                    const { error: vaultEntryError } = await supabase
                      .from('vault_entries')
                      .insert({
                        vault_id: validatedVaultId,
                        recording_id: rec.id,
                      });

                    if (vaultEntryError) {
                      console.error(`Error creating vault entry for Zoom recording ${recordingId}:`, vaultEntryError);
                    } else {
                      console.log(`Created vault entry for Zoom recording ${rec.id} in vault ${validatedVaultId}`);
                    }
                  } else {
                    console.warn(`No recordings table entry found for Zoom recording_id ${recordingId}`);
                  }
                } catch (vaultError) {
                  console.error(`Error handling vault entry for Zoom recording ${recordingId}:`, vaultError);
                }
              }
            } else if (outcome === 'skipped') {
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
