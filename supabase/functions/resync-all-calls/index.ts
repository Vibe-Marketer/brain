import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptSegment {
  speaker: {
    display_name: string;
    matched_calendar_invitee_email?: string;
  };
  text: string;
  timestamp: string;
}

class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 55;
  private readonly windowMs = 60000;

  async throttle() {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    if (elapsed >= this.windowMs) {
      this.requestCount = 0;
      this.windowStart = now;
    }

    if (this.requestCount >= this.maxRequests) {
      const waitTime = this.windowMs - elapsed;
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }

    this.requestCount++;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Get user's Fathom credentials (OAuth or API key)
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'Fathom credentials not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine which authentication method to use
    let fathomAuthHeader: string;
    if (settings.oauth_access_token) {
      // Check if OAuth token is expired
      const now = Date.now();
      if (settings.oauth_token_expires && settings.oauth_token_expires > now) {
        fathomAuthHeader = `Bearer ${settings.oauth_access_token}`;
        console.log('Using OAuth authentication');
      } else {
        return new Response(
          JSON.stringify({ error: 'OAuth token expired. Please reconnect in Settings.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (settings.fathom_api_key) {
      fathomAuthHeader = settings.fathom_api_key;
      console.log('Using API key authentication');
    } else {
      return new Response(
        JSON.stringify({ error: 'No Fathom authentication configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all recording IDs for this user
    const { data: existingCalls, error: callsError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, summary, title_edited_by_user, summary_edited_by_user')
      .eq('user_id', userId);

    if (callsError) {
      console.error('Error fetching calls:', callsError);
      return new Response(
        JSON.stringify({ error: `Database error: ${callsError.message}`, synced: 0, failed: 0 }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!existingCalls || existingCalls.length === 0) {
      console.log('No calls found for user:', userId);
      return new Response(
        JSON.stringify({ error: 'No calls found to re-sync', synced: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${userId} has ${existingCalls.length} calls in database`);
    console.log(`Starting re-sync for ${existingCalls.length} calls`);

    // Initialize rate limiter
    const rateLimiter = new RateLimiter();

    const synced: number[] = [];
    const failed: number[] = [];
    const notFound: number[] = [];

    console.log(`Fetching and re-syncing ${existingCalls.length} calls individually...`);

    // Process each existing call by fetching it individually
    for (const existingCall of existingCalls) {
      try {
        await rateLimiter.throttle();
        
        // Fetch individual meeting with transcript
        const url = new URL(`https://api.fathom.ai/external/v1/recordings/${existingCall.recording_id}`);
        url.searchParams.append('include_transcript', 'true');
        url.searchParams.append('include_summary', 'true');

        const headers: Record<string, string> = settings.oauth_access_token
          ? { 'Authorization': fathomAuthHeader }
          : { 'X-Api-Key': fathomAuthHeader };

        const response = await fetch(url.toString(), { headers });

        if (response.status === 404) {
          console.log(`Meeting ${existingCall.recording_id} not found in Fathom`);
          notFound.push(existingCall.recording_id);
          continue;
        }

        if (!response.ok) {
          throw new Error(`Fathom API error: ${response.status} ${response.statusText}`);
        }

        const meeting = await response.json();

        console.log(`Re-syncing: ${meeting.title} (${meeting.recording_id})`);

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
          full_transcript: (() => {
            const transcript = meeting.transcript || [];
            const consolidatedSegments: string[] = [];
            let currentSpeaker: string | null = null;
            let currentTimestamp: string | null = null;
            let currentTexts: string[] = [];

            transcript.forEach((seg: TranscriptSegment, index: number) => {
              const speakerName = seg.speaker?.display_name || 'Unknown';
              
              if (speakerName !== currentSpeaker) {
                if (currentSpeaker !== null && currentTexts.length > 0) {
                  consolidatedSegments.push(
                    `[${currentTimestamp || '00:00:00'}] ${currentSpeaker}: ${currentTexts.join(' ')}`
                  );
                }
                currentSpeaker = speakerName;
                currentTimestamp = seg.timestamp || '00:00:00';
                currentTexts = [seg.text];
              } else {
                currentTexts.push(seg.text);
              }
              
              if (index === transcript.length - 1 && currentTexts.length > 0) {
                consolidatedSegments.push(
                  `[${currentTimestamp || '00:00:00'}] ${currentSpeaker}: ${currentTexts.join(' ')}`
                );
              }
            });

            return consolidatedSegments.join('\n\n') || null;
          })(),
          recorded_by_name: meeting.recorded_by?.name || null,
          recorded_by_email: meeting.recorded_by?.email || null,
        };

        // Only update title if not edited by user
        if (!existingCall.title_edited_by_user) {
          upsertData.title = meeting.title;
        } else {
          upsertData.title = existingCall.title;
          upsertData.title_edited_by_user = true;
        }

        // Only update summary if not edited by user
        if (!existingCall.summary_edited_by_user) {
          upsertData.summary = meeting.default_summary?.markdown_formatted || null;
        } else {
          upsertData.summary = existingCall.summary;
          upsertData.summary_edited_by_user = true;
        }

        // Upsert call details
        const { error: callError } = await supabase
          .from('fathom_calls')
          .upsert(upsertData, { onConflict: 'recording_id' });

        if (callError) throw callError;

        // Update transcript segments
        if (meeting.transcript && Array.isArray(meeting.transcript)) {
          // Delete existing transcripts
          await supabase
            .from('fathom_transcripts')
            .delete()
            .eq('recording_id', meeting.recording_id);

          // Insert new transcripts
          const transcriptRows = meeting.transcript.map((segment: TranscriptSegment) => {
            // Try to get email from transcript match first, then from calendar invitees
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

          if (transcriptError) throw transcriptError;
        }

        synced.push(meeting.recording_id);
        console.log(`✓ Re-synced: ${meeting.title}`);
        
      } catch (error) {
        console.error(`✗ Failed to re-sync ${existingCall.recording_id}:`, error);
        failed.push(existingCall.recording_id);
      }
    }

    console.log(`Re-sync complete. Synced: ${synced.length}, Failed: ${failed.length}, Not found: ${notFound.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: existingCalls.length,
        synced: synced.length,
        failed: failed.length,
        notFound: notFound.length,
        syncedIds: synced,
        failedIds: failed,
        notFoundIds: notFound,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Re-sync error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
