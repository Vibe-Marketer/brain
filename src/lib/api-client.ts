/**
 * Centralized API client for backend function calls
 * Provides consistent error handling and retry logic
 */

import { supabase } from "@/integrations/supabase/client";
import { retryWithBackoff, getErrorMessage } from "./fathom";
import { logger } from "./logger";

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

/**
 * Call a backend edge function with automatic retry and error handling
 */
export async function callEdgeFunction<T = any>(
  functionName: string,
  body?: any,
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

/**
 * Export complete database (all tables and data)
 * Used for migrating from Lovable to independent Supabase project
 * Returns JSON export that can be downloaded and imported into new project
 */
export async function exportFullDatabase() {
  return callEdgeFunction('export-full-database', undefined, { retry: false });
}

/**
 * Export database using direct PostgreSQL connection
 * Bypasses PostgREST API to avoid schema cache issues
 * Uses PostgreSQL Pool with SUPABASE_DB_URL for complete export
 */
export async function exportDatabaseDirect() {
  return callEdgeFunction('export-database-direct', undefined, { retry: false });
}

/**
 * Get Supabase credentials (URL and service role key)
 * Used to retrieve credentials for local export script
 * WARNING: Returns sensitive credentials - use with caution!
 */
export async function getCredentials() {
  return callEdgeFunction('get-credentials', undefined, { retry: false });
}

// =============================================
// AI CHAT & RAG FUNCTIONS
// =============================================

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
