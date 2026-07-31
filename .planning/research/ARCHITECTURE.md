# Architecture Research: Organization-as-Entity + Org-Level RBAC

**Domain:** Multi-tenant SaaS RBAC layering (Supabase/Postgres RLS + React service/hook pattern)
**Researched:** 2026-07-30
**Confidence:** HIGH (all findings verified directly against this repo's migrations, `mcp-server/auth.ts`, and `organizations.service.ts` — no external ecosystem claims needed; this is an integration study, not a greenfield-tech survey)

## Current State (verified from code, not assumed)

### Existing tables (already in prod)

| Table | Key columns | Notes |
|---|---|---|
| `organizations` | `id, name, slug, type ('personal'\|'business'), cross_org_default, logo_url, created_at, updated_at` | **No `owner_user_id` or `created_by` column exists.** Ownership is 100% implicit — whichever row(s) in `organization_memberships` have `role = 'organization_owner'`. |
| `organization_memberships` | `id, organization_id, user_id, role` | `role` CHECK constrained to **3 values**: `organization_owner`, `organization_admin`, `organization_member` (locked in `20260330200000_align_workspace_roles_5_to_4.sql`). Multiple owners are already schema-legal — nothing currently prevents 2 users both holding `organization_owner` on one org. |
| `workspaces` | `id, organization_id, name, workspace_type, is_home, is_default, slug, invite_token, invite_expires_at` | Unrelated to org RBAC directly; scoped under an org. |
| `workspace_memberships` | `id, workspace_id, user_id, role` | 4 roles: `workspace_owner, workspace_admin, contributor, member` (aligned 2026-03-30). |
| `mcp_tokens` | `id, user_id, org_id, workspace_id, scope ('workspace'\|'organization'), enabled_categories?` | Legacy manual-token path. RLS: `user_id = auth.uid()` only — **no org-role check on mint or use.** |
| `mcp_oauth_client_grants` | `org_id, workspace_id, scope, enabled_categories, revoked_at` | OAuth 2.1 client-grant path (current primary path per `mcp-server/auth.ts`). Same gap: **org role is never consulted**, only org/workspace *membership existence* via `enforceWorkspaceAudience` / `enforceSubdomainSlugAudience`. |

### The actual "creator-coupling" problem

There is no `organizations.owner_user_id`. The coupling is structural, not columnar:

1. `handle_new_user()` (auth trigger) and `ensure_personal_organization()` both **auto-create exactly one `type='personal'` org per user** and insert that user as the sole `organization_owner` in the same transaction.
2. Nothing in the schema stops a personal org from having its `type` changed or a second owner added — but nothing in the *product* exposes that either. In practice a personal org behaves as 1-user/1-owner/non-transferable because no code path handles the N-owner or transfer case.
3. `organizations.service.ts` (`createOrganization`) does the identical pattern for `type='business'` — insert org, then insert exactly one `organization_owner` membership, same transaction, no audit trail.

**So "decouple org from creator" is not a migration to add a foreign key — it's building the missing capability**: transfer ownership, support >1 owner deliberately, and stop any code from treating "the user who is `organization_owner` on a `type='personal'` org" as an unchangeable identity fact.

### RLS recursion history — what actually happened, and the fix already in place

Both incidents referenced in your milestone context are from the **pre-rename `teams`/`team_memberships` schema** (Jan 2026, before the Feb/Mar rename to `organizations`/`workspaces`):

- `20260128000001_fix_team_memberships_rls_recursion.sql` — `team_memberships` SELECT policy self-referenced `team_memberships` in an `EXISTS` subquery. Any *other* table's policy that joined through `team_memberships` triggered nested RLS evaluation → infinite recursion.
- `20260129000004_fix_teams_rls_recursion.sql` — same pattern one level up (`teams` policy querying `team_memberships`).

**Fix pattern (already the house style, carried forward into the org/workspace rename):** `SECURITY DEFINER STABLE` SQL functions that bypass RLS internally, called from policies instead of inline subqueries:

```sql
CREATE OR REPLACE FUNCTION public.is_organization_member(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = p_user_id) $$;

CREATE OR REPLACE FUNCTION public.is_organization_admin_or_owner(p_organization_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM organization_memberships WHERE organization_id = p_organization_id AND user_id = p_user_id AND role IN ('organization_owner','organization_admin')) $$;
```

Mirror pair exists for workspaces: `is_workspace_member()`, `is_workspace_admin_or_owner()`.

**One existing inconsistency to fix, not copy:** `organization_invitations` RLS (`20260306000000_personal_organization_and_home.sql`) writes a raw inline `EXISTS (SELECT 1 FROM organization_memberships ...)` instead of calling `is_organization_admin_or_owner()`. It isn't currently recursive (no policy on `organization_memberships` itself queries `organization_invitations`), but it duplicates authority logic outside the single source of truth. **Every new policy for this milestone must call the helper functions — never inline `EXISTS` against `organization_memberships` or `workspace_memberships` directly**, full stop, no exceptions, even when the immediate case looks safe. That discipline is what prevented incident #3.

## Recommended Schema Changes

### 1. `organizations` — add ownership + audit columns (additive, non-breaking)

```sql
ALTER TABLE organizations
  ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN owner_transferred_at TIMESTAMPTZ;
```

`created_by` is **audit-only** — never an authority check. Authority stays 100% in `organization_memberships.role`. Backfill `created_by` from the earliest `organization_owner` membership row per org (best-effort; `NULL` is acceptable for ambiguous legacy rows — don't invent history).

Do **not** add `owner_user_id` as a single-column authority pointer — the schema already supports multiple owners via `organization_memberships`, and encoding "the one true owner" as a column would immediately conflict with that and reintroduce exactly the coupling this milestone is removing. Ownership is a *role held in the membership table*, plural by design.

### 2. `organization_ownership_transfers` — new audit table

```sql
CREATE TABLE organization_ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE organization_ownership_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org owners/admins can view transfer history"
  ON organization_ownership_transfers FOR SELECT
  USING (is_organization_admin_or_owner(organization_id, auth.uid()));
-- INSERT only via a SECURITY DEFINER RPC (transfer_organization_ownership()), never direct client insert.
```

This is the piece that makes ownership-transfer **provable**, not just possible — matters because the milestone explicitly wants "no second migration" when cross-org sharing lands; an audit trail on the *entity* level (not workspace level) is the primitive that generalizes.

### 3. Org-level RBAC — do NOT add a 4th org role. Add a capability function instead.

The workspace layer already has 4 roles because workspace roles gate day-to-day content actions (create/edit/delete entries). Org roles gate a much smaller surface (billing, membership, cross-workspace visibility, ownership). Expanding `organization_memberships.role` past 3 values buys you another migration and another set of CHECK-constraint call sites to update (you already did that exercise once in `20260330200000` — don't repeat it without a concrete role that doesn't map to owner/admin/member).

Instead, add one **capability-mapping SECURITY DEFINER function** that both current code and future cross-org sharing can call:

```sql
CREATE OR REPLACE FUNCTION public.has_organization_capability(
  p_organization_id uuid, p_user_id uuid, p_capability text
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
      AND (
        (p_capability = 'transfer_ownership' AND om.role = 'organization_owner') OR
        (p_capability = 'manage_billing'     AND om.role = 'organization_owner') OR
        (p_capability = 'manage_members'     AND om.role IN ('organization_owner','organization_admin')) OR
        (p_capability = 'manage_workspaces'  AND om.role IN ('organization_owner','organization_admin')) OR
        (p_capability = 'view_all_org_data'  AND om.role IN ('organization_owner','organization_admin')) OR
        (p_capability = 'mint_org_mcp_token' AND om.role IN ('organization_owner','organization_admin'))
      )
  )
$$;
```

This single function is the "org-as-entity and permissioned sharing are the same primitive at two scopes" decision made concrete: when cross-org sharing ships, you add `has_shared_organization_capability(source_org_id, target_org_id, user_id, capability)` as a sibling function that consults a future `cross_org_grants` table — **every RLS policy and every service-layer check that already calls `has_organization_capability()` needs zero changes**, because the capability vocabulary is already externalized from the role enum.

### 4. RLS pattern for all new/changed policies

Every policy touching `organizations`, `organization_memberships`, `organization_ownership_transfers`, or any table that needs org-role gating must call `is_organization_member()`, `is_organization_admin_or_owner()`, or the new `has_organization_capability()` — never an inline `EXISTS` against `organization_memberships`. This is the concrete, mechanical rule that prevents recursion incident #3: recursion happened both times because a policy queried its *own* table (or a table one hop away) inline instead of through a `SECURITY DEFINER` boundary that breaks the RLS re-evaluation chain.

## Integration Points

### Service + hook layer (`src/services/`, `src/hooks/`)

| File | Change | Why |
|---|---|---|
| `src/services/organizations.service.ts` | Add `transferOrganizationOwnership(orgId, toUserId, reason)` → calls a new `transfer_organization_ownership()` SECURITY DEFINER RPC (mirrors the existing `remove-org-member` Edge Function pattern: server-side authorization check, not client-trusted). Add `getOrganizationCapabilities(orgId, userId)` → thin wrapper over `has_organization_capability` via RPC or a batched query, for UI gating. | Ownership transfer must never be a raw client `UPDATE` on `organization_memberships` — it's a multi-row operation (revoke old owner's implicit rights if you go single-owner-per-transfer, insert/promote new owner, write audit row) that needs to be atomic and needs the same "verify caller is authorized server-side" discipline `remove-org-member` already established. |
| New: `src/hooks/useOrganizationCapability.ts` | TanStack Query hook wrapping `getOrganizationCapabilities`, keyed by `queryKeys.organizations.capabilities(orgId, userId)`. | Every UI surface that conditionally renders "Transfer ownership" / "Manage members" / "Mint org-scoped MCP token" buttons needs one canonical place to ask "can I do X here" — matches the existing `membershipRole` pattern already returned by `getOrganizations()`, just capability-shaped instead of role-shaped so it survives the eventual cross-org-sharing extension. |
| `src/services/organization-invitations.service.ts` | No structural change required, but any invite-role-assignment UI must route through the 3-value role enum, not a hallucinated 4th value. | Keeps invite flow consistent with the schema's locked 3 org roles. |

### MCP OAuth token scoping (`supabase/functions/mcp-server/auth.ts`)

This is the sharpest integration risk in the milestone. Today, an org-scoped grant (`scope: 'organization'`) is authorized purely by `org_id` match (`enforceSubdomainSlugAudience`) — **the granting/using user's org role is never checked**, and `enabled_categories` (read/write/ai/admin) is set once at grant-creation time and never re-derived from current role.

Two concrete gaps this creates:
1. An `organization_member` (not owner/admin) can currently mint or use an org-scoped token with `write`/`admin` categories if the client requested them — nothing stops it.
2. A user demoted from `organization_admin` to `organization_member` keeps full org-scoped token capability until the token/grant is manually revoked — role changes don't propagate to already-issued tokens.

**Fix, two layers (mint-time + request-time), same as the existing JWT-pivot fix pattern (`06.1-sec-jwt-fix`) which established "verify from a trusted, freshly-queried source, never trust what's already on the token/claim"):**

