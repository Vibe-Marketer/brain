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
import { refreshZoomOAuthTokens } from '../zoom-oauth-refresh/index.ts';

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

import { getCorsHeaders } from '../_shared/cors.ts';

// Rate limiter for API calls - conservative to avoid 429 errors
class RateLimiter {
  private requestCount = 0;
  private windowStart = Date.now();
  private readonly maxRequests = 30;
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

interface ZoomRecordingDetail {
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
  participant_audio_files?: Array<{
    id: string;
    recording_start: string;
    recording_end: string;
    file_name: string;
    file_type: string;
    file_extension: string;
    file_size: number;
    download_url?: string;
    status: string;
  }>;
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
 * Syncs a single Zoom meeting to the database
 */
async function syncZoomMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  recordingId: string,
  meeting: ZoomRecordingDetail,
  accessToken: string,
  dedupSettings: {
    priorityMode: DedupPriorityMode;
    platformOrder: string[];
  }
): Promise<boolean> {
  try {
    console.log(`Syncing Zoom meeting ${recordingId}: ${meeting.topic}`);

    // Find transcript file
    const transcriptFile = meeting.recording_files?.find(
      file => file.file_type === 'TRANSCRIPT' || file.recording_type === 'audio_transcript'
    );

    let fullTranscript = '';
    const transcriptSegments: TranscriptSegment[] = [];

    if (transcriptFile?.download_url) {
      console.log(`Downloading transcript for meeting ${recordingId}...`);
      const vttContent = await fetchZoomTranscript(transcriptFile.download_url, accessToken);

      if (vttContent) {
        const parsed = parseVTTWithMetadata(vttContent);
        const consolidated = consolidateBySpeaker(parsed.segments);

        // Build full transcript text with consolidated speaker turns
        const consolidatedSegments: string[] = [];

        for (const seg of consolidated) {
          const speaker = seg.speaker || 'Unknown';
          const timestamp = seg.start_time.split('.')[0] || '00:00:00';
          consolidatedSegments.push(`[${timestamp}] ${speaker}: ${seg.text}`);
        }

        fullTranscript = consolidatedSegments.join('\n\n');
        transcriptSegments.push(...parsed.segments);

        console.log(`Parsed ${parsed.segments.length} transcript segments for meeting ${recordingId}`);
      }
    } else {
      console.log(`No transcript file available for meeting ${recordingId}`);
    }

    // Calculate meeting times
    const startTime = new Date(meeting.start_time);
    const endTime = new Date(startTime.getTime() + (meeting.duration * 60 * 1000));

    // Generate fingerprint for deduplication
    const fingerprint = await generateFingerprint({
      title: meeting.topic,
      start_time: startTime,
      duration_minutes: meeting.duration,
      participants: [meeting.host_email], // Zoom API doesn't easily expose participant list
    });
    const fingerprintString = generateFingerprintString(fingerprint);

    // Deduplication: Find potential duplicates before inserting
    const syncedAt = new Date();
    let isPrimary = true;
    let mergedFromIds: number[] = [];
    let fuzzyMatchScore: number | null = null;
    let primaryMeetingId: number | null = null;

    const duplicates = await findPotentialDuplicates(supabase, userId, fingerprint, recordingId);

    if (duplicates.length > 0) {
      // Found a potential duplicate - handle the merge
      const bestMatch = duplicates[0]; // Already sorted by score

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
      .eq('recording_id', recordingId)
      .eq('user_id', userId)
      .maybeSingle();

    // Build upsert object, preserving user edits
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertData: any = {
      recording_id: recordingId, // Use UUID for Zoom
      user_id: userId,
      created_at: meeting.start_time,
      recording_start_time: meeting.start_time,
      recording_end_time: endTime.toISOString(),
      url: meeting.share_url || null,
      share_url: meeting.share_url || null,
      calendar_invitees: [], // Zoom API doesn't easily provide this
      full_transcript: fullTranscript,
      recorded_by_name: null, // Zoom doesn't have equivalent field
      recorded_by_email: meeting.host_email,
      synced_at: syncedAt.toISOString(),
      source_platform: 'zoom',
      meeting_fingerprint: fingerprintString,
      is_primary: isPrimary,
      merged_from: mergedFromIds.length > 0 ? mergedFromIds : null,
      fuzzy_match_score: fuzzyMatchScore,
    };

    // Only update title if not edited by user
    if (!existingCall?.title_edited_by_user) {
      upsertData.title = meeting.topic;
    } else {
      upsertData.title = existingCall.title;
      upsertData.title_edited_by_user = true;
    }

    // Only update summary if not edited by user
    // Zoom doesn't provide summaries, so keep existing if edited
    if (existingCall?.summary_edited_by_user) {
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
      console.error(`Error upserting Zoom call ${recordingId}:`, callError);
      throw callError;
    }

    // If this meeting is secondary, update the primary meeting's merged_from array
    if (!isPrimary && primaryMeetingId && insertedCall?.id) {
      await updateMergedFrom(supabase, primaryMeetingId, insertedCall.id, userId);
      console.log(`Deduplication: Added meeting ${insertedCall.id} to merged_from of primary meeting ${primaryMeetingId}`);
    }

    // Delete existing transcripts and insert new ones (use composite key for user isolation)
    if (transcriptSegments.length > 0) {
      const { error: deleteError } = await supabase
        .from('fathom_transcripts')
        .delete()
        .eq('recording_id', recordingId)
        .eq('user_id', userId);

      if (deleteError) {
        console.error(`Error deleting old transcripts for ${recordingId}:`, deleteError);
      }

      const transcriptRows = transcriptSegments.map((segment: TranscriptSegment) => ({
        recording_id: recordingId,
        user_id: userId,
        speaker_name: segment.speaker || 'Unknown',
        speaker_email: null, // Zoom VTT doesn't include emails
        text: segment.text,
        timestamp: segment.start_time,
      }));

      const { error: transcriptError } = await supabase
        .from('fathom_transcripts')
        .insert(transcriptRows);

      if (transcriptError) {
        console.error(`Error inserting transcripts for ${recordingId}:`, transcriptError);
        throw transcriptError;
      }

      console.log(`Synced ${transcriptRows.length} transcript segments for Zoom meeting ${recordingId}`);
    }

    console.log(`Successfully synced Zoom meeting ${recordingId}`);
    return true;
  } catch (error) {
    console.error(`Failed to sync Zoom meeting ${recordingId}:`, error);
    return false;
  }
}

/**
 * Fetches recording details from Zoom API
 */
async function fetchRecordingDetails(
  recordingId: string,
  accessToken: string
): Promise<ZoomRecordingDetail | null> {
  try {
    // URL-encode the recording ID (UUIDs may contain special characters)
    const encodedId = encodeURIComponent(encodeURIComponent(recordingId));

    const response = await ZoomClient.apiRequest(
      `/meetings/${encodedId}/recordings`,
      accessToken,
      { maxRetries: 3 }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.error(`Recording ${recordingId} not found`);
        return null;
      }
      const errorText = await response.text();
      console.error(`Error fetching recording ${recordingId}: ${response.status} - ${errorText}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching recording details for ${recordingId}:`, error);
    return null;
  }
}

/**
 * Reconstructs a MeetingFingerprint from an existing meeting's stored data.
 * Used for comparing against potential duplicates.
 */
async function reconstructFingerprint(meeting: ExistingMeeting): Promise<MeetingFingerprint> {
  // Calculate duration from start/end times
  const startTime = new Date(meeting.recording_start_time);
  const endTime = meeting.recording_end_time
    ? new Date(meeting.recording_end_time)
    : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 60 min if no end time

  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (60 * 1000));

  // Collect participants from recorded_by_email and calendar_invitees
  const participants: string[] = [];
  if (meeting.recorded_by_email) {
    participants.push(meeting.recorded_by_email);
  }
  if (meeting.calendar_invitees && Array.isArray(meeting.calendar_invitees)) {
    // calendar_invitees may be objects with email property or strings
    for (const invitee of meeting.calendar_invitees) {
      if (typeof invitee === 'string') {
        participants.push(invitee);
      } else if (invitee && typeof invitee === 'object' && 'email' in invitee) {
        participants.push(invitee.email as string);
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
 * Returns meetings that are within a reasonable time window of the new meeting.
 */
async function findPotentialDuplicates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  newFingerprint: MeetingFingerprint,
  excludeRecordingId: string
): Promise<{ meeting: ExistingMeeting; matchResult: MatchResult }[]> {
  // Query meetings that could potentially match (within 24 hours of the time bucket)
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

  // Sort by match score (highest first)
  duplicates.sort((a, b) => b.matchResult.score - a.matchResult.score);

  return duplicates;
}

/**
 * Determines which meeting should be the primary based on user's priority mode.
 * Returns true if the new meeting should be primary, false if the existing one should remain primary.
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
      // The first synced meeting is primary
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    case 'most_recent': {
      // The most recently synced meeting is primary
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at > existingSyncedAt;
    }

    case 'platform_hierarchy': {
      // Use the platform order array (first in array = highest priority)
      const newPlatformIndex = platformOrder.indexOf(newMeeting.source_platform);
      const existingPlatformIndex = platformOrder.indexOf(existingMeeting.source_platform || 'fathom');

      // If platform not in order, treat as lowest priority
      const newIndex = newPlatformIndex === -1 ? platformOrder.length : newPlatformIndex;
      const existingIndex = existingPlatformIndex === -1 ? platformOrder.length : existingPlatformIndex;

      // Lower index = higher priority
      if (newIndex !== existingIndex) {
        return newIndex < existingIndex;
      }
      // If same platform or both not in order, fall back to first_synced
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    case 'longest_transcript': {
      // The meeting with the longest transcript is primary
      const existingLength = existingMeeting.full_transcript?.length || 0;
      if (newMeeting.transcript_length !== existingLength) {
        return newMeeting.transcript_length > existingLength;
      }
      // If same length, fall back to first_synced
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
    }

    default:
      // Default to first_synced behavior
      const existingSyncedAt = existingMeeting.synced_at ? new Date(existingMeeting.synced_at) : new Date(0);
      return newMeeting.synced_at < existingSyncedAt;
  }
}

/**
 * Handles deduplication merge when a duplicate is found.
 * Updates the primary meeting's merged_from array and sets is_primary on both meetings.
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
    // New meeting becomes primary - update existing meeting to secondary
    // Update existing meeting to not be primary
    await supabase
      .from('fathom_calls')
      .update({
        is_primary: false,
        fuzzy_match_score: matchResult.score,
      })
      .eq('id', existingMeeting.id)
      .eq('user_id', userId);

    // Return existing meeting's ID to add to merged_from of new meeting
    return {
      primaryId: existingMeeting.id,
      isPrimaryNew: true,
    };
  } else {
    // Existing meeting remains primary - add new meeting to its merged_from
    // Note: We'll add the new meeting's ID to merged_from after it's inserted
    // For now, update the existing meeting's match score
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
  // Get current merged_from array
  const { data: primaryMeeting } = await supabase
    .from('fathom_calls')
    .select('merged_from')
    .eq('id', primaryMeetingId)
    .eq('user_id', userId)
    .single();

  const currentMergedFrom = primaryMeeting?.merged_from || [];

  // Add secondary meeting ID if not already present
  if (!currentMergedFrom.includes(secondaryMeetingId)) {
    const updatedMergedFrom = [...currentMergedFrom, secondaryMeetingId];

    await supabase
      .from('fathom_calls')
      .update({ merged_from: updatedMergedFrom })
      .eq('id', primaryMeetingId)
      .eq('user_id', userId);
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
    const { recordingIds } = await req.json();

    if (!Array.isArray(recordingIds)) {
      return new Response(
        JSON.stringify({ error: 'recordingIds must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Allow empty array - return success with no-op
    if (recordingIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No recordings to sync',
          jobId: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get user's Zoom OAuth credentials and deduplication preferences
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('zoom_oauth_access_token, zoom_oauth_token_expires, zoom_oauth_refresh_token, dedup_priority_mode, dedup_platform_order')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.zoom_oauth_access_token) {
      throw new Error('Zoom not connected. Please connect your Zoom account in Settings.');
    }

    // Extract deduplication settings with defaults
    const dedupSettings = {
      priorityMode: (settings.dedup_priority_mode || 'first_synced') as DedupPriorityMode,
      platformOrder: (settings.dedup_platform_order || []) as string[],
    };

    // Determine access token to use (refresh if expired)
    let accessToken: string;
    const now = Date.now();

    if (settings.zoom_oauth_token_expires && settings.zoom_oauth_token_expires > now) {
      accessToken = settings.zoom_oauth_access_token;
      console.log('Using existing Zoom access token for sync');
    } else {
      console.log('Zoom token expired, attempting refresh...');
      if (!settings.zoom_oauth_refresh_token) {
        throw new Error('Zoom token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshZoomOAuthTokens(user.id, settings.zoom_oauth_refresh_token);
        console.log('Zoom token refreshed successfully for sync');
      } catch (refreshError) {
        console.error('Error refreshing Zoom token:', refreshError);
        throw new Error('Zoom token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    console.log(`Syncing ${recordingIds.length} Zoom meetings`);

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

    console.log(`Created sync job ${jobId} for ${recordingIds.length} Zoom meetings`);

    // Process the sync in the background
    const processSyncJob = async () => {
      const synced: string[] = [];
      const failed: string[] = [];
      const rateLimiter = new RateLimiter();

      console.log(`Background processing started for Zoom sync job ${jobId}`);

      try {
        for (const recordingId of recordingIds) {
          try {
            await rateLimiter.throttle();

            console.log(`Fetching Zoom recording ${recordingId}...`);
            const recording = await fetchRecordingDetails(recordingId, accessToken);

            if (!recording) {
              console.error(`Zoom recording ${recordingId} not found or failed to fetch`);
              failed.push(recordingId);

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

            const success = await syncZoomMeeting(supabase, userId, recordingId, recording, accessToken, dedupSettings);

            if (success) {
              synced.push(recordingId);
              console.log(`✓ Synced Zoom ${recordingId} (${synced.length}/${recordingIds.length})`);
            } else {
              failed.push(recordingId);
              console.log(`✗ Failed to sync Zoom ${recordingId}`);
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
            console.error(`Error processing Zoom recording ${recordingId}:`, error);
            failed.push(recordingId);

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

        console.log(`Zoom sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed`);

        // Automatically trigger embedding generation for successfully synced meetings
        if (synced.length > 0) {
          console.log(`Triggering embedding generation for ${synced.length} synced Zoom meetings...`);

          // Fire-and-forget: invoke embed-chunks for the synced recordings
          supabase.functions.invoke('embed-chunks', {
            body: {
              recording_ids: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }: { data: unknown; error: Error | null }) => {
            if (error) {
              console.error(`Embedding generation failed for Zoom sync job ${jobId}:`, error);
            } else {
              console.log(`Embedding generation started for ${synced.length} Zoom meetings:`, data);
            }
          }).catch((err: Error) => {
            console.error(`Embedding invocation failed for Zoom sync job ${jobId}:`, err);
          });

          // Fire-and-forget: invoke generate-ai-titles for the synced recordings
          console.log(`Triggering AI title generation for ${synced.length} synced Zoom meetings...`);
          supabase.functions.invoke('generate-ai-titles', {
            body: {
              recordingIds: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ data, error }: { data: unknown; error: Error | null }) => {
            if (error) {
              console.error(`AI title generation failed for Zoom sync job ${jobId}:`, error);
            } else {
              console.log(`AI title generation completed for ${synced.length} Zoom meetings:`, data);
            }
          }).catch((err: Error) => {
            console.error(`AI title invocation failed for Zoom sync job ${jobId}:`, err);
          });
        }
      } catch (error) {
        console.error(`Zoom sync job ${jobId} failed:`, error);
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
        message: `Sync job started for ${recordingIds.length} Zoom meetings`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing Zoom meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
