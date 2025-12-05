/**
 * Centralized API client for backend function calls
 * Provides consistent error handling and retry logic
 */

import { supabase } from "@/integrations/supabase/client";
import { retryWithBackoff, getErrorMessage } from "./fathom";
import { logger } from "./logger";

// API Response types
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
}

// YouTube thumbnail type
export interface YouTubeThumbnails {
  default?: { url: string; width: number; height: number };
  medium?: { url: string; width: number; height: number };
  high?: { url: string; width: number; height: number };
  standard?: { url: string; width: number; height: number };
  maxres?: { url: string; width: number; height: number };
}

/**
 * Call a backend edge function with automatic retry and error handling
 */
export async function callEdgeFunction<T = unknown>(
  functionName: string,
  body?: Record<string, unknown>,
  options: { retry?: boolean; maxRetries?: number } = {}
): Promise<ApiResponse<T>> {
  const { retry = true, maxRetries = 3 } = options;

  const makeRequest = async () => {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });

    if (error) {
      logger.error(`Edge function ${functionName} error`, error);
      throw error;
    }

    return data as T;
  };

  try {
    if (retry) {
      const data = await retryWithBackoff(makeRequest, maxRetries);
      return { data };
    } else {
      const data = await makeRequest();
      return { data };
    }
  } catch (error: any) {
    const errorMessage = getErrorMessage(error);
    logger.error(`Failed to call ${functionName}`, error);
    return { error: errorMessage };
  }
}

/**
 * Fetch meetings from Fathom
 */
export async function fetchMeetings(params: {
  createdAfter?: string;
  createdBefore?: string;
}) {
  return callEdgeFunction('fetch-meetings', params);
}

/**
 * Sync meetings to database
 */
export async function syncMeetings(recordingIds: number[]) {
  return callEdgeFunction('sync-meetings', { recordingIds });
}

/**
 * Fetch a single meeting with full details
 */
export async function fetchSingleMeeting(recordingId: number) {
  return callEdgeFunction('fetch-single-meeting', { recordingId });
}

/**
 * Test Fathom connection
 */
export async function testFathomConnection() {
  return callEdgeFunction('test-fathom-connection', undefined, { retry: false });
}

/**
 * Save Fathom API key
 */
export async function saveFathomKey(apiKey: string) {
  return callEdgeFunction('save-fathom-key', { apiKey }, { retry: false });
}

/**
 * Save webhook secret
 */
export async function saveWebhookSecret(secret: string) {
  return callEdgeFunction('save-webhook-secret', { secret }, { retry: false });
}

/**
 * Save host email
 */
export async function saveHostEmail(email: string) {
  return callEdgeFunction('save-host-email', { email }, { retry: false });
}

/**
 * Get configuration status
 */
export async function getConfigStatus() {
  return callEdgeFunction('get-config-status', undefined, { retry: false });
}

/**
 * Re-sync all calls from Fathom
 */
export async function resyncAllCalls() {
  return callEdgeFunction('resync-all-calls', undefined, { retry: false });
}

/**
 * Delete all synced calls
 */
export async function deleteAllCalls() {
  return callEdgeFunction('delete-all-calls', undefined, { retry: false });
}

/**
 * Get Fathom OAuth authorization URL
 */
export async function getFathomOAuthUrl() {
  return callEdgeFunction('fathom-oauth-url', undefined, { retry: false });
}

/**
 * Complete Fathom OAuth flow
 */
export async function completeFathomOAuth(code: string, state: string) {
  return callEdgeFunction('fathom-oauth-callback', { code, state }, { retry: false });
}

/**
 * Refresh Fathom OAuth token
 */
export async function refreshFathomOAuth() {
  return callEdgeFunction('fathom-oauth-refresh', undefined, { retry: false });
}

/**
 * Auto-create webhook using OAuth
 */
export async function createFathomWebhook() {
  return callEdgeFunction('create-fathom-webhook', undefined, { retry: false });
}

// =============================================
// AI CHAT & RAG FUNCTIONS
// =============================================

/**
 * Diversity Filter Utility
 * Location: supabase/functions/_shared/diversity-filter.ts
 *
 * Purpose: Filters search results to ensure diversity across recordings and semantic topics
 *
 * Typical RAG Flow:
 *   hybrid_search_transcripts (20 results)
 *     → rerank-results (top 10 by relevance)
 *     → diversity_filter (top 5 diverse results)
 *     → LLM context
 *
 * Functions:
 *   - diversityFilter() - Full filtering with semantic similarity checking
 *   - simpleDiversityFilter() - Recording-based filtering only (no embeddings)
 *
 * Options:
 *   - maxPerRecording: Max chunks from same recording (default: 2)
 *   - minSemanticDistance: Min cosine distance between chunks (default: 0.3)
 *   - targetCount: Target number of diverse results (default: 5)
 */

export interface EmbedChunksResponse {
  success: boolean;
  job_id: string;
  recordings_processed: number;
  recordings_failed: number;
  chunks_created: number;
  failed_recording_ids: number[];
}

/**
 * Embed transcript chunks for RAG search
 * Creates embeddings for the specified recordings and stores them in transcript_chunks table
 */
export async function embedChunks(recordingIds: number[]): Promise<ApiResponse<EmbedChunksResponse>> {
  return callEdgeFunction<EmbedChunksResponse>('embed-chunks', { recording_ids: recordingIds }, { retry: false });
}

/**
 * Embed all unindexed transcripts for a user
 * Finds all recordings that don't have chunks and embeds them
 */
export async function embedAllUnindexedTranscripts(): Promise<ApiResponse<EmbedChunksResponse>> {
  // This will be implemented by finding unindexed recordings first
  // For now, we'll use the embed-chunks endpoint with auto-discovery
  return callEdgeFunction<EmbedChunksResponse>('embed-chunks', { auto_discover: true }, { retry: false });
}

