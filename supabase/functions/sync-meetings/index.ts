import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter for API calls
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 55;
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

async function syncMeeting(
  supabase: any,
  userId: string,
  recordingId: number,
  meeting: any
): Promise<boolean> {
  try {
    console.log(`Syncing meeting ${recordingId}: ${meeting.title}`);

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

    // Check if call exists and has user edits
    const { data: existingCall } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, summary, title_edited_by_user, summary_edited_by_user')
      .eq('recording_id', meeting.recording_id)
      .maybeSingle();

    // Build upsert object, preserving user edits
    const upsertData: any = {
      recording_id: meeting.recording_id,
      user_id: userId,
      created_at: meeting.created_at,
      recording_start_time: meeting.recording_start_time,
      recording_end_time: meeting.recording_end_time,
      url: meeting.url,
      share_url: meeting.share_url,
      calendar_invitees: meeting.calendar_invitees || [],
      full_transcript: fullTranscript,
      recorded_by_name: meeting.recorded_by?.name || null,
      recorded_by_email: meeting.recorded_by?.email || null,
      synced_at: new Date().toISOString(),
    };

    // Only update title if not edited by user
    if (!existingCall?.title_edited_by_user) {
      upsertData.title = meeting.title;
    } else {
      upsertData.title = existingCall.title;
      upsertData.title_edited_by_user = true;
    }

    // Only update summary if not edited by user
    if (!existingCall?.summary_edited_by_user) {
      upsertData.summary = summary;
    } else {
      upsertData.summary = existingCall.summary;
      upsertData.summary_edited_by_user = true;
    }

    // Upsert call details
    const { error: callError } = await supabase
      .from('fathom_calls')
      .upsert(upsertData, {
        onConflict: 'recording_id'
      });

    if (callError) {
      console.error(`Error upserting call ${recordingId}:`, callError);
      throw callError;
    }

    // Delete existing transcripts and insert new ones
    if (meeting.transcript && meeting.transcript.length > 0) {
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', recordingId);

      if (deleteError) {
        console.error(`Error deleting old transcripts for ${recordingId}:`, deleteError);
      }

      const transcriptRows = meeting.transcript.map((segment: TranscriptSegment) => {
        let speakerEmail = segment.speaker.matched_calendar_invitee_email;
        
        if (!speakerEmail && meeting.calendar_invitees) {
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
        console.error(`Error inserting transcripts for ${recordingId}:`, transcriptError);
        throw transcriptError;
      }

      console.log(`Synced ${transcriptRows.length} transcript segments for meeting ${recordingId}`);
    }

    console.log(`Successfully synced meeting ${recordingId}`);
    return true;
  } catch (error) {
    console.error(`Failed to sync meeting ${recordingId}:`, error);
    return false;
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
    const { recordingIds, createdAfter, createdBefore } = await req.json();

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
    } else if (settings.fathom_api_key) {
      // Fall back to API key authentication
      authHeaders['X-Api-Key'] = settings.fathom_api_key;
      console.log('Using API key authentication for sync-meetings');
    } else {
      // OAuth token expired and no API key available
      throw new Error('Fathom OAuth token has expired. Please reconnect your Fathom account in Settings.');
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

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: number[] = [];
      const failed: number[] = [];
      const rateLimiter = new RateLimiter();
      
      console.log(`Background processing started for sync job ${jobId}`);

      try {
        // First, fetch all meetings metadata
        const meetingsMap = new Map<number, any>();
        let cursor: string | undefined = undefined;
        let pageCount = 0;
        const maxPages = 50;
        
        console.log('Fetching meetings list...');
        while (pageCount < maxPages) {
          pageCount++;
          const url = new URL('https://api.fathom.ai/external/v1/meetings');
          
          // Include transcript and summary in the request
          url.searchParams.append('include_transcript', 'true');
          url.searchParams.append('include_summary', 'true');
          
          // Add date filters to match the frontend fetch
          if (createdAfter) {
            url.searchParams.append('created_after', createdAfter);
          }
          if (createdBefore) {
            url.searchParams.append('created_before', createdBefore);
          }
          
          if (cursor) {
            url.searchParams.append('cursor', cursor);
          }

          await rateLimiter.throttle();

          const response = await fetch(url.toString(), { headers: authHeaders });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to fetch meetings (page ${pageCount}): ${response.status} - ${errorText}`);
            break;
          }

          const data = await response.json();
          const items = data.items || [];
          
          // Add meetings to map
          for (const meeting of items) {
            if (recordingIds.includes(meeting.recording_id)) {
              meetingsMap.set(meeting.recording_id, meeting);
            }
          }
          
          console.log(`Fetched page ${pageCount}, found ${meetingsMap.size}/${recordingIds.length} requested meetings`);
          
          cursor = data.next_cursor;
          if (!cursor) break;
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`Found ${meetingsMap.size} meetings, starting sync...`);

        // Sync each requested recording
        for (const recordingId of recordingIds) {
          try {
            const meeting = meetingsMap.get(recordingId);
            
            if (!meeting) {
              console.error(`Meeting ${recordingId} not found in meetings list`);
              failed.push(recordingId);
              
              // Update progress
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
            
            await rateLimiter.throttle();

            const success = await syncMeeting(supabase, userId, recordingId, meeting);
            
            if (success) {
              synced.push(recordingId);
              console.log(`✓ Synced ${recordingId} (${synced.length}/${recordingIds.length})`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync ${recordingId}`);
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

            await new Promise(resolve => setTimeout(resolve, 300));
          } catch (error) {
            console.error(`Error processing recording ${recordingId}:`, error);
            failed.push(recordingId);
            
            // Update progress even on error
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

        // DISABLED: update-contact-metrics function no longer exists
        // Previously updated metrics for 'contacts' table which has been deleted
        // if (synced.length > 0) {
        //   console.log('Updating contact metrics for all contacts...');
        //   await supabase.functions.invoke('update-contact-metrics', {
        //     body: { userId },
        //   });
        // }

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

        console.log(`Sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed`);
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
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
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
