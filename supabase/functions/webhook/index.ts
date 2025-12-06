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

async function processMeetingWebhook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meeting: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string[]> {
  try {
    console.log(`Processing webhook for meeting: ${meeting.recording_id}`);

    // Find ALL users with matching host_email to support team accounts
    // A team leader's calls should sync to BOTH their account AND team members' accounts
    const syncedUserIds: string[] = [];

    if (meeting.recorded_by?.email) {
      const { data: userSettings, error: lookupError } = await supabase
        .from('user_settings')
        .select('user_id')
        .eq('host_email', meeting.recorded_by.email);

      if (lookupError) {
        console.error('Error looking up users by host_email:', lookupError);
      }

      if (userSettings && userSettings.length > 0) {
        console.log(`Found ${userSettings.length} user(s) with host_email "${meeting.recorded_by.email}"`);
        for (const settings of userSettings) {
          syncedUserIds.push(settings.user_id);
        }
      }
    }

    // Reject webhook if no users found
    if (syncedUserIds.length === 0) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.log(`   - Total characters in all segments: ${transcript.reduce((sum: number, seg: any) => sum + (seg.text?.length || 0), 0)}`);
    }
    console.log(`   - Meeting duration: ${meeting.recording_start_time} to ${meeting.recording_end_time}`);
    
    const consolidatedSegments: string[] = [];
    let currentSpeaker: string | null = null;
    let currentTimestamp: string | null = null;
    let currentTexts: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // Sync the call to ALL matching users (team support)
    // Schema has composite primary key (recording_id, user_id), so same recording can exist for multiple users
    console.log(`📥 Syncing meeting ${meeting.recording_id} to ${syncedUserIds.length} user(s)...`);

    for (const userId of syncedUserIds) {
      console.log(`   Syncing to user: ${userId}`);

      // Upsert call for this user
      const { error: callError } = await supabase
        .from('fathom_calls')
        .upsert({
          recording_id: meeting.recording_id,
          user_id: userId,
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
          synced_at: new Date().toISOString(),
        }, {
          onConflict: 'recording_id,user_id'  // Composite primary key
        });

      if (callError) {
        console.error(`Error upserting call for user ${userId}:`, callError);
        // Continue to other users even if one fails
        continue;
      }

      console.log(`   ✅ Synced call to user ${userId}`);

      // Insert transcript segments for this user
      if (meeting.transcript && meeting.transcript.length > 0) {
        // Delete existing transcripts for this user's copy
        await supabase
          .from('fathom_transcripts')
          .delete()
          .eq('recording_id', meeting.recording_id)
          .eq('user_id', userId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const transcriptRows = meeting.transcript.map((segment: any) => {
          // Try to get email from transcript match first, then from calendar invitees
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
            user_id: userId,  // Include user_id for composite FK
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
          console.error(`Error inserting transcripts for user ${userId}:`, transcriptError);
          // Continue to other users even if transcripts fail
          continue;
        }

        console.log(`   ✅ Inserted ${transcriptRows.length} transcript segments for user ${userId}`);
      }
    }

    console.log(`✅ Successfully synced meeting ${meeting.recording_id} to ${syncedUserIds.length} user(s)`);
    return syncedUserIds;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let meeting: any;
  let userId: string | null = null;
  
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

    // ==========================================================================
    // PARALLEL VERIFICATION TEST - Try ALL methods and log results
    // ==========================================================================
    const verificationResults: Record<string, {available: boolean; verified: boolean; secret_preview?: string}> = {
      personal_by_email: { available: false, verified: false },
      oauth_app_secret: { available: false, verified: false },
      first_user_fallback: { available: false, verified: false }
    };

    let matchedUserId = null;
    let successfulMethod: string | null = null;

    // Get all potential secrets
    const oauthAppSecret = Deno.env.get('FATHOM_OAUTH_WEBHOOK_SECRET');
    let personalSecret: string | null = null;
    let personalUserId: string | null = null;
    let firstUserSecret: string | null = null;
    let firstUserId: string | null = null;

    // 1. Check personal secret by email match
    if (meeting.recorded_by?.email) {
      const { data: settings } = await supabase
        .from('user_settings')
        .select('webhook_secret, user_id')
        .eq('host_email', meeting.recorded_by.email)
        .maybeSingle();

      if (settings?.webhook_secret) {
        personalSecret = settings.webhook_secret;
        personalUserId = settings.user_id;
        verificationResults.personal_by_email.available = true;
        verificationResults.personal_by_email.secret_preview = personalSecret.substring(0, 15) + '...';
      }
    }

    // 2. Check OAuth app secret
    if (oauthAppSecret) {
      verificationResults.oauth_app_secret.available = true;
      verificationResults.oauth_app_secret.secret_preview = oauthAppSecret.substring(0, 15) + '...';
    }

    // 3. Check first user fallback
    const { data: firstSettings } = await supabase
      .from('user_settings')
      .select('webhook_secret, user_id')
      .limit(1)
      .maybeSingle();

    if (firstSettings?.webhook_secret) {
      firstUserSecret = firstSettings.webhook_secret;
      firstUserId = firstSettings.user_id;
      verificationResults.first_user_fallback.available = true;
      verificationResults.first_user_fallback.secret_preview = firstUserSecret.substring(0, 15) + '...';
    }

    console.log('📋 VERIFICATION TEST - Available secrets:');
    console.log('   - Personal (email match):', verificationResults.personal_by_email.available ? `YES (${verificationResults.personal_by_email.secret_preview})` : 'NO');
    console.log('   - OAuth app secret:', verificationResults.oauth_app_secret.available ? `YES (${verificationResults.oauth_app_secret.secret_preview})` : 'NO');
    console.log('   - First user fallback:', verificationResults.first_user_fallback.available ? `YES (${verificationResults.first_user_fallback.secret_preview})` : 'NO');

    // Now verify with EACH available secret
    console.log('\n🔐 VERIFICATION TEST - Testing each secret:');

    // Test 1: Personal secret by email
    if (personalSecret) {
      console.log('\n--- Testing PERSONAL secret (email match) ---');
      const personalValid = await verifyWebhookSignature(personalSecret, req.headers, rawBody);
      verificationResults.personal_by_email.verified = personalValid;
      console.log(`   Result: ${personalValid ? '✅ VERIFIED' : '❌ FAILED'}`);
      if (personalValid && !successfulMethod) {
        successfulMethod = 'personal_by_email';
        matchedUserId = personalUserId;
      }
    }

    // Test 2: OAuth app secret
    if (oauthAppSecret) {
      console.log('\n--- Testing OAUTH APP secret ---');
      const oauthValid = await verifyWebhookSignature(oauthAppSecret, req.headers, rawBody);
      verificationResults.oauth_app_secret.verified = oauthValid;
      console.log(`   Result: ${oauthValid ? '✅ VERIFIED' : '❌ FAILED'}`);
      if (oauthValid && !successfulMethod) {
        successfulMethod = 'oauth_app_secret';
        // For OAuth, still need to find user by email
        if (meeting.recorded_by?.email) {
          const { data: userByEmail } = await supabase
            .from('user_settings')
            .select('user_id')
            .eq('host_email', meeting.recorded_by.email)
            .maybeSingle();
          matchedUserId = userByEmail?.user_id || firstUserId;
        } else {
          matchedUserId = firstUserId;
        }
      }
    }

    // Test 3: First user fallback (only if different from personal)
    if (firstUserSecret && firstUserSecret !== personalSecret) {
      console.log('\n--- Testing FIRST USER FALLBACK secret ---');
      const fallbackValid = await verifyWebhookSignature(firstUserSecret, req.headers, rawBody);
      verificationResults.first_user_fallback.verified = fallbackValid;
      console.log(`   Result: ${fallbackValid ? '✅ VERIFIED' : '❌ FAILED'}`);
      if (fallbackValid && !successfulMethod) {
        successfulMethod = 'first_user_fallback';
        matchedUserId = firstUserId;
      }
    } else if (firstUserSecret === personalSecret) {
      // Same as personal, copy result
      verificationResults.first_user_fallback.verified = verificationResults.personal_by_email.verified;
      console.log('\n--- FIRST USER FALLBACK: Same as personal secret, skipping ---');
    }

    // Summary
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log(JSON.stringify(verificationResults, null, 2));
    console.log(`\n🎯 Successful method: ${successfulMethod || 'NONE'}`);

    const isValid = successfulMethod !== null;
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
      console.error('❌ Webhook signature verification FAILED - NO METHOD WORKED');
      console.error('   - Webhook ID:', req.headers.get('webhook-id'));
      console.error('   - Signature Header:', req.headers.get('webhook-signature'));
      const errorMessage = `Invalid webhook signature - all methods failed. Results: ${JSON.stringify(verificationResults)}`;

      // Log failed delivery WITH verification results
      const logUserId = userId || firstUserId;
      if (logUserId) {
        await supabase.from('webhook_deliveries').insert({
          user_id: logUserId,
          webhook_id: req.headers.get('webhook-id') || req.headers.get('svix-id') || 'unknown',
          recording_id: meeting.recording_id,
          status: 'failed',
          error_message: errorMessage,
          request_headers: Object.fromEntries(req.headers.entries()),
          request_body: meeting,
          signature_valid: false,
          payload: { verification_results: verificationResults }
        });
      }

      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          verification_results: verificationResults,
          hint: 'Check logs for which secrets were tested and their results'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Webhook signature verified successfully using method: ${successfulMethod}`);

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

        const syncedUserIds = await processMeetingWebhook(meeting, supabase);

        // Mark webhook as processed
        await supabase
          .from('processed_webhooks')
          .insert({
            webhook_id: webhookId,
            processed_at: new Date().toISOString(),
          });

        // Trigger embedding generation for the synced meeting
        // This ensures webhook-synced calls also get embeddings like manually synced ones
        console.log(`🧠 Triggering embedding generation for meeting ${meeting.recording_id}...`);
        try {
          const { error: embedError } = await supabase.functions.invoke('embed-chunks', {
            body: { recording_ids: [meeting.recording_id] },
          });
          if (embedError) {
            console.error('Embedding generation failed:', embedError);
          } else {
            console.log('✅ Embedding generation triggered successfully');
          }
        } catch (embedErr) {
          console.error('Failed to invoke embed-chunks:', embedErr);
        }

        // Trigger AI title generation
        console.log(`🏷️ Triggering AI title generation for meeting ${meeting.recording_id}...`);
        try {
          const { error: titleError } = await supabase.functions.invoke('generate-ai-titles', {
            body: { recordingIds: [meeting.recording_id] },
          });
          if (titleError) {
            console.error('AI title generation failed:', titleError);
          } else {
            console.log('✅ AI title generation triggered successfully');
          }
        } catch (titleErr) {
          console.error('Failed to invoke generate-ai-titles:', titleErr);
        }

        // Log successful delivery WITH verification results
        if (userId) {
          await supabase.from('webhook_deliveries').insert({
            user_id: userId,
            webhook_id: webhookId,
            recording_id: meeting.recording_id,
            status: 'success',
            request_headers: Object.fromEntries(req.headers.entries()),
            request_body: meeting,
            signature_valid: true,
            payload: {
              verification_results: verificationResults,
              successful_method: successfulMethod,
              synced_user_ids: syncedUserIds,
              synced_user_count: syncedUserIds.length
            }
          });
        }

        console.log(`✅ Webhook processing complete: ${webhookId} (synced to ${syncedUserIds.length} user(s))`);
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
