import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleClient } from '../_shared/google-client.ts';
import { refreshGoogleOAuthTokens } from '../google-oauth-refresh/index.ts';
import {
  generateFingerprint,
  fingerprintToHash,
  findDuplicate,
  selectPrimarySource,
  mergeMeetingData,
  type MeetingData,
  type DedupPreferences
} from '../_shared/deduplication.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * RATE LIMITING CONFIGURATION
 *
 * Google Drive API limits: 12,000 queries/minute per user
 * Our conservative limit: 30 requests/minute per user (conservative for sync operations)
 * Window: 60 seconds (60000ms)
 */
const RATE_WINDOW_MS = 60000;
const RATE_MAX_REQUESTS = 30;
const RATE_JITTER_MS = 200;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type RateWindow = { windowStart: number; count: number };
type RateLimiterState = { windows: Map<string, RateWindow> };

const globalRateLimiterState = (globalThis as unknown as { __googleDriveRateLimiter?: RateLimiterState }).__googleDriveRateLimiter
  ?? { windows: new Map<string, RateWindow>() };
(globalThis as unknown as { __googleDriveRateLimiter?: RateLimiterState }).__googleDriveRateLimiter = globalRateLimiterState;

async function throttleShared(scope: string, maxRequests: number = RATE_MAX_REQUESTS, windowMs: number = RATE_WINDOW_MS): Promise<void> {
  const now = Date.now();
  const existing = globalRateLimiterState.windows.get(scope) ?? { windowStart: now, count: 0 };
  const elapsed = now - existing.windowStart;

  if (elapsed > windowMs * 2) {
    globalRateLimiterState.windows.delete(scope);
    return throttleShared(scope, maxRequests, windowMs);
  }

  if (elapsed >= windowMs) {
    existing.windowStart = now;
    existing.count = 0;
  }

  if (existing.count >= maxRequests) {
    const waitTime = windowMs - elapsed + Math.floor(Math.random() * RATE_JITTER_MS);
    console.log(`Rate limit prevention for ${scope}: waiting ${waitTime}ms...`);
    await sleep(waitTime);
    return throttleShared(scope, maxRequests, windowMs);
  }

  existing.count += 1;
  globalRateLimiterState.windows.set(scope, existing);
}

/**
 * Google Drive file metadata
 */
interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
}

interface DriveFilesResponse {
  files?: DriveFile[];
  nextPageToken?: string;
}

/**
 * Search Google Drive for files in the "Meet Recordings" folder
 * that match the given meeting title and time range.
 */
async function searchMeetRecordings(
  accessToken: string,
  meetingTitle: string,
  meetingStartTime: string,
  userId: string
): Promise<DriveFile[]> {
  await throttleShared(`google-drive:${userId}`);

  // Search for video files in any folder that might be "Meet Recordings"
  // Note: Google stores recordings in user's Drive root or "Meet Recordings" folder
  const query = `mimeType='video/mp4' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime)&orderBy=createdTime desc&pageSize=50`;

  const response = await GoogleClient.fetchWithAuth(url, accessToken);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Drive API error:', errorText);
    return [];
  }

  const data: DriveFilesResponse = await response.json();

  if (!data.files || data.files.length === 0) {
    return [];
  }

  // Filter files by name similarity to meeting title and time proximity
  const meetingDate = new Date(meetingStartTime);
  const oneDayMs = 24 * 60 * 60 * 1000;

  const matchedFiles = data.files.filter(file => {
    // Check if file name contains part of meeting title or "Meet"
    const fileName = file.name.toLowerCase();
    const titleLower = meetingTitle.toLowerCase();

    // Meet recordings often have format: "Meeting title (YYYY-MM-DD at HH-MM-SS GMT)"
    const hasTitleMatch = fileName.includes(titleLower) ||
                          titleLower.split(' ').some(word => word.length > 3 && fileName.includes(word));

    // Check time proximity (within 1 day of meeting)
    if (file.createdTime) {
      const fileDate = new Date(file.createdTime);
      const timeDiff = Math.abs(fileDate.getTime() - meetingDate.getTime());
      if (timeDiff <= oneDayMs && hasTitleMatch) {
        return true;
      }
    }

    return false;
  });

  return matchedFiles;
}

/**
 * Search Google Drive for transcript documents related to a meeting.
 * Google Meet transcripts are stored as Google Docs.
 */