// =============================================
// AI TAGGING & TITLE FUNCTIONS
// =============================================

/**
 * Auto-tag calls using AI
 * Analyzes transcript and summary to generate relevant tags
 * Uses OpenAI GPT-4o-mini via Vercel AI SDK
 */
export async function autoTagCalls(recordingIds: number[]) {
  return callEdgeFunction('auto-tag-calls', { recordingIds }, { retry: false });
}

/**
 * Generate AI-powered titles for calls
 * Creates concise, descriptive titles based on content
 * Uses OpenAI GPT-4o-mini via Vercel AI SDK
 */
export async function generateAiTitles(recordingIds: number[]) {
  return callEdgeFunction('generate-ai-titles', { recordingIds }, { retry: false });
}

/**
 * Enrich transcript chunks with metadata
 * Extracts topics, sentiment, entities, and intent signals using GPT-4o-mini
 * Can process specific chunks, recordings, or auto-discover chunks without metadata
 */
export async function enrichChunkMetadata(params: {
  chunk_ids?: string[];
  recording_ids?: number[];
  auto_discover?: boolean;
}) {
  return callEdgeFunction('enrich-chunk-metadata', params, { retry: false });
}

/**
 * Re-rank search results using cross-encoder model
 * Uses HuggingFace cross-encoder/ms-marco-MiniLM-L-12-v2 for accurate query-document relevance scoring
 * Takes hybrid search candidates and returns top-k most relevant chunks
 */
export interface RerankChunkCandidate {
  chunk_id: string;
  chunk_text: string;
  recording_id: number;
  speaker_name?: string;
  call_title?: string;
  rrf_score: number;  // Original hybrid search score
}

export interface RerankResult extends RerankChunkCandidate {
  rerank_score: number;
  final_rank: number;
}

export interface RerankResponse {
  success: boolean;
  query: string;
  model: string;
  total_candidates: number;
  returned: number;
  results: RerankResult[];
}

export async function rerankResults(params: {
  query: string;
  chunks: RerankChunkCandidate[];
  top_k?: number;
  batch_size?: number;
}): Promise<ApiResponse<RerankResponse>> {
  return callEdgeFunction<RerankResponse>('rerank-results', params, { retry: false });
}

// =============================================
// YOUTUBE API FUNCTIONS
// =============================================

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails: YouTubeThumbnails;
}

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  totalResults: number;
  nextPageToken?: string;
}

export interface YouTubeVideoDetails extends YouTubeVideo {
  tags: string[];
  categoryId: string;
  duration: string;
  definition: string;
  caption: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface VideoTranscript {
  videoId: string;
  transcript: string;
  language: string;
  duration: number;
}

export interface BatchTranscriptsResult {
  transcripts: VideoTranscript[];
  errors: Array<{ videoId: string; error: string }>;
  totalRequested: number;
  successCount: number;
  failureCount: number;
}

/**
 * Search YouTube videos by query
 * Returns video results matching the search query
 */
export async function searchYouTubeVideos(query: string, maxResults: number = 10): Promise<ApiResponse<YouTubeSearchResult>> {
  return callEdgeFunction<YouTubeSearchResult>('youtube-api', {
    action: 'search',
    params: { query, maxResults },
  });
}

/**
 * Get videos from a specific YouTube channel
 * Returns recent videos from the channel
 */
export async function getChannelVideos(channelId: string, maxResults: number = 25): Promise<ApiResponse<YouTubeSearchResult>> {
  return callEdgeFunction<YouTubeSearchResult>('youtube-api', {
    action: 'channel-videos',
    params: { channelId, maxResults },
  });
}

/**
 * Get detailed information about a YouTube video
 * Includes statistics, duration, tags, and content details
 */
export async function getVideoDetails(videoId: string): Promise<ApiResponse<YouTubeVideoDetails>> {
  return callEdgeFunction<YouTubeVideoDetails>('youtube-api', {
    action: 'video-details',
    params: { videoId },
  });
}

/**
 * Get transcript for a single YouTube video
 * Returns full transcript text with language and duration
 */
export async function getVideoTranscript(videoId: string): Promise<ApiResponse<VideoTranscript>> {
  return callEdgeFunction<VideoTranscript>('youtube-api', {
    action: 'transcript',
    params: { videoId },
  });
}

/**
 * Get transcripts for multiple YouTube videos in parallel
 * Efficiently fetches transcripts for batch processing
 * Returns both successful transcripts and any errors
 */
export async function getBatchTranscripts(videoIds: string[]): Promise<ApiResponse<BatchTranscriptsResult>> {
  return callEdgeFunction<BatchTranscriptsResult>('youtube-api', {
    action: 'batch-transcripts',
    params: { videoIds },
  });
}

// =============================================
// EXPORT AI FUNCTIONS
// =============================================

export interface MetaSummaryResult {
  success: boolean;
  meta_summary: {
    executive_summary: string;
    key_themes: string[];
    key_decisions: string[];
    action_items: string[];
    notable_insights: string[];
    participant_highlights: Array<{
      name: string;
      key_contributions: string[];
    }>;
    timeline_summary: string;
  };
  meetings_analyzed: number;
  total_duration_minutes: number;
}

/**
 * Generate AI meta-summary across multiple meetings
 * Analyzes summaries and transcripts to extract themes, decisions, action items
 * Uses GPT-4o for comprehensive analysis
 */
export async function generateMetaSummary(params: {
  recording_ids: number[];
  include_transcripts?: boolean;
  focus_areas?: string[];
}): Promise<ApiResponse<MetaSummaryResult>> {
  return callEdgeFunction<MetaSummaryResult>('generate-meta-summary', params, { retry: false });
}
