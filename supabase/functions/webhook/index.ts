import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature',
};

async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const signatureHeader = headers.get('webhook-signature');
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');
  
  if (!signatureHeader || !webhookId || !webhookTimestamp) {
    console.error('Missing required webhook headers');
    return false;
  }

  const [version, signatureBlock] = signatureHeader.split(',');
  if (version !== 'v1') {
    console.error('Invalid signature version:', version);
    return false;
  }

  // Svix signs the format: webhook-id.webhook-timestamp.body
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  console.log('Verifying Svix signature for content, length:', signedContent.length);

  // Decode the secret - it's in format "whsec_XXXXX" where XXXXX is base64 encoded
  const secretParts = secret.split('_');
  if (secretParts.length !== 2 || secretParts[0] !== 'whsec') {
    console.error('Invalid secret format, expected whsec_XXXXX');
    return false;
  }
  
  // Base64 decode the secret
  const secretBytes = Uint8Array.from(atob(secretParts[1]), c => c.charCodeAt(0));
  console.log('Decoded secret length:', secretBytes.length);

  // Use Web Crypto API to sign the Svix format
  const encoder = new TextEncoder();
  const messageData = encoder.encode(signedContent);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));

  console.log('Expected signature:', expected);
  console.log('Received signatures:', signatureBlock);

  const signatures = signatureBlock.split(' ');
  return signatures.includes(expected);
}

