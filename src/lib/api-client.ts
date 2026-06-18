/**
 * Centralized API client for backend function calls
 * Provides consistent error handling and retry logic
 */

import { supabase } from "@/integrations/supabase/client";
import { getSourceConfig, type SourceId } from "@/config/source-registry";
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
  state?: string;
  sourceId?: string;
}

type OAuthSourceId = Extract<SourceId, "fathom" | "zoom" | "plaud" | "read-ai" | "grain">;

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

export async function getConnectorOAuthUrl(sourceApp: OAuthSourceId) {
  const functionName = getOAuthFunctionName(sourceApp, "oauthUrlFunctionName");
  return callEdgeFunction<OAuthUrlResponse>(functionName, undefined, { retry: false });
}

export async function completeConnectorOAuth(
  sourceApp: OAuthSourceId,
  code: string,
  state: string,
) {
  const functionName = getOAuthFunctionName(sourceApp, "oauthCallbackFunctionName");
  return callEdgeFunction(functionName, { code, state }, { retry: false });
}

/**
 * Get Fathom OAuth authorization URL
 */
export async function getFathomOAuthUrl() {
  return getConnectorOAuthUrl("fathom");
}

/**
 * Complete Fathom OAuth flow
 */
export async function completeFathomOAuth(code: string, state: string) {
  return completeConnectorOAuth("fathom", code, state);
}

// =============================================
// ZOOM OAUTH & SYNC FUNCTIONS
// =============================================

/**
 * Get Zoom OAuth authorization URL
 */
export async function getZoomOAuthUrl() {
  return getConnectorOAuthUrl("zoom");
}

/**
 * Complete Zoom OAuth flow
 */
export async function completeZoomOAuth(code: string, state: string) {
  return completeConnectorOAuth("zoom", code, state);
}
// =============================================
// PLAUD OAUTH SCAFFOLDING
// =============================================

/**
 * Get Plaud OAuth authorization URL.
 * Dormant: Plaud's current working app flow uses plaud-connect-token with the
 * Plaud Web/browser-token connector, not this OAuth path.
 */
export async function getPlaudOAuthUrl() {
  return getConnectorOAuthUrl("plaud");
}

/**
 * Complete Plaud OAuth flow.
 * Dormant until Plaud OAuth works end to end for this app.
 */
export async function completePlaudOAuth(code: string, state: string) {
  return completeConnectorOAuth("plaud", code, state);
}

export async function getReadAiOAuthUrl() {
  return getConnectorOAuthUrl("read-ai");
}

export async function completeReadAiOAuth(code: string, state: string) {
  return completeConnectorOAuth("read-ai", code, state);
}

export async function getGrainOAuthUrl() {
  return getConnectorOAuthUrl("grain");
}

export async function completeGrainOAuth(code: string, state: string) {
  return completeConnectorOAuth("grain", code, state);
}

function getOAuthFunctionName(
  sourceApp: OAuthSourceId,
  field: "oauthUrlFunctionName" | "oauthCallbackFunctionName",
): string {
  const source = getSourceConfig(sourceApp);
  const functionName = source[field];
  if (!functionName) {
    throw new Error(`${source.label} has no ${field} configured`);
  }
  return functionName;
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
 * Generate descriptive titles for calls
 * Creates concise, descriptive titles based on content
 * Uses OpenAI GPT-4o-mini via Vercel AI SDK
 */
export async function generateAiTitles(recordingIds: number[], canonicalRecordingIds: string[] = []) {
  return callEdgeFunction(
    'generate-ai-titles',
    { recordingIds, canonicalRecordingIds },
    { retry: false },
  );
}
