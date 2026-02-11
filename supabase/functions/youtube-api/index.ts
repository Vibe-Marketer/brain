import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// YouTube Data API v3 base URL
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const TRANSCRIPT_API_BASE = 'https://transcriptapi.com/api/v2/youtube/transcript';

class ApiHttpError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
    this.details = details;
  }
}

function parseJsonSafely(raw: string): unknown {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createApiHttpError(source: string, status: number, rawBody: string): ApiHttpError {
  const details = parseJsonSafely(rawBody);
  return new ApiHttpError(`${source} error (${status})`, status, details);
}

function normalizeSecret(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.replace(/^['"]|['"]$/g, '');
}

interface YouTubeSearchParams {
  query: string;
  maxResults?: number;
}

interface ChannelVideosParams {
  channelId: string;
  maxResults?: number;
}

interface VideoDetailsParams {
  videoId: string;
}

interface TranscriptParams {
  videoId: string;
}

interface BatchTranscriptsParams {
  videoIds: string[];
}

interface YouTubeApiRequest {
  action: 'search' | 'channel-videos' | 'video-details' | 'transcript' | 'batch-transcripts';
  params: YouTubeSearchParams | ChannelVideosParams | VideoDetailsParams | TranscriptParams | BatchTranscriptsParams;
}

/**
 * Search YouTube videos by query
 */
async function searchVideos(query: string, maxResults: number = 10, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('q', query);
  url.searchParams.append('maxResults', maxResults.toString());
  url.searchParams.append('type', 'video');
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw createApiHttpError('YouTube API search', response.status, await response.text());
  }

  const data = await response.json();

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    videos: data.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelId: item.snippet.channelId,
      channelTitle: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
    })),
    totalResults: data.pageInfo.totalResults,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get videos from a specific channel
 */
async function getChannelVideos(channelId: string, maxResults: number = 25, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('channelId', channelId);
  url.searchParams.append('maxResults', maxResults.toString());
  url.searchParams.append('type', 'video');
  url.searchParams.append('order', 'date');
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw createApiHttpError('YouTube API channel videos', response.status, await response.text());
  }

  const data = await response.json();

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    videos: data.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnails: item.snippet.thumbnails,
    })),
    totalResults: data.pageInfo.totalResults,
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get detailed information about a video
 */
async function getVideoDetails(videoId: string, apiKey: string) {
  const url = new URL(`${YOUTUBE_API_BASE}/videos`);
  url.searchParams.append('part', 'snippet,contentDetails,statistics');
  url.searchParams.append('id', videoId);
  url.searchParams.append('key', apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw createApiHttpError('YouTube API video details', response.status, await response.text());
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    throw new Error(`Video ${videoId} not found`);
  }

  const video = data.items[0];

  return {
    videoId: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    channelId: video.snippet.channelId,
    channelTitle: video.snippet.channelTitle,
    publishedAt: video.snippet.publishedAt,
    thumbnails: video.snippet.thumbnails,
    tags: video.snippet.tags || [],
    categoryId: video.snippet.categoryId,
    duration: video.contentDetails.duration,
    definition: video.contentDetails.definition,
    caption: video.contentDetails.caption,
    viewCount: parseInt(video.statistics.viewCount || '0'),
    likeCount: parseInt(video.statistics.likeCount || '0'),
    commentCount: parseInt(video.statistics.commentCount || '0'),
  };
}

/**
 * Get transcript for a single video
 */
async function getVideoTranscript(videoId: string, transcriptApiKey: string) {
  const url = new URL(TRANSCRIPT_API_BASE);
  url.searchParams.set('video_url', videoId);
  url.searchParams.set('format', 'json');
  url.searchParams.set('include_timestamp', 'false');
  url.searchParams.set('send_metadata', 'true');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${transcriptApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw createApiHttpError('Transcript API', response.status, await response.text());
  }

  const payload = parseJsonSafely(await response.text());
  const data = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const transcript = typeof data?.transcript === 'string'
    ? data.transcript
    : typeof data?.text === 'string'
      ? data.text
      : null;

  if (!transcript) {
    throw new ApiHttpError('Transcript API returned invalid payload', 502, payload);
  }

  return {
    videoId,
    transcript,
    language: typeof data?.language === 'string' ? data.language : undefined,
    duration: typeof data?.duration === 'number' ? data.duration : undefined,
  };
}

/**
 * Get transcripts for multiple videos in parallel
 */
async function getBatchTranscripts(videoIds: string[], transcriptApiKey: string) {
  const results = await Promise.allSettled(
    videoIds.map(videoId => getVideoTranscript(videoId, transcriptApiKey))
  );

  const transcripts: Array<{
    videoId: string;
    transcript: string;
    language?: string;
    duration?: number;
  }> = [];
  const errors: Array<{
    videoId: string;
    error: string;
  }> = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const videoId = videoIds[i];

    if (result.status === 'fulfilled') {
      transcripts.push(result.value);
    } else {
      errors.push({
        videoId,
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
      });
    }
  }

  return {
    transcripts,
    errors,
    totalRequested: videoIds.length,
    successCount: transcripts.length,
    failureCount: errors.length,
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API keys from environment
    const youtubeApiKey = normalizeSecret(Deno.env.get('YOUTUBE_DATA_API_KEY'));
    const transcriptApiKey = normalizeSecret(Deno.env.get('TRANSCRIPT_API_KEY'));

    if (!youtubeApiKey) {
      return new Response(
        JSON.stringify({ error: 'YouTube Data API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only require transcript API key for transcript-related actions
    const { action, params }: YouTubeApiRequest = await req.json();

    if (!action || !params) {
      return new Response(
        JSON.stringify({ error: 'Missing action or params in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authorization for protected endpoints
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`YouTube API request - Action: ${action}, User: ${user.id}`);

    let result;

    switch (action) {
      case 'search': {
        const { query, maxResults = 10 } = params as YouTubeSearchParams;
        if (!query) {
          return new Response(
            JSON.stringify({ error: 'Missing query parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await searchVideos(query, maxResults, youtubeApiKey);
        break;
      }

      case 'channel-videos': {
        const { channelId, maxResults = 25 } = params as ChannelVideosParams;
        if (!channelId) {
          return new Response(
            JSON.stringify({ error: 'Missing channelId parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getChannelVideos(channelId, maxResults, youtubeApiKey);
        break;
      }

      case 'video-details': {
        const { videoId } = params as VideoDetailsParams;
        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'Missing videoId parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getVideoDetails(videoId, youtubeApiKey);
        break;
      }

      case 'transcript': {
        if (!transcriptApiKey) {
          return new Response(
            JSON.stringify({ error: 'Transcript API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { videoId } = params as TranscriptParams;
        if (!videoId) {
          return new Response(
            JSON.stringify({ error: 'Missing videoId parameter' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getVideoTranscript(videoId, transcriptApiKey);
        break;
      }

      case 'batch-transcripts': {
        if (!transcriptApiKey) {
          return new Response(
            JSON.stringify({ error: 'Transcript API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const { videoIds } = params as BatchTranscriptsParams;
        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Missing or invalid videoIds parameter (must be non-empty array)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await getBatchTranscripts(videoIds, transcriptApiKey);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('YouTube API error:', error);

    if (error instanceof ApiHttpError) {
      return new Response(
        JSON.stringify({ success: false, error: error.message, details: error.details }),
        { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
