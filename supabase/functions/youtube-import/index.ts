import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * YouTube Import Edge Function
 * 
 * Orchestrates the import of YouTube videos as call transcripts:
 * 1. Validates YouTube URL and extracts video ID
 * 2. Checks for duplicate imports
 * 3. Fetches video metadata via youtube-api function
 * 4. Fetches transcript via Transcript API directly
 * 5. Creates fathom_calls record with source_platform='youtube'
 * 
 * The existing embedding pipeline will pick up new records for processing.
 */

interface ImportRequest {
  videoUrl: string;
  vault_id?: string;
}

type ImportStep = 'validating' | 'checking' | 'fetching' | 'transcribing' | 'processing' | 'done';

interface ImportResponse {
  success: boolean;
  step: ImportStep;
  error?: string;
  recordingId?: number;
  title?: string;
  exists?: boolean;
}

type ImportStage = 'video-details' | 'transcript';
type DownstreamSource = 'youtube-api' | 'transcripts-api';

const TRANSCRIPT_API_BASE = 'https://transcriptapi.com/api/v2/youtube/transcript';

interface DownstreamErrorResponse extends ImportResponse {
  source: DownstreamSource;
  stage: ImportStage;
  status: number;
  details?: unknown;
}

interface YouTubeVideoDetails {
  title: string;
  description?: string;
  channelId?: string;
  channelTitle?: string;
  publishedAt?: string;
  thumbnails?: {
    high?: { url?: string };
    default?: { url?: string };
  };
  duration?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  categoryId?: string;
}

function getStringValue(source: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!source) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function getNumberValue(source: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!source) return undefined;

  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function buildFallbackVideoDetails(
  videoId: string,
  transcriptData: Record<string, unknown> | null,
  nestedTranscriptData: Record<string, unknown> | null,
): YouTubeVideoDetails {
  const transcriptMetadata = isRecord(transcriptData?.metadata) ? transcriptData.metadata : null;
  const nestedTranscriptMetadata = isRecord(nestedTranscriptData?.metadata) ? nestedTranscriptData.metadata : null;

  const title = getStringValue(transcriptData, ['title', 'video_title', 'videoTitle'])
    ?? getStringValue(nestedTranscriptData, ['title', 'video_title', 'videoTitle'])
    ?? getStringValue(transcriptMetadata, ['title'])
    ?? getStringValue(nestedTranscriptMetadata, ['title'])
    ?? `YouTube Video ${videoId}`;

  const description = getStringValue(transcriptData, ['description', 'video_description'])
    ?? getStringValue(nestedTranscriptData, ['description', 'video_description']);

  const channelTitle = getStringValue(transcriptData, ['channelTitle', 'channel_title', 'channel_name'])
    ?? getStringValue(nestedTranscriptData, ['channelTitle', 'channel_title', 'channel_name']);

  const channelId = getStringValue(transcriptData, ['channelId', 'channel_id'])
    ?? getStringValue(nestedTranscriptData, ['channelId', 'channel_id']);

  const publishedAt = getStringValue(transcriptData, ['publishedAt', 'published_at'])
    ?? getStringValue(nestedTranscriptData, ['publishedAt', 'published_at']);

  const duration = getStringValue(transcriptData, ['duration', 'youtube_duration'])
    ?? getStringValue(nestedTranscriptData, ['duration', 'youtube_duration']);

  const thumbnailUrl = getStringValue(transcriptData, ['thumbnail', 'thumbnail_url'])
    ?? getStringValue(nestedTranscriptData, ['thumbnail', 'thumbnail_url']);

  const metadataThumbnailUrl = getStringValue(transcriptMetadata, ['thumbnail_url'])
    ?? getStringValue(nestedTranscriptMetadata, ['thumbnail_url']);

  const resolvedChannelTitle = channelTitle
    ?? getStringValue(transcriptMetadata, ['author_name'])
    ?? getStringValue(nestedTranscriptMetadata, ['author_name']);

  const viewCount = getNumberValue(transcriptData, ['viewCount', 'view_count', 'youtube_view_count'])
    ?? getNumberValue(nestedTranscriptData, ['viewCount', 'view_count', 'youtube_view_count']);

  const likeCount = getNumberValue(transcriptData, ['likeCount', 'like_count', 'youtube_like_count'])
    ?? getNumberValue(nestedTranscriptData, ['likeCount', 'like_count', 'youtube_like_count']);

  return {
    title,
    description,
    channelId,
    channelTitle: resolvedChannelTitle,
    publishedAt,
    duration,
    viewCount,
    likeCount,
    thumbnails: (thumbnailUrl ?? metadataThumbnailUrl) ? { high: { url: thumbnailUrl ?? metadataThumbnailUrl } } : undefined,
  };
}

