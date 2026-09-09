-- Migration: Create organization_domains and organization_aliases tables
-- Purpose: ORG-01 -- an organization can carry multiple claimed domains and
--          multiple display aliases. organization_domains stores CONFIRMED
--          claims only -- no `verified` boolean, because every row here is,
--          by construction, already verified (CONTEXT.md locks a synchronous
--          resolve via Phase 34's identity_aliases verified-email mechanism;
--          no DNS-TXT pending-state flow this phase). Domain uniqueness is
--          GLOBAL and case-insensitive (one domain maps to exactly one org,
--          ever -- the canonical-entity premise). organization_aliases is
--          display/search metadata only, uniqueness scoped PER-ORG and
--          case-insensitive (NOT global -- two real companies can share a
--          DBA name; canonical identity remains organization.id).
--          Both tables: single direct FK to organizations(id), RLS both
--          enabled AND forced (mirrors organization_feature_flags,
--          identities, identity_aliases), member-SELECT policy reusing
--          is_organization_member (verbatim reuse of organizations' own
--          SELECT policy predicate), service-role FOR ALL policy. NO
--          authenticated INSERT/DELETE/UPDATE policy -- all writes go
--          through the SECURITY DEFINER RPCs added in 20260908130001
--          (claim_organization_domain / add_organization_alias /
--          remove_organization_alias) so the distinct error codes
--          (FORBIDDEN/BLOCKLISTED/NO_VERIFIED_EMAIL/CONFLICT) can be
--          returned instead of one opaque RLS/constraint-violation error
--          (see 36-RESEARCH.md Anti-Patterns).
--          Column named `organization_id`, not `org_id` -- the newer,
--          dominant convention across this schema (Pitfall 10).
--          Reversibility-gate decision: option-a, auto-selected per the
--          yolo/auto_advance checkpoint posture (Phase 36 Plan 01, Task 1)
--          -- config.json mode=yolo, workflow.auto_advance=true, gate=
--          "blocking" (not "blocking-human"), so the planner's own front-
--          loaded recommended option was taken with no knob changes.
-- Author: Claude (GSD Phase 36 Plan 01 executor)
-- Date: 2026-09-09

-- ============================================================================
-- 1. TABLE: organization_domains
-- ============================================================================
-- No `verified` boolean: every row is a confirmed claim by construction
-- (CONTEXT.md: resolves synchronously via an already-verified email, no
-- pending state this phase).

CREATE TABLE IF NOT EXISTS organization_domains (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain          TEXT        NOT NULL,
  claimed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TABLE: organization_aliases
-- ============================================================================
-- Deliberately NOT globally unique (two real companies can share a DBA name)
-- -- but exact duplicate alias strings within the SAME org are rejected.

CREATE TABLE IF NOT EXISTS organization_aliases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias           TEXT        NOT NULL,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================
-- organization_domains: GLOBAL uniqueness, case-insensitive (Pitfall 3 + 4
-- from 36-RESEARCH.md -- a real UNIQUE index is the race-safe guarantee, not
-- just an application-level pre-check).

CREATE UNIQUE INDEX IF NOT EXISTS organization_domains_domain_unique
  ON organization_domains (LOWER(domain));

CREATE INDEX IF NOT EXISTS idx_organization_domains_organization_id
  ON organization_domains(organization_id);

-- organization_aliases: PER-ORG uniqueness only, case-insensitive.

CREATE UNIQUE INDEX IF NOT EXISTS organization_aliases_org_alias_unique
  ON organization_aliases (organization_id, LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_organization_aliases_organization_id
  ON organization_aliases(organization_id);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- FORCE RLS so the table-owner role (migrations often run as) cannot bypass
-- policy either -- mirrors organization_feature_flags/identities/identity_
-- aliases (Pitfall 9).

ALTER TABLE organization_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_aliases FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
-- SELECT: any org member can view (Settings UI). Verbatim reuse of
-- organizations' own SELECT policy predicate (is_organization_member), read
-- from 20260301000002_recreate_rls_policies.sql line 24.

DROP POLICY IF EXISTS "org_members_can_view_domains" ON organization_domains;
CREATE POLICY "org_members_can_view_domains"
  ON organization_domains FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org_members_can_view_aliases" ON organization_aliases;
CREATE POLICY "org_members_can_view_aliases"
  ON organization_aliases FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));

-- Writes go through the SECURITY DEFINER RPCs in 20260908130001 -- NO
-- authenticated INSERT/DELETE/UPDATE policy is granted directly (see
-- migration header + 36-RESEARCH.md Anti-Patterns: a raw RLS WITH CHECK
-- encoding the full claim business logic can only produce one opaque
-- constraint-violation error, not the distinct codes the RPC contract
-- requires).

DROP POLICY IF EXISTS "service_role_full_access_domains" ON organization_domains;
CREATE POLICY "service_role_full_access_domains"
  ON organization_domains FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_aliases" ON organization_aliases;
CREATE POLICY "service_role_full_access_aliases"
  ON organization_aliases FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON TABLE organization_domains IS
  'ORG-01/ORG-02: confirmed domain claims for an organization. Global, '
  'case-insensitive UNIQUE(LOWER(domain)) -- one domain maps to exactly one '
  'org, ever. No verified boolean -- every row is a confirmed claim by '
  'construction (see claim_organization_domain in 20260908130001). Written '
  'exclusively via that SECURITY DEFINER RPC; no client INSERT/DELETE '
  'policy exists.';

COMMENT ON COLUMN organization_domains.domain IS
  'Stored LOWER(TRIM(...)) at write time by claim_organization_domain. '
  'Never a free-email/consumer-webmail domain (blocklist enforced in the '
  'RPC, not here) -- claiming gmail.com would let any Gmail user claim the '
  'org.';

COMMENT ON TABLE organization_aliases IS
  'ORG-01: display/search alias metadata for an organization. Per-org, '
  'case-insensitive UNIQUE(organization_id, LOWER(alias)) -- NOT globally '
  'unique; two real organizations may legitimately share a DBA/alias '
  'string. Written exclusively via add_organization_alias/'
  'remove_organization_alias (20260908130001); no client INSERT/DELETE '
  'policy exists.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
