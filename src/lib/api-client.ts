/**
 * Centralized API client for backend function calls
 * Provides consistent error handling and retry logic
 */

import { supabase } from "@/integrations/supabase/client";
import { retryWithBackoff, getErrorMessage } from "./utils";
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

export interface OAuthUrlResponse {
  authUrl: string;
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
    // Ensure we have a valid session before making the request
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      logger.error(`Session error before calling ${functionName}`, sessionError);
      throw new Error(`Authentication error: ${sessionError.message}`);
    }

    if (!sessionData.session) {
      logger.error(`No session available for ${functionName}`);
      throw new Error('Not authenticated. Please sign in again.');
    }

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
  } catch (error: unknown) {
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
 * Save host email
 */
export async function saveHostEmail(email: string) {
  return callEdgeFunction('save-host-email', { email }, { retry: false });
}

/**
 * Get Fathom OAuth authorization URL
 */
export async function getFathomOAuthUrl() {
  return callEdgeFunction<OAuthUrlResponse>('fathom-oauth-url', undefined, { retry: false });
}

/**
 * Complete Fathom OAuth flow
 */
export async function completeFathomOAuth(code: string, state: string) {
  return callEdgeFunction('fathom-oauth-callback', { code, state }, { retry: false });
}

// =============================================
// ZOOM OAUTH & SYNC FUNCTIONS
// =============================================

/**
 * Get Zoom OAuth authorization URL
 */
export async function getZoomOAuthUrl() {
  return callEdgeFunction('zoom-oauth-url', undefined, { retry: false });
}

/**
 * Complete Zoom OAuth flow
 */
export async function completeZoomOAuth(code: string, state: string) {
  return callEdgeFunction('zoom-oauth-callback', { code, state }, { retry: false });
}

/**
 * Refresh Zoom OAuth token
 */
export async function refreshZoomOAuth() {
  return callEdgeFunction('zoom-oauth-refresh', undefined, { retry: false });
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
