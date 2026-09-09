# Phase 36: Live Organizations - Research

**Researched:** 2026-09-08
**Domain:** Postgres/Supabase schema + RLS design for a claimable canonical-entity model (org identity, domain-ownership verification, non-destructive merge)
**Confidence:** HIGH

## Summary

Phase 36 adds zero new libraries and zero new infrastructure classes — it is a pure Postgres/Supabase schema + RLS phase that reuses two mechanisms already built and proven earlier in this exact milestone: Phase 34's `identity_aliases` verified-email spine (for domain-ownership proof) and the SECURITY DEFINER + atomic-RPC + REVOKE-EXECUTE pattern already shipped three times (`apply_event_match_atomic`/`reverse_event_match_atomic` in Phase 31, `kill_switch_revert_event_merges` in Phase 32). The `organizations` table is confirmed live-verified as `id, name, slug, type, logo_url, cross_org_default, created_at, updated_at` with zero domain/alias/canonical columns — this phase is purely additive, no data migration, no rename.

The single highest-risk finding: `is_organization_member()` and `is_organization_admin_or_owner()` are the RLS choke point for roughly 15 tables (`recordings`, `workspaces`, `call_participants`, `contacts`, `sync_jobs`, `import_routing_rules`, `organizations` itself, etc.) — every one of them keys strictly off the literal `organization_id`/`org_id` column on the row being checked. ORG-04 ("org association with an event confers no access to any capture of it") is fundamentally a promise that `canonical_organization_id` never gets dereferenced inside that choke point. If a future edit makes `is_organization_member` treat "member of the org this org points to" as equivalent membership, every one of those ~15 tables silently develops a cross-org leak in one shot. This must be an explicit, named non-goal in the plan, not an implicit assumption.

The second major finding: this codebase already has **two structurally distinct "admin" concepts** that this phase must not conflate. `is_organization_admin_or_owner(org_id, user_id)` (checks `organization_memberships.role`) is org-scoped and gates the *self-serve* domain-claim in Settings. `has_role(user_id, 'ADMIN')` (checks the separate `user_roles` table) is platform-scoped and must gate the *internal* merge/unclaim tools in Admin Center — because a platform operator merging two customer orgs is not necessarily a member of either. This codebase has a shipped security-incident migration (`20260316120000_fix_admin_role_leak.sql`) from role-precedence confusion in the platform-admin system specifically — reason to be precise here, not casual.

**Primary recommendation:** Two new tables (`organization_domains`, `organization_aliases`), each a simple single-parent-FK table on `organizations(id)` with `organization_id` (not `org_id` — see Pitfall 10) — no partial-unique/verified-boolean complexity needed on `organization_domains` (unlike `identity_aliases`) because every row in it is by definition already verified; there is no pending state this phase (CONTEXT.md: claim resolves synchronously, no DNS-TXT flow). Add `canonical_organization_id` + `merged_at` + `merged_by` directly to `organizations`. Gate the self-serve claim through a direct client-callable `SECURITY DEFINER` RPC mirroring `accept_organization_invite`'s exact shape (no edge function needed — no external email send is involved). Gate merge/unclaim through the `admin-manage-user` + `kill_switch_revert_event_merges` combined shape: an edge function checks `has_role(caller, 'ADMIN')`, then invokes a service-role-only, `REVOKE EXECUTE`'d `SECURITY DEFINER` RPC that takes admin identity by parameter, never `auth.uid()`.

## Architectural Responsibility Map

