import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FathomClient } from '../_shared/fathom-client.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { checkDuplicate, insertRecording } from '../_shared/connector-pipeline.ts';

// Rate limiter for API calls - conservative to avoid 429 errors
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 30; // Reduced from 55 to be more conservative
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

interface TranscriptSegment {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email?: string;
  };
  text: string;
  timestamp: string;
}

/**
 * Syncs a single Fathom meeting to the recordings table via shared connector pipeline.
 *
 * Returns:
 *   'synced'   — new recording created
 *   'skipped'  — already exists (duplicate)
 *   'failed'   — error during sync
 */
async function syncMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meeting: any
): Promise<'synced' | 'skipped' | 'failed'> {
  try {
    console.log(`Syncing meeting ${recordingId}: ${meeting.title}`);

    // Stage 3 — Dedup check via shared pipeline (Fathom recording IDs are numeric)
    const externalId = String(recordingId);
    const { isDuplicate } = await checkDuplicate(supabase, userId, 'fathom', externalId);
    if (isDuplicate) {
      console.log(`Fathom meeting ${recordingId} already exists — skipping`);
      return 'skipped';
    }

    // Build full transcript text with consolidated speaker turns
    const transcript = meeting.transcript || [];
    const consolidatedSegments: string[] = [];
    let currentSpeaker: string | null = null;
    let currentTimestamp: string | null = null;
    let currentTexts: string[] = [];

    transcript.forEach((seg: TranscriptSegment, index: number) => {
      const speakerName = seg.speaker?.display_name || 'Unknown';

      if (speakerName !== currentSpeaker) {
        // Speaker changed - save previous speaker's consolidated text
        if (currentSpeaker !== null && currentTexts.length > 0) {
          consolidatedSegments.push(
            `[${currentTimestamp || '00:00:00'}] ${currentSpeaker}: ${currentTexts.join(' ')}`
          );
        }

        // Start new speaker turn
        currentSpeaker = speakerName;
        currentTimestamp = seg.timestamp || '00:00:00';
        currentTexts = [seg.text];
      } else {
        // Same speaker - append text
        currentTexts.push(seg.text);
      }

      // Handle last segment
      if (index === transcript.length - 1 && currentTexts.length > 0) {
        consolidatedSegments.push(
          `[${currentTimestamp || '00:00:00'}] ${currentSpeaker}: ${currentTexts.join(' ')}`
        );
      }
    });

    const fullTranscript = consolidatedSegments.join('\n\n');

    // Extract summary
    const summary = meeting.default_summary?.markdown_formatted || null;

    // Calculate duration from start/end times
    const startTime = new Date(meeting.recording_start_time);
    const endTime = meeting.recording_end_time ? new Date(meeting.recording_end_time) : null;
    const durationSeconds = endTime
      ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
      : undefined;

    // Extract participant emails from calendar_invitees
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const participantEmails = (meeting.calendar_invitees || []).map((inv: any) => inv.email).filter(Boolean);

    // Build source_metadata (external_id merged as first key by insertRecording)
    const sourceMetadata = {
      fathom_call_id: recordingId,
      fathom_url: meeting.url || null,
      fathom_share_url: meeting.share_url || null,
      recorded_by_name: meeting.recorded_by?.name || null,
      recorded_by_email: meeting.recorded_by?.email || null,
      calendar_invitees: meeting.calendar_invitees || [],
      participant_emails: participantEmails,
      summary: summary,
      import_source: 'sync-meetings',
      synced_at: new Date().toISOString(),
    };

    // Stage 5 — Insert via shared pipeline
    const result = await insertRecording(supabase, userId, {
      external_id: externalId,
      source_app: 'fathom',
      title: meeting.title,
      full_transcript: fullTranscript,
      recording_start_time: meeting.recording_start_time,
      duration: durationSeconds,
      source_metadata: sourceMetadata,
    });

    console.log(`Successfully synced Fathom meeting ${recordingId} as recording ${result.id}`);

    // Insert transcript segments into fathom_transcripts for backward compat
    if (meeting.transcript && meeting.transcript.length > 0) {
      const transcriptRows = meeting.transcript.map((segment: TranscriptSegment) => {
        let speakerEmail = segment.speaker.matched_calendar_invitee_email;

        if (!speakerEmail && meeting.calendar_invitees) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchedInvitee = meeting.calendar_invitees.find((inv: any) =>
            inv.matched_speaker_display_name === segment.speaker.display_name ||
            inv.name === segment.speaker.display_name
          );
          if (matchedInvitee) {
            speakerEmail = matchedInvitee.email;
          }
        }

        return {
          recording_id: meeting.recording_id,
          user_id: userId,
          speaker_name: segment.speaker.display_name,
          speaker_email: speakerEmail,
          text: segment.text,
          timestamp: segment.timestamp,
        };
      });

      const { error: transcriptError } = await supabase
        .from('fathom_transcripts')
        .insert(transcriptRows);

      if (transcriptError) {
        // Non-blocking — transcript table is supplementary; recording already committed
        console.error(`Error inserting transcripts for ${recordingId} (non-blocking):`, transcriptError);
      } else {
        console.log(`Synced ${transcriptRows.length} transcript segments for meeting ${recordingId}`);
      }
    }

    return 'synced';
  } catch (error) {
    console.error(`Failed to sync meeting ${recordingId}:`, error);
    return 'failed';
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
    const { recordingIds, createdAfter, createdBefore, vault_id } = await req.json();

    if (!Array.isArray(recordingIds) || recordingIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid recording IDs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get user's Fathom credentials (OAuth or API key)
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires, oauth_refresh_token')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.fathom_api_key && !settings?.oauth_access_token) {
      throw new Error('Fathom credentials not configured. Please add them in Settings.');
    }

    // Determine authentication method - prefer OAuth if available and valid
    const authHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Check if OAuth token is available and not expired
    const oauthTokenExpires = settings.oauth_token_expires ? new Date(settings.oauth_token_expires) : null;
    const isOAuthValid = settings.oauth_access_token && oauthTokenExpires && oauthTokenExpires > new Date();

    if (isOAuthValid) {
      // Use OAuth Bearer token authentication
      authHeaders['Authorization'] = `Bearer ${settings.oauth_access_token}`;
      console.log('Using OAuth Bearer token authentication for sync-meetings');
    } else if (settings.oauth_access_token && settings.oauth_refresh_token) {
      // OAuth token expired but we have a refresh token - try to refresh
      console.log('OAuth token expired, attempting refresh...');
      try {
        const clientId = Deno.env.get('FATHOM_OAUTH_CLIENT_ID');
        const clientSecret = Deno.env.get('FATHOM_OAUTH_CLIENT_SECRET');

        if (!clientId || !clientSecret) {
          throw new Error('OAuth not configured on server');
        }

        const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: settings.oauth_refresh_token,
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token refresh failed:', tokenResponse.status, errorText);
          throw new Error('Failed to refresh access token. Please reconnect Fathom in Settings.');
        }

        const tokens = await tokenResponse.json();
        const expiresAt = Date.now() + (tokens.expires_in * 1000);

        // Store new tokens
        await supabase
          .from('user_settings')
          .update({
            oauth_access_token: tokens.access_token,
            oauth_refresh_token: tokens.refresh_token,
            oauth_token_expires: expiresAt,
          })
          .eq('user_id', user.id);

        // Use the new token
        authHeaders['Authorization'] = `Bearer ${tokens.access_token}`;
        console.log('OAuth token refreshed successfully for sync-meetings');
      } catch (refreshError) {
        console.error('Error refreshing OAuth token:', refreshError);
        if (settings.fathom_api_key) {
          // Fall back to API key if refresh fails
          authHeaders['X-Api-Key'] = settings.fathom_api_key;
          console.log('OAuth refresh failed, falling back to API key authentication');
        } else {
          throw new Error('OAuth token expired and refresh failed. Please reconnect Fathom in Settings.');
        }
      }
    } else if (settings.fathom_api_key) {
      // Fall back to API key authentication
      authHeaders['X-Api-Key'] = settings.fathom_api_key;
      console.log('Using API key authentication for sync-meetings');
    } else {
      // OAuth token expired and no API key available
      throw new Error('Fathom OAuth token has expired. Please reconnect your Fathom account in Settings.');
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

    console.log(`Syncing ${recordingIds.length} meetings with date range:`, { createdAfter, createdBefore });

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

    console.log(`Created sync job ${jobId} for ${recordingIds.length} meetings`);

    // Helper function to fetch meeting metadata from paginated list
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMeetingMetadata = async (targetRecordingId: number): Promise<any | null> => {
      let cursor: string | undefined = undefined;
      const maxPages = 100; // Increase max pages for old meetings

      for (let pageCount = 0; pageCount < maxPages; pageCount++) {
        const url = new URL('https://api.fathom.ai/external/v1/meetings');
        url.searchParams.append('include_calendar_invitees', 'true');

        // Add date filters if provided
        if (createdAfter) {
          url.searchParams.append('created_after', createdAfter);
        }
        if (createdBefore) {
          url.searchParams.append('created_before', createdBefore);
        }

        if (cursor) {
          url.searchParams.append('cursor', cursor);
        }

        const response = await FathomClient.fetchWithRetry(url.toString(), {
          headers: authHeaders,
          maxRetries: 3,
        });

        if (!response || !response.ok) {
          console.error(`Failed to fetch meetings page ${pageCount + 1}`);
          break;
        }

        const data = await response.json();
        const found = data.items?.find((m: {recording_id: number}) => m.recording_id === targetRecordingId);

        if (found) {
          return found;
        }

        cursor = data.next_cursor;
        if (!cursor) break;

        // Small delay between pages
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return null;
    };

    // Helper function to fetch transcript and summary separately (like fetch-single-meeting)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fetchMeetingData = async (recordingId: number): Promise<any | null> => {
      try {
        // Fetch summary and transcript separately by recording_id
        const [summaryResponse, transcriptResponse] = await Promise.all([
          FathomClient.fetchWithRetry(
            `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
            { headers: authHeaders, maxRetries: 3 }
          ),
          FathomClient.fetchWithRetry(
            `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
            { headers: authHeaders, maxRetries: 3 }
          )
        ]);

        if (!summaryResponse.ok && summaryResponse.status !== 404) {
          console.error(`Failed to fetch summary for ${recordingId}: ${summaryResponse.status}`);
        }
        if (!transcriptResponse.ok && transcriptResponse.status !== 404) {
          console.error(`Failed to fetch transcript for ${recordingId}: ${transcriptResponse.status}`);
        }

        const summaryData = summaryResponse.ok ? await summaryResponse.json() : { summary: null };
        const transcriptData = transcriptResponse.ok ? await transcriptResponse.json() : { transcript: [] };

        // Get meeting metadata from paginated list
        const meetingMetadata = await fetchMeetingMetadata(recordingId);

        if (!meetingMetadata) {
          console.error(`Meeting metadata not found for ${recordingId}`);
          return null;
        }

        // Combine data like fetch-single-meeting does
        return {
          ...meetingMetadata,
          transcript: transcriptData.transcript || [],
          default_summary: summaryData.summary || null,
        };
      } catch (error) {
        console.error(`Error fetching meeting data for ${recordingId}:`, error);
        return null;
      }
    };

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: number[] = [];
      const failed: number[] = [];
      let skippedCount = 0;
      const rateLimiter = new RateLimiter();

      console.log(`Background processing started for sync job ${jobId}`);
      console.log(`Using NEW direct recording_id approach for ${recordingIds.length} meetings`);

      try {
        // Process each meeting individually using direct recording_id endpoints
        for (const recordingId of recordingIds) {
          try {
            await rateLimiter.throttle();

            console.log(`Fetching meeting ${recordingId} via direct recording_id endpoints...`);
            const meeting = await fetchMeetingData(recordingId);

            if (!meeting) {
              console.error(`Meeting ${recordingId} not found or failed to fetch`);
              failed.push(recordingId);

              // Update progress
              await supabase
                .from('sync_jobs')
                .update({
                  progress_current: synced.length + failed.length + skippedCount,
                  synced_ids: synced,
                  failed_ids: failed,
                  skipped_count: skippedCount,
                })
                .eq('id', jobId);

              continue;
            }

            const outcome = await syncMeeting(supabase, userId, recordingId, meeting);

            if (outcome === 'synced') {
              synced.push(recordingId);
              console.log(`✓ Synced ${recordingId} (${synced.length}/${recordingIds.length})`);

              // Create vault entry if vault_id was validated
              if (validatedVaultId) {
                try {
                  // Look up recording UUID by external_id in source_metadata
                  const { data: rec } = await supabase
                    .from('recordings')
                    .select('id')
                    .eq('owner_user_id', userId)
                    .eq('source_app', 'fathom')
                    .filter("source_metadata->>'external_id'", 'eq', String(recordingId))
                    .maybeSingle();

                  if (rec?.id) {
                    const { error: vaultEntryError } = await supabase
                      .from('vault_entries')
                      .insert({
                        vault_id: validatedVaultId,
                        recording_id: rec.id,
                      });

                    if (vaultEntryError) {
                      console.error(`Error creating vault entry for recording ${recordingId}:`, vaultEntryError);
                    } else {
                      console.log(`Created vault entry for recording ${rec.id} in vault ${validatedVaultId}`);
                    }
                  } else {
                    console.warn(`No recordings table entry found for Fathom recording_id ${recordingId}`);
                  }
                } catch (vaultError) {
                  console.error(`Error handling vault entry for recording ${recordingId}:`, vaultError);
                }
              }
            } else if (outcome === 'skipped') {
              skippedCount++;
              console.log(`→ Skipped ${recordingId} (duplicate)`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync ${recordingId}`);
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
            console.error(`Error processing recording ${recordingId}:`, error);
            failed.push(recordingId);

            // Update progress even on error
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

        console.log(`Sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed, ${skippedCount} skipped`);

        // [DISABLED] Embedding system disabled — pipeline broken
        // if (synced.length > 0) { ... }

        // Fire-and-forget: invoke generate-ai-titles for the synced recordings
        if (synced.length > 0) {
          // This generates descriptive AI titles and auto-categorizes calls
          console.log(`Triggering AI title generation for ${synced.length} synced meetings...`);
          supabase.functions.invoke('generate-ai-titles', {
            body: {
              recordingIds: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error(`AI title generation failed for sync job ${jobId}:`, error);
            } else {
              console.log(`AI title generation completed for ${synced.length} meetings:`, data);
            }
          }).catch((err) => {
            console.error(`AI title invocation failed for sync job ${jobId}:`, err);
          });
        }
      } catch (error) {
        console.error(`Sync job ${jobId} failed:`, error);
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
        message: `Sync job started for ${recordingIds.length} meetings`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
