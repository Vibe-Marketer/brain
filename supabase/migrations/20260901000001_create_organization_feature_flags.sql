-- Migration: Create organization_feature_flags table
-- Purpose: Per-organization feature flag gate for the deterministic-resolution shadow
--          sweep (SAFE-01). A flag is OFF unless an explicit (organization_id, flag_key,
--          enabled=true) row exists -- there is deliberately NO global/wildcard row and
--          NO default-true path. This is a new, purpose-scoped table -- it does NOT
--          resurrect or relate to the deleted global `feature_flags` table (migration
--          20260302000000, dropped by 20260611000001 for unrelated UI-rollout reasons;
--          see 31-RESEARCH.md Common Pitfalls #4 -- different shape, different problem).
--          Phase 31 does not enable this flag for any organization; that is gated on
--          Phase 32's precision proof (SAFE-06).
--          Reversibility-gate decision: option-a, approved as-is, no knob changes
--          (Phase 31 Plan 01, Task 1).
-- Author: Claude (GSD Phase 31 Plan 01 executor)
-- Date: 2026-09-01

-- ============================================================================
-- 1. TABLE: organization_feature_flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, flag_key)
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
-- Partial index backs the sweep's "which orgs have event_resolution enabled"
-- lookup (resolve-events/index.ts SELECT ... WHERE flag_key = ... AND enabled = true)
-- -- only enabled rows are ever queried by key, so a partial index is both smaller
-- and a closer match to the actual query shape than a full composite index.

CREATE INDEX IF NOT EXISTS idx_organization_feature_flags_key_enabled
  ON organization_feature_flags(flag_key, enabled) WHERE enabled;

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS so the table owner role cannot bypass RLS either (mirrors events,
-- call_participants). No authenticated/anon policy at all -- this table has no
-- user-facing surface yet (31-CONTEXT.md code_context: "default to service-role-only
-- writes/reads if no user-facing surface needs it yet (this phase has none)"). It is
-- read/written exclusively by the service-role sweep in resolve-events/index.ts.

ALTER TABLE organization_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_feature_flags FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access" ON organization_feature_flags;
CREATE POLICY "Service role full access"
  ON organization_feature_flags FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 5. TRIGGERS
-- ============================================================================
-- Refresh updated_at on every UPDATE, matching this schema's established
-- per-table trigger convention (e.g. update_events_updated_at, added in
-- 20260831020000 as a Phase 30 code-review gap-closure -- adding this table's
-- own trigger at creation time avoids repeating that same gap here).

CREATE OR REPLACE FUNCTION public.update_organization_feature_flags_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS organization_feature_flags_updated_at ON public.organization_feature_flags;
CREATE TRIGGER organization_feature_flags_updated_at
  BEFORE UPDATE ON public.organization_feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_organization_feature_flags_updated_at();

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_feature_flags IS
  'Per-organization feature flag gate (SAFE-01). A flag is OFF unless an explicit row '
  'with enabled=true exists for (organization_id, flag_key) -- no global/wildcard row, '
  'no default-true path. Service-role only; no client policy exists in v1. NOT a '
  'resurrection of the deleted global feature_flags table (different shape -- that one '
  'was a global, admin-gated UI-rollout switch; this one is a per-tenant data-mutation '
  'gate). See migration header for full context.';

COMMENT ON COLUMN organization_feature_flags.flag_key IS
  'Flag identifier, e.g. ''event_resolution''. Free text (not an enum) so adding a new '
  'flag (e.g. Phase 32''s SAFE-03 kill switch) never requires a migration to add a value.';

COMMENT ON COLUMN organization_feature_flags.enabled IS
  'Defaults to false. The event-resolution shadow sweep (resolve-events/index.ts) only '
  'processes an organization when a row here has flag_key=''event_resolution'' AND '
  'enabled=true. This phase (31) never sets this to true for any organization -- that '
  'is gated on Phase 32''s precision proof (SAFE-06).';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