async function searchMeetTranscripts(
  accessToken: string,
  meetingTitle: string,
  meetingStartTime: string,
  userId: string
): Promise<DriveFile[]> {
  await throttleShared(`google-drive:${userId}`);

  // Search for Google Docs that might be transcripts
  // Transcripts are often named "Meeting title - Transcript"
  const query = `mimeType='application/vnd.google-apps.document' and trashed=false and (name contains 'transcript' or name contains 'Transcript')`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime)&orderBy=createdTime desc&pageSize=50`;

  const response = await GoogleClient.fetchWithAuth(url, accessToken);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Google Drive API error searching transcripts:', errorText);
    return [];
  }

  const data: DriveFilesResponse = await response.json();

  if (!data.files || data.files.length === 0) {
    return [];
  }

  // Filter by time proximity and title match
  const meetingDate = new Date(meetingStartTime);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const titleLower = meetingTitle.toLowerCase();

  return data.files.filter(file => {
    const fileName = file.name.toLowerCase();

    // Check for title match
    const hasTitleMatch = fileName.includes(titleLower) ||
                          titleLower.split(' ').some(word => word.length > 3 && fileName.includes(word));

    // Check time proximity
    if (file.createdTime && hasTitleMatch) {
      const fileDate = new Date(file.createdTime);
      const timeDiff = Math.abs(fileDate.getTime() - meetingDate.getTime());
      return timeDiff <= oneDayMs;
    }

    return false;
  });
}

/**
 * Download/export a Google Docs transcript as plain text
 */
async function downloadTranscript(
  accessToken: string,
  fileId: string,
  userId: string
): Promise<string | null> {
  await throttleShared(`google-drive:${userId}`);

  // Export Google Docs as plain text
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;

  const response = await GoogleClient.fetchWithAuth(url, accessToken);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to download transcript ${fileId}:`, errorText);
    return null;
  }

  return response.text();
}

/**
 * Fetch a single calendar event to get full details
 */
async function fetchCalendarEvent(
  accessToken: string,
  eventId: string,
  userId: string
): Promise<{
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  conferenceData?: { conferenceId?: string };
  hangoutLink?: string;
} | null> {
  await throttleShared(`google-calendar:${userId}`);

  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`;
  const response = await GoogleClient.fetchWithAuth(url, accessToken);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch calendar event ${eventId}:`, errorText);
    return null;
  }

  return response.json();
}

/**
 * Sync a single Google Meet meeting
 */
