-- Migration: Add Polar billing fields to user_profiles
-- Purpose: Foundation for 3-tier billing system (Solo/Team/Business) using Polar as payment provider
-- Author: Claude
-- Date: 2026-01-31

-- ============================================================================
-- ADD BILLING COLUMNS TO user_profiles
-- ============================================================================
-- These fields track Polar subscription state locally for quick access.
-- Webhooks and Customer State API keep these in sync with Polar.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS polar_customer_id UUID,
  ADD COLUMN IF NOT EXISTS polar_external_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_id UUID,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS product_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- ============================================================================
-- CHECK CONSTRAINT for subscription_status
-- ============================================================================
-- Valid values as per Polar API: active, canceled, revoked, incomplete,
-- incomplete_expired, trialing, past_due, unpaid
-- NULL is allowed for free tier users without any subscription history.

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN (
    'active',
    'canceled',
    'revoked',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'past_due',
    'unpaid'
  ));

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Partial indexes for non-null values (most users will be on free tier initially)

CREATE INDEX IF NOT EXISTS idx_user_profiles_polar_customer_id
  ON user_profiles(polar_customer_id)
  WHERE polar_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status
  ON user_profiles(subscription_status)
  WHERE subscription_status IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN user_profiles.polar_customer_id IS 'Polar internal customer UUID for API calls';
COMMENT ON COLUMN user_profiles.polar_external_id IS 'App user ID sent to Polar (maps to auth.users.id)';
COMMENT ON COLUMN user_profiles.subscription_id IS 'Active Polar subscription UUID (null if free tier)';
COMMENT ON COLUMN user_profiles.subscription_status IS 'Subscription status: active, canceled, revoked, incomplete, incomplete_expired, trialing, past_due, unpaid';
COMMENT ON COLUMN user_profiles.product_id IS 'Product key identifying tier (e.g., solo-monthly, team-annual)';
COMMENT ON COLUMN user_profiles.current_period_end IS 'Subscription renewal date for trial/expiration checks';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
