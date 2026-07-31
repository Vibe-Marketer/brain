# Project Research Summary

**Project:** CallVault v2.2 — Organization Entity & Access Foundation
**Domain:** Multi-tenant SaaS, Org-level RBAC + ownership-transfer on existing Supabase/Postgres RLS
**Researched:** 2026-07-30
**Confidence:** HIGH

## Executive Summary

CallVault v2.2 adds organization-as-ownable-entity and org-level RBAC to an existing workspace-scoped RBAC system on Postgres RLS. The recommended approach is pure SQL (migrations + SECURITY DEFINER functions) — no new platforms or dependencies — building on proven patterns the codebase has already fixed twice (RLS recursion incidents in Jan/Feb 2026). The critical shape decision is a single `has_organization_capability()` function that encodes precedence and extensibility for future cross-org sharing, not adding new role enums. The highest-risk surface is MCP OAuth tokens, which must re-validate role on every request (not cache at issuance), and Polar billing, which needs verification that `polar_customer_id` is keyed to org, not user, before ownership transfer ships.

The milestone succeeds by following a strict build order that mirrors the prior recursion fix (`20260128000001`): schema + RLS foundation → transfer RPC → service layer → MCP auth integration → UI → rollout. Starting with org-role precedence as an explicit product decision (not a schema assumption) prevents the ambiguity that caused the `20260316_fix_admin_role_leak.sql` incident. The backfill migration must follow the proven order (migrate data → add constraint → handle dependent tables), not schema-first. This is a schema-and-authorization milestone, not a feature-platform-addition one.

## Key Findings

### Recommended Stack

**No new stack. This milestone is entirely migrations + SQL functions on existing Supabase Postgres + Auth, reusing the `supabase-js@2` client pattern already in the codebase.** The only "stack" change is defensive: use `SECURITY DEFINER STABLE` functions for every org/workspace cross-reference (proven pattern from prior recursion fixes), never inline `EXISTS` subqueries against membership tables within RLS policies.

**Core technologies:**
- **Postgres RLS (Supabase-hosted):** RBAC data model and enforcement — org/workspace memberships already in schema, adding role hierarchy and ownership via new columns/functions/policies
- **SECURITY DEFINER PL/pgSQL functions:** RLS recursion prevention — exact same pattern from `20260128000001` and `20260129000004`, now generalized to org+workspace two-tier checks
- **Supabase Auth (GoTrue):** Identity — unchanged; org ownership is application-level FK, not auth-identity concept
- **supabase-js v2:** RPC calling convention — no version bump needed, `.rpc()` signature unchanged

