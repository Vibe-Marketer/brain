import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { FathomClient } from '../_shared/fathom-client.ts';
import {
  generateFingerprint,
  generateFingerprintString,
  checkMatch,
  MeetingFingerprint,
  MatchResult,
} from '../_shared/dedup-fingerprint.ts';

/**
 * Types for deduplication priority modes.
 * Determines which meeting becomes the "primary" when duplicates are detected.
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
};

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
  excludeRecordingId: string | number
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
    .neq('recording_id', String(excludeRecordingId))
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

async function syncMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meeting: any,
  dedupSettings: {
    priorityMode: DedupPriorityMode;
    platformOrder: string[];
  }
): Promise<{ success: boolean; insertedId?: number }> {
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

    // Calculate meeting duration
    const startTime = meeting.recording_start_time ? new Date(meeting.recording_start_time) : new Date();
    const endTime = meeting.recording_end_time
      ? new Date(meeting.recording_end_time)
      : new Date(startTime.getTime() + 60 * 60 * 1000);
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

    // Collect participants for fingerprinting
    const participants: string[] = [];
    if (meeting.recorded_by?.email) {
      participants.push(meeting.recorded_by.email);
    }
    if (meeting.calendar_invitees && Array.isArray(meeting.calendar_invitees)) {
      for (const invitee of meeting.calendar_invitees) {
        if (typeof invitee === 'string') {
          participants.push(invitee);
        } else if (invitee && typeof invitee === 'object' && 'email' in invitee) {
          participants.push(invitee.email);
        }
      }
    }

    // Generate fingerprint for deduplication
    const fingerprint = await generateFingerprint({
      title: meeting.title,
      start_time: startTime,
      duration_minutes: durationMinutes,
      participants,
    });
    const fingerprintString = generateFingerprintString(fingerprint);

    // Deduplication: Find potential duplicates before inserting
    const syncedAt = new Date();
    let isPrimary = true;
    let mergedFromIds: number[] = [];
    let fuzzyMatchScore: number | null = null;
    let primaryMeetingId: number | null = null;

    const duplicates = await findPotentialDuplicates(supabase, userId, fingerprint, meeting.recording_id);

    if (duplicates.length > 0) {
      // Found a potential duplicate - handle the merge
      const bestMatch = duplicates[0]; // Already sorted by score

      const mergeResult = await handleDuplicateMerge(
        supabase,
        userId,
        {
          source_platform: 'fathom',
          synced_at: syncedAt,
          transcript_length: fullTranscript.length,
        },
        bestMatch,
        dedupSettings.priorityMode,
        dedupSettings.platformOrder
      );

      if (mergeResult.isPrimaryNew) {
        // This new meeting is primary - collect IDs of duplicates to add to merged_from
        isPrimary = true;
        mergedFromIds = [bestMatch.meeting.id];
        // Also include any previously merged IDs from the existing meeting
        if (bestMatch.meeting.merged_from) {
          mergedFromIds = [...mergedFromIds, ...bestMatch.meeting.merged_from];
        }
        fuzzyMatchScore = bestMatch.matchResult.score;
      } else {
        // Existing meeting remains primary - this new meeting is secondary
        isPrimary = false;
        primaryMeetingId = mergeResult.primaryId;
        fuzzyMatchScore = bestMatch.matchResult.score;
      }
    }

    // Check if call exists and has user edits (use composite key)
    const { data: existingCall } = await supabase
      .from('fathom_calls')
      .select('recording_id, title, summary, title_edited_by_user, summary_edited_by_user')
      .eq('recording_id', meeting.recording_id)
      .eq('user_id', userId)
      .maybeSingle();

    // Build upsert object, preserving user edits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      synced_at: syncedAt.toISOString(),
      source_platform: 'fathom',
      meeting_fingerprint: fingerprintString,
      is_primary: isPrimary,
      merged_from: mergedFromIds.length > 0 ? mergedFromIds : null,
      fuzzy_match_score: fuzzyMatchScore,
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

    // Upsert call details (use composite primary key)
    const { data: insertedCall, error: callError } = await supabase
      .from('fathom_calls')
      .upsert(upsertData, {
        onConflict: 'recording_id,user_id'
      })
      .select('id')
      .single();

    if (callError) {
      console.error(`Error upserting call ${recordingId}:`, callError);
      throw callError;
    }

    // If this meeting is secondary, update the primary meeting's merged_from array
    if (!isPrimary && primaryMeetingId && insertedCall?.id) {
      await updateMergedFrom(supabase, primaryMeetingId, insertedCall.id, userId);
      console.log(`Deduplication: Added meeting ${insertedCall.id} to merged_from of primary meeting ${primaryMeetingId}`);
    }

    // Delete existing transcripts and insert new ones (use composite key for user isolation)
    if (meeting.transcript && meeting.transcript.length > 0) {
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', recordingId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error(`Error deleting old transcripts for ${recordingId}:`, deleteError);
      }

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
          user_id: userId, // Include user_id for composite foreign key
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
    return { success: true, insertedId: insertedCall?.id };
  } catch (error) {
    console.error(`Failed to sync meeting ${recordingId}:`, error);
    return { success: false };
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

    // Get user's Fathom credentials (OAuth or API key) and deduplication settings
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('fathom_api_key, oauth_access_token, oauth_token_expires, oauth_refresh_token, dedup_priority_mode, dedup_platform_order')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.fathom_api_key && !settings?.oauth_access_token) {
      throw new Error('Fathom credentials not configured. Please add them in Settings.');
    }

    // Extract deduplication settings with defaults
    const dedupSettings = {
      priorityMode: (settings.dedup_priority_mode || 'first_synced') as DedupPriorityMode,
      platformOrder: (settings.dedup_platform_order || []) as string[],
    };

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
                  progress_current: synced.length + failed.length,
                  synced_ids: synced,
                  failed_ids: failed,
                })
                .eq('id', jobId);

              continue;
            }

            const result = await syncMeeting(supabase, userId, recordingId, meeting, dedupSettings);

            if (result.success) {
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

            // Small delay between meetings to be nice to the API
            await new Promise(resolve => setTimeout(resolve, 500));
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

        // Automatically trigger embedding generation for successfully synced meetings
        if (synced.length > 0) {
          console.log(`Triggering embedding generation for ${synced.length} synced meetings...`);

          // Fire-and-forget: invoke embed-chunks for the synced recordings
          // The embed-chunks function will also trigger enrich-chunk-metadata automatically
          supabase.functions.invoke('embed-chunks', {
            body: {
              recording_ids: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error(`Embedding generation failed for sync job ${jobId}:`, error);
            } else {
              console.log(`Embedding generation started for ${synced.length} meetings:`, data);
            }
          }).catch((err) => {
            console.error(`Embedding invocation failed for sync job ${jobId}:`, err);
          });

          // Fire-and-forget: invoke generate-ai-titles for the synced recordings
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
