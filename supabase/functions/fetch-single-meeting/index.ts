import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Fathom API key from config
    const { data: config, error: configError } = await supabaseClient
      .from('app_config')
      .select('value')
      .eq('key', 'FATHOM_API_KEY')
      .maybeSingle();

    if (configError) throw configError;
    if (!config?.value) {
      return new Response(
        JSON.stringify({ error: 'Fathom API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { recording_id } = await req.json();
    
    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'Recording ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching meeting with recording_id:', recording_id);

    // Use the specific recordings endpoint to get meeting details directly
    const url = `https://api.fathom.ai/external/v1/recordings/${recording_id}/summary`;
    
    const [summaryResponse, transcriptResponse] = await Promise.all([
      fetch(url, {
        headers: {
          'X-Api-Key': config.value,
          'Content-Type': 'application/json',
        },
      }),
      fetch(`https://api.fathom.ai/external/v1/recordings/${recording_id}/transcript`, {
        headers: {
          'X-Api-Key': config.value,
          'Content-Type': 'application/json',
        },
      })
    ]);

    if (!summaryResponse.ok) {
      const errorText = await summaryResponse.text();
      console.error('Fathom API summary error:', errorText);
      throw new Error(`Fathom API error: ${summaryResponse.status} ${errorText}`);
    }

    const summaryData = await summaryResponse.json();
    const transcriptData = transcriptResponse.ok ? await transcriptResponse.json() : { transcript: [] };

    // Fetch basic meeting info from list endpoint with pagination
    let meetingInfo: any = null;
    let cursor: string | undefined = undefined;
    const targetRecordingId = parseInt(recording_id);
    
    // Search through pages until we find the meeting (max 5 pages to avoid infinite loops)
    for (let page = 0; page < 5 && !meetingInfo; page++) {
      const listUrl = new URL('https://api.fathom.ai/external/v1/meetings');
      listUrl.searchParams.append('include_calendar_invitees', 'true');
      if (cursor) {
        listUrl.searchParams.append('cursor', cursor);
      }
      
      const listResponse = await fetch(listUrl.toString(), {
        headers: {
          'X-Api-Key': config.value,
          'Content-Type': 'application/json',
        },
      });

      if (!listResponse.ok) {
        throw new Error(`Failed to fetch meeting list: ${listResponse.status}`);
      }

      const listData = await listResponse.json();
      meetingInfo = listData.items?.find((m: any) => m.recording_id === targetRecordingId);
      
      // If found or no more pages, break
      if (meetingInfo || !listData.next_cursor) {
        break;
      }
      
      cursor = listData.next_cursor;
    }

    if (!meetingInfo) {
      console.error(`Meeting with recording_id ${recording_id} not found in API`);
      return new Response(
        JSON.stringify({ 
          error: 'Meeting not found',
          details: 'The meeting may not be accessible or may have been deleted'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine all the data
    const meeting = {
      ...meetingInfo,
      transcript: transcriptData.transcript || [],
      default_summary: summaryData.summary || null,
    };

    // Log to debug share_url issues
    console.log('Meeting data:', {
      recording_id: meeting.recording_id,
      has_url: !!meeting.url,
      has_share_url: !!meeting.share_url,
      url: meeting.url,
      share_url: meeting.share_url
    });

    return new Response(
      JSON.stringify({ meeting }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