This is a Vite + React 18 SPA (no SSR) backed by Supabase Postgres — there is no "Frontend Server" or "CDN/Static" tier distinct from Browser/Client and Database in this stack; the "API/Backend" tier here means Supabase Edge Functions (Deno) plus Postgres RPCs, which is where all business logic and authorization actually live (RLS is the last line of defense, not the primary logic layer, for anything with cross-table validation).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Alias/domain storage, `canonical_organization_id` pointer | Database/Storage | — | New columns/tables on `organizations`-adjacent schema; pure data at rest |
| Domain-claim eligibility check (verified email, blocklist, conflict) | API/Backend (Postgres RPC) | Database/Storage (RLS as backstop) | Multi-table validation with distinct error codes — needs `SECURITY DEFINER`, not raw RLS (RLS can't produce the 3 distinct UI-SPEC error variants) |
| Domain global-uniqueness enforcement | Database/Storage | API/Backend | A `UNIQUE` index is the actual race-safe guarantee; the RPC's pre-check is UX-only |
| Org-admin authorization (self-serve claim) | API/Backend | Database/Storage | `is_organization_admin_or_owner()` — existing SECURITY DEFINER helper, org-scoped |
| Platform-admin authorization (merge, unclaim) | API/Backend | — | `has_role(user_id,'ADMIN')` — existing SECURITY DEFINER helper, platform-scoped, distinct from the row above |
| Merge/unclaim reversible mutation | API/Backend (Postgres RPC) | — | Atomic `SECURITY DEFINER` function, authority-by-parameter, `REVOKE EXECUTE` from client roles |
| Cross-org isolation proof (ORG-04) | Database/Storage (RLS) | API/Backend (test harness) | Enforced at RLS; proven by `src/test/rls-regression.test.ts` from real JWTs, never service-role |
| Settings UI (aliases, domain claim, badge) | Browser/Client | — | Already fully specified in `36-UI-SPEC.md`; reuses `OrganizationsTab.tsx`'s per-org Card |
| Admin Center UI (merge, unclaim) | Browser/Client | API/Backend | Reuses `UsersSection.tsx`/`AdminCategoryPane.tsx` registration pattern; authority still enforced server-side |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Domain & Alias Model**
- Domain uniqueness is global across ALL orgs — one domain maps to exactly one org, never shared. A shared domain across two orgs would break the canonical-entity premise.
- `organization_aliases` is display/search metadata only this phase — no fuzzy-match or automated duplicate-detection algorithm. Mirrors how the MATCH-* resolution tiers were scoped incrementally rather than all at once.
- Common free-email domains (gmail.com, outlook.com, yahoo.com, etc.) are blocklisted from being claimed as an organization domain — claiming "gmail.com" would let any Gmail user claim the org.
- Aliases are NOT globally unique. Two real-world companies can legitimately share a DBA/alias name; the organization's canonical identity remains its `id`.

**Domain Claim & Verification**
- Domain ownership is proven by reusing Phase 34's verified-email mechanism: a user holding an already-verified `@acme.com` email (via `identity_aliases`) can claim `acme.com` for their organization. No new DNS TXT-record flow or fresh verification-email flow this phase.
- Only org admins/owners can initiate a domain claim — mirrors existing org-admin gating used elsewhere (e.g. invitations).
- Conflict rule: first-claim-wins. If a second org later has a member with a verified email on an already-claimed domain, that claim attempt is rejected with a clear conflict message. Allowing multiple orgs to claim the same domain was explicitly rejected as inconsistent with the canonical-entity premise.
- Claims are reversible: a service-role/admin-only unclaim capability exists, mirroring the milestone-wide reversible-operation pattern (kill switch, `reverse_event_match_atomic`). Not necessarily exposed as a self-serve UI action this phase.

**Duplicate Merge Mechanics**
- Merges are manual/admin-initiated only. ORG-03 requires that duplicates *can* be merged, not that they're auto-detected — no automated duplicate-org finder this phase.
- Mechanically, `canonical_organization_id` is a redirect/pointer layer: the losing org's row gets `canonical_organization_id` pointing at the winner. Existing FK columns (e.g. `recordings.organization_id`) are NOT bulk-rewritten. This matches the milestone's additive/non-destructive SAFE-* pattern used for `events`/`identities`, and makes reversal trivial (clear the pointer).
- Dual-membership handling (a user who is a member of both the losing and winning org at merge time) is Claude's Discretion at plan time — default to preserving the higher-privilege role if both exist, unless the actual membership-table shape suggests otherwise.
- Merged (non-canonical) orgs remain directly queryable — nothing about them breaks or gets locked. New UI surfaces should follow `canonical_organization_id` when displaying "the" organization, but the old row is never hidden or deleted.

**UI Surface**
- Claim/domain/alias management lives in the existing org Settings area, as a new "Organization Identity" (or equivalently named) section — not a new standalone page.
- The merge-duplicates tool is internal/admin-only this phase (mirrors the existing AdminTab precedent for other operator-only tools) — not exposed to end users/org owners.
- Verified-domain status is shown as a small verified badge next to the org name, visually consistent with `IdentityEvidenceBadge` from Phase 34.
- No pending/polling UI state is needed for claims — the recommended verification mechanism (already-verified email) resolves synchronously as an instant confirm/reject. (This would need revisiting only if the verification mechanism ever changes to a DNS-TXT flow.)

### Claude's Discretion
- Exact schema/column naming, constraint syntax, and RLS helper-function structure — follow the established patterns from `events`/`identities` (Phase 30/34): additive only, nullable new columns, SECURITY DEFINER helpers for cross-table RLS checks, non-org-scoped visibility where appropriate.
- Whether the admin/service-role unclaim action gets a UI affordance now or stays DB-only this phase. **Resolved by 36-UI-SPEC.md: ships a minimal UI affordance in Admin Center this phase, not DB-only.**
- Dual-membership role resolution on merge (see above) — resolve against the actual membership table shape at plan time. **This research found `organization_memberships` has `UNIQUE(organization_id, user_id)` — see Open Questions for the resulting recommendation.**

### Deferred Ideas (OUT OF SCOPE)
- Automated duplicate-org detection (fuzzy alias/name matching) — explicitly deferred; this phase only makes merging *possible*, not automatic.
- DNS TXT-record domain verification — deferred in favor of reusing the verified-email mechanism; could be revisited later if a company without any already-verified member email needs to claim its domain.
- Self-serve (non-admin) merge-duplicates UI — deferred; admin-only for now given the stakes of merging real organizations.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-01 | `organization_aliases` and `organization_domains` exist; an org can carry multiple names and domains. | Table shapes proposed in Code Examples, grounded in the `organization_feature_flags` additive-table precedent (simplest existing org-scoped table: single FK, `FORCE ROW LEVEL SECURITY`, service-role-aware policy shape). Column-naming pitfall (`organization_id` not `org_id`) documented in Pitfall 10. |
| ORG-02 | An org can be claimed and verified via domain ownership. | Full reuse path for Phase 34's `identity_aliases` verified-email mechanism documented (exact table/RLS/edge-function read in this session). RPC design in Code Examples covers admin gating, blocklist, verified-email check, and generic-conflict-message requirements from `36-UI-SPEC.md`'s copy contract. |
| ORG-03 | Duplicate orgs can be merged non-destructively via `canonical_organization_id`, reversibly. | Pointer-only merge design grounded in `apply_event_match_atomic`/`reverse_event_match_atomic` (Phase 31) and `kill_switch_revert_event_merges` (Phase 32) atomic-RPC precedent. Chain/cycle-prevention trigger documented as a pitfall not covered by any existing precedent (novel to this phase). Dual-membership question resolved against real `organization_memberships` schema (UNIQUE org+user) in Open Questions. |
| ORG-04 | Org association with an event confers no access to any capture of it. Enforced at RLS. | Central pitfall (`is_organization_member` dereference leak) documented with the full list of ~15 dependent tables found via grep. Test strategy mapped in Validation Architecture, extending `src/test/rls-regression.test.ts`'s existing `CROSS_ORG_TABLES`/bespoke-block machinery. |
</phase_requirements>

## Standard Stack

This phase introduces **zero new npm/Deno dependencies**. Every mechanism needed already exists in the codebase and is version-pinned there.

### Core (already installed — no action needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.84.0` (confirmed in `package.json`) | Postgres client, RPC invocation, RLS-scoped queries | Already the only DB client in the codebase |
| `zod` | `^3.25.76` (confirmed in `package.json`) | Request validation in edge functions (domain format, alias length) | Already the only validation library; mirrors `confirm-email-alias-verification`'s `confirmSchema` pattern exactly |
| Postgres `SECURITY DEFINER` functions | N/A (Postgres-native) | Cross-table RLS checks, atomic multi-table mutations | This is the codebase's own established pattern for every non-trivial cross-table check since `is_organization_member` (Phase pre-dates this milestone) through `user_can_view_identity` (Phase 34) |
| Supabase CLI | `2.101.0` (confirmed via `supabase --version` in this session) | Migration authoring/apply, type generation | `supabase gen types typescript --linked` is the only sanctioned way to update `src/types/supabase.ts` (SAFE-07 precedent) |

### Supporting
None needed — `zod` covers input validation; no email/domain-parsing library is warranted for a short static blocklist (see Don't Hand-Roll).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded free-email blocklist array | `free-email-domains` npm package ([github.com/Kikobeats/free-email-domains](https://github.com/Kikobeats/free-email-domains)) | The package gives a larger, community-maintained list, but adds a dependency for what CONTEXT.md scoped as a short, stable list ("gmail.com, outlook.com, yahoo.com, etc."). Recommend hardcoded array for v1; revisit only if the list needs frequent runtime tuning. **Not adopted — see Package Legitimacy Audit.** |
| Direct client `supabase.rpc()` call for domain-claim | New `claim-organization-domain` edge function | An edge function adds a hop for zero benefit here (no external API call is involved, unlike `request-email-alias-verification`'s Resend send) — but is defensible if the team wants a uniform edge-function audit-log surface for all org-mutating actions. Flagged as a discretion point, not a hard call. |

**Installation:**
```bash
# No new packages required this phase.
```

**Version verification:** `@supabase/supabase-js` and `zod` versions above were read directly from `package.json` in this session (not training-data recall). Supabase CLI version confirmed via `supabase --version` executed in this session (2.101.0). No registry lookup needed since no new package is being added.

## Package Legitimacy Audit

No external packages are being installed this phase. The `free-email-domains` npm package was surfaced during ecosystem research (WebSearch, cross-referenced against HubSpot's and Forumbee's blocklist features — MEDIUM confidence, 3 independent sources agree on the ~15-20 core domains) as an *alternative* to a hardcoded list, but the recommendation is to **not** take it as a dependency — CONTEXT.md's own framing ("common free-email domains... etc.") describes a short, stable, hand-maintained list consistent with this phase's broader "no fuzzy-match, no automated infra" ethos. No slopcheck run was needed because no package is recommended for installation.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| *(none — no new packages this phase)* | — | — | — | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────┐
                         │   Browser (React SPA, no SSR)        │
                         │                                       │
  Org Settings ──────────┤ OrganizationIdentitySection.tsx       │
  (self-serve,           │  - list aliases / add alias           │
   org admin/owner)      │  - claim domain (reads own verified   │
                         │    emails via useIdentityAliases())   │
                         │  - VerifiedDomainBadge                │
                         │                                       │
  Admin Center ──────────┤ OrganizationsSection.tsx (new)        │
  (internal operator     │  - search/list all orgs               │
   tool, platform ADMIN) │  - MergeOrganizationsDialog            │
                         │  - UnclaimDomainDialog                │
                         └───────────────┬───────────────────────┘
                                         │ supabase-js (RPC + RLS-scoped SELECT)
                                         ▼
                         ┌─────────────────────────────────────┐
                         │  Supabase (Postgres + PostgREST)      │
                         │                                       │
  Self-serve path:        │  claim_organization_domain(...)       │◄── direct client RPC call
  auth.uid() available    │   SECURITY DEFINER, GRANT TO          │    (mirrors accept_organization_invite)
                         │   authenticated                       │
                         │   1. is_organization_admin_or_owner   │
                         │   2. blocklist check                  │
                         │   3. verified-email check              │
                         │      (identity_aliases, owner-scoped) │
                         │   4. UNIQUE(domain) conflict check     │
                         │   5. INSERT organization_domains       │
                         │                                       │
  Admin path:              │  merge_organizations_atomic(...)      │◄── service-role only
  no auth.uid() at RPC     │  unclaim_organization_domain(...)     │    (REVOKE EXECUTE from
  (service-role invoked)  │   SECURITY DEFINER, authority BY       │     PUBLIC/anon/authenticated)
                         │   PARAMETER via has_role() check        │
                         │                                       │
                         │  RLS on organization_domains/aliases:  │
                         │   SELECT: is_organization_member       │
                         │   INSERT/DELETE: is_organization_       │
                         │     admin_or_owner (self-serve path)   │
                         │     OR service_role (admin path)       │
                         └───────────────┬───────────────────────┘
                                         │
                                         ▼
                         ┌─────────────────────────────────────┐
                         │  Existing choke point (UNCHANGED):     │
                         │  is_organization_member(org_id, uid)   │
                         │  is_organization_admin_or_owner(...)   │
                         │   used by ~15 tables incl. recordings, │
                         │   workspaces, call_participants,       │
                         │   contacts, sync_jobs — MUST NEVER      │
                         │   dereference canonical_organization_id│
                         └─────────────────────────────────────┘
```

Meanwhile, the admin edge function path (for merge/unclaim) is:

```
Admin Center UI → edge function (merge-organizations / unclaim-organization-domain)
  1. authenticateRequest(req, anonClient) → userId
  2. serviceClient.rpc('has_role', { _user_id: userId, _role: 'ADMIN' }) → 403 if false
  3. serviceClient.rpc('merge_organizations_atomic', { ..., p_admin_user_id: userId })
     (service role bypasses the RPC's own REVOKE EXECUTE)
```

This exact two-step (client-side auth check inside an edge function, then a service-role call to a locked-down RPC) is `admin-manage-user/index.ts`'s live, already-shipped shape — read directly in this session (line ~87-91: `supabaseAdmin.rpc('has_role', { _user_id: ..., _role: 'ADMIN' })`).

### Recommended Project Structure
```
supabase/migrations/
├── <ts>_create_organization_domains_and_aliases.sql   # ORG-01: two new tables, RLS, indexes
├── <ts>_create_claim_organization_domain_rpc.sql       # ORG-02: SECURITY DEFINER RPC + GRANT
├── <ts>_add_canonical_organization_id.sql              # ORG-03: organizations columns + chain-prevention trigger
└── <ts>_create_merge_and_unclaim_admin_rpcs.sql         # ORG-03/ORG-04 support: admin-only atomic RPCs

supabase/functions/
├── merge-organizations/index.ts                        # has_role check + service-role RPC call
└── unclaim-organization-domain/index.ts                # has_role check + service-role RPC call
  (no new edge function needed for the self-serve claim path — direct RPC call, see above)

src/services/organization-identity.service.ts           # pure async wrappers (mirrors identity-alias.service.ts)
src/hooks/useOrganizationIdentity.ts                     # TanStack Query wrapper (mirrors useIdentityAliases.ts)
src/components/settings/OrganizationIdentitySection.tsx  # per 36-UI-SPEC.md implementation pointers
src/components/shared/VerifiedDomainBadge.tsx            # per 36-UI-SPEC.md implementation pointers
src/pages/admin/OrganizationsSection.tsx                 # per 36-UI-SPEC.md implementation pointers
src/components/dialogs/MergeOrganizationsDialog.tsx      # per 36-UI-SPEC.md implementation pointers
src/components/dialogs/UnclaimDomainDialog.tsx           # per 36-UI-SPEC.md implementation pointers

src/test/rls-regression.test.ts                          # register organization_domains + organization_aliases
                                                          # (likely fit the GENERIC CROSS_ORG_TABLES loop — see
                                                          # Validation Architecture) + a new bespoke block proving
                                                          # canonical_organization_id introduces no leak (ORG-04)
```

### Pattern 1: SECURITY DEFINER helper for cross-table RLS checks, written SECURITY DEFINER from the start
**What:** Any new predicate that needs to read a table with its own restrictive RLS (to avoid the "inherits the target table's own RLS and silently returns false for legitimate callers" bug class) must be `SECURITY DEFINER` from its first version, not bolted on after a leak is found.
**When to use:** Any RLS policy or RPC that needs to check something across `organization_domains`/`organization_aliases` and another restrictively-RLS'd table (e.g., checking `identity_aliases` for a verified email during domain claim).
**Example (the exact lesson, stated explicitly in the Phase 34 migration comment read in this session):**
```sql
-- Source: supabase/migrations/20260905140000_create_identities_and_link_tables.sql, lines 116-120
-- "SECURITY DEFINER from the outset -- reads call_participants/contacts under
--  definer privileges so the identities RLS policy's participation branch is
--  actually reachable, rather than silently inheriting those tables' own
--  org-membership-only SELECT policies (the exact bug fixed for events after
--  the fact by 20260831020000's user_participates_in_event / CR-01)."
CREATE OR REPLACE FUNCTION public.user_can_view_identity(p_identity_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ ... $$;
```
Phase 36's domain-claim RPC needs this exact discipline: it must read `identity_aliases` (owner-only SELECT RLS) under `SECURITY DEFINER` privileges so the check works regardless of who is calling — although in practice, since the caller IS the identity owner checking their own alias, this specific check would actually pass under plain `authenticated` RLS too. Use `SECURITY DEFINER` anyway for consistency and to avoid the class of bug entirely.

### Pattern 2: Dual-tier admin authorization — do not conflate the two
**What:** Two independent SECURITY DEFINER helpers already exist and must be used for their correct, distinct purposes.
**When to use:** `is_organization_admin_or_owner(org_id, user_id)` for anything scoped to a single org's own management (self-serve domain claim, alias add/remove). `has_role(user_id, 'ADMIN')` for anything platform-operator-scoped that must work across orgs the caller may not belong to (merge, unclaim).
**Example:**
```sql
-- Source: supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql, line 103
CREATE OR REPLACE FUNCTION public.is_organization_admin_or_owner(p_organization_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_id = p_organization_id AND user_id = p_user_id
      AND role IN ('organization_owner', 'organization_admin')
  )
$function$;

-- Source: supabase/functions/admin-manage-user/index.ts, line 87 (platform-level, different table)
const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: 'ADMIN' });
```

### Pattern 3: Atomic reversible RPC, authority by parameter, REVOKE EXECUTE from client roles
**What:** Any multi-statement, security-sensitive mutation is a single `SECURITY DEFINER` Postgres function, never a sequence of client-side `.from().update()` calls. Authority is validated by an explicit parameter, never `auth.uid()`, when the function is meant to be invoked with the service-role key from an edge function (where `auth.uid()` is NULL). `REVOKE EXECUTE` from `PUBLIC`/`anon`/`authenticated` is mandatory — Postgres grants EXECUTE to PUBLIC by default on function creation, so skipping the revoke lets any authenticated user call the function directly via PostgREST with a forged parameter.
**When to use:** `merge_organizations_atomic`, `unclaim_organization_domain_atomic`.
**Example:**
```sql
-- Source: supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql, lines 60-256
CREATE OR REPLACE FUNCTION public.apply_event_match_atomic(
  p_recording_id_a UUID, p_recording_id_b UUID, p_event_id UUID,
  p_decided_by TEXT, p_signals JSONB, p_owner_user_id UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM recordings WHERE id = p_recording_id_a AND owner_user_id = p_owner_user_id) THEN
    RAISE EXCEPTION 'Access denied: not the owner of recording %', p_recording_id_a;
  END IF;
  -- ... atomic multi-table write ...
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_event_match_atomic FROM authenticated;
-- Service role bypasses grants entirely, so an edge function's service-role
-- client can still call this after doing its own auth check first.
```

### Pattern 4: Pointer/redirect merge — never rewrite existing FKs
**What:** A "merge" is a single nullable self-referencing FK column plus metadata (`merged_at`, `merged_by`). No bulk `UPDATE` of dependent tables' FK columns. Reversal = clear the pointer.
**When to use:** `organizations.canonical_organization_id`.
**Why this is the right shape here (not a new pattern, but the correct generalization of what's already shipped):** `identities`/`speakers`/`contacts`/`call_participants` all gained a *nullable* `identity_id` rather than any table being rewritten or deleted (IDENT-01's explicit design). Events use the same non-destructive-additive philosophy (EVT-02: `recordings.event_id` nullable, NULL means unresolved never broken). `canonical_organization_id` is this same philosophy applied one level up: NULL means "this is a canonical/root org", non-NULL means "this org's real identity is over there" — nothing downstream is required to change to stay correct.

### Anti-Patterns to Avoid
- **Extending `is_organization_member`/`is_organization_admin_or_owner` to resolve through `canonical_organization_id`:** this is the single most dangerous mistake available in this phase — see Common Pitfall 1. These two functions must remain byte-for-byte unrelated to the new columns.
- **Bulk-rewriting `recordings.organization_id` (or any other FK) to point at the winning org during merge:** explicitly rejected by CONTEXT.md; breaks reversibility and destroys the "non-destructive" guarantee.
- **Using a partial-unique/verified-boolean shape on `organization_domains` copied wholesale from `identity_aliases`:** unnecessary complexity — `identity_aliases` needs it because it stores both verified AND unverified candidate signals; `organization_domains` this phase only ever stores confirmed claims (no pending state, per CONTEXT.md's explicit "resolves synchronously" decision).
- **A raw client-side RLS `WITH CHECK` clause encoding the full claim business logic (admin check + blocklist + verified-email + uniqueness):** technically expressible in Postgres RLS, but produces one opaque constraint-violation error, not the 3 distinct UI-SPEC error variants (conflict / no-verified-email / blocklisted) the frontend contract requires. Use a `SECURITY DEFINER` RPC that returns/raises distinguishable error codes instead — mirrors `confirm-email-alias-verification`'s explicit machine-readable `code` field pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proving a user owns `@acme.com` | A new DNS TXT-record verification flow, or a second OTP-email flow | Phase 34's `identity_aliases` (verified=true, alias_type='email') | Already built, already security-reviewed once (CR-01 gap-closure), already has rate limiting (`identity_alias_verifications` DB-backed RateLimiter) — CONTEXT.md explicitly locks this reuse |
| "Is this user a platform admin" | A new admin-role column on `organizations` or a hardcoded user-id allowlist | `has_role(user_id, 'ADMIN')` / `user_roles` table | Existing, already the sole platform-admin mechanism (`admin-manage-user`, `admin_delete_user`); a second parallel admin concept would recreate the exact role-precedence confusion `20260316120000_fix_admin_role_leak.sql` had to fix once already |
| Atomic multi-table reversible mutation | Sequential client-side `.update()` calls with manual rollback-on-error logic | A single `SECURITY DEFINER` Postgres function | Client-side "transactions" over `supabase-js` are not actually atomic — a network drop between two calls leaves partial state. Postgres functions are genuinely all-or-nothing |
| Free-email-domain detection | A hand-written regex trying to detect "personal-looking" domains | A short, explicit hardcoded array (see Assumptions Log for a starter list) | CONTEXT.md scoped this as a simple, stable blocklist, not a heuristic; a regex-based heuristic would have false positives/negatives a fixed list doesn't |
| Regenerating `src/types/supabase.ts` by hand after adding columns | Manually editing the generated types file | `npm run gen:types` (`supabase gen types typescript --linked`), then reconcile per Phase 30's SAFE-07 precedent | Phase 30 found and fixed a 7-migration type drift caused by exactly this kind of manual/skipped regeneration (F16/F17) |

**Key insight:** every "hard part" of this phase (identity proof, admin authorization, atomic reversibility) has already been built and hardened earlier in this same milestone. The actual net-new engineering surface is small: two tables, one self-serve RPC, two admin RPCs, and the RLS wiring between them. The risk is not in inventing new mechanisms — it's in accidentally widening what the *existing* mechanisms (`is_organization_member` above all) mean.

## Common Pitfalls

### Pitfall 1: `canonical_organization_id` dereferenced inside the RLS choke point (CRITICAL)
**What goes wrong:** A future edit (in this phase or a later one) makes `is_organization_member`/`is_organization_admin_or_owner` — or any new copy of their logic — treat membership in an org as membership in every org that points its `canonical_organization_id` at it (or vice versa). Because these two functions gate `recordings`, `workspaces`, `call_participants`, `contacts`, `sync_jobs`, `import_routing_rules`, `organizations` itself, and the cross-org-copy RPCs (confirmed via direct grep across `supabase/migrations/*.sql` in this session — 15+ call sites), this single change would grant cross-org capture access everywhere at once.
**Why it happens:** It feels natural/helpful to make "merged" orgs transparently equivalent for access purposes — but that is exactly the thing ORG-04 forbids ("org association with an event confers no access to any capture of it").
**How to avoid:** Treat `canonical_organization_id` as read-only display metadata for exactly one purpose — "which org row should the UI show as *the* organization" — and never let it enter any `USING`/`WITH CHECK` clause or `SECURITY DEFINER` function body that currently gates capture-bearing tables. State this as an explicit non-goal in the plan.
**Warning signs:** Any diff touching `is_organization_member`, `is_organization_admin_or_owner`, or introducing a new helper with a name like `is_organization_member_or_canonical_match` should be treated as a stop-and-verify moment.

### Pitfall 2: Merge chains/cycles
**What goes wrong:** Admin merges Org A into Org B, then later merges Org B into Org C. Org A's pointer is now stale (points at B, which itself points at C) unless every reader recursively resolves the chain — which nothing in this codebase is built to do (CONTEXT.md's mental model is a flat two-level pointer).
**Why it happens:** `canonical_organization_id` is a plain nullable FK with no constraint preventing it from pointing at a non-root org, and Postgres `CHECK` constraints cannot do cross-row subqueries to prevent this.
**How to avoid:** A `BEFORE INSERT OR UPDATE` trigger that rejects setting `canonical_organization_id` to an org whose own `canonical_organization_id` is non-NULL, and rejects setting it on an org that other rows already point at (i.e., an org cannot be both a "loser" and someone else's "winner"). See Code Examples.
**Warning signs:** A merge RPC that doesn't check the target's own `canonical_organization_id` before writing.

### Pitfall 3: Domain uniqueness race condition
**What goes wrong:** Two orgs' admins submit a claim for the same domain within the same instant; an application-level "check then insert" (`SELECT` for conflict, then `INSERT`) can let both pass the check before either row exists.
**Why it happens:** Classic TOCTOU (time-of-check-to-time-of-use) gap between a `SELECT` and a following `INSERT` in two concurrent transactions.
**How to avoid:** A genuine `UNIQUE` index is the actual guarantee (`CREATE UNIQUE INDEX ... ON organization_domains (LOWER(domain))`); the RPC's own pre-check is a UX nicety for a fast, friendly error, but the RPC must also catch the resulting unique-violation error and return the same generic `CONFLICT` code — exactly how `confirm-email-alias-verification` (read in this session, lines 205-213) handles a concurrent race against `identity_aliases_verified_unique`.
**Warning signs:** A claim RPC with a `SELECT ... WHERE domain = X` check but no corresponding `UNIQUE` index, or one that lets a raw constraint-violation Postgres error escape to the client instead of being caught and translated.

### Pitfall 4: Blocklist/uniqueness normalization gaps
**What goes wrong:** `GMAIL.COM`, `gmail.com ` (trailing space), or `Gmail.Com` bypass a naive exact-string blocklist check or defeat the uniqueness index if storage isn't normalized consistently.
**Why it happens:** Domains are case-insensitive by spec but Postgres string comparison is case-sensitive by default.
**How to avoid:** Normalize with `LOWER(TRIM(...))` before every blocklist check, uniqueness check, and storage write — mirrors the exact `lower(regexp_replace(...))` pattern already used for org/workspace slug generation (`supabase/migrations/20260612020000_autogen_org_workspace_slugs.sql`, lines 36 and 77, read in this session).
**Warning signs:** A blocklist check using `= ANY(...)` without a `LOWER()` wrapper on both sides.

### Pitfall 5: Org-admin vs. platform-admin conflation
**What goes wrong:** The merge or unclaim RPC is gated with `is_organization_admin_or_owner()` instead of `has_role(user_id, 'ADMIN')` — meaning any admin/owner of *either the losing or winning org* could merge or unclaim, when the entire point of routing these tools through Admin Center (per `36-UI-SPEC.md`) is that they are platform-operator-only actions independent of either org's own membership.
**Why it happens:** `is_organization_admin_or_owner` is the more commonly-reached-for helper in this codebase (used across invitations, cross-org-default updates, workspace management) — it's an easy copy-paste mistake.
**How to avoid:** Merge and unclaim RPCs must check `has_role(p_admin_user_id, 'ADMIN')`, never `is_organization_admin_or_owner`. This codebase has already shipped one real incident from admin-role confusion (`20260316120000_fix_admin_role_leak.sql`, read in this session) — treat this as a known failure mode, not a theoretical one.
**Warning signs:** Any admin RPC/edge function for merge or unclaim whose authorization check references `organization_memberships` at all.

### Pitfall 6: Conflict error leaking the other org's identity
**What goes wrong:** A "this domain is claimed by {other org name}" error message, or a response payload that differs detectably (status code, timing, field presence) between "domain free" and "domain claimed by an org you can't see," leaks the existence/identity of an org the caller has no visibility into.
**Why it happens:** Natural instinct to be helpful in error messages; also easy to accidentally let a raw Postgres unique-violation message (which can include the conflicting value) bubble up unfiltered.
**How to avoid:** `36-UI-SPEC.md` already locks the exact copy ("This domain is already claimed by another organization." — never names the other org) — the RPC/edge function must return one generic error code (`CONFLICT`) regardless of which org holds the domain, and never let a raw Postgres error message escape to the client.
**Warning signs:** An error path that interpolates a queried org's `name` or `id` into a message shown to a caller who isn't a member of that org.

### Pitfall 7: Claimable-domain UI offering a dead-end option
**What goes wrong:** The domain-claim candidate list (per `36-UI-SPEC.md`: derived client-side from `useIdentityAliases()` by extracting the substring after `@`) includes a blocklisted domain (e.g. the user's only verified email is `@gmail.com`), so the user picks it and immediately hits the blocklist error.
**Why it happens:** The candidate-list derivation and the blocklist check are two different code paths; nothing forces them to share logic.
**How to avoid:** Not blocking — `36-UI-SPEC.md`'s reactive error copy already covers this case correctly. Recommend (nice-to-have) filtering the blocklist out of the candidate dropdown too, for a smoother UX, sharing the same blocklist constant between frontend and backend.
**Warning signs:** None — this is a UX polish item, not a correctness bug.

### Pitfall 8: Assuming `organization_domains`/`organization_aliases` need the `identities`-style bespoke RLS test block
**What goes wrong:** Copying `identities`/`identity_aliases`'s bespoke seed-and-assert block in `rls-regression.test.ts` (needed because `identities` has no `organization_id` column and multiple FK parents) when a much simpler registration in the generic `CROSS_ORG_TABLES` loop would work.
**Why it happens:** `identities`/`identity_aliases` are the most recent precedent read in this session, so it's tempting to over-generalize their bespoke pattern.
**How to avoid:** `organization_domains` and `organization_aliases` both have a single, direct FK to `organizations(id)` — exactly the shape `CROSS_ORG_TABLES`'s generic loop is built for (`{ table: 'organization_domains', filterColumn: 'organization_id' }`). Reserve the bespoke-block pattern for the `canonical_organization_id` no-leak proof specifically (which genuinely needs custom multi-org fixtures), not for the two new tables' own baseline isolation.
**Warning signs:** A plan task budgeting significant effort for "bespoke fixture seeding" for the two new tables themselves.

### Pitfall 9: Forgetting `FORCE ROW LEVEL SECURITY`
**What goes wrong:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` alone still lets the table-owner role (which migrations often run as) bypass RLS.
**Why it happens:** Easy to forget the second statement; `ENABLE` reads as if it's sufficient.
**How to avoid:** Every new table in this migration set must run both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` — the unbroken pattern across `identities`, `identity_aliases`, `identity_alias_verifications`, and `organization_feature_flags` (all confirmed in this session).
**Warning signs:** A migration diff with `ENABLE ROW LEVEL SECURITY` but no accompanying `FORCE ROW LEVEL SECURITY` line for the same table.

### Pitfall 10: `org_id` vs. `organization_id` naming inconsistency
**What goes wrong:** New columns named `org_id` (matching the older `contacts.org_id` legacy naming) instead of `organization_id` (the dominant convention across `recordings`, `workspaces`, `call_participants`, `organization_feature_flags`, and every RLS helper's parameter name).
**Why it happens:** Both names exist in the live schema, so either could look "precedented."
**How to avoid:** Use `organization_id` — it's the newer, dominant, and more common convention (confirmed via grep: every 2026-Q2+ table uses it; only the older `contacts` table uses `org_id`).
**Warning signs:** A migration diff introducing a new `org_id` column.

## Code Examples

### Table shapes (ORG-01)
```sql
-- Source: pattern grounded in supabase/migrations/20260901000001_create_organization_feature_flags.sql
-- (the simplest existing org-scoped additive table in this schema)

CREATE TABLE IF NOT EXISTS organization_domains (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain           TEXT        NOT NULL,
  claimed_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No `verified` boolean needed: every row here is, by construction, already
  -- verified -- CONTEXT.md locks a synchronous resolve, no pending state.
);

-- Global uniqueness, case-insensitive (Pitfall 3 + 4).
CREATE UNIQUE INDEX IF NOT EXISTS organization_domains_domain_unique
  ON organization_domains (LOWER(domain));

CREATE INDEX IF NOT EXISTS idx_organization_domains_organization_id
  ON organization_domains(organization_id);

CREATE TABLE IF NOT EXISTS organization_aliases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alias            TEXT        NOT NULL,
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Deliberately NOT globally unique (CONTEXT.md: two real companies can
  -- share a DBA name) -- but prevent exact duplicate rows within one org.
);

CREATE UNIQUE INDEX IF NOT EXISTS organization_aliases_org_alias_unique
  ON organization_aliases (organization_id, LOWER(alias));

CREATE INDEX IF NOT EXISTS idx_organization_aliases_organization_id
  ON organization_aliases(organization_id);

ALTER TABLE organization_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_domains FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_aliases FORCE ROW LEVEL SECURITY;

-- SELECT: any org member can view (Settings UI). Mirrors organizations' own
-- SELECT policy exactly (is_organization_member, read in this session from
-- supabase/migrations/20260301000002_recreate_rls_policies.sql line 24).
CREATE POLICY "org_members_can_view_domains" ON organization_domains
  FOR SELECT USING (is_organization_member(organization_id, auth.uid()));
CREATE POLICY "org_members_can_view_aliases" ON organization_aliases
  FOR SELECT USING (is_organization_member(organization_id, auth.uid()));

-- Writes go through the SECURITY DEFINER RPCs below, not raw client INSERT/
-- DELETE -- no authenticated INSERT/DELETE/UPDATE policy is granted directly
-- (mirrors identity_alias_verifications' "no client policy at all" posture
-- for anything with cross-table validation logic that must return distinct
-- error codes -- see Anti-Patterns).
CREATE POLICY "service_role_full_access_domains" ON organization_domains
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_access_aliases" ON organization_aliases
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### Merge columns + chain-prevention trigger (ORG-03, Pitfall 2)
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS canonical_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_canonical_not_self
  CHECK (canonical_organization_id IS NULL OR canonical_organization_id != id);

CREATE OR REPLACE FUNCTION public.prevent_canonical_organization_chain()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.canonical_organization_id IS NOT NULL THEN
    -- The target must itself be a root org (not already merged elsewhere).
    IF EXISTS (
      SELECT 1 FROM organizations
      WHERE id = NEW.canonical_organization_id AND canonical_organization_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Cannot merge into an organization that is itself merged (no chains)';
    END IF;
    -- This org cannot already be a merge target for other orgs.
    IF EXISTS (SELECT 1 FROM organizations WHERE canonical_organization_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot merge an organization that other organizations already point to (no chains)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organizations_prevent_canonical_chain
  BEFORE INSERT OR UPDATE OF canonical_organization_id ON organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_canonical_organization_chain();
```

### Self-serve claim RPC (ORG-02) — direct client call, mirrors `accept_organization_invite`
```sql
-- Source pattern: supabase/migrations/20260309210001_org_invitation_bugfixes.sql
-- accept_organization_invite -- SECURITY DEFINER, GRANT EXECUTE TO authenticated,
-- reads auth.uid() directly (no p_user_id trust issue since it also checks
-- `auth.uid() IS DISTINCT FROM p_user_id` -- this phase's version skips that
-- parameter entirely and just uses auth.uid() throughout).

CREATE OR REPLACE FUNCTION public.claim_organization_domain(
  p_organization_id UUID,
  p_domain TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_domain TEXT := LOWER(TRIM(p_domain));
  v_identity_id UUID;
BEGIN
  IF NOT is_organization_admin_or_owner(p_organization_id, auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN');
  END IF;

  IF v_domain = ANY (ARRAY['gmail.com','yahoo.com','outlook.com', /* ... see Assumptions Log */]) THEN
    RETURN jsonb_build_object('success', false, 'code', 'BLOCKLISTED');
  END IF;

  SELECT id INTO v_identity_id FROM identities WHERE owner_user_id = auth.uid() LIMIT 1;
  IF v_identity_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM identity_aliases
    WHERE identity_id = v_identity_id AND alias_type = 'email' AND verified = true
      AND split_part(value, '@', 2) = v_domain
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_VERIFIED_EMAIL');
  END IF;

  BEGIN
    INSERT INTO organization_domains (organization_id, domain, claimed_by)
    VALUES (p_organization_id, v_domain, auth.uid());
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONFLICT');
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_organization_domain(UUID, TEXT) TO authenticated;
```

### Admin-only atomic merge RPC (ORG-03) — mirrors `kill_switch_revert_event_merges`
```sql
CREATE OR REPLACE FUNCTION public.merge_organizations_atomic(
  p_losing_org_id UUID,
  p_winning_org_id UUID,
  p_admin_user_id UUID
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(p_admin_user_id, 'ADMIN') THEN
    RAISE EXCEPTION 'Access denied: platform admin required';
  END IF;
  IF p_losing_org_id = p_winning_org_id THEN
    RAISE EXCEPTION 'Cannot merge an organization into itself';
  END IF;

  UPDATE organizations
  SET canonical_organization_id = p_winning_org_id, merged_at = NOW(), merged_by = p_admin_user_id
  WHERE id = p_losing_org_id;
  -- Chain/self-reference safety enforced by the trigger above, not repeated here.
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_organizations_atomic FROM authenticated;
```

## State of the Art

This is an internal-only comparison — there's no external "industry state of the art" shift to report; the relevant evolution happened inside this milestone itself.

| Old Approach (Phase 30, events) | Current Approach (Phase 34+, identities) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SECURITY DEFINER` helper (`user_participates_in_event`) added *after* a code-review found the original bare `EXISTS` subquery inherited a restrictive target-table RLS policy (CR-01) | `SECURITY DEFINER` from the function's first version (`user_can_view_identity`) | Phase 34, 2026-09-05 | Phase 36 should follow the Phase 34 discipline from the start — any new cross-table RLS helper this phase writes must be `SECURITY DEFINER` on day one, not added reactively after a review finding |

**Deprecated/outdated:** Nothing in this phase's domain is deprecated — `organizations`/`organization_memberships` are the live, current tables (not legacy `banks`/`vaults` naming, which was fully renamed in Phase pre-dating this milestone).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A starter free-email-domain blocklist: `gmail.com, googlemail.com, yahoo.com, ymail.com, outlook.com, hotmail.com, live.com, msn.com, icloud.com, me.com, mac.com, aol.com, protonmail.com, proton.me, gmx.com, mail.com, zoho.com, yandex.com, fastmail.com, tutanota.com, inbox.com, qq.com, 163.com, naver.com` — cross-referenced via WebSearch against 3 independent sources ([free-email-domains npm/GitHub](https://github.com/kikobeats/free-email-domains), [HubSpot's blocked-domains feature](https://knowledge.hubspot.com/forms/what-domains-are-blocked-when-using-the-forms-email-domains-to-block-feature), [Forumbee's community doc](https://community.forumbee.com/t/63zsyt/what-domains-are-blocked-when-using-the-block-free-email-domains-feature)) that agree on the core ~15-20 domains. Confidence: MEDIUM (multiple sources agree, but no single authoritative registry exists for "the" free-email list, and the list is inherently a product/policy choice). | Common Pitfalls (blocklist), Code Examples | If too short: a real free-email domain slips through and gets claimed as an "organization," undermining the canonical-entity premise CONTEXT.md protects. If too long: a legitimate small-business domain that happens to resemble a consumer provider gets wrongly blocked (low risk — the list above is all well-known consumer webmail brands, not generic TLDs). Either way, low severity and trivially fixable post-launch (it's a hardcoded array, not a migration). |
| A2 | Self-serve domain claim should be a direct client-callable `SECURITY DEFINER` RPC (mirroring `accept_organization_invite`), not routed through a new edge function. | Standard Stack (Alternatives), Architecture Patterns, Code Examples | If wrong (team prefers an edge-function audit-log layer for consistency with `request-email-alias-verification`/`confirm-email-alias-verification`): low risk, easy to restructure — the RPC body is identical either way, only the calling convention (direct `supabase.rpc()` vs. `supabase.functions.invoke()`) changes. |
| A3 | The merge RPC should touch ONLY `organizations.canonical_organization_id`/`merged_at`/`merged_by` and NOT touch `organization_memberships` at all — treating "dual-membership role resolution" as a future read-side concern (an as-yet-unbuilt "effective access via canonical org" resolver) rather than something this phase's merge RPC must compute and write. Grounded in: `organization_memberships` has `UNIQUE(organization_id, user_id)` (confirmed via migration read), so the two orgs' membership rows never collide at the DB level — there is no constraint-violation forcing a decision at merge time. | User Constraints (Dual-membership), Open Questions | If wrong (Andrew wants immediate access continuity — i.e., a losing-org member becomes an effective member of the winning org right away): the merge RPC would need an additional step upserting/reconciling `organization_memberships` rows using role-precedence (`organization_owner > organization_admin > manager > member > guest`, confirmed via the live CHECK constraint), which is a moderate scope increase the plan should size explicitly if chosen. See Open Questions for both options laid out. |
| A4 | No new edge function is needed for `merge-organizations`/`unclaim-organization-domain` beyond a thin `has_role` check + RPC call — no additional business logic (e.g., notification emails to affected org admins) is in scope this phase. | Architecture Patterns | If wrong (product wants the merge/unclaim actions to notify anyone), this is a moderate scope addition (a new Resend-based email, mirroring `send-org-invite`) not currently costed into the plan. CONTEXT.md doesn't mention notifications for merge/unclaim, so this is a reasonable default, not a locked decision. |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Does the merge RPC need to touch `organization_memberships` at all?**
   - What we know: `organization_memberships` has `UNIQUE(organization_id, user_id)` — a user can hold a row in the losing org AND a separate row in the winning org simultaneously with zero constraint conflict. The 5-tier role hierarchy is `organization_owner > organization_admin > manager > member > guest` (confirmed via the live `organization_memberships_role_check` CHECK constraint).
   - What's unclear: whether "preserving the higher-privilege role" (CONTEXT.md's discretion note) means (a) nothing — this is purely a future read-side "effective access" feature not built yet, so the merge RPC does nothing to memberships, or (b) the merge RPC should actively upsert the losing-org member into the winning org at the higher of their two roles (if they hold both), granting them immediate access continuity to the surviving entity.
   - Recommendation: default to (a) — it's the minimal, purely-additive interpretation consistent with "existing FK columns are NOT bulk-rewritten," and is trivially extensible to (b) later without any reversal cost (no migration needed either way, since this is RPC logic, not schema). Surface this explicitly as a plan-time checkpoint/decision rather than silently picking one, since it changes user-visible behavior (whether merging orgs grants any new access) and CONTEXT.md explicitly left it open.

2. **Should `organization_aliases` writes (add/remove) be gated by `is_organization_admin_or_owner`, or open to any org member?**
   - What we know: CONTEXT.md explicitly locks admin/owner gating for domain *claim* initiation ("mirrors existing org-admin gating used elsewhere") but does not explicitly restate a permission level for aliases specifically. `36-UI-SPEC.md` places both in the same "Organization Identity" settings section without differentiating permission levels in its copy contract.
   - What's unclear: whether a `manager`/`member`-level user should be able to add a display alias (low-stakes, metadata-only, no security implication) without needing admin/owner rank.
   - Recommendation: gate alias INSERT/DELETE with `is_organization_admin_or_owner` for consistency with the section's other action (domain claim) and because `OrganizationsTab.tsx`'s existing `canManageOrg` gate already controls everything else in this settings surface — but this is a low-stakes call the planner can resolve either way without re-deriving anything from this research.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | Migration authoring, TEST apply, type regen | ✓ | 2.101.0 (confirmed via `supabase --version` this session) | — |
| `callvault-test` Supabase project | TEST-then-prod apply discipline (per `supabase/CLAUDE.md`) | ✓ | ref `swjzxiddcrtaqixsfaac`, confirmed via `supabase projects list` this session | — |
| `.env.test` (TEST creds) | Integration test suite (`npm run test:integration`) | ✓ | present in working tree | — |
| `.env` (PROD creds, `DATABASE_URL`) | Prod-ref-guard scripts that read `.env` directly | ✗ | — | Confirmed missing (consistent with Phase 31 P04's STATE.md note: "no .env file exists in this checkout"). Fallback already established and working: verify the prod ref via the Supabase CLI's *linked-project* state (`supabase projects list` shows the `●` marker) both before and after any prod apply, exactly as Phase 31 P04 did. |
| Docker | Local Supabase stack (`supabase start`), local edge function bundling | ✗ (per `supabase/CLAUDE.md`: "Docker is not running on Andrew's machine") | — | Already-established fallback: `supabase functions deploy --use-api` (no Docker needed) for edge function deploys; Option A (free-tier hosted TEST project) instead of local stack for integration tests — both already in active use, not new to this phase |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `.env` (use CLI linked-state prod-ref guard instead); Docker (use `--use-api` deploys and the hosted TEST project instead of local stack) — both are pre-existing, already-working project conventions, not new risks introduced by this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.16` (confirmed in `package.json`) |
| Config file | `vitest.config.ts` (`include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/__tests__/*.test.ts', 'cloudflare/**/__tests__/*.test.ts']`, confirmed read this session) |
| Quick run command | `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` (the exact command the CI `rls-regression` job runs, confirmed in `.github/workflows/ci.yml`) |
| Full suite command | `npm run test` (unit) + `npm run test:integration` (requires `VITEST_INTEGRATION_OK=true` and TEST project env vars, per `supabase/CLAUDE.md`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORG-01 | `organization_domains`/`organization_aliases` tables exist with correct shape, RLS enabled+forced, org-member SELECT works, non-member SELECT returns zero rows | integration + RLS regression | `npx vitest run src/test/rls-regression.test.ts` (extend `CROSS_ORG_TABLES` — see Pitfall 8) | ❌ Wave 0 — needs two new `CROSS_ORG_TABLES` entries |
| ORG-02 | Admin/owner with verified `@acme.com` email can claim `acme.com`; non-admin cannot; blocklisted domain rejected; already-claimed domain rejected with generic conflict; no-verified-email rejected | integration test against `claim_organization_domain` RPC, mirroring `confirm-email-alias.integration.test.ts`'s existing shape | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/**/__tests__/*.integration.test.ts` (new file, e.g. `claim-organization-domain.integration.test.ts`) | ❌ Wave 0 — new integration test file needed |
| ORG-03 | Merge sets `canonical_organization_id` without touching `recordings.organization_id`/other FKs; reversal (clear pointer) restores original state; chain-prevention trigger rejects merge-into-already-merged and merge-that-creates-a-chain | integration test against `merge_organizations_atomic`, seeded via service-role (donor-pattern per `supabase/CLAUDE.md`'s cleanup contract) | `VITEST_INTEGRATION_OK=true npx vitest run supabase/functions/**/__tests__/*.integration.test.ts` (new file) | ❌ Wave 0 — new integration test file needed |
| ORG-04 | **The critical negative test:** a member of Org B (and a member of merged-away Org C) cannot read Org A's recordings/captures despite Org A having claimed a domain and/or being a merge target — proves `canonical_organization_id`/`organization_domains` introduce no new RLS path | bespoke block in `src/test/rls-regression.test.ts`, following the `identities`/`identity_aliases` bespoke-block precedent (real JWTs via `signInWithPassword`, never service-role) | `npx vitest run src/test/rls-regression.test.ts` | ❌ Wave 0 — new bespoke block needed (this is the one part of the phase that genuinely needs the bespoke pattern, not the generic loop — see Pitfall 8) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/test/rls-regression.test.ts --reporter=verbose` (fast, targeted — this is the CI-enforced gate for exactly this class of regression)
- **Per wave merge:** `npm run test` (full unit suite) + `npm run test:integration` (if TEST env vars are configured in the session)
- **Phase gate:** Full suite green before `/gsd:verify-work`, plus a manual/explicit run of the new ORG-04 bespoke block specifically (this is the requirement's own explicit proof mechanism per REQUIREMENTS.md: "Enforced at RLS." + "proven by test" in the phase success criteria)

### Wave 0 Gaps
- [ ] Two new `CROSS_ORG_TABLES` entries in `src/test/rls-regression.test.ts` for `organization_domains` and `organization_aliases` (generic loop, `filterColumn: 'organization_id'`) — covers ORG-01
- [ ] New bespoke isolation block in `src/test/rls-regression.test.ts` proving `canonical_organization_id` introduces no cross-org leak — covers ORG-04 (the phase's core safety proof)
- [ ] New integration test file for `claim_organization_domain` RPC (admin gate, blocklist, verified-email check, conflict) — covers ORG-02
- [ ] New integration test file for `merge_organizations_atomic`/`unclaim_organization_domain` RPCs (pointer set/clear, chain rejection, FK-non-rewrite proof) — covers ORG-03
- [ ] No new test-framework install needed — Vitest + the existing integration-test harness (`src/test/integration-setup.ts`) fully covers this phase's needs

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (new surface) | Reuses existing Supabase Auth + Phase 34's verified-email `identity_aliases` — no new authentication mechanism this phase |
| V3 Session Management | No | No new session handling |
| V4 Access Control | **Yes — this is the phase's core concern** | Dual-tier `SECURITY DEFINER` authorization (`is_organization_admin_or_owner` for self-serve, `has_role(...,'ADMIN')` for platform-admin tools), `REVOKE EXECUTE` on all atomic admin RPCs, RLS `FORCE`d on both new tables, and the explicit non-goal of never dereferencing `canonical_organization_id` inside the existing cross-org RLS choke point |
| V5 Input Validation | Yes | Zod schema for domain format/length in any edge function touched; SQL-side normalization (`LOWER(TRIM(...))`) before every blocklist/uniqueness check, mirroring `confirmSchema`'s `.trim().toLowerCase()` pattern from `confirm-email-alias-verification/index.ts` |
| V6 Cryptography | No | No new secrets/hashes generated this phase — domain claim reuses Phase 34's already-hashed OTP infrastructure without adding anything new |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org RLS leak via `canonical_organization_id` dereference in the shared `is_organization_member`/`is_organization_admin_or_owner` choke point | Elevation of Privilege | Never modify those two functions this phase; treat the pointer as display-only metadata (Pitfall 1) |
| IDOR via forged `p_admin_user_id`/`p_organization_id` parameter on a directly-callable RPC | Tampering / Elevation of Privilege | `REVOKE EXECUTE FROM PUBLIC/anon/authenticated` on the two admin RPCs so they're reachable only via an edge function's service-role client that has already independently verified `has_role`; the self-serve claim RPC uses `auth.uid()` internally rather than trusting a passed-in user id |
| Org-admin/platform-admin authorization confusion | Elevation of Privilege | Explicit Pattern 2 + Pitfall 5 — use the correct helper for the correct tier, always |
| Information disclosure via conflict-error org-name leakage | Information Disclosure | Generic `CONFLICT` code only, never interpolate the other org's identity (Pitfall 6, already locked in `36-UI-SPEC.md`'s copy contract) |
| Domain-uniqueness race condition (TOCTOU) | Tampering (data integrity) | Real `UNIQUE` index as the enforcement mechanism, not just an application-level check (Pitfall 3) |
| Blocklist bypass via case/whitespace normalization gap | Tampering (policy bypass) | `LOWER(TRIM(...))` normalization before every check and at storage time (Pitfall 4) |

## Sources

### Primary (HIGH confidence — read directly in this session)
- `/Users/admin/dev/brain/main/src/types/supabase.ts` — live `organizations`/`organization_memberships` table shapes
- `/Users/admin/dev/brain/main/supabase/migrations/20260301000001_rename_vaults_to_workspaces.sql` — `is_organization_member`, `is_organization_admin_or_owner` definitions, role CHECK constraint values
- `/Users/admin/dev/brain/main/supabase/migrations/20260301000002_recreate_rls_policies.sql` — `organizations`/`organization_memberships` RLS policies (SELECT/UPDATE/INSERT/DELETE)
- `/Users/admin/dev/brain/main/supabase/migrations/20260905140000_create_identities_and_link_tables.sql` — `identities`/`identity_aliases` full schema, RLS, SECURITY DEFINER pattern
- `/Users/admin/dev/brain/main/supabase/migrations/20260905150000_create_identity_alias_verifications.sql` — OTP ledger table, service-role-only RLS pattern
- `/Users/admin/dev/brain/main/supabase/migrations/20260906000001_fix_identity_evidence_authz_and_speakers_view_gap.sql` — the CR-01 gap-closure lesson (SECURITY DEFINER-from-the-start discipline)
- `/Users/admin/dev/brain/main/supabase/migrations/20260901000001_create_organization_feature_flags.sql` — simplest org-scoped additive table precedent
- `/Users/admin/dev/brain/main/supabase/migrations/20260901000003_create_event_match_apply_reverse_rpcs.sql` — atomic reversible RPC pattern, authority-by-parameter, REVOKE EXECUTE
- `/Users/admin/dev/brain/main/supabase/migrations/20260902000002_kill_switch_revert_event_merges.sql` — bulk admin-only reversal, service-role-only authorization framing
- `/Users/admin/dev/brain/main/supabase/migrations/20260309210001_org_invitation_bugfixes.sql` — `accept_organization_invite` (direct client RPC pattern), `get_org_members` (conditional field exposure by role)
- `/Users/admin/dev/brain/main/supabase/migrations/20260316120000_fix_admin_role_leak.sql` — platform-admin role-precedence security incident
- `/Users/admin/dev/brain/main/supabase/migrations/00000000000000_consolidated_schema.sql` — `user_roles`/`app_role` schema
- `/Users/admin/dev/brain/main/supabase/functions/admin-manage-user/index.ts` — `has_role()` server-side gating pattern for Admin Center tools
- `/Users/admin/dev/brain/main/supabase/functions/confirm-email-alias-verification/index.ts` — Zod validation, race-handling on unique-violation, generic error messaging pattern
- `/Users/admin/dev/brain/main/supabase/functions/send-org-invite/index.ts` — edge function shape when external email send is involved
- `/Users/admin/dev/brain/main/src/hooks/useIdentityAliases.ts`, `src/services/identity-alias.service.ts` — frontend read pattern for verified emails (directly informs domain-claim candidate sourcing)
- `/Users/admin/dev/brain/main/src/hooks/useUserRole.ts` — client-side platform-role hook
- `/Users/admin/dev/brain/main/src/components/settings/OrganizationsTab.tsx` — per-org Card attachment point, `canManageOrg` client-side gate
- `/Users/admin/dev/brain/main/src/hooks/useOrganizationMutations.ts` — client-side org-admin gating precedent
- `/Users/admin/dev/brain/main/src/components/dialogs/DeleteOrganizationDialog.tsx` — type-to-confirm destructive dialog pattern
- `/Users/admin/dev/brain/main/src/test/rls-regression.test.ts` — `CROSS_ORG_TABLES`/`CLIENT_DENY_TABLES`/`BESPOKE_CLIENT_DENY_TABLES` registries and their exact fixture-seeding shapes
- `/Users/admin/dev/brain/main/supabase/CLAUDE.md`, `/Users/admin/dev/brain/main/CLAUDE.md` — project conventions, TEST-then-prod discipline, migration file structure
- `/Users/admin/dev/brain/main/.planning/phases/36-live-organizations/36-CONTEXT.md`, `36-UI-SPEC.md` — locked decisions and approved UI contract for this phase
- `/Users/admin/dev/brain/main/.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement text, milestone history, prior-phase decisions
- Commands executed directly in this session: `supabase --version` (2.101.0), `supabase projects list` (confirmed `callvault-test`/`callvault-ai` project refs and current CLI link), `git branch --show-current` (confirmed `v2.2-event-resolution`), `.planning/config.json` read (confirmed `nyquist_validation: true`, `security_enforcement: true`)

### Secondary (MEDIUM confidence)
- [free-email-domains (GitHub, Kikobeats)](https://github.com/kikobeats/free-email-domains) — cross-referenced free-email domain list
- [HubSpot: domains blocked by "Block free email providers" forms feature](https://knowledge.hubspot.com/forms/what-domains-are-blocked-when-using-the-forms-email-domains-to-block-feature) — cross-referenced free-email domain list
- [Forumbee: Block Free Email Domains feature](https://community.forumbee.com/t/63zsyt/what-domains-are-blocked-when-using-the-block-free-email-domains-feature) — cross-referenced free-email domain list

### Tertiary (LOW confidence)
- None — every claim in this research is either grounded in a direct file read/command execution in this session, or (for the blocklist specifically) cross-referenced across 3 independent sources and explicitly logged in the Assumptions Log rather than stated as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every version cited was read directly from `package.json`/`supabase --version` in this session, not recalled from training data.
- Architecture: HIGH — every pattern (SECURITY DEFINER helpers, atomic RPC + REVOKE EXECUTE, dual-tier admin authorization, pointer-only merge) is copied from real, already-shipped, already-tested code in this exact codebase and milestone, read directly in this session.
- Pitfalls: HIGH for schema/RLS pitfalls (1-6, 8-10, all grounded in direct code reads and grep evidence of the exact dependent-table list); MEDIUM for the free-email blocklist specifics (Pitfall 4's mechanism is HIGH-confidence, but the exact list contents in Assumptions Log A1 are inherently a policy choice, not a fact to verify).

**Research date:** 2026-09-08
**Valid until:** 30 days (stable internal codebase patterns; no fast-moving external dependency in this phase's scope)
