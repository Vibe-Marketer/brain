-- Migration: Admin read-all SELECT policies for organizations/organization_domains/organization_aliases
-- Purpose: Phase 36 Plan 05 (Admin Center "Organizations" section) needs a
--          platform ADMIN operator to list EVERY organization on the
--          platform, not just the ones they personally happen to belong
--          to. The existing SELECT policies on all three tables are
--          member-scoped (is_organization_member(...)) -- correct for the
--          self-serve settings surface (Plan 03), but would silently limit
--          the new admin table to "organizations the operator is a member
--          of" instead of "all organizations", which is what
--          OrganizationsSection's own must-have requires ("lists all
--          orgs"). Mirrors the ALREADY-LIVE "Admins can view all profiles"
--          policy on user_profiles (has_role(auth.uid(), 'ADMIN'::app_role))
--          verbatim -- same authority tier, same pattern, no new helper
--          function introduced.
--
--          Additive only: these are NEW policies alongside the existing
--          member-scoped SELECT policies (Postgres RLS policies within the
--          same command are OR'd together), so regular member visibility
--          is completely unchanged -- a non-admin caller's
--          has_role(auth.uid(),'ADMIN') evaluates false and contributes
--          nothing. Read-only: no INSERT/UPDATE/DELETE grant for admins
--          here. All admin writes continue to route through the
--          has_role-gated merge-organizations / unclaim-organization-domain
--          edge functions (Phase 36 Plan 04), which independently
--          re-verify has_role server-side via a service-role client and
--          never trust this RLS policy as their authority boundary.
--
--          Does NOT touch is_organization_member / is_organization_admin_or_owner
--          -- carries forward the phase-wide non-goal that those two
--          choke-point functions never dereference anything new.
--
--          Deviation: Phase 36 Plan 05 (Rule 2 -- missing critical
--          authorization), not in the plan's declared files_modified.
--          Added because the admin org list literally cannot show "all
--          organizations" without it -- a platform admin who is not a
--          member of every customer org would otherwise see an
--          incomplete/wrong list. TEST-only, per this milestone's
--          established TEST-then-prod-on-Plan-06 discipline (Phase 36
--          Plans 01/02/03/04 all applied their own migrations to TEST only
--          and deferred prod apply to Plan 06). Flagged for Plan 06's
--          prod-apply sweep.
-- Author: Claude (GSD Phase 36 Plan 05 executor)
-- Date: 2026-09-09

-- ============================================================================
-- RLS POLICIES -- additive admin-read bypass, mirrors user_profiles exactly
-- ============================================================================

DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "Admins can view all organization domains" ON organization_domains;
CREATE POLICY "Admins can view all organization domains"
  ON organization_domains FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

DROP POLICY IF EXISTS "Admins can view all organization aliases" ON organization_aliases;
CREATE POLICY "Admins can view all organization aliases"
  ON organization_aliases FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'ADMIN'::app_role));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Admins can view all organizations" ON organizations IS
  'Phase 36 Plan 05: platform ADMIN read-all bypass for the Admin Center Organizations section. Additive alongside the member-scoped SELECT policy -- does not affect regular member visibility. Mirrors user_profiles."Admins can view all profiles" exactly.';

COMMENT ON POLICY "Admins can view all organization domains" ON organization_domains IS
  'Phase 36 Plan 05: platform ADMIN read-all bypass, same rationale as organizations."Admins can view all organizations".';

COMMENT ON POLICY "Admins can view all organization aliases" ON organization_aliases IS
  'Phase 36 Plan 05: platform ADMIN read-all bypass, same rationale as organizations."Admins can view all organizations".';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
