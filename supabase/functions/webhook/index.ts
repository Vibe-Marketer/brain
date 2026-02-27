import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

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

  return expected === xSignature;
}

// Fathom simple signature verification (per Fathom docs: HMAC-SHA256 of body with secret)
// This is what Fathom docs show, but it may send webhook-signature header with v1, prefix
async function verifyFathomSimpleSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const signatureHeader = headers.get('webhook-signature');
  if (!signatureHeader) {
    return false;
  }

  console.log('Verifying Fathom simple signature (body only, no id.timestamp)');

  // Extract signature(s) from header (format: "v1,signature" or space separated list)
  const signatures = signatureHeader.split(' ').map(s => {
    if (s.startsWith('v1,')) return s.substring(3);
    return s; // Fallback for raw signature
  });

  // Per Fathom docs: Use the secret directly to HMAC the raw body
  // The secret is the full whsec_XXXX string used as-is
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  const messageData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const computed = btoa(String.fromCharCode(...new Uint8Array(signature)));

  if (signatures.includes(computed)) {
    return true;
  }

  // Also try with just the base64 part of the secret (after whsec_) as UTF-8 string
  if (secret.startsWith('whsec_')) {
    const secretPart = secret.substring(6);
    const secretBytes2 = encoder.encode(secretPart);

    const cryptoKey2 = await crypto.subtle.importKey(
      'raw',
      secretBytes2,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature2 = await crypto.subtle.sign('HMAC', cryptoKey2, messageData);
    const computed2 = btoa(String.fromCharCode(...new Uint8Array(signature2)));

    if (signatures.includes(computed2)) {
      return true;
    }

    // CRITICAL: Also try BASE64 DECODING the secret part (like Svix format)
    // This is likely the correct format: secret is base64-encoded bytes after whsec_
    // but we HMAC just the body (not id.timestamp.body like Svix)
    try {
      const decodedSecretBytes = Uint8Array.from(atob(secretPart), c => c.charCodeAt(0));

      const cryptoKey3 = await crypto.subtle.importKey(
        'raw',
        decodedSecretBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature3 = await crypto.subtle.sign('HMAC', cryptoKey3, messageData);
      const computed3 = btoa(String.fromCharCode(...new Uint8Array(signature3)));

      if (signatures.includes(computed3)) {
        return true;
      }
    } catch {
      // Failed to decode secret - log without error details to avoid potential secret exposure
      console.log('Failed to base64 decode secret part');
    }
  }

  return false;
}

// Sanitize headers for safe storage - removes sensitive values (OWASP A09:2021)
function sanitizeHeadersForStorage(headers: Headers): Record<string, string> {
  const sensitiveHeaders = new Set([
    'webhook-signature',
    'x-signature',
    'authorization',
    'x-api-key',
    'cookie'
  ]);

  const sanitized: Record<string, string> = {};
  for (const [key, value] of headers.entries()) {
    if (sensitiveHeaders.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
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

  const signatures = signatureBlock.split(' ');
  return signatures.includes(expected);
}

// Main verification function that tries all methods
// Helper to verify webhook signature (computedSignature removed for security - OWASP A09:2021)
async function verifyWebhookSignatureWithDebug(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<{ isValid: boolean; computedSignature: string | null }> {
  if (headers.get('x-signature')) {
    const valid = await verifyFathomSignature(secret, headers, rawBody);
    if (valid) return { isValid: true, computedSignature: null };
  }

  if (headers.get('webhook-signature')) {
    const valid = await verifyFathomSimpleSignature(secret, headers, rawBody);
    if (valid) return { isValid: true, computedSignature: null };
  }

  if (headers.get('webhook-signature')) {
    const valid = await verifySvixSignature(secret, headers, rawBody);
    if (valid) return { isValid: true, computedSignature: null };
  }

  return { isValid: false, computedSignature: null };
}

async function verifyWebhookSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  const { isValid } = await verifyWebhookSignatureWithDebug(secret, headers, rawBody);
  return isValid;
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
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  // Log all incoming webhook requests for debugging
  console.log('=== WEBHOOK REQUEST RECEIVED ===');
  console.log('Request ID:', requestId);
  console.log('Timestamp:', timestamp);
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Safe header logging - only non-sensitive headers (OWASP A09:2021)
  // Log values for non-sensitive headers, indicate presence only for signature headers
  console.log('📋 Request Headers (safe subset):');
  console.log('   content-type:', req.headers.get('content-type') || 'not set');
  console.log('   webhook-id:', req.headers.get('webhook-id') || 'not set');
  console.log('   webhook-timestamp:', req.headers.get('webhook-timestamp') || 'not set');
  console.log('   webhook-signature:', req.headers.has('webhook-signature') ? '[PRESENT]' : '[NOT SET]');
  console.log('   x-signature:', req.headers.has('x-signature') ? '[PRESENT]' : '[NOT SET]');

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
    // VerificationResult stores only boolean flags - no secrets or signatures (OWASP A09:2021)
    interface VerificationResult {
      available: boolean;
      verified: boolean;
    }

    const verificationResults: {
      personal_by_email: VerificationResult;
      oauth_app_secret: VerificationResult;
      first_user_fallback: VerificationResult;
    } = {
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
      }
    }

    // 2. Check OAuth app secret
    if (oauthAppSecret) {
      verificationResults.oauth_app_secret.available = true;
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
    }

    // Safe logging: indicate availability without exposing any secret data (OWASP A09:2021)
    console.log('📋 Verification secrets availability:');
    console.log('   - Personal (email match): ' + (verificationResults.personal_by_email.available ? 'configured' : 'not configured'));
    console.log('   - OAuth app secret: ' + (verificationResults.oauth_app_secret.available ? 'configured' : 'not configured'));
    console.log('   - First user fallback: ' + (verificationResults.first_user_fallback.available ? 'configured' : 'not configured'));

    // Now verify with EACH available secret
    // Test 1: Personal secret by email
    if (personalSecret) {
      console.log('🔐 Testing verification method: personal_by_email');
      const { isValid } = await verifyWebhookSignatureWithDebug(personalSecret, req.headers, rawBody);
      verificationResults.personal_by_email.verified = isValid;
      console.log(`   Verification method personal_by_email: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      if (isValid && !successfulMethod) {
        successfulMethod = 'personal_by_email';
        matchedUserId = personalUserId;
      }
    }

    // Test 2: OAuth app secret
    if (oauthAppSecret) {
      console.log('🔐 Testing verification method: oauth_app_secret');
      const { isValid } = await verifyWebhookSignatureWithDebug(oauthAppSecret, req.headers, rawBody);
      verificationResults.oauth_app_secret.verified = isValid;
      console.log(`   Verification method oauth_app_secret: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      if (isValid && !successfulMethod) {
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
      console.log('🔐 Testing verification method: first_user_fallback');
      const { isValid } = await verifyWebhookSignatureWithDebug(firstUserSecret, req.headers, rawBody);
      verificationResults.first_user_fallback.verified = isValid;
      console.log(`   Verification method first_user_fallback: ${isValid ? 'SUCCESS' : 'FAILED'}`);
      if (isValid && !successfulMethod) {
        successfulMethod = 'first_user_fallback';
        matchedUserId = firstUserId;
      }
    } else if (firstUserSecret === personalSecret) {
      // Same as personal, copy result
      verificationResults.first_user_fallback.verified = verificationResults.personal_by_email.verified;
      console.log('   Verification method first_user_fallback: SKIPPED (same as personal)');
    }

    // Summary - log verification status only, no secrets or debug info (OWASP A09:2021)
    console.log('\n📊 VERIFICATION SUMMARY:');
    console.log(`   - Personal (email match): available=${verificationResults.personal_by_email.available}, verified=${verificationResults.personal_by_email.verified}`);
    console.log(`   - OAuth app secret: available=${verificationResults.oauth_app_secret.available}, verified=${verificationResults.oauth_app_secret.verified}`);
    console.log(`   - First user fallback: available=${verificationResults.first_user_fallback.available}, verified=${verificationResults.first_user_fallback.verified}`);
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
      console.error('   - Signature Header:', req.headers.has('webhook-signature') ? '[PRESENT]' : '[NOT SET]');
      const errorMessage = `Invalid webhook signature - all verification methods failed`;

      // Log failed delivery WITH sanitized verification results
      // Only store boolean flags - no secrets, previews, or signatures (OWASP A09:2021)
      const logUserId = userId || firstUserId;
      if (logUserId) {
        const sanitizedVerificationResults = {
          personal_by_email: { available: verificationResults.personal_by_email.available, verified: verificationResults.personal_by_email.verified },
          oauth_app_secret: { available: verificationResults.oauth_app_secret.available, verified: verificationResults.oauth_app_secret.verified },
          first_user_fallback: { available: verificationResults.first_user_fallback.available, verified: verificationResults.first_user_fallback.verified }
        };

        await supabase.from('webhook_deliveries').insert({
          user_id: logUserId,
          webhook_id: req.headers.get('webhook-id') || req.headers.get('svix-id') || 'unknown',
          recording_id: meeting.recording_id,
          status: 'failed',
          error_message: errorMessage,
          request_headers: sanitizeHeadersForStorage(req.headers),
          request_body: meeting,
          signature_valid: false,
          payload: {
            verification_results: sanitizedVerificationResults
          }
        });
      }

      return new Response(
        JSON.stringify({
          error: 'Invalid signature'
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
          request_headers: sanitizeHeadersForStorage(req.headers),
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

        // [DISABLED] Embedding system disabled — pipeline broken
        // // Trigger embedding generation for the synced meeting
        // // This ensures webhook-synced calls also get embeddings like manually synced ones
        // console.log(`🧠 Triggering embedding generation for meeting ${meeting.recording_id}...`);
        // try {
        //   const { error: embedError } = await supabase.functions.invoke('embed-chunks', {
        //     body: { recording_ids: [meeting.recording_id] },
        //   });
        //   if (embedError) {
        //     console.error('Embedding generation failed:', embedError);
        //   } else {
        //     console.log('✅ Embedding generation triggered successfully');
        //   }
        // } catch (embedErr) {
        //   console.error('Failed to invoke embed-chunks:', embedErr);
        // }

        // Trigger AI title generation for each synced user
        console.log(`🏷️ Triggering AI title generation for meeting ${meeting.recording_id}...`);
        for (const syncedUserId of syncedUserIds) {
          try {
            const { error: titleError } = await supabase.functions.invoke('generate-ai-titles', {
              body: {
                recordingIds: [meeting.recording_id],
                user_id: syncedUserId  // Pass user_id for internal service call
              },
            });
            if (titleError) {
              console.error(`AI title generation failed for user ${syncedUserId}:`, titleError);
            } else {
              console.log(`✅ AI title generation triggered for user ${syncedUserId}`);
            }
          } catch (titleErr) {
            console.error(`Failed to invoke generate-ai-titles for user ${syncedUserId}:`, titleErr);
          }
        }

        // Log successful delivery WITH sanitized verification results
        // Only store boolean flags - no secrets, previews, or signatures (OWASP A09:2021)
        if (userId) {
          const sanitizedVerificationResults = {
            personal_by_email: { available: verificationResults.personal_by_email.available, verified: verificationResults.personal_by_email.verified },
            oauth_app_secret: { available: verificationResults.oauth_app_secret.available, verified: verificationResults.oauth_app_secret.verified },
            first_user_fallback: { available: verificationResults.first_user_fallback.available, verified: verificationResults.first_user_fallback.verified }
          };

          await supabase.from('webhook_deliveries').insert({
            user_id: userId,
            webhook_id: webhookId,
            recording_id: meeting.recording_id,
            status: 'success',
            request_headers: sanitizeHeadersForStorage(req.headers),
            request_body: meeting,
            signature_valid: true,
            payload: {
              verification_results: sanitizedVerificationResults,
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
            request_headers: sanitizeHeadersForStorage(req.headers),
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