/**
 * Format seconds to MM:SS or HH:MM:SS timestamp string
 */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Extract a segment array from transcript data (if present).
 * Returns an array of { text, start?, duration? } objects.
 */
function extractSegmentArray(data: Record<string, unknown> | null): Array<{ text: string; start?: number; duration?: number }> | null {
  if (!data) return null;

  const tryParse = (arr: unknown[]): Array<{ text: string; start?: number; duration?: number }> | null => {
    const result: Array<{ text: string; start?: number; duration?: number }> = [];
    for (const item of arr) {
      if (typeof item === 'string' && item.trim()) {
        result.push({ text: item });
      } else if (isRecord(item) && typeof item.text === 'string' && item.text.trim()) {
        const start = typeof item.start === 'number' ? item.start
          : typeof item.offset === 'number' ? item.offset
          : typeof item.timestamp === 'number' ? item.timestamp
          : undefined;
        const duration = typeof item.duration === 'number' ? item.duration : undefined;
        result.push({ text: item.text, start, duration });
      }
    }
    return result.length > 0 ? result : null;
  };

  if (Array.isArray(data.transcript)) {
    const segments = tryParse(data.transcript);
    if (segments) return segments;
  }
  if (Array.isArray(data.segments)) {
    const segments = tryParse(data.segments);
    if (segments) return segments;
  }

  return null;
}

/**
 * Extract transcript text from a single response data object.
 *
 * Handles all TranscriptAPI v2 response shapes:
 *   - transcript as string (format=text)
 *   - transcript as array of segment objects (format=json)
 *   - segments as array (defensive, some docs show this key)
 *   - text as string (legacy fallback)
 *
 * When segments include timestamps, formats them as "[MM:SS] text" lines
 * for readable display with timestamps.
 */
function extractTranscriptFromData(data: Record<string, unknown> | null): string | null {
  if (!data) return null;

  // 1. Try segment arrays with timestamps first (json format)
  const segments = extractSegmentArray(data);
  if (segments) {
    const hasTimestamps = segments.some(s => s.start !== undefined);
    if (hasTimestamps) {
      // Format with timestamps: group into ~30-second paragraphs
      const lines: string[] = [];
      let lastTimestamp = -999;

      for (const seg of segments) {
        const ts = seg.start !== undefined ? formatTimestamp(seg.start) : null;
        // Add timestamp header every ~30 seconds
        if (ts && seg.start !== undefined && (seg.start - lastTimestamp >= 30)) {
          lines.push(`\n[${ts}]`);
          lastTimestamp = seg.start;
        }
        lines.push(seg.text);
      }

      const joined = lines.join('\n').trim();
      if (joined.length > 0) return joined;
    } else {
      // No timestamps — just join text
      const joined = segments.map(s => s.text).join('\n');
      if (joined.length > 0) return joined;
    }
  }

  // 2. transcript as plain string (text format fallback)
  const transcript = data.transcript;
  if (typeof transcript === 'string' && transcript.trim().length > 0) {
    return transcript;
  }

  // 3. top-level text field (legacy fallback)
  const text = data.text;
  if (typeof text === 'string' && text.trim().length > 0) {
    return text;
  }

  return null;
}

