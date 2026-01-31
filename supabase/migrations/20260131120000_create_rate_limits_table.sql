-- Migration: Create rate_limits table for persistent rate limiting
-- Purpose: Store rate limit state that survives Edge Function cold starts
-- Author: CallVault AI
-- Date: 2026-01-31
-- Ticket: INFRA-03

-- ============================================================================
-- TABLE: rate_limits
-- ============================================================================
-- Tracks per-user rate limiting state across Edge Function invocations
-- Unlike in-memory Maps, this persists through cold starts

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50) NOT NULL,  -- 'webhook', 'email', 'chat', etc.
  window_start TIMESTAMPTZ NOT NULL,
  window_duration_ms INTEGER NOT NULL DEFAULT 60000,  -- 1 minute default
  request_count INTEGER NOT NULL DEFAULT 0,
  max_requests INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, resource_type)
);

-- ============================================================================
-- TABLE: rate_limit_configs
-- ============================================================================
-- Global configuration for rate limits per resource type
-- Admin-configurable via database

CREATE TABLE IF NOT EXISTS rate_limit_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type VARCHAR(50) NOT NULL UNIQUE,
  max_requests INTEGER NOT NULL,
  window_duration_ms INTEGER NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Fast lookups by user + resource
CREATE INDEX idx_rate_limits_user_resource ON rate_limits(user_id, resource_type);

-- Find expired windows for cleanup
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Config lookups by resource type
CREATE INDEX idx_rate_limit_configs_resource ON rate_limit_configs(resource_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Service role has full access to rate_limits (Edge Functions use service key)
CREATE POLICY "Service role manages rate limits"
  ON rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Service role can read rate_limit_configs (admin can update via database)
CREATE POLICY "Service role reads rate limit configs"
  ON rate_limit_configs
  FOR SELECT
  USING (true);

-- ============================================================================
-- DATABASE FUNCTION: Atomic rate limit check and increment
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_user_id UUID,
  p_resource_type VARCHAR(50),
  p_max_requests INTEGER,
  p_window_duration_ms INTEGER,
  p_current_time TIMESTAMPTZ
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_current_count INTEGER;
  v_new_count INTEGER;
  v_allowed BOOLEAN;
  v_remaining INTEGER;
  v_reset_at BIGINT;
BEGIN
  -- Calculate window boundaries
  v_window_start := p_current_time - (p_window_duration_ms * INTERVAL '1 millisecond');
  v_window_end := p_current_time;
  
  -- Upsert rate limit entry with sliding window logic
  -- If window has expired, reset count to 1
  -- If window is active, increment count
  INSERT INTO rate_limits (
    user_id,
    resource_type,
    window_start,
    window_duration_ms,
    request_count,
    max_requests,
    updated_at
  )
  VALUES (
    p_user_id,
    p_resource_type,
    p_current_time,
    p_window_duration_ms,
    1,
    p_max_requests,
    NOW()
  )
  ON CONFLICT (user_id, resource_type)
  DO UPDATE SET
    -- Reset window if expired, otherwise increment
    request_count = CASE
      WHEN rate_limits.window_start < v_window_start THEN 1  -- Window expired, reset
      ELSE rate_limits.request_count + 1                      -- Increment
    END,
    -- Update window start if expired
    window_start = CASE
      WHEN rate_limits.window_start < v_window_start THEN p_current_time  -- New window
      ELSE rate_limits.window_start                                        -- Keep existing
    END,
    window_duration_ms = p_window_duration_ms,
    max_requests = p_max_requests,
    updated_at = NOW()
  RETURNING
    request_count,
    window_start
  INTO v_current_count, v_window_start;
  
  -- Calculate results
  v_allowed := v_current_count <= p_max_requests;
  v_remaining := GREATEST(0, p_max_requests - v_current_count);
  v_reset_at := (EXTRACT(EPOCH FROM v_window_start) * 1000 + p_window_duration_ms)::BIGINT;
  
  RETURN QUERY SELECT v_allowed, v_remaining, v_reset_at;
END;
$$;

-- ============================================================================
-- DEFAULT CONFIGURATIONS
-- ============================================================================

INSERT INTO rate_limit_configs (resource_type, max_requests, window_duration_ms)
VALUES
  ('webhook', 100, 60000),       -- 100 requests per minute
  ('email', 95, 86400000),       -- 95 emails per day (Resend free tier buffer)
  ('chat', 50, 60000)            -- 50 chat requests per minute
ON CONFLICT (resource_type) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE rate_limits IS 'Persistent rate limiting state for Edge Functions (survives cold starts)';
COMMENT ON TABLE rate_limit_configs IS 'Admin-configurable rate limit thresholds per resource type';

COMMENT ON COLUMN rate_limits.user_id IS 'User being rate limited';
COMMENT ON COLUMN rate_limits.resource_type IS 'Type of resource being rate limited (webhook, email, chat, etc.)';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the current rate limit window';
COMMENT ON COLUMN rate_limits.window_duration_ms IS 'Duration of the rate limit window in milliseconds';
COMMENT ON COLUMN rate_limits.request_count IS 'Number of requests in the current window';
COMMENT ON COLUMN rate_limits.max_requests IS 'Maximum requests allowed per window';

COMMENT ON COLUMN rate_limit_configs.resource_type IS 'Type of resource this config applies to';
COMMENT ON COLUMN rate_limit_configs.max_requests IS 'Maximum requests allowed per window';
COMMENT ON COLUMN rate_limit_configs.window_duration_ms IS 'Window duration in milliseconds';
COMMENT ON COLUMN rate_limit_configs.is_enabled IS 'Whether rate limiting is enabled for this resource type';

COMMENT ON FUNCTION check_and_increment_rate_limit IS 'Atomic check and increment for rate limiting with sliding window support';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
