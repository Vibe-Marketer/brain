-- Migration: Add grandfathered flag to user_profiles
-- Purpose: Phase 31 payment gate — pre-existing accounts (Andrew, Phill, beta users)
--          bypass the new payment gate. Created-before-this-phase users are auto-grandfathered.
-- Author: Phase 31 (auth-signup-payment-gate)
-- Date: 2026-05-12

-- ============================================================================
-- COLUMN: grandfathered
-- ============================================================================
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS grandfathered BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- BACKFILL: existing accounts created before phase ship date are grandfathered
-- ============================================================================
-- Any user_profile row created before 2026-05-12 is auto-grandfathered. This
-- covers Andrew, Phill, Soren (legacy), and any prior beta tester. New signups
-- post-2026-05-12 default to grandfathered=false and must hit the payment gate.
UPDATE public.user_profiles
SET grandfathered = true
WHERE created_at < '2026-05-12T00:00:00Z';

-- ============================================================================
-- INDEX (deferred — low-cardinality boolean rarely benefits from an index)
-- ============================================================================
-- CREATE INDEX IF NOT EXISTS idx_user_profiles_grandfathered
--   ON public.user_profiles(grandfathered) WHERE grandfathered = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN public.user_profiles.grandfathered IS
  'When true, this account bypasses the Phase 31 payment gate. Backfilled for all rows created before 2026-05-12. New signups default to false.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
