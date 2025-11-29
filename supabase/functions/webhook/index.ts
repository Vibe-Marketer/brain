import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, webhook-id, webhook-signature, webhook-timestamp, x-signature',
};

// Fathom's simple signature verification (for OAuth webhooks)
// Per Fathom docs: HMAC-SHA256 of raw body with secret, base64 encoded
async function verifyFathomSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  // Fathom uses x-signature header for their native webhooks
  const xSignature = headers.get('x-signature');

  if (!xSignature) {
    return false;
  }

  console.log('Verifying Fathom native signature (x-signature header)');

  // Use the secret directly (no base64 decoding needed for Fathom native)
  // Remove whsec_ prefix if present
  const secretToUse = secret.startsWith('whsec_') ? secret.substring(6) : secret;

  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secretToUse);
  const messageData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));

  console.log('Expected Fathom signature:', expected);
  console.log('Received x-signature:', xSignature);

  return expected === xSignature;
}

// Svix signature verification (for API Key webhooks)
async function verifySvixSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const signatureHeader = headers.get('webhook-signature');
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');

  if (!signatureHeader || !webhookId || !webhookTimestamp) {
    return false;
  }

  console.log('Verifying Svix signature (webhook-signature header)');

  const [version, signatureBlock] = signatureHeader.split(',');
  if (version !== 'v1') {
    console.error('Invalid Svix signature version:', version);
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

  console.log('Expected Svix signature:', expected);
  console.log('Received Svix signatures:', signatureBlock);

  const signatures = signatureBlock.split(' ');
  return signatures.includes(expected);
}

// Main verification function that tries both methods
async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  // Log available headers for debugging
  console.log('📝 Available signature headers:');
  console.log('   - x-signature:', headers.get('x-signature') ? 'present' : 'missing');
  console.log('   - webhook-signature:', headers.get('webhook-signature') ? 'present' : 'missing');
  console.log('   - webhook-id:', headers.get('webhook-id') ? 'present' : 'missing');
  console.log('   - webhook-timestamp:', headers.get('webhook-timestamp') ? 'present' : 'missing');

  // Try Fathom native signature first (x-signature header)
  if (headers.get('x-signature')) {
    console.log('🔐 Attempting Fathom native signature verification...');
    const fathomValid = await verifyFathomSignature(secret, headers, rawBody);
    if (fathomValid) {
      console.log('✅ Fathom native signature verified');
      return true;
    }
    console.log('❌ Fathom native signature failed');
  }

  // Try Svix signature (webhook-signature header)
  if (headers.get('webhook-signature')) {
    console.log('🔐 Attempting Svix signature verification...');
    const svixValid = await verifySvixSignature(secret, headers, rawBody);
    if (svixValid) {
      console.log('✅ Svix signature verified');
      return true;
    }
    console.log('❌ Svix signature failed');
  }

  // No valid signature found
  console.error('❌ No valid signature found with any method');
  return false;
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
    
    // ==========================================================================
    // WEBHOOK SIGNATURE VERIFICATION
    // ==========================================================================
    // We support BOTH personal API webhooks AND OAuth app webhooks:
    //
    // 1. Personal API Webhooks: signed with user-specific webhook_secret stored
    //    in user_settings. The secret is matched by recorded_by.email → host_email.
    //
    // 2. OAuth App Webhooks: signed with shared FATHOM_OAUTH_WEBHOOK_SECRET.
    //    This is the fallback when no user-specific secret matches.
    //
    // Priority: User-specific secret (matched by email) → OAuth app secret → First user's secret
    // ==========================================================================

    console.log('🔍 Webhook received - recorded_by:', meeting.recorded_by?.email);

    // Try to find a matching webhook secret
    let webhookSecret = null;
    let secretMatchMethod = 'none';
    let matchedUserId = null;

    // 1. Try to match by recorded_by email to user_settings.host_email
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

    // 2. Fallback to OAuth app webhook secret
    if (!webhookSecret) {
      console.log('🔄 No user-specific secret found, trying OAuth app secret');
      const oauthAppSecret = Deno.env.get('FATHOM_OAUTH_WEBHOOK_SECRET');

      if (oauthAppSecret) {
        webhookSecret = oauthAppSecret;
        secretMatchMethod = 'oauth_app_secret';
        console.log('✅ Using OAuth app webhook secret');
        console.log('   - Secret (masked):', oauthAppSecret.substring(0, 15) + '...');

        // For OAuth webhooks, try to find user by email for later processing
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

    // 3. Final fallback to first user's webhook secret
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
        secretMatchMethod = 'first_user_fallback';
        console.log('✅ Using first user\'s webhook secret');
        console.log('   - Secret (masked):', webhookSecret.substring(0, 15) + '...');
      }
    }

    if (!webhookSecret) {
      console.error('❌ No webhook secret available (none in user_settings, no FATHOM_OAUTH_WEBHOOK_SECRET)');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔐 Verifying signature using method:', secretMatchMethod);

    // Verify the webhook signature
    const isValid = await verifyWebhookSignature(webhookSecret, req.headers, rawBody);

    // Use the userId we already found during secret lookup
    userId = matchedUserId;

    // If still no userId, get first user for logging purposes
    if (!userId) {
      const { data: firstUser } = await supabase
        .from('user_settings')
        .select('user_id')
        .limit(1)
        .maybeSingle();

      userId = firstUser?.user_id || null;
    }

    if (!isValid) {
      console.error('❌ Webhook signature verification FAILED');
      console.error('   - Webhook ID:', req.headers.get('webhook-id'));
      console.error('   - Signature Header:', req.headers.get('webhook-signature'));
      errorMessage = `Invalid webhook signature (method: ${secretMatchMethod})`;

      // Log failed delivery
      if (userId) {
        await supabase.from('webhook_deliveries').insert({
          user_id: userId,
          webhook_id: req.headers.get('webhook-id') || req.headers.get('svix-id') || 'unknown',
          recording_id: meeting.recording_id,
          status: 'failed',
          error_message: errorMessage,
          request_headers: Object.fromEntries(req.headers.entries()),
          request_body: meeting,
          signature_valid: false
        });
      }

      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          hint: 'Verify FATHOM_OAUTH_WEBHOOK_SECRET matches your OAuth app webhook secret in the Fathom Developer Portal'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Webhook signature verified successfully using OAuth app secret');

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
