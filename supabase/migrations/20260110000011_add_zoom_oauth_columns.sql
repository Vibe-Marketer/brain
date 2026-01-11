-- Migration: Add Zoom OAuth columns to user_settings
-- Purpose: Store Zoom OAuth tokens for Zoom integration
-- Author: Claude Code
-- Date: 2026-01-10

-- ============================================================================
-- ADD ZOOM OAUTH COLUMNS TO USER_SETTINGS
-- ============================================================================
-- These columns store Zoom OAuth 2.0 tokens separately from Fathom tokens,
-- allowing users to have both integrations connected simultaneously.

-- Add Zoom OAuth access token
-- Stores the short-lived access token from Zoom OAuth flow
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS zoom_oauth_access_token TEXT;

-- Add Zoom OAuth refresh token
-- Stores the long-lived refresh token used to obtain new access tokens
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS zoom_oauth_refresh_token TEXT;

-- Add Zoom OAuth token expiration timestamp
-- Unix timestamp (ms) when the access token expires
-- Zoom tokens expire after 1 hour (3600 seconds)
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS zoom_oauth_token_expires BIGINT;

-- Add Zoom OAuth state parameter
-- Stores the state parameter during OAuth flow for CSRF protection
-- Cleared after successful token exchange
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS zoom_oauth_state TEXT;

-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Add helpful comments to the new columns

COMMENT ON COLUMN public.user_settings.zoom_oauth_access_token IS
  'Zoom OAuth 2.0 access token. Short-lived (1 hour). Used for API requests.';

COMMENT ON COLUMN public.user_settings.zoom_oauth_refresh_token IS
  'Zoom OAuth 2.0 refresh token. Long-lived. Used to obtain new access tokens.';

COMMENT ON COLUMN public.user_settings.zoom_oauth_token_expires IS
  'Unix timestamp (milliseconds) when the Zoom access token expires.';

COMMENT ON COLUMN public.user_settings.zoom_oauth_state IS
  'OAuth state parameter for CSRF protection. Cleared after token exchange.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