async function processMeetingWebhook(meeting: any, supabase: any) {
  try {
    console.log(`Processing webhook for meeting: ${meeting.recording_id}`);

    // Try to determine user_id by recorded_by_email matching user_settings.host_email
    let userId = null;
    
    if (meeting.recorded_by?.email) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('host_email', meeting.recorded_by.email)
        .maybeSingle();
      
      userId = userSettings?.user_id || null;
    }

    // Reject webhook if user cannot be determined
    if (!userId) {
      const hostEmail = meeting.recorded_by?.email || 'unknown';
      console.error(
        `CRITICAL: Cannot determine user_id for meeting ${meeting.recording_id}. ` +
        `Host email "${hostEmail}" is not configured in any user's settings. ` +
        `Please configure the host_email in user_settings before processing webhooks.`
      );
      throw new Error(
        `Cannot process webhook: Host email "${hostEmail}" not found in user settings. ` +
        `Please add this email to your Fathom configuration in Settings.`
      );
    }

    // Build full transcript text with consolidated speaker turns
    const transcript = meeting.transcript || [];
    
    // 📊 LOG TRANSCRIPT STATS FROM WEBHOOK
    console.log(`📊 Webhook transcript stats for meeting ${meeting.recording_id}:`);
    console.log(`   - Transcript segments received from Fathom: ${transcript.length}`);
    if (transcript.length > 0) {
      const firstTimestamp = transcript[0].timestamp || '00:00:00';
      const lastTimestamp = transcript[transcript.length - 1].timestamp || '00:00:00';
      console.log(`   - First timestamp: ${firstTimestamp}`);
      console.log(`   - Last timestamp: ${lastTimestamp}`);
      console.log(`   - Total characters in all segments: ${transcript.reduce((sum: number, seg: any) => sum + (seg.text?.length || 0), 0)}`);
    }
    console.log(`   - Meeting duration: ${meeting.recording_start_time} to ${meeting.recording_end_time}`);
    
    const consolidatedSegments: string[] = [];
    let currentSpeaker: string | null = null;
    let currentTimestamp: string | null = null;
    let currentTexts: string[] = [];

    transcript.forEach((seg: any, index: number) => {
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

    // Upsert call details with calendar invitees
    const { error: callError } = await supabase
      .from('fathom_calls')
      .upsert({
        recording_id: meeting.recording_id,
        title: meeting.title,
        created_at: meeting.created_at,
        recording_start_time: meeting.recording_start_time,
        recording_end_time: meeting.recording_end_time,
        url: meeting.url,
        share_url: meeting.share_url,
        full_transcript: fullTranscript,
        summary: summary,
        recorded_by_name: meeting.recorded_by?.name || null,
        recorded_by_email: meeting.recorded_by?.email || null,
        calendar_invitees: meeting.calendar_invitees || null,
        user_id: userId,
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'recording_id'
      });

    if (callError) {
      console.error('Error upserting call:', callError);
      throw callError;
    }

    // Insert transcript segments
    if (meeting.transcript && meeting.transcript.length > 0) {
      // Delete existing transcripts
      await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', meeting.recording_id);

      const transcriptRows = meeting.transcript.map((segment: any) => {
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

      if (transcriptError) {
        console.error('Error inserting transcripts:', transcriptError);
        throw transcriptError;
      }

      console.log(`✅ Successfully inserted ${transcriptRows.length} transcript segments into database`);
    }

    console.log(`Successfully processed webhook for meeting: ${meeting.recording_id}`);
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Log all incoming webhook requests for debugging
  console.log('=== WEBHOOK REQUEST RECEIVED ===');
  console.log('Request ID:', requestId);
  console.log('Timestamp:', timestamp);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle health check / test requests
  if (req.method === 'GET') {
    console.log('GET request received - returning health check');
    return new Response(
      JSON.stringify({ 
        status: 'online',
        message: 'Webhook endpoint is ready',
        url: 'https://phfwibxcuavoqykrlcir.supabase.co/functions/v1/webhook',
        timestamp,
        requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let meeting: any;
  let userId: string | null = null;
  let errorMessage: string | null = null;
  
  try {
    // Clone the request to read body multiple times if needed
    const clonedReq = req.clone();
    const rawBody = await clonedReq.text();
    console.log('Raw body length:', rawBody.length);
    console.log('Raw body preview:', rawBody.substring(0, 200));
    
    // Parse body to get meeting email for webhook secret lookup
    meeting = JSON.parse(rawBody);
    
    // Retrieve the webhook secret from user_settings
    // Try to match by recorded_by email first
    let webhookSecret = null;
    let secretMatchMethod = 'none';
    let matchedUserId = null;
    
    console.log('🔍 Looking up webhook secret for email:', meeting.recorded_by?.email);
    
    if (meeting.recorded_by?.email) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('webhook_secret, user_id')
        .eq('host_email', meeting.recorded_by.email)
        .maybeSingle();
      
      if (settings?.webhook_secret) {
        webhookSecret = settings.webhook_secret;
        matchedUserId = settings.user_id;
        secretMatchMethod = 'email_match';
        console.log('✅ Found secret via email match');
        console.log('   - Matched User ID:', matchedUserId);
        console.log('   - Secret (masked):', webhookSecret.substring(0, 15) + '...');
      } else {
        console.log('❌ No webhook secret found for email:', meeting.recorded_by.email);
      }
    }
    
    // Fallback to OAuth app webhook secret (for OAuth-based webhooks)
    if (!webhookSecret) {
      console.log('🔄 No user-specific secret found, trying OAuth app secret');
      const oauthAppSecret = Deno.env.get('FATHOM_OAUTH_WEBHOOK_SECRET');

      if (oauthAppSecret) {
        webhookSecret = oauthAppSecret;
        secretMatchMethod = 'oauth_app_secret';
        console.log('✅ Using OAuth app webhook secret');

        // For OAuth webhooks, try to find user by email
        if (meeting.recorded_by?.email) {
          const { data: userByEmail } = await supabase
            .from('user_settings')
            .select('user_id')
            .eq('host_email', meeting.recorded_by.email)
            .maybeSingle();

          matchedUserId = userByEmail?.user_id || null;
        }
      }
    }

    // Final fallback to first user's settings (for legacy API key webhooks)
    if (!webhookSecret) {
      console.log('🔄 Falling back to first user\'s webhook secret');
      const { data: firstSettings } = await supabase
        .from('user_settings')
        .select('webhook_secret, user_id')
        .limit(1)
        .maybeSingle();

      if (firstSettings?.webhook_secret) {
        webhookSecret = firstSettings.webhook_secret;
        matchedUserId = firstSettings.user_id;
        secretMatchMethod = 'fallback_first_user';
        console.log('✅ Using fallback secret');
        console.log('   - User ID:', matchedUserId);
        console.log('   - Secret (masked):', webhookSecret.substring(0, 15) + '...');
      }
    }

    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET not configured - no user secret or OAuth app secret found');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Webhook secret loaded successfully');
    console.log('📊 Webhook Signature Verification Details:');
    console.log('   - Secret match method:', secretMatchMethod);
    console.log('   - Matched User ID:', matchedUserId);
    console.log('   - Webhook ID:', req.headers.get('webhook-id'));
    console.log('   - Webhook Timestamp:', req.headers.get('webhook-timestamp'));
    console.log('   - Signature Header:', req.headers.get('webhook-signature'));
    console.log('   - Body length:', rawBody.length);
    
    // Get user_id for logging
    if (meeting.recorded_by?.email) {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('host_email', meeting.recorded_by.email)
        .maybeSingle();
      
      userId = userSettings?.user_id || null;
    }
    
    if (!userId) {
      const { data: firstUser } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1)
        .maybeSingle();
      
      userId = firstUser?.user_id || null;
    }
    
    // Verify webhook signature
    const isValid = await verifyWebhookSignature(webhookSecret, req.headers, rawBody);
    console.log('Signature verification:', isValid ? 'VALID' : 'INVALID');
    
    if (!isValid) {
      console.error('Invalid webhook signature');
      errorMessage = 'Invalid webhook signature';
      
      // Log failed delivery
      if (userId) {
        await supabase.from('webhook_deliveries').insert({
          user_id: userId,
          webhook_id: req.headers.get('webhook-id') || 'unknown',
          recording_id: meeting.recording_id,
          status: 'failed',
          error_message: errorMessage,
          request_headers: Object.fromEntries(req.headers.entries()),
          request_body: meeting,
          signature_valid: false
        });
      }
      
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookId = req.headers.get('webhook-id');
    console.log('Webhook ID:', webhookId);
    
    if (!webhookId) {
      console.error('Missing webhook-id header');
      return new Response(
        JSON.stringify({ error: 'Missing webhook ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if webhook already processed (idempotency)
    const { data: existing } = await supabase
      .from('processed_webhooks')
      .select('webhook_id')
      .eq('webhook_id', webhookId)
      .maybeSingle();

    if (existing) {
      console.log('Webhook already processed:', webhookId);

      // Log duplicate delivery
      if (userId) {
        await supabase.from('webhook_deliveries').insert({
          user_id: userId,
          webhook_id: webhookId,
          recording_id: meeting.recording_id,
          status: 'duplicate',
          request_headers: Object.fromEntries(req.headers.entries()),
          request_body: meeting,
          signature_valid: true
        });
      }
      
      return new Response(
        JSON.stringify({ status: 'already_processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Meeting already parsed above for webhook secret lookup
    console.log('Meeting:', meeting.recording_id);

    // Acknowledge receipt immediately (within 5 seconds)
    console.log('✅ Webhook validated - sending immediate acknowledgement');
    const response = new Response(
      JSON.stringify({ 
        status: 'received',
        webhookId,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Process webhook in background
    (async () => {
      try {
        console.log('🔄 Starting background processing for webhook:', webhookId);
        console.log('Meeting details:', { recording_id: meeting.recording_id, title: meeting.title });
        
        await processMeetingWebhook(meeting, supabase);
        
        // Mark webhook as processed
        await supabase
          .from('processed_webhooks')
          .insert({
            webhook_id: webhookId,
            processed_at: new Date().toISOString(),
          });

        // Note: AI title generation and auto-tagging edge functions were removed
        // These features are now handled differently or deprecated
        
        // Log successful delivery
        if (userId) {
          await supabase.from('webhook_deliveries').insert({
            user_id: userId,
            webhook_id: webhookId,
            recording_id: meeting.recording_id,
            status: 'success',
            request_headers: Object.fromEntries(req.headers.entries()),
            request_body: meeting,
            signature_valid: true
          });
        }
        
        console.log('✅ Webhook processing complete:', webhookId);
      } catch (error) {
        console.error('❌ Background processing failed for webhook:', webhookId, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        // Log failed delivery
        if (userId) {
          await supabase.from('webhook_deliveries').insert({
            user_id: userId,
            webhook_id: webhookId,
            recording_id: meeting.recording_id,
            status: 'failed',
            error_message: errorMsg,
            request_headers: Object.fromEntries(req.headers.entries()),
            request_body: meeting,
            signature_valid: true
          });
        }
        
        try {
          await supabase
            .from('processed_webhooks')
            .insert({
              webhook_id: `${webhookId}_ERROR`,
              processed_at: new Date().toISOString(),
            });
        } catch (logError) {
          console.error('Failed to log error:', logError);
        }
      }
    })();

    return response;
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