- **Mint-time:** wherever an org-scoped grant/token is created (OAuth authorize flow + the legacy `mcp_tokens` insert path), call `has_organization_capability(org_id, user_id, 'mint_org_mcp_token')` server-side before persisting the grant, and cap `enabled_categories` to the categories the org role actually permits (e.g., `organization_member` → read-only regardless of what the client requested).
- **Request-time (the real fix for the demotion gap):** in `auth.ts`, add an `enforceOrgRoleCapability()` step alongside the existing `enforceWorkspaceAudience()` / `enforceSubdomainSlugAudience()` calls, right before returning `{ ok: true, mcpToken }`. It re-queries `has_organization_capability()` fresh on every request (it's `STABLE SECURITY DEFINER`, cheap, same cost class as the membership checks already running) and intersects the token's stored `enabled_categories` with what the *current* role permits — so a demoted user's next MCP call is silently capped even if the grant row itself wasn't touched.

Workspace-scoped tokens are unaffected by this change — they already resolve through `workspace_memberships`, a separate axis, and that path stays as-is.

### Frontend components (new, not yet built)

| Component | Location | Purpose |
|---|---|---|
| `OrganizationOwnershipTransferDialog` | `src/components/organization/` (new domain folder, sibling to `workspace/`) | Radix Dialog, gated by `useOrganizationCapability(orgId).transfer_ownership`. Confirms target user is already an org member before allowing transfer (can't transfer to an outsider — that's an invite flow, not a transfer flow). |
| `OrgRoleBadge` | `src/components/organization/` | Reusable role display, mirrors whatever `WorkspaceRoleBadge` pattern already exists for the 4 workspace roles — check `src/components/workspace/` for the existing pattern before inventing a new one. |

## Anti-Patterns to Avoid (specific to this codebase's history)

### Anti-Pattern 1: Inline `EXISTS` against membership tables in RLS policies

**What happened before:** `team_memberships` and `teams` policies both self-referenced or cross-referenced membership tables inline, causing "infinite recursion detected in policy for relation" in production.
**Why it's wrong:** Postgres re-evaluates RLS for every table touched inside a policy's own subquery, including the table the policy is defined on. Membership tables get queried from many other tables' policies (recordings, workspace_entries, invitations, tokens) — any inline reference is a future recursion landmine, not just a style nit.
**Instead:** Always call the `SECURITY DEFINER STABLE` helper functions (`is_organization_member`, `is_organization_admin_or_owner`, `has_organization_capability`, and the workspace equivalents). If a new check doesn't have a helper yet, write one — don't inline it "just this once."

### Anti-Pattern 2: Encoding "the owner" as a single foreign key column

**What it would look like:** `organizations.owner_user_id UUID`.
**Why it's wrong here specifically:** The schema already allows N owners via `organization_memberships.role = 'organization_owner'`, and nothing in the product forbids co-ownership on business orgs today. A single-column pointer creates two competing sources of truth (the column vs. the membership rows) the moment someone adds a second owner, and every RLS policy/service function would need to pick one and silently ignore the other.
**Instead:** Ownership is `organization_memberships.role = 'organization_owner'`, full stop, N-valued by design. Use `organization_ownership_transfers` for the audit trail, not a mutable owner column.

### Anti-Pattern 3: Trusting client-supplied capability/category values on MCP grants without a fresh server-side re-check

**What happened before:** `readClientIdFromJwt()` decoded an unverified JWT claim client-side-adjacent, letting a forged `client_id` pivot to another client's grant scope (fixed in `06.1-sec-jwt-fix`).
**Why it's relevant here:** The same failure shape applies to org-role-derived MCP capability — if `enabled_categories` is only checked at mint time and never re-derived, a role change (demotion, removal) doesn't propagate, which is functionally the same class of bug (stale authority trusted at request time).
**Instead:** Re-derive capability from `organization_memberships` fresh on every MCP request via `has_organization_capability()`, the same "verify via a freshly-queried, cryptographically/RLS-trusted source, not a cached/stored claim" discipline the JWT fix established.

## Build Order

Sequencing matters here specifically because of the recursion history — schema/RLS changes need to land and be regression-tested *before* anything downstream depends on their shape, and the MCP auth changes are the highest-blast-radius piece (a bug there is a live security hole, not a UI glitch).

1. **Schema + RLS (foundation, no app code depends on it yet):**
   `organizations.created_by` + `owner_transferred_at` columns → `organization_ownership_transfers` table + RLS → `has_organization_capability()` function → fix the `organization_invitations` policy to call `is_organization_admin_or_owner()` instead of its inline `EXISTS` (small cleanup, closes the one existing inconsistency while you're in this code) → **add every new/touched table to `CROSS_ORG_TABLES` in `src/test/rls-regression.test.ts` and run it locally before moving on.**
2. **`transfer_organization_ownership()` SECURITY DEFINER RPC** — the one INSERT path into `organization_ownership_transfers`, does the membership-role mutation + audit write atomically. Test it directly (integration test against the TEST project, per `supabase/CLAUDE.md` rules) before wiring any UI to it.
3. **Services layer** — `organizations.service.ts` additions (`transferOrganizationOwnership`, `getOrganizationCapabilities`). Pure async functions, no React, unit-testable against the RPC from step 2.
4. **MCP auth integration** — `enforceOrgRoleCapability()` in `mcp-server/auth.ts`, plus the mint-time cap on grant/token creation. This is the step that most directly touches the "hit recursion/leak bugs twice" risk surface (auth boundary code) — write the failing test first (mirrors the `sec-jwt-fix` RED/GREEN pattern already used in this file), verify it against both an `organization_owner` and an `organization_member` token before shipping.
5. **Hooks** — `useOrganizationCapability`, wired to the services from step 3.
6. **UI** — `OrganizationOwnershipTransferDialog`, capability-gated buttons/menu items across existing org settings surfaces.

Steps 1–2 are pure backend and reversible via migration rollback if something's wrong. Step 4 is the one to slow down on — it's the auth boundary, and this codebase's own history (recursion twice, one JWT-pivot privilege escalation) says that's exactly where a rushed change bites.

## Sources

- Direct repo inspection: `supabase/migrations/00000000000000_consolidated_schema.sql`, `20260301000001_rename_vaults_to_workspaces.sql`, `20260303000003_naming_cleanup.sql`, `20260306000000_personal_organization_and_home.sql`, `20260330200000_align_workspace_roles_5_to_4.sql`, `20260128000001_fix_team_memberships_rls_recursion.sql`, `20260129000004_fix_teams_rls_recursion.sql`, `20260310160000_mcp_tokens.sql`
- `supabase/functions/mcp-server/auth.ts` (full read, lines 150–444) — org/workspace grant resolution, `enforceWorkspaceAudience`, `enforceSubdomainSlugAudience`
- `.planning/milestones/v1.0-phases/06.1-mcp-subdomain-routing/06.1-sec-jwt-fix-SUMMARY.md` — the JWT-pivot privilege-escalation fix, used as the precedent pattern for "verify fresh, don't trust cached claims"
- `src/services/organizations.service.ts` — confirms no `owner_user_id` column exists; ownership is membership-role-derived
- `supabase/CLAUDE.md` — RLS regression test contract (`CROSS_ORG_TABLES` array, `src/test/rls-regression.test.ts`), integration test safety rules
- `.planning/PROJECT.md` — v2.2 milestone scope, "org-as-entity and permissioned sharing are the same primitive at two scopes" decision

---
*Architecture research for: CallVault v2.2 Organization Entity & Access Foundation*
*Researched: 2026-07-30*
