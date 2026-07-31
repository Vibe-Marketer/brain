# Stack Research — v2.2 Organization Entity & Access Foundation

**Domain:** Org-level RBAC + org-as-ownable-entity on an existing Supabase Postgres multi-tenant app
**Researched:** 2026-07-30
**Confidence:** HIGH (Postgres/RLS mechanics, verified against this codebase's own prior incidents) / MEDIUM (external-pattern comparisons — WebSearch-verified against official docs, not Context7)

> NOTE: This file replaces the v2.1 Import/Sync Rebuild stack research (shipped milestone; preserved in git history). This is the v2.2 org-entity/RBAC stack research.

## Recommended Stack

**Headline finding: no new stack. This is a schema + SQL-function + RLS-policy milestone, built entirely on what's already installed.** Supabase Auth + Postgres RLS is not just "good enough" here — for a codebase whose entire security boundary is already RLS on `auth.uid()`, swapping in a hosted org-identity product (Clerk Organizations, WorkOS) would mean moving the source of truth for membership/roles out of Postgres, which breaks every existing RLS policy's assumption and is a rewrite, not an addition. Nothing in this milestone's requirements (org-level roles, ownership transfer, sharing groundwork) needs auth-identity federation, SSO, or SCIM — the actual asks Clerk/WorkOS solve.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Postgres (Supabase-hosted) | current Supabase Postgres (15/17 line, whatever the linked project runs — verify with `supabase migration list` / dashboard before writing DDL) | RBAC data model, RLS enforcement | Already the system of record for `organizations`, `organization_memberships`, `workspaces`, `workspace_memberships`. Org RBAC is additive rows/functions/policies on this same schema — no new engine. |
| Supabase Auth (GoTrue) | current (managed) | Identity, JWT issuance, `auth.uid()` | Already locked per `PROJECT.md` constraints. No change needed — org "ownership" is an application-level foreign key (`organizations.primary_owner_user_id` → `auth.users.id`), not an auth-provider concept. |
| PL/pgSQL `SECURITY DEFINER` functions | native | RLS-recursion-safe permission checks | This codebase has already been bitten twice by naive recursive RLS (`20260128000001_fix_team_memberships_rls_recursion.sql`, and the `assign_free_role_to_new_user` backfill leak in `20260316120000_fix_admin_role_leak.sql`). The fix pattern used there — a `SECURITY DEFINER STABLE` helper function that the policy calls instead of an inline self-referencing `EXISTS` — is the correct, already-proven-in-this-codebase pattern for org+workspace two-level checks. Reuse it, don't reinvent it. |

### Supporting Libraries

None. No new npm packages, no new Edge Function dependencies. This is pure SQL (migrations) plus thin RPC wrappers the frontend already knows how to call (`supabase.rpc(...)`, same pattern as `get_organization_invite_details`; `transfer_organization_ownership` would be net-new but follows the exact shape of existing RPCs like `copy_recordings_rpc`, `accept_workspace_invite`).

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | already installed (v2.x) | Calling the new ownership-transfer / role-management RPCs from React | No version bump needed — `.rpc()` calling convention is unchanged. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `src/test/rls-regression.test.ts` | CI-enforced cross-org isolation gate | **Mandatory for this milestone.** Add every new org-RBAC-governed table to `CROSS_ORG_TABLES`. This is the test that would have caught a recursive-policy regression before it hit prod. |
| `is_active_team_member` / `is_team_admin` pattern (existing) | Template for new helper functions | Copy the shape exactly: `LANGUAGE plpgsql`, `STABLE`, `SECURITY DEFINER`, explicit `GRANT EXECUTE ... TO authenticated`, a `COMMENT ON FUNCTION` stating *why* it's `SECURITY DEFINER`. |

## Installation

```bash
# No installs required — this is a migrations-only milestone.
# New Edge Function RPCs (if any) use the existing Deno/supabase-js@2 import pattern already in _shared/.
```

## The Actual Pattern: Org-Level RBAC on Postgres RLS

### 1. Decouple org from creator — `primary_owner_user_id`, not creation event

Today, `organizations` derive from `ensure_personal_organization(p_user_id)` (see `20260301000001_rename_vaults_to_workspaces.sql`, refined in `20260303000003_naming_cleanup.sql`) — org identity is implicitly "whoever created it." There is no column that says "who owns this org right now," separate from "who created it originally."

**Add:**
```sql
ALTER TABLE organizations
  ADD COLUMN primary_owner_user_id UUID REFERENCES auth.users(id);

-- Backfill: whoever holds 'organization_owner' in organization_memberships today
-- (or the creator, if that's the only signal available — audit before backfilling)
UPDATE organizations o
SET primary_owner_user_id = om.user_id
FROM organization_memberships om
WHERE om.organization_id = o.id AND om.role = 'organization_owner'
  AND o.primary_owner_user_id IS NULL;
```

This is the exact shape used in production Supabase SaaS boilerplates (Makerkit's `accounts.primary_owner_user_id`) precisely because "owner" needs to be a mutable pointer, not a creation-time fact. `organization_memberships.role = 'organization_owner'` stays as the *membership/permission* record; `primary_owner_user_id` becomes the *single canonical owner* pointer used for transfer, billing attribution, and "who do we email about this org."

### 2. Block direct client mutation of the owner pointer — force it through an RPC

A bare RLS `UPDATE` policy that lets any `organization_admin` write to `primary_owner_user_id` is a privilege-escalation hole (an admin could "transfer" ownership to themselves, or to an outside collaborator, without the sitting owner's consent).

**Recommended approach: don't grant `UPDATE` on `organizations` to `authenticated` for this column at all — route every owner change through a single `SECURITY DEFINER` RPC** (simpler than a blocking trigger + bypass exception, and avoids a second footgun):

```sql
CREATE OR REPLACE FUNCTION transfer_organization_ownership(
  p_org_id UUID, p_new_owner_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
BEGIN
  -- Caller must currently be the owner
  IF NOT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id AND primary_owner_user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Only the current owner can transfer ownership';
  END IF;

  -- New owner must already be an org member (invite-then-transfer, not transfer-to-stranger)
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id AND user_id = p_new_owner_user_id
  ) THEN
    RAISE EXCEPTION 'New owner must already be an organization member';
  END IF;

  UPDATE organizations SET primary_owner_user_id = p_new_owner_user_id WHERE id = p_org_id;

  -- Old owner demotes to organization_admin, new owner promotes to organization_owner
  UPDATE organization_memberships SET role = 'organization_admin'
    WHERE organization_id = p_org_id AND user_id = v_caller;
  UPDATE organization_memberships SET role = 'organization_owner'
    WHERE organization_id = p_org_id AND user_id = p_new_owner_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_organization_ownership(UUID, UUID) TO authenticated;
```

If a UI later needs `organizations` to be otherwise updatable by admins (name, settings), scope the RLS `UPDATE` policy's `WITH CHECK` to explicitly exclude `primary_owner_user_id` changes, or add the blocking-trigger variant (`BEFORE UPDATE ... RAISE EXCEPTION IF NEW.primary_owner_user_id IS DISTINCT FROM OLD.primary_owner_user_id`) as defense-in-depth. Either way, the RPC above is the only intended write path for ownership itself.

### 3. Two-level role checks without recursion

**The recursion trap (already hit twice in this codebase — don't hit it a third time):** an RLS policy on table T that does `EXISTS (SELECT 1 FROM T WHERE ...)` — even indirectly through a chain of two or three tables that loops back to T — triggers Postgres to re-evaluate T's own RLS policy while evaluating T's own RLS policy. `20260128000001` hit this on `team_memberships` reading itself; `20260316120000` was a different bug (privilege backfill leak) but same family of "role state read without a clean, single choke point."

**The fix, generalized to org+workspace:** every cross-table permission check goes through a `SECURITY DEFINER STABLE` function — never an inline `EXISTS` against a membership table from that same table's own policy, and never a policy on table A that queries table B whose policy queries table A.

```sql
-- Org-level check
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id AND user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION has_org_role(p_org_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_org_id AND user_id = p_user_id AND role = ANY(p_roles)
  )
  OR EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id AND primary_owner_user_id = p_user_id
  );
END;
$$;

-- Two-level check: does this user have effective access to a WORKSPACE, either
-- via direct workspace membership OR via org-level admin/owner override
-- (this is the GHL "agency admin sees everything under it" pattern —
-- CallVault already does this for recordings in the personal_organization
-- migration's "Org Admins can view all recordings in org" policy; generalize it).
CREATE OR REPLACE FUNCTION has_workspace_access(p_workspace_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_memberships wm
    WHERE wm.workspace_id = p_workspace_id AND wm.user_id = p_user_id
  )
  OR EXISTS (
    SELECT 1 FROM workspaces w
    WHERE w.id = p_workspace_id
      AND has_org_role(w.organization_id, p_user_id, ARRAY['organization_owner', 'organization_admin'])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_org_role(UUID, UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION has_workspace_access(UUID, UUID) TO authenticated;
```

`workspace_entries` / `recordings` / any workspace-scoped table then calls `has_workspace_access(workspace_id, auth.uid())` in its policy — one function call, no self-join, no cycle. **Rule of thumb for this milestone:** if you ever find yourself writing `EXISTS (SELECT 1 FROM <table policy is on> ...)` inside that same table's own policy, stop — extract it into a `SECURITY DEFINER` function first, exactly like `is_active_team_member` did.

**Why `plpgsql`, not `sql`, for anything gating an RLS-enabled table:** Postgres can inline simple `LANGUAGE sql` functions directly into the calling query plan. Usually harmless — but if a `SECURITY DEFINER` function's whole point is to run with elevated privilege specifically to *avoid* re-triggering RLS on the inner table, inlining can undermine that isolation in some planner scenarios. This codebase's own working fix (`is_active_team_member`, `is_team_admin`) used `plpgsql` for exactly this reason. Default to `plpgsql STABLE SECURITY DEFINER` for every new helper gating an RLS-enabled table — every table in this schema has RLS enabled per `supabase/CLAUDE.md`, so that's all of them.

### 4. Privilege escalation guard — don't let org_admin grant org_owner to themselves

When building the "manage org members" UI/RPC, gate role *assignment* the same way Makerkit's `has_more_elevated_role` does: the assigning user's role must outrank the role being assigned, and only the current `primary_owner_user_id` (via the transfer RPC in Section 2) can create a second owner-equivalent — never a raw `UPDATE organization_memberships SET role = 'organization_owner'` exposed to clients. Keep the existing `CHECK` constraint restricting `organization_memberships.role IN ('organization_owner','organization_admin','organization_member')` (already present per `20260330200000_align_workspace_roles_5_to_4.sql`), and put the escalation guard in the RPC/policy layer, not the constraint.

### 5. Groundwork for future permissioned cross-org sharing (don't over-build now)

The milestone explicitly scopes this as groundwork, not implementation. The forward-compatible move: make every org-role check flow through a *named helper function* (Section 3), never a hardcoded `role IN (...)` string scattered across individual RLS policies. Two ways to extend this later, pick the lighter one now:

- **Lightweight (recommended for this milestone):** role-name checks via `has_org_role()`/`has_workspace_access()`, centralized. A future migration to fine-grained permissions only touches these function bodies, not every RLS policy across the schema.
- **Heavier (Makerkit-style, defer unless a concrete cross-org-sharing spec lands this milestone):** add an `app_permissions` enum + `role_permissions(role, permission)` table + `has_permission(user_id, org_id, permission)` function. This is the right shape *when* cross-org sharing needs resource-level grants (e.g., "share workspace X read-only with org Y") — but building the permissions table now, before the sharing spec exists, risks guessing the wrong permission granularity and needing a second migration anyway (the exact outcome this milestone is trying to avoid). Don't build it speculatively.

### 6. On Supabase Custom Access Token Hooks (JWT custom claims) — situational, not required

Supabase supports a [Custom Access Token Auth Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) that injects server-controlled (client-immutable) claims into the JWT at mint time, distinct from `user_metadata` (which Supabase's own docs explicitly warn is client-mutable and unsafe for authorization — the same warning Makerkit's guide gives). This could shave a DB round-trip off every RLS check by reading `auth.jwt() ->> 'org_role'` instead of calling `has_org_role()`. **Not recommended for this milestone:** it adds a second source of truth (role changes don't take effect until the JWT refreshes, ~1hr by default, or the client force-refreshes) and a new Auth Hook to build/maintain/debug. The `SECURITY DEFINER` function approach is simpler, always-current, and already the proven pattern in this codebase. Revisit only if RLS-check query volume becomes a measured performance problem, not a speculative one.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Postgres RLS + `SECURITY DEFINER` functions (Supabase-native) | Clerk Organizations | If auth identity itself were moving off Supabase Auth, or if you needed pre-built SSO/SCIM/domain-verification UI for enterprise procurement. Neither applies here — moving membership/role source-of-truth out of Postgres breaks every existing RLS policy's assumption that `auth.uid()` + a Postgres table is the full picture. Also, Clerk Organizations is a single-level org+member model, not the two-level org+workspace hierarchy this app needs. |
| Postgres RLS + `SECURITY DEFINER` functions | WorkOS | WorkOS solves SAML SSO / SCIM directory sync / audit logs for enterprise sales-led GTM — a different problem than "add a role tier above workspace." Not relevant until an enterprise customer contractually requires SSO. |
| Role-name checks via helper functions (lightweight RBAC) | Full permission-table RBAC (Makerkit-style `app_permissions` + `role_permissions`) | Build this when the cross-org-sharing spec exists and needs resource-level grants, not speculatively now. |
| `SECURITY DEFINER` function reads (current-request, always-fresh) | Custom Access Token Hook + JWT claims | Only if RLS-check latency is measured as a real bottleneck at scale; accept the staleness/complexity tradeoff explicitly if you go this route. |
| Postgres RLS as the authorization boundary | External policy engine (Oso, Permit.io, Cerbos) | Only justified at ABAC complexity (dynamic, attribute-based, cross-resource rules) well beyond a two-level role hierarchy. Two levels of RBAC does not warrant a new infra dependency. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Inline `EXISTS (SELECT 1 FROM <same table>)` inside that table's own RLS policy | This exact pattern caused `20260128000001`'s infinite recursion on `team_memberships`. Will recur on `organization_memberships` or `workspace_memberships` if repeated. | `SECURITY DEFINER STABLE` helper function, called from the policy — breaks the recursion by bypassing RLS on the read. |
| Client-mutable `user_metadata` / `raw_user_meta_data` for role/permission checks | User-controllable; not an authorization boundary. Supabase's own docs and every production RLS guide surveyed warn against this explicitly. | Database-backed role tables (`organization_memberships`, `workspace_memberships`) read through `SECURITY DEFINER` functions. |
| Raw `UPDATE organizations SET primary_owner_user_id = ...` exposed to `authenticated` role via a permissive RLS policy | Privilege escalation — any admin-level user could self-transfer ownership. | `transfer_organization_ownership()` `SECURITY DEFINER` RPC with an explicit "caller must be current owner" check. |
| Treating "org owner" as a Postgres database ROLE (à la `REASSIGN OWNED BY`) | Conflates Postgres's own object-ownership system (which governs DDL privileges on the `postgres` connection) with the application-level concept of "which `auth.users` row owns this `organizations` row." Different mechanisms entirely — Postgres `REASSIGN OWNED BY` is for database administration, not app authorization. | A plain foreign-key column (`primary_owner_user_id`) plus RLS/RPC logic, as above. |
| Swapping Supabase Auth for Clerk/WorkOS to get "organizations as a first-class primitive" | This codebase's entire RLS security boundary already assumes Postgres is the source of truth for org/workspace membership. Moving that off-platform is an architecture rewrite disguised as an auth-provider swap, and isn't needed — Postgres already models orgs, workspaces, and roles fine; it's missing an owner-transfer mechanism and a role tier, not a data model. | Add the columns/functions/RPCs above on the existing schema. |
| Building the full `app_permissions` enum + `role_permissions` grant table speculatively, before the cross-org sharing spec exists | Guessing permission granularity ahead of the actual sharing requirements risks a second migration anyway — the exact outcome this milestone is trying to avoid. | Centralize checks through named helper functions now (lightweight); add the permission table when the sharing spec is real. |

## Stack Patterns by Variant

**If org-level roles need to override workspace-level roles (GHL "broader permission always wins" pattern):**
- Use the `has_workspace_access()` OR-composition shown above (workspace membership OR org owner/admin override).
- Because this is already the precedent in this codebase (`"Org Admins can view all recordings in org"` policy in `20260306000000_personal_organization_and_home.sql`) — generalize the existing precedent, don't invent a new shape.

**If ownership transfer must survive the outgoing owner losing all access (e.g., they're removed from the org entirely, not just demoted):**
- Do the transfer RPC (Section 2) *before* any removal RPC — never allow "remove last owner" and "transfer ownership" to be separate, racy operations. Reuse the existing `has_other_workspace_owner()` / last-owner-removal-trigger pattern from `20260310000010_rls_permission_enforcement.sql`, adapted to `organizations`/`organization_memberships` — this codebase already has a battle-tested TOCTOU-safe, deadlock-safe (`ORDER BY user_id ... FOR UPDATE`) last-owner-guard trigger. Copy that locking pattern for the org-level equivalent rather than re-deriving it.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| New migrations (this milestone) | Existing 211+ migration chain | Pure additive SQL — `ALTER TABLE ... ADD COLUMN`, new functions, new policies. No breaking changes to existing `organization_memberships` / `workspace_memberships` role `CHECK` constraints required unless org roles are expanded beyond the current 3 (`organization_owner`/`organization_admin`/`organization_member`). |
| `src/test/rls-regression.test.ts` | Any new org-RBAC-governed table | Must add new tables to `CROSS_ORG_TABLES` array — this is the CI gate that catches exactly the class of bug this research is designed to prevent. |

## Sources

- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — official RLS reference, HIGH confidence
- [Infinite recursion in Postgres RLS: a SECURITY DEFINER gotcha (dev.to)](https://dev.to/bairescodeai/infinite-recursion-in-postgres-rls-a-security-definer-gotcha-1916) — confirms `plpgsql` non-inlining behavior for `SECURITY DEFINER` recursion fixes; MEDIUM confidence (community source), cross-checked against this codebase's own working fix
- [Supabase Custom Access Token Hook docs](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — official, HIGH confidence, used to explicitly rule out JWT-claims-for-roles as unnecessary here
- [Supabase Custom Claims & RBAC guide](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac) — official, HIGH confidence
- [Makerkit — Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — production Supabase SaaS boilerplate reference implementation of `accounts` + `primary_owner_user_id` + `accounts_memberships` + `has_role_on_account`/`has_permission`/`has_more_elevated_role` pattern; MEDIUM confidence (third-party, but a widely-used production reference and directly analogous to this milestone's exact problem)
- [GoHighLevel agency/sub-account role docs](https://help.gohighlevel.com/support/solutions/articles/48001078296-admin-vs-user-roles-and-permission-scopes) — confirms the two-tier "broader permission stacks/wins" model requested for research; MEDIUM confidence (vendor help docs, cross-checked across multiple GHL sources)
- [Clerk Organizations roles/permissions docs](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — HIGH confidence for what Clerk offers; used to establish why it's NOT the right move here (single-level org, not the two-level org+workspace shape this app needs, and a full auth-identity migration)
- [WorkOS vs Auth0 vs Clerk 2026 comparison](https://workos.com/blog/workos-vs-auth0-vs-clerk-the-best-auth-platform-for-b2b-saas-in-2026) — MEDIUM confidence (vendor blog), used to confirm WorkOS solves SSO/SCIM, not role-hierarchy modeling
- This repository's own migrations (HIGH confidence — ground truth): `20260128000001_fix_team_memberships_rls_recursion.sql`, `20260316120000_fix_admin_role_leak.sql`, `20260306000000_personal_organization_and_home.sql`, `20260330200000_align_workspace_roles_5_to_4.sql`, `20260310000010_rls_permission_enforcement.sql`, `supabase/CLAUDE.md`

---
*Stack research for: organization-as-entity + org-level RBAC (CallVault v2.2 milestone)*
*Researched: 2026-07-30*
