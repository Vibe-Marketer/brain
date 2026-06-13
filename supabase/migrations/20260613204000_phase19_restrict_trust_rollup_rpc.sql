-- Migration: Phase 19 restrict trust rollup RPC
-- Purpose: L-1 — rollup is a daemon/service-role operation, not an authenticated user RPC.
-- Date: 2026-06-13

REVOKE ALL ON FUNCTION public.rollup_autopilot_category_trust() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_autopilot_category_trust() TO service_role;

COMMENT ON FUNCTION public.rollup_autopilot_category_trust() IS
  'Service-role-only daemon rollup. Persists category survival counters, matures pending survivors to held, and emits automatic demotion audit events.';
