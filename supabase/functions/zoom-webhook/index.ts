import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ZoomClient } from '../_shared/zoom-client.ts';
import { parseVTTWithMetadata, consolidateBySpeaker, TranscriptSegment } from '../_shared/vtt-parser.ts';
import {
  generateFingerprint,
  generateFingerprintString,
  checkMatch,
  MeetingFingerprint,
  MatchResult,
} from '../_shared/dedup-fingerprint.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp',
};

/**
 * Zoom webhook signature verification.
 * Per Zoom docs: HMAC-SHA256 of "v0:{timestamp}:{body}" with webhook secret token.
 * IMPORTANT: Zoom uses HEX encoding, not base64 (unlike Fathom/Svix).
 */
async function verifyZoomSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  const message = `v0:${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));

  // Convert to hex string (Zoom uses hex, not base64)
  const hashHex = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const expected = `v0=${hashHex}`;

  return expected === signature;
}

/**
 * Generates the encrypted token for Zoom URL verification challenge.
 * Per Zoom docs: HMAC-SHA256 of plainToken with webhook secret, hex encoded.
 */
async function generateChallengeResponse(
  plainToken: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(plainToken));

  // Convert to hex string
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Types for deduplication priority modes.
 */
type DedupPriorityMode = 'first_synced' | 'most_recent' | 'platform_hierarchy' | 'longest_transcript';

/**
 * Represents an existing meeting that could be a duplicate.
 */
interface ExistingMeeting {
  id: number;
  recording_id: string;
  title: string;
  recording_start_time: string;
  recording_end_time: string | null;
  recorded_by_email: string | null;
  calendar_invitees: string[] | null;
  source_platform: string | null;
  is_primary: boolean;
  merged_from: number[] | null;
  full_transcript: string | null;
  synced_at: string | null;
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

interface ZoomWebhookPayload {
  event: string;
  event_ts: number;
  payload: {
    account_id: string;
    object: {
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
      password?: string;
    };
  };
}

interface ZoomUrlValidationPayload {
  event: string;
  payload: {
    plainToken: string;
  };
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
 * Reconstructs a MeetingFingerprint from an existing meeting's stored data.
 */
async function reconstructFingerprint(meeting: ExistingMeeting): Promise<MeetingFingerprint> {
  const startTime = new Date(meeting.recording_start_time);
  const endTime = meeting.recording_end_time
    ? new Date(meeting.recording_end_time)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

  const participants: string[] = [];
  if (meeting.recorded_by_email) {
    participants.push(meeting.recorded_by_email);
  }
  if (meeting.calendar_invitees && Array.isArray(meeting.calendar_invitees)) {
    for (const invitee of meeting.calendar_invitees) {
      if (typeof invitee === 'string') {
        participants.push(invitee);
      } else if (invitee && typeof invitee === 'object' && 'email' in invitee) {
        participants.push((invitee as { email: string }).email);
      }
    }
  }

  return await generateFingerprint({
    title: meeting.title,
    start_time: startTime,
    duration_minutes: durationMinutes,
    participants,
  });
}

/**
 * Finds potential duplicate meetings in the database.
 */
async function findPotentialDuplicates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  newFingerprint: MeetingFingerprint,
  excludeRecordingId: string
): Promise<{ meeting: ExistingMeeting; matchResult: MatchResult }[]> {
  const timeBucket = new Date(newFingerprint.start_time_bucket);
  const timeWindowStart = new Date(timeBucket.getTime() - 24 * 60 * 60 * 1000);
  const timeWindowEnd = new Date(timeBucket.getTime() + 24 * 60 * 60 * 1000);

  const { data: potentialMatches, error } = await supabase
    .from('fathom_calls')
    .select(`
      id,
      recording_id,
      title,
      recording_start_time,
      recording_end_time,
      recorded_by_email,
      calendar_invitees,
      source_platform,
      is_primary,
      merged_from,
      full_transcript,
      synced_at
    `)
    .eq('user_id', userId)
    .neq('recording_id', excludeRecordingId)
    .gte('recording_start_time', timeWindowStart.toISOString())
    .lte('recording_start_time', timeWindowEnd.toISOString());

  if (error) {
    console.error('Error querying potential duplicates:', error);
    return [];
  }

  if (!potentialMatches || potentialMatches.length === 0) {
    return [];
  }

  const duplicates: { meeting: ExistingMeeting; matchResult: MatchResult }[] = [];

  for (const meeting of potentialMatches as ExistingMeeting[]) {
    try {
      const existingFingerprint = await reconstructFingerprint(meeting);
      const matchResult = checkMatch(newFingerprint, existingFingerprint);

      if (matchResult.is_match) {
        duplicates.push({ meeting, matchResult });
      }
    } catch (err) {
      console.error(`Error checking match for meeting ${meeting.id}:`, err);
    }
  }

  duplicates.sort((a, b) => b.matchResult.score - a.matchResult.score);

  return duplicates;
}

/**
 * Determines which meeting should be the primary based on user's priority mode.
 */
function shouldNewMeetingBePrimary(
  newMeeting: {
    source_platform: string;
    synced_at: Date;
    transcript_length: number;
  },
  existingMeeting: ExistingMeeting,
  priorityMode: DedupPriorityMode,
  platformOrder: string[]
): boolean {
  switch (priorityMode) {
    case 'first_synced': {
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    case 'most_recent': {
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at > existingSyncedAt;
    }

    case 'platform_hierarchy': {
      const newPlatformIndex = platformOrder.indexOf(newMeeting.source_platform);
      const existingPlatformIndex = platformOrder.indexOf(existingMeeting.source_platform || 'fathom');

      const newIndex = newPlatformIndex === -1 ? platformOrder.length : newPlatformIndex;
      const existingIndex = existingPlatformIndex === -1 ? platformOrder.length : existingPlatformIndex;

      if (newIndex !== existingIndex) {
        return newIndex < existingIndex;
      }
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    case 'longest_transcript': {
      const existingLength = existingMeeting.full_transcript?.length || 0;
      if (newMeeting.transcript_length !== existingLength) {
        return newMeeting.transcript_length > existingLength;
      }
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    default:
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
  }
}

/**
 * Handles deduplication merge when a duplicate is found.
 */
async function handleDuplicateMerge(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  newMeetingData: {
    source_platform: string;
    synced_at: Date;
    transcript_length: number;
  },
  duplicateMatch: { meeting: ExistingMeeting; matchResult: MatchResult },
  priorityMode: DedupPriorityMode,
  platformOrder: string[]
): Promise<{ primaryId: number | null; isPrimaryNew: boolean }> {
  const { meeting: existingMeeting, matchResult } = duplicateMatch;

  const newShouldBePrimary = shouldNewMeetingBePrimary(
    newMeetingData,
    existingMeeting,
    priorityMode,
    platformOrder
  );

  console.log(`Deduplication: Found duplicate match (score: ${matchResult.score.toFixed(2)})`);
  console.log(`  Criteria met - Title: ${matchResult.criteria_met.title}, Time: ${matchResult.criteria_met.time}, Participants: ${matchResult.criteria_met.participants}`);
  console.log(`  Priority mode: ${priorityMode}, New meeting is primary: ${newShouldBePrimary}`);

  if (newShouldBePrimary) {
    await supabase
      .from('fathom_calls')
      .update({
        is_primary: false,
        fuzzy_match_score: matchResult.score,
      })
      .eq('id', existingMeeting.id)
      .eq('user_id', userId);

    return {
      primaryId: existingMeeting.id,
      isPrimaryNew: true,
    };
  } else {
    await supabase
      .from('fathom_calls')
      .update({
        fuzzy_match_score: matchResult.score,
      })
      .eq('id', existingMeeting.id)
      .eq('user_id', userId);

    return {
      primaryId: existingMeeting.id,
      isPrimaryNew: false,
    };
  }
}

/**
 * Updates the merged_from array on the primary meeting after a merge.
 */
async function updateMergedFrom(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  primaryMeetingId: number,
  secondaryMeetingId: number,
  userId: string
): Promise<void> {
  const { data: primaryMeeting } = await supabase
    .from('fathom_calls')
    .select('merged_from')
    .eq('id', primaryMeetingId)
    .eq('user_id', userId)
    .single();

  const currentMergedFrom = primaryMeeting?.merged_from || [];

  if (!currentMergedFrom.includes(secondaryMeetingId)) {
    const updatedMergedFrom = [...currentMergedFrom, secondaryMeetingId];

    await supabase
      .from('fathom_calls')
      .update({ merged_from: updatedMergedFrom })
      .eq('id', primaryMeetingId)
      .eq('user_id', userId);
  }
}

/**
 * Processes a Zoom recording.transcript_completed webhook event.
 * Syncs the meeting to all users with matching host_email.
 */
async function processZoomWebhook(
  payload: ZoomWebhookPayload,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<string[]> {
  const recording = payload.payload.object;
  const recordingId = recording.uuid; // Use UUID not meeting_id (PMI reuse issue)
  const hostEmail = recording.host_email;

  console.log(`Processing Zoom webhook for recording: ${recordingId} (${recording.topic})`);

  // Find ALL users with matching host_email (team support)
  const { data: userSettings, error: lookupError } = await supabase
    .from('user_settings')
    .select('user_id, zoom_oauth_access_token, zoom_oauth_token_expires, zoom_oauth_refresh_token, dedup_priority_mode, dedup_platform_order')
    .eq('host_email', hostEmail);

  if (lookupError) {
    console.error('Error looking up users by host_email:', lookupError);
    throw lookupError;
  }

  if (!userSettings || userSettings.length === 0) {
    console.error(`CRITICAL: No users found with host_email "${hostEmail}" for Zoom recording ${recordingId}`);
    throw new Error(`No users found with host_email "${hostEmail}". Configure your Zoom email in Settings.`);
  }

  console.log(`Found ${userSettings.length} user(s) with host_email "${hostEmail}"`);

  const syncedUserIds: string[] = [];

  for (const settings of userSettings) {
    const userId = settings.user_id;

    try {
      // Check if we have a valid access token
      if (!settings.zoom_oauth_access_token) {
        console.error(`User ${userId} has no Zoom OAuth token`);
        continue;
      }

      // Use the access token (auto-refresh would happen during manual sync, not webhook)
      const accessToken = settings.zoom_oauth_access_token;

      // Extract deduplication settings
      const dedupSettings = {
        priorityMode: (settings.dedup_priority_mode || 'first_synced') as DedupPriorityMode,
        platformOrder: (settings.dedup_platform_order || []) as string[],
      };

      // Find transcript file
      const transcriptFile = recording.recording_files?.find(
        file => file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
      );

      let fullTranscript = '';
      const transcriptSegments: TranscriptSegment[] = [];

      if (transcriptFile?.download_url) {
        console.log(`Downloading transcript for Zoom meeting ${recordingId}...`);
        const vttContent = await fetchZoomTranscript(transcriptFile.download_url, accessToken);

        if (vttContent) {
          const parsed = parseVTTWithMetadata(vttContent);
          const consolidated = consolidateBySpeaker(parsed.segments);

          const consolidatedSegments: string[] = [];
          for (const seg of consolidated) {
            const speaker = seg.speaker || 'Unknown';
            const timestamp = seg.start_time.split('.')[0] || '00:00:00';
            consolidatedSegments.push(`[${timestamp}] ${speaker}: ${seg.text}`);
          }

          fullTranscript = consolidatedSegments.join('\n\n');
          transcriptSegments.push(...parsed.segments);

          console.log(`Parsed ${parsed.segments.length} transcript segments for Zoom meeting ${recordingId}`);
        }
      } else {
        console.log(`No transcript file available for Zoom meeting ${recordingId}`);
      }

      // Calculate meeting times
      const startTime = new Date(recording.start_time);
      const endTime = new Date(startTime.getTime() + (recording.duration * 60 * 1000));

      // Generate fingerprint for deduplication
      const fingerprint = await generateFingerprint({
        title: recording.topic,
        start_time: startTime,
        duration_minutes: recording.duration,
        participants: [hostEmail],
      });
      const fingerprintString = generateFingerprintString(fingerprint);

      // Deduplication logic
      const syncedAt = new Date();
      let isPrimary = true;
      let mergedFromIds: number[] = [];
      let fuzzyMatchScore: number | null = null;
      let primaryMeetingId: number | null = null;

      const duplicates = await findPotentialDuplicates(supabase, userId, fingerprint, recordingId);

      if (duplicates.length > 0) {
        const bestMatch = duplicates[0];

        const mergeResult = await handleDuplicateMerge(
          supabase,
          userId,
          {
            source_platform: 'zoom',
            synced_at: syncedAt,
            transcript_length: fullTranscript.length,
          },
          bestMatch,
          dedupSettings.priorityMode,
          dedupSettings.platformOrder
        );

        if (mergeResult.isPrimaryNew) {
          isPrimary = true;
          mergedFromIds = [bestMatch.meeting.id];
          if (bestMatch.meeting.merged_from) {
            mergedFromIds = [...mergedFromIds, ...bestMatch.meeting.merged_from];
          }
          fuzzyMatchScore = bestMatch.matchResult.score;
        } else {
          isPrimary = false;
          primaryMeetingId = mergeResult.primaryId;
          fuzzyMatchScore = bestMatch.matchResult.score;
        }
      }

      // Check if call exists and has user edits
      const { data: existingCall } = await supabase
        .from('fathom_calls')
        .select('recording_id, title, summary, title_edited_by_user, summary_edited_by_user')
        .eq('recording_id', recordingId)
        .eq('user_id', userId)
        .maybeSingle();

      // Build upsert data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upsertData: any = {
        recording_id: recordingId,
        user_id: userId,
        created_at: recording.start_time,
        recording_start_time: recording.start_time,
        recording_end_time: endTime.toISOString(),
        url: recording.share_url || null,
        share_url: recording.share_url || null,
        calendar_invitees: [],
        full_transcript: fullTranscript,
        recorded_by_name: null,
        recorded_by_email: hostEmail,
        synced_at: syncedAt.toISOString(),
        source_platform: 'zoom',
        meeting_fingerprint: fingerprintString,
        is_primary: isPrimary,
        merged_from: mergedFromIds.length > 0 ? mergedFromIds : null,
        fuzzy_match_score: fuzzyMatchScore,
      };

      // Preserve user edits
      if (!existingCall?.title_edited_by_user) {
        upsertData.title = recording.topic;
      } else {
        upsertData.title = existingCall.title;
        upsertData.title_edited_by_user = true;
      }

      if (existingCall?.summary_edited_by_user) {
        upsertData.summary = existingCall.summary;
        upsertData.summary_edited_by_user = true;
      }

      // Upsert call
      const { data: insertedCall, error: callError } = await supabase
        .from('fathom_calls')
        .upsert(upsertData, {
          onConflict: 'recording_id,user_id'
        })
        .select('id')
        .single();

      if (callError) {
        console.error(`Error upserting Zoom call ${recordingId} for user ${userId}:`, callError);
        continue;
      }

      console.log(`Synced Zoom call to user ${userId}`);

      // Update merged_from if this meeting is secondary
      if (!isPrimary && primaryMeetingId && insertedCall?.id) {
        await updateMergedFrom(supabase, primaryMeetingId, insertedCall.id, userId);
        console.log(`Deduplication: Added meeting ${insertedCall.id} to merged_from of primary meeting ${primaryMeetingId}`);
      }

      // Insert transcript segments
      if (transcriptSegments.length > 0) {
        await supabase
          .from('fathom_transcripts')
          .delete()
          .eq('recording_id', recordingId)
          .eq('user_id', userId);

        const transcriptRows = transcriptSegments.map((segment: TranscriptSegment) => ({
          recording_id: recordingId,
          user_id: userId,
          speaker_name: segment.speaker || 'Unknown',
          speaker_email: null,
          text: segment.text,
          timestamp: segment.start_time,
        }));

        const { error: transcriptError } = await supabase
          .from('fathom_transcripts')
          .insert(transcriptRows);

        if (transcriptError) {
          console.error(`Error inserting transcripts for user ${userId}:`, transcriptError);
        } else {
          console.log(`Inserted ${transcriptRows.length} transcript segments for user ${userId}`);
        }
      }

      syncedUserIds.push(userId);
    } catch (error) {
      console.error(`Error processing Zoom webhook for user ${userId}:`, error);
    }
  }

  return syncedUserIds;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  console.log('=== ZOOM WEBHOOK REQUEST RECEIVED ===');
  console.log('Request ID:', requestId);
  console.log('Timestamp:', timestamp);
  console.log('Method:', req.method);
  console.log('URL:', req.url);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle health check
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'online',
        message: 'Zoom webhook endpoint is ready',
        timestamp,
        requestId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const webhookSecretToken = Deno.env.get('ZOOM_WEBHOOK_SECRET_TOKEN');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    console.log('Raw body length:', rawBody.length);

    // Parse the payload first (needed for URL validation check)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error('Failed to parse webhook payload');
      return new Response(
        JSON.stringify({ error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle Zoom URL verification challenge
    // This happens during webhook endpoint registration
    if (payload.event === 'endpoint.url_validation') {
      console.log('Handling Zoom URL validation challenge');

      if (!webhookSecretToken) {
        console.error('ZOOM_WEBHOOK_SECRET_TOKEN not configured');
        return new Response(
          JSON.stringify({ error: 'Webhook secret not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validationPayload = payload as ZoomUrlValidationPayload;
      const plainToken = validationPayload.payload.plainToken;
      const encryptedToken = await generateChallengeResponse(plainToken, webhookSecretToken);

      console.log('URL validation challenge successful');
      return new Response(
        JSON.stringify({
          plainToken,
          encryptedToken,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For all other events, verify the webhook signature
    const signature = req.headers.get('x-zm-signature');
    const requestTimestamp = req.headers.get('x-zm-request-timestamp');

    console.log('Signature header:', signature ? `${signature.substring(0, 20)}...` : 'missing');
    console.log('Timestamp header:', requestTimestamp);

    if (!signature || !requestTimestamp) {
      console.error('Missing required headers: x-zm-signature or x-zm-request-timestamp');
      return new Response(
        JSON.stringify({ error: 'Missing required webhook headers' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!webhookSecretToken) {
      console.error('ZOOM_WEBHOOK_SECRET_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    const isValid = await verifyZoomSignature(
      webhookSecretToken,
      requestTimestamp,
      rawBody,
      signature
    );

    if (!isValid) {
      console.error('Zoom webhook signature verification failed');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Zoom webhook signature verified successfully');

    // Generate a webhook ID for idempotency (Zoom doesn't provide one in the same way)
    const webhookId = `zoom_${payload.event}_${payload.event_ts}_${payload.payload?.object?.uuid || requestId}`;
    console.log('Webhook ID:', webhookId);

    // Check if webhook already processed (idempotency)
    const { data: existing } = await supabase
      .from('processed_webhooks')
      .select('webhook_id')
      .eq('webhook_id', webhookId)
      .maybeSingle();

    if (existing) {
      console.log('Zoom webhook already processed:', webhookId);
      return new Response(
        JSON.stringify({ status: 'already_processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only process recording.transcript_completed events
    if (payload.event !== 'recording.transcript_completed') {
      console.log(`Ignoring Zoom webhook event: ${payload.event}`);
      return new Response(
        JSON.stringify({ status: 'ignored', event: payload.event }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing recording.transcript_completed event');

    // Acknowledge receipt immediately (Zoom requires response within 3 seconds)
    const response = new Response(
      JSON.stringify({
        status: 'received',
        webhookId,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    // Process webhook in background
    const processInBackground = async () => {
      try {
        console.log('Starting background processing for Zoom webhook:', webhookId);

        const syncedUserIds = await processZoomWebhook(payload as ZoomWebhookPayload, supabase);

        // Mark webhook as processed
        await supabase
          .from('processed_webhooks')
          .insert({
            webhook_id: webhookId,
            processed_at: new Date().toISOString(),
          });

        // Trigger embedding generation for synced meeting
        if (syncedUserIds.length > 0) {
          const recordingId = payload.payload.object.uuid;
          console.log(`Triggering embedding generation for Zoom meeting ${recordingId}...`);

          try {
            const { error: embedError } = await supabase.functions.invoke('embed-chunks', {
              body: { recording_ids: [recordingId] },
            });

            if (embedError) {
              console.error('Embedding generation failed:', embedError);
            } else {
              console.log('Embedding generation triggered successfully');
            }
          } catch (embedErr) {
            console.error('Failed to invoke embed-chunks:', embedErr);
          }

          // Trigger AI title generation for each synced user
          console.log(`Triggering AI title generation for Zoom meeting ${recordingId}...`);
          for (const userId of syncedUserIds) {
            try {
              const { error: titleError } = await supabase.functions.invoke('generate-ai-titles', {
                body: {
                  recordingIds: [recordingId],
                  user_id: userId
                },
              });

              if (titleError) {
                console.error(`AI title generation failed for user ${userId}:`, titleError);
              } else {
                console.log(`AI title generation triggered for user ${userId}`);
              }
            } catch (titleErr) {
              console.error(`Failed to invoke generate-ai-titles for user ${userId}:`, titleErr);
            }
          }
        }

        console.log(`Zoom webhook processing complete: ${webhookId} (synced to ${syncedUserIds.length} user(s))`);
      } catch (error) {
        console.error('Background processing failed for Zoom webhook:', webhookId, error);

        // Mark as failed for debugging
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
    };

    // Start background processing
    // @ts-expect-error - EdgeRuntime is available in Deno Deploy
    EdgeRuntime.waitUntil(processInBackground());

    return response;
  } catch (error) {
    console.error('Zoom webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