function extractTranscriptText(
  transcriptData: Record<string, unknown> | null,
  nestedTranscriptData: Record<string, unknown> | null,
): string | null {
  return extractTranscriptFromData(transcriptData) ?? extractTranscriptFromData(nestedTranscriptData);
}

/**
 * Extract video ID from various YouTube URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - Direct video ID (11 characters, alphanumeric + _ -)
 */
function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  
  // Check if it's a direct video ID (11 chars, alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Try various URL patterns
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // Old embed URL: youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // With www or without
    /(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Generate a unique recording_id for YouTube imports
 * Uses timestamp-based approach with a prefix to avoid collision with Fathom IDs
 * YouTube recording IDs use the 9000000000000+ range
 */
function generateYouTubeRecordingId(): number {
  // Use 9000000000000 as base to avoid collision with Fathom's recording IDs
  // Add timestamp in milliseconds to ensure uniqueness
  const base = 9000000000000;
  const timestamp = Date.now();
  return base + timestamp;
}

/**
 * Parse ISO 8601 duration (e.g., "PT1H2M10S") to seconds
 * Used to populate recordings.duration field
 */
function parseDurationToSeconds(iso8601: string | undefined | null): number | null {
  if (!iso8601 || typeof iso8601 !== 'string') return null;
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const secs = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + secs;
}

function parseJsonSafely(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createDownstreamFailureResponse(
  source: DownstreamSource,
  stage: ImportStage,
  step: ImportStep,
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
  details?: unknown,
): Response {
  const payload: DownstreamErrorResponse = {
    success: false,
    step,
    error,
    source,
    stage,
    status,
    details,
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'No authorization header' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    // Store the user's JWT token to pass to internal function calls
    const userJwtToken = token;

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Unauthorized' 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: ImportRequest = await req.json();
    
    if (!body.videoUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Missing videoUrl in request body' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`YouTube import request - User: ${user.id}, URL: ${body.videoUrl}`);

    // ========================================================================
    // Step 0: Ensure YouTube vault exists (auto-create on first import)
    // ========================================================================
    let youtubeVaultId: string | null = body.vault_id || null;
    let resolvedPersonalBankId: string | null = null;

    if (!youtubeVaultId) {
      try {
        // Find user's personal bank via bank_memberships
        // Use two separate queries instead of a join to avoid PostgREST join issues
        const { data: bankMemberships, error: bankError } = await supabase
          .from('bank_memberships')
          .select('bank_id')
          .eq('user_id', user.id);

        if (bankError) {
          console.error('Error finding bank memberships:', bankError);
        }

        if (bankMemberships && bankMemberships.length > 0) {
          // Look up which of these banks is a personal bank
          const bankIds = bankMemberships.map(bm => bm.bank_id);
          const { data: personalBank, error: personalBankError } = await supabase
            .from('banks')
            .select('id')
            .in('id', bankIds)
            .eq('type', 'personal')
            .maybeSingle();

          if (personalBankError) {
            console.error('Error finding personal bank:', personalBankError);
          }

          resolvedPersonalBankId = personalBank?.id || null;
          console.log(`Found personal bank: ${resolvedPersonalBankId} (from ${bankMemberships.length} memberships)`);
        } else {
          console.warn('No bank memberships found for user:', user.id);
        }

        const personalBankId = resolvedPersonalBankId;

        if (personalBankId) {
          // Check for existing YouTube vault in that bank
          const { data: existingVault, error: vaultCheckError } = await supabase
            .from('vaults')
            .select('id')
            .eq('bank_id', personalBankId)
            .eq('vault_type', 'youtube')
            .maybeSingle();

          if (vaultCheckError) {
            console.error('Error checking for YouTube vault:', vaultCheckError);
          }

          if (existingVault) {
            youtubeVaultId = existingVault.id;
            console.log(`Found existing YouTube vault: ${youtubeVaultId}`);
          } else {
            // Create YouTube vault
            const { data: newVault, error: createVaultError } = await supabase
              .from('vaults')
              .insert({
                bank_id: personalBankId,
                name: 'YouTube Vault',
                vault_type: 'youtube',
              })
              .select('id')
              .single();

            if (createVaultError) {
              console.error('Error creating YouTube vault:', createVaultError);
            } else if (newVault) {
              youtubeVaultId = newVault.id;
              console.log(`Created YouTube vault: ${youtubeVaultId}`);

              // Create vault_membership for user as vault_owner
              const { error: membershipError } = await supabase
                .from('vault_memberships')
                .insert({
                  vault_id: newVault.id,
                  user_id: user.id,
                  role: 'vault_owner',
                });

              if (membershipError) {
                console.error('Error creating vault membership:', membershipError);
              }
            }
          }
        }
      } catch (vaultSetupError) {
        // Never block import on vault auto-creation failures
        console.error('Error in YouTube vault auto-creation:', vaultSetupError);
      }
    }

    // ========================================================================
    // Step 1: Validate URL and extract video ID
    // ========================================================================
    const videoId = extractVideoId(body.videoUrl);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'validating' as ImportStep,
          error: 'Invalid YouTube URL. Supported formats: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, or direct 11-character video ID' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted video ID: ${videoId}`);

    // ========================================================================
    // Step 2: Check for duplicate import
    // ========================================================================
    const { data: existingCall, error: checkError } = await supabase
      .from('fathom_calls')
      .select('recording_id, title')
      .eq('user_id', user.id)
      .eq('source_platform', 'youtube')
      .filter('metadata->>youtube_video_id', 'eq', videoId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for duplicate:', checkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'checking' as ImportStep,
          error: 'Failed to check for existing imports' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingCall) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'checking' as ImportStep,
          error: 'Video already imported',
          exists: true,
          recordingId: existingCall.recording_id,
          title: existingCall.title
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const youtubeApiHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userJwtToken}`,
    };

    // ========================================================================
    // Step 3: Fetch video details via youtube-api function (best effort)
    // ========================================================================
    let videoDetails: YouTubeVideoDetails | null = null;

    try {
      const detailsResponse = await fetch(`${supabaseUrl}/functions/v1/youtube-api`, {
        method: 'POST',
        headers: youtubeApiHeaders,
        body: JSON.stringify({
          action: 'video-details',
          params: { videoId },
        }),
      });

      const detailsRaw = await detailsResponse.text();
      const detailsPayload = parseJsonSafely(detailsRaw);

      if (!detailsResponse.ok) {
        console.warn('[youtube-import] youtube-api video-details unavailable; continuing with transcript metadata fallback', {
          stage: 'video-details',
          downstreamStatus: detailsResponse.status,
          detailsPayload,
        });
      } else {
        const detailsResult = isRecord(detailsPayload) ? detailsPayload : null;
        const detailsData = isRecord(detailsResult?.data) ? detailsResult.data : null;

        if (detailsResult?.success && detailsData && typeof detailsData.title === 'string') {
          videoDetails = detailsData as unknown as YouTubeVideoDetails;
          console.log(`Fetched video details: "${videoDetails.title}"`);
        } else {
          console.warn('[youtube-import] youtube-api returned invalid video-details payload; falling back to transcript metadata');
        }
      }
    } catch (detailsError) {
      console.warn('[youtube-import] video-details fetch failed; falling back to transcript metadata', detailsError);
    }

    // ========================================================================
    // Step 4: Fetch transcript via Transcript API (direct)
    // ========================================================================
    const transcriptApiKey = normalizeSecret(Deno.env.get('TRANSCRIPT_API_KEY'));
    if (!transcriptApiKey) {
      return createDownstreamFailureResponse(
        'transcripts-api',
        'transcript',
        'transcribing',
        500,
        'Transcript API key not configured',
        corsHeaders,
      );
    }

    const transcriptUrl = new URL(TRANSCRIPT_API_BASE);
    transcriptUrl.searchParams.set('video_url', videoId);
    transcriptUrl.searchParams.set('format', 'json');
    transcriptUrl.searchParams.set('include_timestamp', 'true');
    transcriptUrl.searchParams.set('send_metadata', 'true');

    console.log(`[youtube-import] Fetching transcript from: ${transcriptUrl.toString()}`);

    const transcriptResponse = await fetch(transcriptUrl.toString(), {
      headers: {
        Authorization: `Bearer ${transcriptApiKey}`,
      },
    });

    const transcriptRaw = await transcriptResponse.text();
    const transcriptPayload = parseJsonSafely(transcriptRaw);

    if (!transcriptResponse.ok) {
      console.error('[youtube-import] downstream transcript api failure', {
        stage: 'transcript',
        downstreamStatus: transcriptResponse.status,
        responseBody: typeof transcriptRaw === 'string' ? transcriptRaw.slice(0, 500) : 'empty',
      });
      return createDownstreamFailureResponse(
        'transcripts-api',
        'transcript',
        'transcribing',
        transcriptResponse.status,
        'transcripts-api transcript stage failed',
        corsHeaders,
        transcriptPayload,
      );
    }

    const transcriptData = isRecord(transcriptPayload) ? transcriptPayload : null;
    const nestedTranscriptData = isRecord(transcriptData?.data) ? transcriptData.data : null;

    const transcriptText = extractTranscriptText(transcriptData, nestedTranscriptData);

    if (!transcriptText) {
      console.error('[youtube-import] invalid transcript api success payload', {
        stage: 'transcript',
      });
      return createDownstreamFailureResponse(
        'transcripts-api',
        'transcript',
        'transcribing',
        502,
        'transcripts-api transcript returned invalid payload',
        corsHeaders,
        transcriptPayload,
      );
    }

    if (!videoDetails) {
      videoDetails = buildFallbackVideoDetails(videoId, transcriptData, nestedTranscriptData);
      console.log(`Using transcript-derived metadata fallback for video: "${videoDetails.title}"`);
    }

    console.log(`Fetched transcript: ${transcriptText.length} characters`);

    // ========================================================================
    // Step 5: Create fathom_calls record
    // ========================================================================
    const recordingId = generateYouTubeRecordingId();
    
    // Prepare metadata JSONB
    const metadata = {
      youtube_video_id: videoId,
      youtube_channel_id: videoDetails.channelId,
      youtube_channel_title: videoDetails.channelTitle,
      youtube_description: (videoDetails.description || '').substring(0, 1000), // Truncate to 1000 chars
      youtube_thumbnail: videoDetails.thumbnails?.high?.url || videoDetails.thumbnails?.default?.url,
      youtube_duration: videoDetails.duration,
      youtube_view_count: videoDetails.viewCount,
      youtube_like_count: videoDetails.likeCount,
      import_source: 'youtube-import',
      imported_at: new Date().toISOString(),
    };

    // Parse publishedAt date for recording_start_time
    const publishedAt = videoDetails.publishedAt 
      ? new Date(videoDetails.publishedAt).toISOString()
      : new Date().toISOString();

    const insertData = {
      recording_id: recordingId,
      user_id: user.id,
      title: videoDetails.title,
      full_transcript: transcriptText,
      recording_start_time: publishedAt,
      created_at: new Date().toISOString(),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      source_platform: 'youtube',
      metadata: metadata,
      // Set deduplication fields
      is_primary: true,
      transcript_source: 'native', // YouTube's native captions
    };

    const { error: insertError } = await supabase
      .from('fathom_calls')
      .insert(insertData);

    if (insertError) {
      console.error('Error inserting call record:', insertError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          step: 'processing' as ImportStep,
          error: 'Failed to save video import' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully imported YouTube video as recording_id: ${recordingId}`);

    // ========================================================================
    // Step 6: Create recording in recordings table + vault entry
    // ========================================================================
    let newRecordingUuid: string | null = null;

    try {
      // Reuse the personal bank found in Step 0, or fall back to first membership
      let recordingBankId = resolvedPersonalBankId;
      if (!recordingBankId) {
        const { data: userBank } = await supabase
          .from('bank_memberships')
          .select('bank_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        recordingBankId = userBank?.bank_id || null;
      }

      if (recordingBankId) {
        // Parse duration to seconds for recordings table
        const durationSeconds = parseDurationToSeconds(videoDetails.duration);

        // Build source_metadata matching YouTubeVideoMetadata interface
        const sourceMetadata = {
          youtube_video_id: videoId,
          youtube_channel_id: videoDetails.channelId,
          youtube_channel_title: videoDetails.channelTitle,
          youtube_description: (videoDetails.description || '').substring(0, 1000),
          youtube_thumbnail: videoDetails.thumbnails?.high?.url || videoDetails.thumbnails?.default?.url,
          youtube_duration: videoDetails.duration,
          youtube_view_count: videoDetails.viewCount,
          youtube_like_count: videoDetails.likeCount,
          youtube_comment_count: videoDetails.commentCount || null,
          youtube_category_id: videoDetails.categoryId || null,
          import_source: 'youtube-import',
          imported_at: new Date().toISOString(),
        };

        // Create recording directly in recordings table
        const { data: newRecording, error: recordingInsertError } = await supabase
          .from('recordings')
          .insert({
            bank_id: recordingBankId,
            owner_user_id: user.id,
            legacy_recording_id: recordingId,
            title: videoDetails.title,
            full_transcript: transcriptText,
            source_app: 'youtube',
            source_metadata: sourceMetadata,
            duration: durationSeconds,
            recording_start_time: publishedAt,
            global_tags: [],
          })
          .select('id')
          .single();

        if (recordingInsertError) {
          console.error('Error creating recording:', recordingInsertError);
        } else if (newRecording) {
          newRecordingUuid = newRecording.id;
          console.log(`Created recording ${newRecordingUuid} with source_metadata`);
        }
      }
    } catch (recordingError) {
      // Never block import on recording table failures
      console.error('Error creating recording entry:', recordingError);
    }

    // Create vault entry linking recording to YouTube vault
    if (youtubeVaultId && newRecordingUuid) {
      try {
        // Validate vault membership
        const { data: membership, error: membershipError } = await supabase
          .from('vault_memberships')
          .select('id')
          .eq('vault_id', youtubeVaultId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (membershipError) {
          console.error('Error checking vault membership:', membershipError);
        } else if (!membership) {
          console.warn(`User ${user.id} is not a member of vault ${youtubeVaultId}, skipping vault entry`);
        } else {
          const { error: vaultEntryError } = await supabase
            .from('vault_entries')
            .insert({
              vault_id: youtubeVaultId,
              recording_id: newRecordingUuid,
            });

          if (vaultEntryError) {
            // Don't fail the whole import for vault entry issues
            console.error('Error creating vault entry:', vaultEntryError);
          } else {
            console.log(`Created vault entry for recording ${newRecordingUuid} in vault ${youtubeVaultId}`);
          }
        }
      } catch (vaultError) {
        // Never fail the import due to vault entry issues
        console.error('Error handling vault entry:', vaultError);
      }
    }

    // ========================================================================
    // Step 7: Return success
    // ========================================================================
    const response: ImportResponse & { vaultId?: string } = {
      success: true,
      step: 'done',
      recordingId: recordingId,
      title: videoDetails.title,
    };

    if (youtubeVaultId) {
      response.vaultId = youtubeVaultId;
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('YouTube import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        step: 'processing' as ImportStep,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
