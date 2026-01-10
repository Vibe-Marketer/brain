/**
 * Frontend API client for Zoom edge functions
 * Provides consistent interface for Zoom OAuth and meeting sync operations
 */

import { callEdgeFunction, ApiResponse } from "./api-client";

// =============================================
// ZOOM RESPONSE TYPES
// =============================================

/**
 * Zoom OAuth URL response
 */
export interface ZoomOAuthUrlResponse {
  authUrl: string;
}

/**
 * Zoom OAuth callback response
 */
export interface ZoomOAuthCallbackResponse {
  success: boolean;
}

/**
 * Zoom OAuth refresh response
 */
export interface ZoomOAuthRefreshResponse {
  success: boolean;
  expires_in?: number;
}

/**
 * Zoom meeting with sync status
 */
export interface ZoomMeeting {
  recording_id: string; // UUID for uniqueness
  meeting_id: number; // Original Zoom meeting ID (may be reused for PMI)
  title: string;
  host_email: string;
  start_time: string;
  end_time: string;
  duration: number;
  has_transcript: boolean;
  synced: boolean;
}

/**
 * Zoom fetch meetings response
 */
export interface ZoomFetchMeetingsResponse {
  meetings: ZoomMeeting[];
  fromDate: string;
  toDate: string;
}

/**
 * Zoom sync meetings response
 */
export interface ZoomSyncMeetingsResponse {
  success: boolean;
  jobId?: string;
  total?: number;
  synced?: number;
  failed?: number;
  results?: Array<{
    recording_id: string;
    success: boolean;
    error?: string;
  }>;
}

// =============================================
// ZOOM OAUTH FUNCTIONS
// =============================================

/**
 * Get Zoom OAuth authorization URL
 * Generates a URL to redirect the user to Zoom for authorization
 */
export async function getZoomOAuthUrl(): Promise<ApiResponse<ZoomOAuthUrlResponse>> {
  return callEdgeFunction<ZoomOAuthUrlResponse>('zoom-oauth-url', undefined, { retry: false });
}

/**
 * Complete Zoom OAuth flow
 * Exchanges the authorization code for access tokens
 */
export async function completeZoomOAuth(code: string, state: string): Promise<ApiResponse<ZoomOAuthCallbackResponse>> {
  return callEdgeFunction<ZoomOAuthCallbackResponse>('zoom-oauth-callback', { code, state }, { retry: false });
}

/**
 * Refresh Zoom OAuth token
 * Uses the refresh token to get a new access token
 */
export async function refreshZoomOAuth(): Promise<ApiResponse<ZoomOAuthRefreshResponse>> {
  return callEdgeFunction<ZoomOAuthRefreshResponse>('zoom-oauth-refresh', undefined, { retry: false });
}

// =============================================
// ZOOM MEETING FUNCTIONS
// =============================================

/**
 * Fetch Zoom meetings with cloud recordings
 * Returns user's cloud-recorded meetings with sync status
 */
export async function fetchZoomMeetings(params?: {
  fromDate?: string;
  toDate?: string;
}): Promise<ApiResponse<ZoomFetchMeetingsResponse>> {
  return callEdgeFunction<ZoomFetchMeetingsResponse>('zoom-fetch-meetings', params);
}

/**
 * Sync selected Zoom meetings to database
 * Downloads transcripts, generates fingerprints, and handles deduplication
 */
export async function syncZoomMeetings(recordingIds: string[]): Promise<ApiResponse<ZoomSyncMeetingsResponse>> {
  return callEdgeFunction<ZoomSyncMeetingsResponse>('zoom-sync-meetings', { recordingIds });
}
