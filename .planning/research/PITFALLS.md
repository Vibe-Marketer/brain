# Pitfalls Research

**Domain:** Org-as-ownable-entity + org-level RBAC layered on an existing workspace-RBAC, Supabase/RLS, multi-tenant SaaS with paying customers and a live OAuth/MCP surface (CallVault v2.2)
**Researched:** 2026-07-30
**Confidence:** MEDIUM-HIGH (grounded in this repo's own incident history — two shipped RLS-recursion/role-leak fixes plus the v2.1 data-trust incident — supplemented with verified general Supabase RLS and SaaS-ownership-transfer sources)

## Critical Pitfalls

### Pitfall 1: Two-tier RLS policies re-introduce the exact recursion class already fixed twice

**What goes wrong:**
Every table that needs to check "is this row visible" will now need to evaluate BOTH org role and workspace role in the same policy (e.g. `organization_owner` can see everything OR `workspace_admin` can see workspace rows). The naive way to write that is a nested `EXISTS` that queries `organization_memberships` from inside a policy on `workspace_memberships`, or a policy that queries `workspace_memberships` from inside a policy that itself is evaluated while resolving `organization_memberships`. This is precisely the `team_memberships` self-reference class fixed in `20260128000001_fix_team_memberships_rls_recursion.sql` — except now it's a *cross-table* recursion (org policy → workspace table → org table) instead of self-referencing, which is easier to introduce by accident because no single file "looks" recursive.

**Why it happens:**
Two independent role tables didn't used to talk to each other in policy logic. Adding org-level RBAC as a second gate means org policies and workspace policies must now cross-reference each other's membership tables to answer "does this user have effective access," and Postgres RLS evaluates policies for every table touched inside another policy's subquery — including tables touched transitively.

**How to avoid:**
Every combined check (org OR workspace role) must go through a `SECURITY DEFINER STABLE` helper function that bypasses RLS internally — exactly the `is_active_team_member()` / `is_team_admin()` pattern already established. Do not write raw `EXISTS (SELECT ... FROM organization_memberships ...)` inside a policy that itself sits on a table another policy queries. Write ONE new helper, e.g. `has_org_or_workspace_access(p_workspace_id UUID, p_user_id UUID, p_min_role TEXT)`, that internally resolves both org role and workspace role and returns a boolean, and route every new/modified policy through it.

**Warning signs:**
"infinite recursion detected in policy for relation X" in Postgres logs or CI; RLS regression test (`src/test/rls-regression.test.ts`) hangs or times out instead of failing cleanly; any new policy that has `EXISTS` querying a *different* membership table than the one the policy is on.

**Phase to address:**
The phase that introduces the org-role schema and first org-gated RLS policy — write the SECURITY DEFINER helper(s) before any table gets a combined-role policy, not after the first recursion is hit in prod.

---

### Pitfall 2: Effective-permission ambiguity between org role and workspace role silently over- or under-grants access

**What goes wrong:**
With two role tiers, every access check has to answer a design question that doesn't currently exist: does `organization_admin` automatically inherit `workspace_admin` on every workspace in the org, or is workspace access always additive/explicit? If different engineers (or different Autopilot-authored migrations) answer this inconsistently across tables, you get some tables where an org owner can silently see workspace data they shouldn't (in a customer-facing product this is a data-leak, same class as the `20260316_fix_admin_role_leak.sql` incident — one orphaned/ambiguous role row silently granted admin), and other tables where an org owner is unable to see workspace data they should be able to administer (support/billing dead-ends, "I own this org and can't remove a workspace member").

**Why it happens:**
The role-precedence question ("does higher tier imply lower tier privilege everywhere, or only for org-scoped resources like billing/members") is a product decision, not a schema decision, and the codebase's own `get_user_role()` precedence pattern (`ADMIN > TEAM > PRO > FREE`, single ORDER BY CASE) shows the team already has one "pick highest role" pattern in production — it will be tempting to copy that pattern for org-vs-workspace without checking whether inheritance should actually be scoped, not blanket.

**How to avoid:**
Write down the precedence rule explicitly as a single canonical function (e.g. `get_effective_workspace_role(p_user_id, p_workspace_id)` that resolves: explicit workspace role if present, else org role mapped down through an explicit mapping table/CASE, else no access) and route every table's RLS policy through that one function — never let individual policies re-derive precedence inline. Explicitly decide and document: does `organization_owner` see workspace *content* (recordings, transcripts) by default, or only workspace *administration* (membership, settings)? CallVault's "org vs. workspace vs. individual" moat-audit (already in this milestone's scope) is the right place to lock this before schema work starts.

**Warning signs:**
Two migrations touching role-check logic within the same phase with different precedence assumptions; a support ticket where an org owner "can't see a workspace they should be able to manage"; RLS regression test only checks cross-*org* isolation today (`CROSS_ORG_TABLES`), not cross-workspace-within-org, so this class of bug ships silently unless the test suite is extended.

**Phase to address:**
Requirements/schema-design phase, before any RLS policy touches org role — the precedence rule is a decision artifact (add to Key Decisions in PROJECT.md), and it must exist before Pitfall 1's helper function can be written correctly.

---

### Pitfall 3: Ownership transfer breaks the Polar billing↔org 1:1 assumption baked into the current schema

**What goes wrong:**
Today's org model derives from `personal_organization` (creator-coupled) — the org's owner and the Polar billing customer are almost certainly the same identity/assumption throughout the codebase (webhook receiver, plan-gate checks, invoice emails). The instant "ownership transfer" exists as a feature, three things can silently desync: (1) Polar customer record still points at the old owner's email/user_id while the org's `owner_user_id` now points at someone else — webhooks keyed on the old identity stop resolving to the org, or resolve to the wrong org if user_ids get reused anywhere; (2) plan-gate / seat-limit checks that read "does this user's org have an active subscription" via a join on `owner_user_id` silently break for the new owner immediately after transfer; (3) the old owner, now demoted, may still hold billing portal access (Polar customer portal sessions, magic links) that was never revoked, letting a former owner cancel or modify billing after they no longer administer the org.

**Why it happens:**
Ownership-transfer is a "renaming" mental model (change one FK), but billing systems treat "the customer" as an identity, not a role — Polar's customer object, webhook payloads, and portal-session tokens are all keyed to whoever was the customer at subscription-creation time, not to "whoever is `owner_user_id` today." Verified pattern from general SaaS ownership-transfer research: Stripe (and by extension Polar, which mirrors much of Stripe's model) subscription objects and billing relationships do NOT automatically follow when the underlying "owner" identity changes — this requires an explicit migration step, or the org must be modeled as owning the Polar customer, not the individual user.

**How to avoid:**
Before building "transfer ownership" as a UI action, verify (read Polar's docs/API, don't assume from Stripe familiarity) whether the `polar_customer_id` in this schema is already keyed to `organization_id` (good — transfer is safe) or to `owner_user_id` / creator `user_id` (bad — transfer will desync billing). If it's user-keyed, the migration must either (a) re-point the Polar customer record's external ID to the org, or (b) explicitly forbid ownership transfer for orgs with active paid subscriptions until billing is re-keyed, whichever is cheaper. Explicitly revoke/expire any billing-portal session or magic link issued to the old owner as part of the transfer transaction — don't rely on it expiring naturally.

**Warning signs:**
Any code path that does `.eq('user_id', ...)` (not `.eq('organization_id', ...)`) to look up Polar customer or subscription rows; webhook handler (`polar-*` Edge Functions) that resolves org context via `user_id` from the webhook payload rather than a stored `organization_id` mapping; no explicit "revoke billing session" step in the ownership-transfer flow design.

**Phase to address:**
The org-as-ownable-entity phase, specifically before implementing the transfer-ownership Edge Function/RPC — this must be verified against the actual `polar_customer_id` FK target in this schema (grep `polar_customer_id` usage) before writing the transfer flow, not discovered after the first real transfer.

---

### Pitfall 4: Org-scoped MCP tokens silently gain or lose access when org roles are introduced, with no way to detect it

**What goes wrong:**
`mcp_tokens` already has `org_id`, `workspace_id` (nullable), and `scope` columns; org-scoped tokens today implicitly mean "full org access" because there is no org-level role to gate against yet. The moment org-level RBAC ships, an org-scoped token's *effective* permission becomes a function of whichever role the *token-issuing user* held **at issuance time** — but tokens are long-lived and roles are not immutable. Two failure modes: (a) a token issued while its owner was `organization_owner` keeps acting with owner-level power in the MCP server even after that user is demoted to `organization_member` (or removed from the org entirely) — because the token's access check today likely just checks "does `org_id` match," not "does the *current* role of the token's user still justify this access"; (b) a workspace-scoped token issued before org RBAC existed may unexpectedly gain *broader* access if new org-role logic accidentally treats "workspace-scoped token, org owner" as "org-scoped" during the retrofit, because the current code path (`mcp-server/index.ts:1118+`) already special-cases org-scoped tokens to accept `workspace_id` as a parameter — that special-casing logic is exactly the kind of code a role-precedence bug slips into.

**Why it happens:**
OAuth/API tokens are bearer credentials cached at issuance; RBAC is checked at query time. Retrofitting a permission system underneath an existing token model without re-validating token-holder identity against *current* role on every MCP call reintroduces the classic "permission creep" failure documented broadly in OAuth/RBAC integration literature: scopes/tokens persist even after the underlying grant that justified them changes or is revoked, because no review/re-validation process runs automatically.

**How to avoid:**
Do not gate MCP tool calls on `org_id`/`workspace_id` match alone. Every MCP request must re-resolve the *current* effective role of the token's owning user against org role + workspace role at call time (not cache role at token-issuance time) — this is a live lookup, not a token claim. Add an explicit revalidation/kill path: when a user's org role is downgraded or removed, either revoke their `mcp_tokens` rows immediately (safest) or ensure every subsequent MCP call re-checks role and 403s. Write a specific regression test: issue a token as `organization_owner`, downgrade that user to `organization_member` mid-test, assert the token's next call is scoped down (or rejected) accordingly — this is a new test class, not covered by `rls-regression.test.ts` today.

**Warning signs:**
Any MCP auth check that reads role/permission from the token row itself (`mcp_tokens.scope`) rather than re-joining to current `organization_memberships`/`workspace_memberships` at request time; no token-revocation trigger wired to role-change events; existing `mcp-server/index.ts:1118+` org-scoped-token special case not re-audited once org roles exist.

**Phase to address:**
The org-level RBAC phase, as an explicit sub-task: "audit and update MCP token permission resolution to re-check live org+workspace role on every call." Must ship in the same phase as org RBAC, not deferred — an unaudited MCP surface with a live OAuth client base (Claude Desktop, Cursor, custom agents already connected) is the highest-blast-radius integration point in this milestone.

---

### Pitfall 5: Migration/rollout defaults every existing org to the wrong role, or breaks invitations mid-flight

**What goes wrong:**
211 existing migrations and real paying customers means the backfill migration that assigns every existing `personal_organization`-derived org an initial org role is a one-shot, irreversible-in-practice operation on production data — the exact class of migration that produced the `20260316_fix_admin_role_leak.sql` incident (a backfill migration on 2026-03-02 created spurious ADMIN rows via an orphaned auth record, silently inherited by a real user two weeks later). Two concrete rollout risks specific to this milestone: (1) every current org creator becomes `organization_owner` by default, which is probably correct — but any org with more than one existing admin-equivalent workspace member (a workspace_owner who isn't the org creator) needs an explicit decision about their new org role, and a naive "creator = owner, everyone else = member" backfill will demote real admins without their knowledge; (2) any `workspace_invitations` or org-invitation rows that are `pending` at the moment the migration runs reference role strings that predate org roles — if the invitation-accept code path validates the invited role against a new CHECK constraint before the migration back-fills/migrates old invitation rows (same shape as the `manager`→`contributor`, `guest`→`member` role-string migration in `20260330200000_align_workspace_roles_5_to_4.sql`), any invitation accepted during the deploy window fails with a constraint violation.

**Why it happens:**
Backfills are written and tested against a snapshot of current data, but production keeps moving (new signups, new invitations) during the deploy window; the existing role-rename migration (`20260330200000`) is a good model for the mechanics (`UPDATE ... SET role = ... WHERE role = 'old'` before adding the CHECK constraint) but the same three-step order (migrate data → replace constraint → migrate dependent rows like invitations) must be followed for org roles too, and it's easy to add the CHECK constraint first if working from a "define schema, then populate" instinct rather than "populate, then constrain."

**How to avoid:**
Follow the exact order already proven safe in `20260330200000_align_workspace_roles_5_to_4.sql`: (1) migrate/backfill existing data to valid new role values first, (2) only then add/replace the CHECK constraint, (3) explicitly handle in-flight rows in dependent tables (`*_invitations`) in the same transaction. For the specific "who becomes org_owner" question, do not assume creator=owner is universally correct — query for orgs where the creator is no longer an active member, or where another user holds `workspace_owner` on the org's primary workspace, and flag those for manual decision rather than silent default. Run the backfill inside a single `BEGIN...COMMIT` transaction (as `20260330200000` does) so a failure partway through doesn't leave orgs half-migrated. Consider a maintenance-window or feature-flag gate on new invitation creation during the deploy, since this codebase's `FLAG-01` feature-flag system was removed — there is currently no clean way to pause a specific flow during a risky migration, which is itself a gap worth flagging to the phase that does this rollout.

**Warning signs:**
Backfill migration that adds a CHECK constraint before running the `UPDATE` that makes existing rows valid; no query auditing "orgs where creator ≠ sole admin-equivalent member" before deciding the default-role rule; invitation-accept Edge Function not covered by an integration test that spans the migration boundary (accept an invitation created before the migration, after the migration runs).

**Phase to address:**
The org-as-ownable-entity phase's rollout/backfill step — write and dry-run the backfill against a copy of prod-shaped data (per the `.env.test` project pattern already established) before running it against `.env` (prod), exactly per the existing DB-safety rule in `supabase/CLAUDE.md`.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Gate org RBAC checks by re-deriving role precedence inline in each new RLS policy instead of one shared helper function | Faster to ship first table | Re-introduces Pitfall 1/2 class bugs every time a new table is added; each policy becomes a place inheritance logic can drift | Never — this codebase has already paid for this lesson twice |
| Treat "org owner" as implicitly having full workspace-admin power everywhere without an explicit mapping table/function | Simpler mental model, fewer rows | Makes the precedence rule un-auditable and un-testable; can't answer "why does this user have access" without re-deriving logic per table | Only acceptable if explicitly documented as the permanent rule (not a shortcut) and encoded in ONE function |
| Defer MCP token re-validation (Pitfall 4) to "later" and ship org RBAC gating the UI/API only | Ships org RBAC faster | Leaves a silent, high-blast-radius bypass — any AI client with an existing token ignores the new role boundary entirely | Never in this milestone — MCP is a named integration surface explicitly called out as "must not break" |
| Backfill org roles with a quick one-off `UPDATE organizations SET ...` script run manually via psql (bypassing migration files) | Faster than writing a proper migration | No record in `supabase/migrations/`, can't be replayed on the test project, breaks the "migrations are the source of truth" pattern this repo otherwise follows | Never — this repo's `.env`/`.env.test` safety model assumes migrations are the only mutation path |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|-------------------|
| Polar billing | Assuming `polar_customer_id` (or equivalent) is keyed to `organization_id` without checking — Stripe/Polar customer objects are keyed to whichever identity created them, not to a role | Grep every `polar_*` Edge Function and column for what identity keys the customer record; re-key to `organization_id` before building transfer if currently user-keyed |
| OAuth 2.1 MCP tokens (`mcp_tokens`) | Caching role/scope at token-issuance time and never re-checking it against current org/workspace membership | Re-resolve effective role from `organization_memberships`/`workspace_memberships` on every MCP request, not from the token row |
| Resend transactional email (org invitations) | Migrating role strings/constraints without also handling `pending` invitation rows created before the migration runs, or invitations accepted mid-deploy | Follow the 3-step order from `20260330200000`: migrate existing rows → replace constraint → handle dependent tables in the same transaction |
| Supabase Auth (`auth.users`) | Assuming every `auth.users` row corresponds to a real signed-up user when writing role backfills — this repo has direct history of an orphaned/ghost auth record silently inheriting ADMIN | Backfill org roles by joining through `user_profiles`/confirmed-signup tables, not raw `auth.users`, and add the same "known admin allowlist + strip spurious high roles" guard pattern used in `assign_free_role_to_new_user()` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Two-tier RLS policy evaluates org-role subquery AND workspace-role subquery on every row instead of via a single cached/STABLE function | Query latency climbs on list endpoints (recordings, transcripts) as org/workspace counts grow | Use `SECURITY DEFINER STABLE` helper functions (already the established pattern) so Postgres can cache/plan the check once per statement; index `organization_memberships(user_id, organization_id)` and `workspace_memberships(user_id, workspace_id)` explicitly | Noticeable once orgs have workspaces in the double digits or MCP polling drives high query volume — worth an `EXPLAIN ANALYZE` check before shipping the first combined-role policy |
| JWT custom-claims approach (embedding role in `app_metadata` to avoid DB lookups) adopted for org role without a plan to invalidate stale JWTs on role change | Demoted/removed users retain old-role access until their JWT naturally expires/refreshes | If using JWT claims for org role, force a token refresh (or short JWT TTL) on any role-change event; otherwise stick with live DB lookups via `SECURITY DEFINER` functions, which this repo already has infra for | Only matters if JWT-claims-for-role is chosen — current codebase style (helper functions) doesn't have this problem |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Backfilling org roles via ad hoc `auth.users` join without the "known admin allowlist + guard against orphaned/ghost records" pattern | Repeat of the exact `20260316_fix_admin_role_leak.sql` incident — a new user silently inherits elevated org role via a reused/orphaned UUID | Mirror `assign_free_role_to_new_user()`'s defensive delete-then-insert pattern for any new "assign default org role" trigger; explicitly test against a known-orphaned-record fixture |
| Not revoking the former owner's billing portal / admin session immediately on ownership transfer | Ex-owner can still access Polar billing portal or perform admin actions with a stale session/JWT after being demoted | Ownership transfer must be a single transaction that (a) updates `owner_user_id`, (b) re-keys/notifies Polar, (c) invalidates the old owner's active sessions or at minimum forces a role-claim refresh |
| Treating org-scoped MCP tokens as trusted forever once issued (Pitfall 4) | A revoked/demoted user's AI client (Claude Desktop, Cursor, custom agent) keeps full org access indefinitely | Live role re-validation per MCP request (see Pitfall 4); add token-revocation-on-role-change as a DB trigger, not an app-layer afterthought |
| Extending RLS regression coverage only for cross-*org* leaks (current `CROSS_ORG_TABLES` array), not cross-*workspace-within-org* or role-downgrade scenarios | A same-org, lower-role user (e.g. `organization_member`) could read/write data scoped to a workspace they were removed from, and CI would stay green | Add a second regression suite class: same-org, different-role, different-workspace-membership isolation — modeled on `rls-regression.test.ts` but asserting role boundaries, not just org boundaries |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Ownership transfer presented as instant/irreversible with no confirmation of billing implications | Org owner accidentally hands off billing control, then can't self-serve manage their own subscription | Explicit two-step confirm (transfer target + "this also transfers billing control") with a visible warning if the org has an active paid plan |
| No visible distinction in the UI between "org role" and "workspace role" once both exist | Users can't tell why they can/can't do something — support burden identical to the ambiguity described in Pitfall 2 | Show effective role plainly ("Org Admin, Workspace Member here") anywhere role gates a UI action, not just a raw role badge |
| Demoting/removing a user from an org doesn't surface what happens to their existing MCP tokens or pending invitations they sent | Silent dangling access, or confused "why can't I invite anyone" for a demoted admin who still has pending invites out | Ownership/role-change flows should surface affected tokens/invitations explicitly as part of the confirmation step |

## "Looks Done But Isn't" Checklist

- [ ] **Org role schema exists:** Often missing the effective-role resolution function — verify a single canonical `get_effective_workspace_role()`-style function exists and every RLS policy calls it, not ad hoc per-policy logic
- [ ] **Ownership transfer flow:** Often missing Polar re-keying and old-owner session/token invalidation — verify by transferring a test org with an active subscription and checking the Polar dashboard + old owner's session state
- [ ] **MCP token permission gating:** Often missing live role re-validation — verify by downgrading a test user's org role mid-session and confirming their existing MCP token's next call is correctly scoped down, not just new tokens
- [ ] **RLS regression coverage:** Often missing cross-workspace-within-org and role-downgrade test cases — verify `rls-regression.test.ts` (or a new sibling suite) covers same-org/different-role isolation, not just cross-org isolation
- [ ] **Backfill migration:** Often missing the "which existing orgs need manual review" query — verify a pre-migration audit query has been run identifying orgs where creator ≠ sole admin, before the default-role backfill runs

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| RLS recursion shipped to prod (Pitfall 1) | LOW | Same playbook already proven: replace the recursive policy with a `SECURITY DEFINER` helper function migration, per `20260128000001` — known-fast fix given the precedent |
| Role precedence ambiguity causes a data leak (Pitfall 2) | MEDIUM | Same playbook as `20260316_fix_admin_role_leak.sql`: identify affected rows via a targeted query, patch the guard function, backfill-correct any spuriously-granted rows, add a regression test asserting the specific leak case |
| Billing desync after ownership transfer (Pitfall 3) | HIGH | Requires manual Polar-side reconciliation (re-key or recreate customer/subscription record), customer comms if billing was double-charged or a payment method was lost, and a one-off data-repair migration — expensive because it touches money and customer trust |
| Stale MCP token retains access after role downgrade (Pitfall 4) | LOW-MEDIUM | Force-revoke all `mcp_tokens` for the affected user immediately (mechanical fix), then ship the live-revalidation fix; low cost if caught quickly, but any AI-client actions taken during the exposure window need manual audit |
| Bad rollout backfill assigns wrong default org role broadly (Pitfall 5) | MEDIUM | Same playbook as prior migrations: since it's schema data (not deleted rows), a corrective migration can re-derive correct roles from a snapshot/audit query and re-run; cost scales with how long the bad state persisted before detection and whether invitations were affected mid-flight |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| RLS cross-table recursion (org↔workspace policies) | Phase introducing org-role schema + first combined-role RLS policy | New policies only ever call a `SECURITY DEFINER STABLE` helper; CI RLS regression suite passes without recursion errors |
| Org/workspace role precedence ambiguity | Requirements/schema-design phase, before RLS work starts | Precedence rule documented as a Key Decision in PROJECT.md and encoded in exactly one function; new regression suite asserts same-org/different-role isolation |
| Ownership transfer breaks Polar billing coupling | Org-as-ownable-entity phase, before transfer flow is built | Transfer a test org with an active subscription in the TEST Supabase+Polar sandbox; confirm Polar customer record and webhook resolution still work post-transfer |
| MCP tokens don't re-check role after RBAC introduced | Org-level RBAC phase (same phase, not deferred) | Integration test: issue token as elevated role, downgrade role mid-test, assert next MCP call reflects the downgrade |
| Backfill migration mis-defaults roles / breaks in-flight invitations | Org-as-ownable-entity phase, rollout/backfill step | Dry-run backfill against `.env.test` project first; pre-migration audit query for "orgs needing manual role review"; migration follows migrate-then-constrain order like `20260330200000` |

## Sources

- This repo: `supabase/migrations/20260128000001_fix_team_memberships_rls_recursion.sql` — prior RLS recursion incident and fix pattern (HIGH confidence, direct incident record)
- This repo: `supabase/migrations/20260316120000_fix_admin_role_leak.sql` — prior role-leak incident from a backfill migration + orphaned auth record (HIGH confidence, direct incident record)
- This repo: `supabase/migrations/20260330200000_align_workspace_roles_5_to_4.sql` — proven safe migration order for role-string changes (HIGH confidence, direct precedent)
- This repo: `supabase/CLAUDE.md` — RLS regression test contract, DB safety rules, `.env`/`.env.test` separation (HIGH confidence, current conventions)
- This repo: `.planning/PROJECT.md` — v2.2 milestone scope, MCP org/workspace token architecture, `mcp-server/index.ts:1118+` dual-scope handling (HIGH confidence, current state)
- [Building Multi-Tenant RLS in Supabase: Lessons From Shipping Lomi](https://dev.to/pavelespitia/building-multi-tenant-rls-in-supabase-lessons-from-shipping-lomi-4go4) — SECURITY DEFINER pattern, RLS performance (MEDIUM confidence, community source, consistent with repo's own pattern)
- [Supabase RLS Best Practices: Production Patterns](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — indexing RLS policy columns, JWT claims tradeoffs (MEDIUM confidence)
- [Stripe Subscription Migration Guide — MoveMRR](https://movemrr.com/knowledge/stripe-subscription-migration-guide/) — subscriptions/billing relationships don't auto-follow ownership changes (MEDIUM confidence, Stripe-specific but structurally applicable to Polar)
- [What Happens to Stripe Subscriptions When You Sell Your SaaS — MoveMRR](https://movemrr.com/blog/what-happens-to-stripe-subscriptions-when-you-sell-your-saas/) — anchor-date loss, double-charging risk on ownership/billing-entity transfer (MEDIUM confidence)
- [Preventing Scope Creep in OAuth — hoop.dev](https://hoop.dev/blog/preventing-scope-creep-in-oauth-temporary-production-access-management) — OAuth scopes persisting past the grant that justified them (MEDIUM confidence, general pattern, not Polar/Supabase-specific)
- [OAuth Scopes vs RBAC: Key Differences — DreamFactory](https://blog.dreamfactory.com/oauth-scopes-vs-rbac-key-differences) — scopes are token-bound/static, RBAC is user-bound/dynamic; mismatch is the root of retrofit bugs (MEDIUM confidence)

---
*Pitfalls research for: org-as-ownable-entity + org-level RBAC on Supabase/RLS, live product (CallVault v2.2)*
*Researched: 2026-07-30*
