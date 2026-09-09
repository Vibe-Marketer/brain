-- Migration: Add canonical_organization_id pointer + chain-prevention trigger
-- Purpose: ORG-03 -- duplicate organizations can be merged non-destructively
--          and reversibly. canonical_organization_id is a nullable self-FK on
--          organizations: NULL means "this row is canonical/root"; non-NULL
--          means "this org's real identity is over there" (the losing org in
--          a merge). Pointer-only -- existing FK columns elsewhere
--          (recordings.organization_id, organization_memberships, etc.) are
--          NEVER rewritten by this migration or the merge RPC that uses these
--          columns (20260908140001). Reversal is simply clearing the pointer.
--
--          CRITICAL NON-GOAL (36-RESEARCH.md Pitfall 1, the single highest-
--          risk finding in this phase): this migration touches ONLY
--          organizations DDL plus the new chain-prevention trigger function.
--          It deliberately never references, edits, or even names in prose
--          the two org-membership RLS choke-point helper functions defined
--          in 20260301000001_rename_vaults_to_workspaces.sql (the ones
--          gating ~15 dependent tables -- recordings, workspaces,
--          call_participants, contacts, sync_jobs, import_routing_rules,
--          organizations itself, etc.) -- they must remain byte-for-byte
--          unrelated to canonical_organization_id. Treat this pointer as
--          read-only display metadata for exactly one purpose -- "which org
--          row should the UI show as *the* organization" -- and never let it
--          enter a USING/WITH CHECK clause or a SECURITY DEFINER function
--          body gating a capture-bearing table (ORG-04).
--
--          Chain/cycle prevention (36-RESEARCH.md Pitfall 2): a plain
--          nullable FK has no constraint preventing A -> B -> C chains or
--          A -> B, C -> A cycles -- Postgres CHECK constraints cannot express
--          cross-row subqueries. prevent_canonical_organization_chain() is a
--          BEFORE INSERT OR UPDATE OF canonical_organization_id trigger that
--          rejects (a) merging into an org that is itself already merged
--          (no chains) and (b) merging an org that other orgs already point
--          their canonical_organization_id at (an org cannot be both a
--          "loser" and someone else's "winner").
-- Author: Claude (GSD Phase 36 Plan 02 executor)
-- Date: 2026-09-09

-- ============================================================================
-- 1. COLUMNS: organizations.canonical_organization_id / merged_at / merged_by
-- ============================================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS canonical_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================================
-- 2. CONSTRAINT: not-self
-- ============================================================================

ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_canonical_not_self;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_canonical_not_self
  CHECK (canonical_organization_id IS NULL OR canonical_organization_id != id);

-- ============================================================================
-- 3. CHAIN-PREVENTION TRIGGER
-- ============================================================================
-- CHECK constraints cannot express cross-row subqueries, so chain/cycle
-- rejection must be a trigger. Fires only when canonical_organization_id is
-- actually being set/changed (BEFORE INSERT OR UPDATE OF ... ON ...).

CREATE OR REPLACE FUNCTION public.prevent_canonical_organization_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.canonical_organization_id IS NOT NULL THEN
    -- The target must itself be a root org -- cannot merge into an org that
    -- is itself already merged elsewhere (no chains).
    IF EXISTS (
      SELECT 1 FROM organizations
      WHERE id = NEW.canonical_organization_id
        AND canonical_organization_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot merge into an organization that is itself merged (no chains)';
    END IF;

    -- This org cannot already be a merge target for other orgs -- an org
    -- cannot be both a "loser" (being merged) and someone else's "winner"
    -- (a merge target).
    IF EXISTS (
      SELECT 1 FROM organizations
      WHERE canonical_organization_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Cannot merge an organization that other organizations already point to (no chains)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_prevent_canonical_chain ON public.organizations;
CREATE TRIGGER organizations_prevent_canonical_chain
  BEFORE INSERT OR UPDATE OF canonical_organization_id ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_canonical_organization_chain();

-- ============================================================================
-- 4. COMMENTS
-- ============================================================================

COMMENT ON COLUMN organizations.canonical_organization_id IS
  'ORG-03: nullable self-FK. NULL = canonical/root org. Non-NULL = this org '
  'was merged into the referenced org (pointer-only -- no other row/FK is '
  'rewritten). Reversal = clear this column. Display-only metadata: NEVER '
  'dereferenced by the org-membership RLS helper functions or any RLS '
  'choke point gating a capture-bearing table (ORG-04 non-goal).';

COMMENT ON COLUMN organizations.merged_at IS
  'ORG-03: timestamp this org was merged (canonical_organization_id set). '
  'NULL when canonical_organization_id is NULL.';

COMMENT ON COLUMN organizations.merged_by IS
  'ORG-03: platform admin (auth.users.id) who performed the merge via '
  'merge_organizations_atomic. NULL when canonical_organization_id is NULL.';

COMMENT ON FUNCTION public.prevent_canonical_organization_chain() IS
  'ORG-03/Pitfall 2: BEFORE INSERT OR UPDATE OF canonical_organization_id '
  'guard rejecting merge chains/cycles -- an org whose own '
  'canonical_organization_id is already set cannot be a merge target, and '
  'an org that other orgs already point to cannot itself be merged.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