async function syncGoogleMeeting(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  eventId: string,
  accessToken: string,
  dedupPreferences: DedupPreferences
): Promise<{ success: boolean; recordingId?: number; error?: string }> {
  try {
    console.log(`Syncing Google Meet event ${eventId}`);

    // 1. Fetch calendar event details
    const event = await fetchCalendarEvent(accessToken, eventId, userId);
    if (!event) {
      return { success: false, error: 'Failed to fetch calendar event' };
    }

    const title = event.summary || 'Untitled Meeting';
    const startTime = event.start?.dateTime || event.start?.date || new Date().toISOString();
    const endTime = event.end?.dateTime || event.end?.date || startTime;
    const participants = (event.attendees || []).map(a => a.email);

    // 2. Search for recordings in Google Drive
    const recordings = await searchMeetRecordings(accessToken, title, startTime, userId);
    const driveFileId = recordings.length > 0 ? recordings[0].id : null;

    if (recordings.length > 0) {
      console.log(`Found ${recordings.length} potential recordings for "${title}"`);
    } else {
      console.log(`No recordings found for "${title}" in Google Drive`);
    }

    // 3. Search for transcripts in Google Drive
    const transcripts = await searchMeetTranscripts(accessToken, title, startTime, userId);
    let fullTranscript = '';
    let transcriptSource = 'none';

    if (transcripts.length > 0) {
      console.log(`Found ${transcripts.length} potential transcripts for "${title}"`);
      const transcriptText = await downloadTranscript(accessToken, transcripts[0].id, userId);
      if (transcriptText) {
        fullTranscript = transcriptText;
        transcriptSource = 'native';
        console.log(`Downloaded native transcript (${transcriptText.length} chars)`);
      }
    }

    // Note: Whisper transcription fallback would be triggered by a separate function
    // if transcriptSource === 'none' and we have a recording file

    // 4. Generate fingerprint for deduplication
    const durationSeconds = startTime && endTime
      ? Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
      : 3600;

    const meetingData: MeetingData = {
      title,
      started_at: startTime,
      ended_at: endTime,
      duration_seconds: durationSeconds,
      participants,
      source_platform: 'google_meet',
      transcript: fullTranscript,
    };

    const fingerprint = generateFingerprint(meetingData);
    const fingerprintHash = fingerprintToHash(fingerprint);

    // 5. Check for existing duplicate meetings
    const { data: existingMeetings, error: existingError } = await supabase
      .from('fathom_calls')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .gte('recording_start_time', new Date(new Date(startTime).getTime() - 24 * 60 * 60 * 1000).toISOString())
      .lte('recording_start_time', new Date(new Date(startTime).getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (existingError) {
      console.error('Error fetching existing meetings:', existingError);
    }

    let isDuplicate = false;
    let existingMeeting = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let matchResult: any = null;

    if (existingMeetings && existingMeetings.length > 0) {
      // Convert existing meetings to MeetingData format
      const existingMeetingData: MeetingData[] = existingMeetings.map((m: {
        recording_id: number;
        title: string;
        recording_start_time: string;
        recording_end_time?: string;
        calendar_invitees?: Array<{ email?: string }>;
        source_platform?: string;
        full_transcript?: string;
        is_primary?: boolean;
        merged_from?: number[];
      }) => ({
        id: m.recording_id,
        title: m.title || '',
        started_at: m.recording_start_time,
        ended_at: m.recording_end_time,
        participants: (m.calendar_invitees || []).map((i: { email?: string }) => i.email).filter(Boolean) as string[],
        source_platform: m.source_platform,
        transcript: m.full_transcript,
        is_primary: m.is_primary,
        merged_from: m.merged_from,
      }));

      const duplicateResult = findDuplicate(meetingData, existingMeetingData);
      if (duplicateResult) {
        isDuplicate = true;
        existingMeeting = existingMeetings.find((m: { recording_id: number }) => m.recording_id === duplicateResult.meeting.id);
        matchResult = duplicateResult.matchResult;
        console.log(`Found duplicate meeting: ${existingMeeting?.title} (score: ${matchResult.score.toFixed(2)})`);
      }
    }

    // 6. Generate a unique recording_id for Google Meet meetings
    // Use negative numbers to avoid collision with Fathom recording IDs
    const { data: maxIdResult } = await supabase
      .from('fathom_calls')
      .select('recording_id')
      .lt('recording_id', 0)
      .order('recording_id', { ascending: true })
      .limit(1);

    const minExistingId = maxIdResult?.[0]?.recording_id ?? 0;
    const newRecordingId = Math.min(minExistingId - 1, -1);

    // 7. Handle duplicate or create new record
    if (isDuplicate && existingMeeting && matchResult) {
      // Determine which should be primary based on user preferences
      const existingMeetingData: MeetingData = {
        id: existingMeeting.recording_id,
        title: existingMeeting.title,
        started_at: existingMeeting.recording_start_time,
        ended_at: existingMeeting.recording_end_time,
        participants: (existingMeeting.calendar_invitees || []).map((i: { email?: string }) => i.email).filter(Boolean) as string[],
        source_platform: existingMeeting.source_platform,
        transcript: existingMeeting.full_transcript,
        is_primary: true,
        merged_from: existingMeeting.merged_from || [],
      };

      meetingData.id = newRecordingId;

      const primaryMeeting = selectPrimarySource(
        existingMeetingData,
        meetingData,
        dedupPreferences,
        new Date(existingMeeting.synced_at),
        new Date()
      );

      if (primaryMeeting.id === existingMeeting.recording_id) {
        // Existing meeting stays primary, new one is secondary
        console.log(`Existing meeting remains primary. Merging Google Meet data...`);

        const mergedData = mergeMeetingData(existingMeetingData, meetingData, matchResult);

        // Update existing meeting with merged data
        const { error: updateError } = await supabase
          .from('fathom_calls')
          .update({
            merged_from: mergedData.merged_from,
            fuzzy_match_score: matchResult.score,
          })
          .eq('recording_id', existingMeeting.recording_id)
          .eq('user_id', userId);

        if (updateError) {
          console.error('Error updating existing meeting:', updateError);
        }

        // Insert secondary record (not primary)
        const { error: insertError } = await supabase
          .from('fathom_calls')
          .insert({
            recording_id: newRecordingId,
            user_id: userId,
            title,
            recording_start_time: startTime,
            recording_end_time: endTime,
            calendar_invitees: participants.map(email => ({ email })),
            full_transcript: fullTranscript,
            synced_at: new Date().toISOString(),
            source_platform: 'google_meet',
            is_primary: false,
            meeting_fingerprint: fingerprintHash,
            google_calendar_event_id: eventId,
            google_drive_file_id: driveFileId,
            transcript_source: transcriptSource,
            fuzzy_match_score: matchResult.score,
          });

        if (insertError) {
          console.error('Error inserting secondary record:', insertError);
          return { success: false, error: insertError.message };
        }

        return { success: true, recordingId: existingMeeting.recording_id };
      } else {
        // New Google Meet record becomes primary
        console.log(`Google Meet record becomes primary. Updating existing to secondary...`);

        // Demote existing to secondary
        const { error: demoteError } = await supabase
          .from('fathom_calls')
          .update({ is_primary: false })
          .eq('recording_id', existingMeeting.recording_id)
          .eq('user_id', userId);

        if (demoteError) {
          console.error('Error demoting existing meeting:', demoteError);
        }

        // Insert new primary
        const { error: insertError } = await supabase
          .from('fathom_calls')
          .insert({
            recording_id: newRecordingId,
            user_id: userId,
            title,
            recording_start_time: startTime,
            recording_end_time: endTime,
            calendar_invitees: participants.map(email => ({ email })),
            full_transcript: fullTranscript,
            synced_at: new Date().toISOString(),
            source_platform: 'google_meet',
            is_primary: true,
            meeting_fingerprint: fingerprintHash,
            google_calendar_event_id: eventId,
            google_drive_file_id: driveFileId,
            transcript_source: transcriptSource,
            merged_from: [existingMeeting.recording_id],
            fuzzy_match_score: matchResult.score,
          });

        if (insertError) {
          console.error('Error inserting primary record:', insertError);
          return { success: false, error: insertError.message };
        }

        return { success: true, recordingId: newRecordingId };
      }
    } else {
      // No duplicate - insert as new primary record
      console.log(`No duplicate found. Creating new primary record for "${title}"`);

      const { error: insertError } = await supabase
        .from('fathom_calls')
        .insert({
          recording_id: newRecordingId,
          user_id: userId,
          title,
          recording_start_time: startTime,
          recording_end_time: endTime,
          calendar_invitees: participants.map(email => ({ email })),
          full_transcript: fullTranscript,
          synced_at: new Date().toISOString(),
          source_platform: 'google_meet',
          is_primary: true,
          meeting_fingerprint: fingerprintHash,
          google_calendar_event_id: eventId,
          google_drive_file_id: driveFileId,
          transcript_source: transcriptSource,
        });

      if (insertError) {
        console.error('Error inserting new record:', insertError);
        return { success: false, error: insertError.message };
      }

      console.log(`Successfully synced Google Meet meeting ${eventId} as recording ${newRecordingId}`);
      return { success: true, recordingId: newRecordingId };
    }
  } catch (error) {
    console.error(`Error syncing Google Meet event ${eventId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

    // Parse request body
    const { eventIds, vault_id } = await req.json();

    if (!Array.isArray(eventIds) || eventIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid event IDs - must be a non-empty array' }),
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

    // Get user's Google OAuth credentials and dedup preferences
    const { data: settings, error: configError } = await supabase
      .from('user_settings')
      .select('google_oauth_access_token, google_oauth_token_expires, google_oauth_refresh_token, dedup_priority_mode, dedup_platform_order')
      .eq('user_id', user.id)
      .maybeSingle();

    if (configError) throw configError;

    if (!settings?.google_oauth_access_token) {
      throw new Error('Google account not connected. Please connect your Google account in Settings.');
    }

    // Check if token is expired and refresh if needed
    let accessToken = settings.google_oauth_access_token;
    const now = Date.now();

    if (settings.google_oauth_token_expires && settings.google_oauth_token_expires <= now) {
      console.log('Google OAuth token expired, attempting refresh...');
      if (!settings.google_oauth_refresh_token) {
        throw new Error('Google OAuth token expired and no refresh token available. Please reconnect in Settings.');
      }

      try {
        accessToken = await refreshGoogleOAuthTokens(user.id, settings.google_oauth_refresh_token);
        console.log('Google OAuth token refreshed successfully');
      } catch (refreshError) {
        console.error('Error refreshing Google OAuth token:', refreshError);
        throw new Error('Google OAuth token expired and refresh failed. Please reconnect in Settings.');
      }
    }

    // Dedup preferences
    const dedupPreferences: DedupPreferences = {
      dedup_priority_mode: settings.dedup_priority_mode || 'first_synced',
      dedup_platform_order: settings.dedup_platform_order || [],
    };

    // Validate vault membership once at the top if vault_id provided
    let validatedVaultId: string | null = null;
    if (vault_id) {
      const { data: membership, error: membershipError } = await supabase
        .from('vault_memberships')
        .select('id')
        .eq('vault_id', vault_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipError) {
        console.error('Error checking vault membership:', membershipError);
      } else if (!membership) {
        console.warn(`User ${user.id} is not a member of vault ${vault_id}, ignoring vault_id`);
      } else {
        validatedVaultId = vault_id;
        console.log(`Vault ${vault_id} membership validated for user ${user.id}`);
      }
    }

    console.log(`Syncing ${eventIds.length} Google Meet meetings for user ${userId}`);

    // Create a sync job record
    const { data: syncJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        user_id: userId,
        recording_ids: [], // Will be populated as we sync
        status: 'processing',
        progress_current: 0,
        progress_total: eventIds.length,
      })
      .select()
      .single();

    if (jobError) throw jobError;
    const jobId = syncJob.id;

    console.log(`Created sync job ${jobId} for ${eventIds.length} Google Meet meetings`);

    // Background processing function
    const processSyncJob = async () => {
      const synced: number[] = [];
      const failed: string[] = [];

      console.log(`Background processing started for Google Meet sync job ${jobId}`);

      try {
        for (const eventId of eventIds) {
          const result = await syncGoogleMeeting(
            supabase,
            userId,
            eventId,
            accessToken,
            dedupPreferences
          );

          if (result.success && result.recordingId) {
            synced.push(result.recordingId);
            console.log(`Synced event ${eventId} (${synced.length}/${eventIds.length})`);

            // Create vault entry if vault_id was validated
            if (validatedVaultId) {
              try {
                // Google Meet uses negative recording IDs - look up from recordings table
                const { data: recording } = await supabase
                  .from('recordings')
                  .select('id')
                  .eq('legacy_recording_id', result.recordingId)
                  .eq('owner_user_id', userId)
                  .maybeSingle();

                if (recording?.id) {
                  const { error: vaultEntryError } = await supabase
                    .from('vault_entries')
                    .insert({
                      vault_id: validatedVaultId,
                      recording_id: recording.id,
                    });

                  if (vaultEntryError) {
                    console.error(`Error creating vault entry for Google Meet recording ${result.recordingId}:`, vaultEntryError);
                  } else {
                    console.log(`Created vault entry for Google Meet recording ${recording.id} in vault ${validatedVaultId}`);
                  }
                } else {
                  console.warn(`No recordings table entry found for Google Meet recording_id ${result.recordingId}`);
                }
              } catch (vaultError) {
                console.error(`Error handling vault entry for Google Meet recording ${result.recordingId}:`, vaultError);
              }
            }
          } else {
            failed.push(eventId);
            console.log(`Failed to sync event ${eventId}: ${result.error}`);
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

          // Small delay between meetings
          await sleep(500);
        }

        // Mark job as completed
        const finalStatus = failed.length === 0 ? 'completed' :
                           synced.length === 0 ? 'failed' :
                           'completed_with_errors';

        await supabase
          .from('sync_jobs')
          .update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            recording_ids: synced,
          })
          .eq('id', jobId);

        console.log(`Google Meet sync job ${jobId} complete: ${synced.length} succeeded, ${failed.length} failed`);

        // Trigger embedding generation for successfully synced meetings
        if (synced.length > 0) {
          console.log(`Triggering embedding generation for ${synced.length} synced meetings...`);

          supabase.functions.invoke('embed-chunks', {
            body: {
              recording_ids: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ error }: { error?: Error }) => {
            if (error) {
              console.error(`Embedding generation failed for sync job ${jobId}:`, error);
            } else {
              console.log(`Embedding generation started for ${synced.length} meetings`);
            }
          }).catch((err: Error) => {
            console.error(`Embedding invocation failed for sync job ${jobId}:`, err);
          });

          // Trigger AI title generation
          console.log(`Triggering AI title generation for ${synced.length} synced meetings...`);
          supabase.functions.invoke('generate-ai-titles', {
            body: {
              recordingIds: synced,
            },
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          }).then(({ error }: { error?: Error }) => {
            if (error) {
              console.error(`AI title generation failed for sync job ${jobId}:`, error);
            } else {
              console.log(`AI title generation completed for ${synced.length} meetings`);
            }
          }).catch((err: Error) => {
            console.error(`AI title invocation failed for sync job ${jobId}:`, err);
          });
        }
      } catch (error) {
        console.error(`Google Meet sync job ${jobId} failed:`, error);
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
        message: `Sync job started for ${eventIds.length} Google Meet meetings`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing Google Meet meetings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