**Alternatives explicitly NOT recommended:**
- Clerk Organizations / WorkOS: moving membership/role source-of-truth off Postgres breaks every existing RLS policy's `auth.uid()` assumption; Clerk is single-level org+member model (this needs two-level org+workspace); neither solves the actual problem (ownership transfer) without full auth migration
- JWT custom claims for org role: adds a second source-of-truth (role changes don't take effect until JWT refresh), complexity without current performance justification

### Expected Features

**Table stakes (users expect these):**
- Org-level `owner` role, exactly one owner enforced at all times, distinct from workspace roles — every comparable SaaS (Vercel, Linear, Notion, GHL) has this; CallVault today has only workspace roles
- Promote-then-demote ownership transfer (2-step, never instant swap) — Vercel's pattern, avoids dead-zone where org is ownerless
- `org_admin` role (manages members/workspaces, not owner-level authority) — GHL Agency Admin equivalent, matches Andrew's stated delegation model
- Billing actions gated to `org_owner` only — same sensitivity as Stripe/Polar's billing-role scoping
- Org role as ceiling over workspace roles (org owner/admin see everything in org) — GHL model, matches Andrew's agency-manages-sub-accounts mental model; must be an explicit decision, not a schema assumption
- Org invitations updated to capture org role — existing invite flow extended with org_role field
- Audit log data model for role/ownership changes (no UI required yet) — makes "org as transferable asset" credible; reusable for v2.3 cross-org sharing

**Should have (competitive, post-launch):**
- Org-scoped MCP tokens that resolve org role (not just org membership) — trigger: when org roles exist + AI-agent-as-agency use case is real
- Audit log viewer UI — trigger: first real ownership transfer; low-cost addition post-launch
- Generic entity-scoped grant primitive for future permissioned cross-org sharing — already shaped via `has_organization_capability()` helper function

**Anti-features (commonly requested, reject them):**
- Custom/granular role permissions builder — "role explosion" anti-pattern; stay with 2 org roles + 4 workspace roles (fixed, like Vercel/Linear)
- IdP/SSO group-to-role mapping — enterprise pattern, CallVault has no enterprise customers; defer as explicit v3+ trigger, not v2.2
- Instant single-step ownership transfer — window where org ends up ownerless; two-step transfer is the safe pattern Vercel enforces

### Architecture Approach

Org-level RBAC layers on top of existing workspace RBAC using the proven `SECURITY DEFINER STABLE` helper-function pattern. No `owner_user_id` column (ownership is already `organization_memberships.role = 'organization_owner'` in the schema; encoding a single owner as a column introduces competing sources of truth the moment someone adds a second owner). Add three new schema pieces: audit columns (`created_by`, `owner_transferred_at` on `organizations`), new `organization_ownership_transfers` table for the audit trail, and one canonical `has_organization_capability()` function that encodes precedence and extensibility.

**Critical integration points:**
1. **Schema/RLS (foundation):** Add SECURITY DEFINER helpers (`is_org_member`, `has_org_role`, `has_organization_capability`), fix `organization_invitations` policy to use the helper instead of inline EXISTS, add all new/touched tables to `CROSS_ORG_TABLES` in rls-regression.test.ts
2. **Transfer RPC:** Single `transfer_organization_ownership()` SECURITY DEFINER function (only authorized write path for ownership), atomically updates membership roles + writes audit row
3. **Service layer:** `transferOrganizationOwnership()` and `getOrganizationCapabilities()` methods in `organizations.service.ts`
4. **MCP auth:** `enforceOrgRoleCapability()` in `mcp-server/auth.ts` that re-checks live role on every request (not cached at token-issuance time) — this is the highest-blast-radius surface
5. **Frontend:** `OrganizationOwnershipTransferDialog` component, capability-gated UI, show effective role plainly in UI

**Build order is strict due to recursion history:** schema → RPC → services → MCP auth → UI → rollout. Each layer must pass regression tests before the next layer depends on it.

### Critical Pitfalls

1. **RLS cross-table recursion (org↔workspace policies)** — Naive two-tier RLS checks (org OR workspace role) recreate the exact recursion pattern fixed in `20260128000001`. Prevention: every combined-role check goes through a `SECURITY DEFINER STABLE` helper, never inline EXISTS between membership tables. Write the helper(s) before any policy is added, not after a recursion is hit in prod.

2. **Org/workspace role precedence ambiguity** — "Does org_owner see all workspace content or only org-level admin functions?" is a product decision, not a schema assumption. Inconsistent precedence across tables causes silent over- or under-grants (data leak or unusable feature). Prevention: write the precedence rule as an explicit Key Decision in PROJECT.md, encode it in exactly one `get_effective_workspace_role()` helper, route every RLS policy through it. Do this before RLS work starts, not mid-implementation.

3. **Ownership transfer breaks Polar billing coupling** — `polar_customer_id` is likely keyed to `owner_user_id` (user identity) not `organization_id`. Transferring ownership without re-keying Polar leaves billing attached to the old owner (webhooks fail, seat limits check wrong user, old owner can still access billing portal). Prevention: grep all `polar_*` Edge Functions and `polar_customer_id` usage immediately; verify whether it's user-keyed or org-keyed; if user-keyed, either migrate Polar customer to be org-keyed OR forbid transfer for paid orgs until re-keying is solved. Test against TEST Supabase+Polar sandbox with an active subscription before touching prod.

4. **MCP token permission creep after role changes** — Tokens are long-lived; roles are not immutable. A token issued while user was `organization_owner` keeps full org access even after demotion to `organization_member` because current auth.ts only checks `org_id` match, not current role. Prevention: re-derive capability from `organization_memberships` fresh on every MCP request via `has_organization_capability()` (live lookup, not cached). Add integration test: issue token as owner, downgrade user mid-test, assert next MCP call is scoped down. This is same phase as org RBAC, not deferred.

5. **Migration backfill defaults wrong org role / breaks pending invitations** — Backfill migration that assigns default org role to all existing orgs is a one-shot operation. If it assumes "creator = owner" universally (wrong for orgs with co-admins), demotes real admins silently. If it adds a CHECK constraint before migrating existing data, in-flight invitation acceptances fail mid-deploy. Prevention: follow the proven order from `20260330200000_align_workspace_roles_5_to_4.sql` — (1) migrate/backfill data to valid new values, (2) add/replace constraint, (3) handle dependent tables in same transaction. Audit existing orgs pre-migration; query for "orgs where creator ≠ sole admin" and flag for manual decision. Dry-run against `.env.test` first.

## Implications for Roadmap

Based on research, the milestone splits into 5-6 phases that must sequence strictly (schema can't ship until precedence is decided; MCP auth can't ship until schema is tested; UI can't use transfer RPC until it's verified).

### Phase 1: Pre-Work / Decisions & Audit
**Rationale:** Schema and RLS work depend on an explicit org/workspace precedence rule. Billing integration depends on Polar model verification. Backfill depends on knowing which existing orgs need manual review.

**Delivers:**
- Explicit precedence rule documented as Key Decision (org owner implicitly sees all workspace content? or only org-level admin functions?)
- Polar `polar_customer_id` audit (is it user-keyed or org-keyed? if user-keyed, re-key plan before transfer ships)
- Pre-migration audit query identifying "orgs where creator ≠ sole admin equivalent"
- Extended RLS regression test class for same-org/different-role/different-workspace isolation (currently only cross-org isolation)

**Avoids:** Pitfall 2 (precedence ambiguity), Pitfall 3 (billing desync), Pitfall 5 (backfill mis-defaults)

**Research flags:** Product decision on precedence requires Andrew/customer context (not purely technical)

---

### Phase 2: Schema + RLS Foundation
**Rationale:** All downstream work depends on this layer being stable and regression-tested. The recursion history makes this critical — get the helpers right before anything depends on them.

**Delivers:**
- `organizations.created_by` + `owner_transferred_at` audit columns (additive, non-breaking)
- `organization_ownership_transfers` audit table + RLS policy
- `is_organization_member()`, `has_org_role()`, `has_organization_capability()` SECURITY DEFINER functions (the pattern from `20260128000001`)
- Fix `organization_invitations` RLS policy to call helper instead of inline EXISTS (closes existing inconsistency)
- All new/touched tables added to `CROSS_ORG_TABLES` in rls-regression.test.ts
- **Must pass full RLS regression suite before Phase 3 starts**

**Avoids:** Pitfall 1 (RLS recursion), Pitfall 2 (precedence ambiguity)

---

### Phase 3: Transfer RPC + Service Layer
**Rationale:** Ownership transfer is the core feature of this milestone. Must verify it in isolation (pure SQL) before layering service/UI on top. Integration test against TEST project per `supabase/CLAUDE.md` rules.

**Delivers:**
- `transfer_organization_ownership(p_org_id, p_new_owner_user_id)` SECURITY DEFINER RPC (only authorized write path for ownership)
- `organizations.service.ts` additions: `transferOrganizationOwnership()`, `getOrganizationCapabilities()`
- `src/hooks/useOrganizationCapability.ts` (TanStack Query wrapper)
- Integration test: transfer an org, verify membership roles updated + audit row written

**Avoids:** Pitfall 3 (billing desync), Pitfall 5 (broken backfill)

---

### Phase 4: MCP Auth Integration (Highest-Risk Surface)
**Rationale:** MCP OAuth tokens are the live integration surface (Claude Desktop, Cursor, custom agents connected). An unaudited MCP surface with permission issues is the highest-blast-radius failure mode. Must ship in same phase as org RBAC, not deferred.

**Delivers:**
- `enforceOrgRoleCapability()` in `mcp-server/auth.ts` that re-derives capability fresh on every request
- Mint-time capability cap (org-scoped token respects org role's permitted categories)
- Token-revocation-on-role-change trigger or equivalent
- Integration test: issue token as owner, downgrade user, verify next call is scoped down

**Avoids:** Pitfall 4 (token permission creep)

---

### Phase 5: UI Components + UX
**Rationale:** Backend is proven; now expose the feature safely. Emphasis on visibility (show effective role plainly) and safety (two-step confirm on transfer with billing warning).

**Delivers:**
- `OrganizationOwnershipTransferDialog` (Radix Dialog, gated by `useOrganizationCapability`)
- Capability-gated buttons/menu items on existing org settings surfaces
- Role badges showing "Org Admin, Workspace Member here" (effective role, not just role name)
- Transfer confirmation shows "this transfers billing control" if org has active Polar plan

---

### Phase 6: Rollout + Backfill Migration
**Rationale:** Production data migration is the last step, after all code is tested and proven. Must follow the proven migration order to avoid a repeat of `20260316_fix_admin_role_leak.sql`.

**Delivers:**
- Backfill migration following order: (1) migrate data → (2) add/replace constraint → (3) handle dependent invitation rows
- Pre-migration audit query run against prod (identify orgs needing manual review)
- Dry-run against `.env.test` project first
- **Post-deploy verification:** spot-check Polar customer re-keying, confirm no orphaned orgs

**Avoids:** Pitfall 5 (backfill mis-defaults)

### Phase Ordering Rationale

- Precedence must be explicit first — schema decisions depend on product rule (implicit Pitfall 2 prevention)
- Schema + regression test before anything depends on it — recursion history means this layer must be proven stable (Pitfall 1 prevention)
- Transfer RPC in isolation — verify core feature works before service layer (Pitfall 3 + 5 detection point)
- MCP auth same phase as org RBAC — not deferred; this is the live integration surface (Pitfall 4 prevention)
- UI after backend proven — no reason to expose a feature before it's tested
- Rollout last — one-shot operation on prod data, minimal risk after full testing

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1 (Precedence):** Product decision on org/workspace role precedence requires Andrew's input + customer mental model validation
- **Phase 3 (Transfer RPC):** Polar billing model must be verified by running queries against actual schema — `grep -r polar_customer_id` to see if keyed to user or org
- **Phase 4 (MCP Auth):** Current `mcp-server/index.ts:1118+` org-scoped-token special case must be re-audited once org roles exist

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Schema + RLS):** Recursion fix pattern proven twice in this repo; SECURITY DEFINER functions are established house style
- **Phase 5 (UI):** React components follow existing CallVault patterns
- **Phase 6 (Rollout):** Migration order proven in `20260330200000`; backfill pattern established

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies required; pattern verified twice in this codebase's own migration history (recursion fixes). Postgres/RLS mechanics are deterministic. |
| Features | MEDIUM-HIGH | Table-stakes features verified across Vercel/Linear/Notion/GHL official docs. MVP list explicit in FEATURES.md. Ownership transfer mechanics sourced from Vercel's documented approach. |
| Architecture | HIGH | All findings verified directly against this repo's migrations + source code (not external ecosystem claims). SECURITY DEFINER pattern proven working in production. Schema analysis is deterministic. |
| Pitfalls | MEDIUM-HIGH | Grounded in this repo's own incident history (two RLS recursion fixes, one role-leak backfill incident). Polar billing gotcha sourced from general Stripe/SaaS literature + verified pattern. MCP token permission creep is standard OAuth/RBAC retrofit problem, well-documented in OAuth security literature. |

**Overall confidence:** HIGH for technical execution. MEDIUM for product precedence decisions (Phase 1 explicit-rule requirement depends on Andrew's input).

### Gaps to Address

- **Polar billing model specifics** — Research verified the general risk; actual risk level depends on whether `polar_customer_id` is user-keyed or org-keyed. Mitigation: Phase 1 includes the grep audit.
- **Precedence rule not yet written as a Key Decision** — Research established this must exist before schema work, but the specific rule hasn't been decided. Mitigation: Phase 1 deliverable; requires Andrew.
- **MCP org-scoped token special-case** — Current code has special handling for org-scoped tokens that must be re-audited. Mitigation: Phase 4 includes explicit re-audit + integration test.

## Sources

### Primary (HIGH confidence)

- **This repository's migrations (ground truth):**
  - `20260128000001_fix_team_memberships_rls_recursion.sql` — RLS recursion pattern and fix
  - `20260129000004_fix_teams_rls_recursion.sql` — same family of fix
  - `20260316120000_fix_admin_role_leak.sql` — backfill migration safety lesson
  - `20260330200000_align_workspace_roles_5_to_4.sql` — proven migration order (migrate data → constraint → dependent tables)
  - `supabase/migrations/` (full schema) — authoritative on current org/workspace/membership structure
  - `supabase/CLAUDE.md` — RLS regression test contract, DB safety rules
  - `.planning/PROJECT.md` — v2.2 milestone framing, MCP org/workspace architecture

- **Official documentation:**
  - [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS mechanics, HIGH confidence
  - [Vercel — How do I transfer ownership of a Vercel team?](https://vercel.com/kb/guide/how-do-i-transfer-ownership-of-a-vercel-team) — promote-then-demote pattern, only publicly-documented safe transfer pattern reviewed
  - [Vercel — Access Roles](https://vercel.com/docs/rbac/access-roles) — owner/member/billing role tiers

### Secondary (MEDIUM confidence)

- **Competitor analysis (sourced from official docs, synthesized):**
  - [GoHighLevel — Admin vs User Roles](https://help.gohighlevel.com/support/solutions/articles/48001078296-admin-vs-user-roles-and-permission-scopes) — agency admin / sub-account pattern (matches Andrew's stated mental model)
  - [Clerk Organizations — Roles and Permissions](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — single-tier org model (not suitable here)
  - [Linear — Members and Roles](https://linear.app/docs/members-roles) — team-scoped delegation pattern (reference, deferred for v2.3+)
  - [Notion — Who's who in a workspace](https://www.notion.com/help/whos-who-in-a-workspace) — owner/admin model

- **Third-party deep dives (production-reference implementations):**
  - [Makerkit — Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — `SECURITY DEFINER` pattern, `primary_owner_user_id` column pattern (MEDIUM confidence, widely-used production SaaS boilerplate)
  - [WorkOS — Multi-tenant permissions done right](https://workos.com/blog/multi-tenant-permissions-slack-notion-linear) — role explosion anti-pattern, reference for what NOT to do

### Tertiary (MEDIUM confidence, general patterns)

- **Billing/subscription transfer gotchas:**
  - [MoveMRR — Stripe Subscription Migration Guide](https://movemrr.com/knowledge/stripe-subscription-migration-guide/) — subscriptions don't auto-follow ownership changes (structural pattern, verified in this codebase's Polar usage)
  - [MoveMRR — What Happens to Stripe Subscriptions When You Sell Your SaaS](https://movemrr.com/blog/what-happens-to-stripe-subscriptions-when-you-sell-your-saas/) — anchor-date loss, double-charging risk on ownership transfer

- **OAuth/RBAC retrofit patterns:**
  - [hoop.dev — Preventing Scope Creep in OAuth](https://hoop.dev/blog/preventing-scope-creep-in-oauth-temporary-production-access-management) — OAuth scopes persisting past the grant that justified them (token-level vs role-level mismatch)
  - [DreamFactory — OAuth Scopes vs RBAC](https://blog.dreamfactory.com/oauth-scopes-vs-rbac-key-differences) — scopes are token-bound/static, RBAC is user-bound/dynamic (theoretical, widely-documented)

---

*Research completed: 2026-07-30*
*Ready for roadmap: Yes, with Phase 1 (Decisions & Audit) as a required first step*
