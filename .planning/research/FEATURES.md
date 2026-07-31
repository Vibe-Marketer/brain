# Feature Research

**Domain:** Org-level RBAC + org-as-ownable-entity for a multi-tenant B2B SaaS (agency/enterprise pattern, GHL-style)
**Researched:** 2026-07-30
**Confidence:** MEDIUM-HIGH (Clerk, Vercel, Linear, Notion verified via official docs/changelog; GoHighLevel verified via official HighLevel support portal + corroborating third-party guides; ownership-transfer flow synthesized from Vercel's documented mechanism, which is the most concretely-specified of the sources reviewed)

> **Scope note (subsequent milestone — v2.2 Organization Entity & Access Foundation).** This replaces the v2.1 import/sync FEATURES research (archived context below is no longer relevant scope). v2.2 adds org-level roles above the existing 4 workspace-level roles (`workspace_owner/admin/contributor/member`), decouples organizations from creator-coupling so they're transferable, and lays a primitive that v2.3's permissioned cross-org sharing can reuse without a second migration. Andrew's explicit reference point: GoHighLevel's agency→sub-account model, described as wanting the org to be an "ownable asset" / "vault" independent of its creator.

## Feature Landscape

### Table Stakes (Users Expect These)

Features any multi-tenant B2B tool is assumed to have. Missing these makes CallVault's org layer feel unfinished next to Vercel/Linear/Notion/GHL, all of which Andrew or his users have used.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Org-level `owner` role, distinct from workspace-level roles | Every comparable (Vercel, Linear Enterprise, Notion, GHL Agency) has exactly one "the buck stops here" role above team/workspace roles. CallVault today only has workspace roles — there's no org-scoped authority at all. | LOW-MEDIUM | Add an org-membership role column with `org_owner` as the top role. Map onto the existing `workspace_owner/admin/contributor/member` naming so the mental model transfers directly. |
| Exactly one owner enforced at all times | Vercel explicitly blocks removing the last Owner; Notion requires ≥1 workspace owner always. This is a correctness invariant, not a preference — an ownerless org is an orphaned, unmanageable entity, precisely the bug this milestone exists to fix. | LOW | DB constraint or trigger rejecting any demote/delete that would leave `org_owner` count at 0. Cheap insurance against a real failure mode. |
| Ownership transfer flow (promote-then-demote, not instant handoff) | Vercel's mechanism (promote target to Owner first, only then optionally demote/remove the original) is the safe pattern serious SaaS converges on — it makes ownership transfer atomic-safe without a "dead zone" where nobody owns the org. | LOW-MEDIUM | Two-step transaction: (1) grant `org_owner` to target, (2) optionally demote/remove original owner as a separate, explicit follow-up action — never an implicit single-step swap. |
| Org admin role (day-to-day management, not full owner authority) | GHL (Agency Admin vs Agency User), Vercel (Owner vs Member vs Billing), Clerk (`org:admin` vs `org:member`), Notion (Owner vs Admin on Enterprise) — every model has a "can manage the org but isn't the ultimate authority" tier. Matches Andrew's stated agency-style delegation want. | LOW | `org_admin` sits below `org_owner`: can manage members, workspaces, invitations; cannot transfer/delete the org or touch billing. |
| Billing gated to owner (or an explicit billing role) | Vercel has a dedicated `Billing` role because "who can see/change the credit card" is the single most sensitive permission in a B2B org. CallVault already runs Polar billing per org — nothing today stops any workspace_admin from touching it once org roles exist unless this is explicitly gated. | LOW | Simplest correct default: only `org_owner` touches billing at launch. A dedicated billing role is a differentiator, not required for v2.2. |
| Org invitations updated to capture org role | CallVault already has org invitations (existing feature). New requirement: the invite flow must ask "what org role" not just "what workspace role," or invites become ambiguous once org-level roles exist. | LOW | Extend the existing invitation table/UI with an `org_role` field; default to lowest privilege (no elevated org role, workspace-scoped only) unless explicitly granted. |
| Clear authority hierarchy: org role as ceiling/override over workspace roles | GHL's model (Agency Admin has global authority across all sub-accounts; sub-account admin is scoped to just that sub-account) is the direct analog to what Andrew described. This is the core "agency manages sub-accounts" mental model. | MEDIUM | Decide explicitly: does `org_owner`/`org_admin` implicitly have access to every workspace under the org (GHL model), or must they also be granted individual workspace membership (Notion teamspace model)? Recommend the GHL model — org owner/admin sees everything under their org by default, matching Andrew's stated mental model and CallVault's existing "org already functions like an agency account" framing. |

### Differentiators (Competitive Advantage)

Not required for launch-parity, but this is where CallVault's org model could feel "actually GHL-competitive" rather than merely adequate. Prioritize only after table stakes ship, and only where they serve the stated near-term goal of permissioned cross-org sharing.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Org ownership transfer as a genuinely reusable, general primitive (not special-cased to "founder → new owner") | This is the explicit leverage insight behind this milestone's sequencing: org-as-ownable-entity and permissioned cross-org sharing are the same primitive at two scopes. Building transfer + role-grant as a generic "grant scoped authority over an entity" mechanism now means v2.3 cross-org call sharing reuses it rather than needing new schema. | MEDIUM | Model as `entity_type` + `entity_id` + `grantee` + `role/scope` — even if today `entity_type` is only ever `organization`, this shape means "share this workspace's calls with another org" later is a new row shape, not a new table. |
| Org-level audit log for role/ownership changes | Nobody expects this for a small B2B tool, but it's the feature that makes "org as an asset you can sell/transfer" trustworthy. If the actual play resembles GHL's white-label reseller motif (agencies effectively controlling sub-account access), an audit trail of who owned what and when is the differentiator that makes the "vault as valuable asset" framing credible — not the RBAC itself. | LOW-MEDIUM | Append-only table logging role grants/revokes/transfers with actor + timestamp. Cheap to build now (an insert on every mutation), expensive to retrofit once real transfers have already happened un-logged. |
| Org-scoped MCP token tied to org role, not just workspace | CallVault's actual product differentiator is the MCP surface. Once org-level roles exist, an "org owner" MCP token that can act across every workspace under the org (vs. today's per-workspace or org-wide-but-role-blind tokens) is a natural, high-leverage extension — an AI agent acting "as the agency" rather than "as one sub-account." | MEDIUM | `mcp_tokens` already has `org_id`/`workspace_id`/`scope` columns — this is additive: resolve org-role at token-mint/validation time instead of granting blanket org access. |
| Per-workspace role override within an org (GHL sub-account admin pattern) | Lets an org owner delegate day-to-day workspace management to someone without granting org-wide authority — mirrors GHL's independent agency-level vs. sub-account-level role assignment. | MEDIUM | Only worth building once a real multi-workspace-per-org customer hits the limitation. Table stakes already cover "org role implies workspace access" — this is about scoping DOWN, a v2.3+ problem, not v2.2. |

### Anti-Features (Commonly Requested, Often Problematic)

The trap specific to this milestone: Andrew explicitly named GHL as the reference, and GHL is built by/for an enterprise engineering team serving thousands of agencies. CallVault is one operator + AI agents. Several GHL/enterprise patterns look right but are pure overhead here.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Custom/granular role builder (à la Clerk's up-to-10-custom-roles, or GHL's per-feature permission toggles for conversations/calendars/pipelines/reporting) | "GHL lets you fine-tune exactly what each user can touch" — sounds like flexibility. | This is the "role explosion" anti-pattern documented in the Slack/Notion/Linear multi-tenant permissions analysis: 30+ roles/permission combinations that exist for one customer's edge case, that nobody remembers the purpose of, that become a support and QA burden. CallVault has 4 workspace roles and is about to add 2 org roles — a permission matrix on top of that is enterprise-scale complexity for a single-operator-run product with no enterprise sales motion demanding it. | Ship the fixed role set (org_owner/org_admin; existing 4 workspace roles unchanged). If a real customer needs finer control, that's a v2.3+ signal, not a v2.2 default. |
| Full audit-log UI / SOC2-style compliance dashboard | Feels "enterprise-ready," matches GHL/Notion Enterprise tier features. | Building a UI for an audit log nobody has asked to see yet is speculative enterprise theater. The actual near-term need is the underlying data model for trust in ownership transfer (log the events), not a compliance dashboard. | Log events to a table now (cheap); build a viewer only if/when a customer or the transfer flow itself needs to display history. |
| IdP/SSO group-to-role mapping (Slack/enterprise pattern) | Called "non-negotiable at scale" in enterprise multi-tenant permission guidance, and Andrew wants "enterprise-style" org management. | CallVault has no enterprise customers today and no SSO. Building group-sync plumbing for a role model that has 2-3 people per org is solving a scale problem that doesn't exist yet. | Manual role assignment via the existing invitation flow is sufficient until an actual enterprise prospect asks for SSO — treat as an explicit v3+ trigger, not v2.2. |
| Instant/single-step ownership transfer (no promote-then-demote) | Feels simpler — "just pick a new owner and go." | The opposite of the pattern Vercel enforces by requiring the two-step promote/demote: a single-step swap has a failure window (e.g., transfer target rejects/errors mid-transaction) where the org can end up ownerless — the exact state this milestone's stated goal ("org exists independent of its creator, safely") must prevent. | Two-step transaction (grant new owner → confirm → optionally revoke old owner), per Table Stakes. |
| Selling/marketplace layer for orgs-as-assets (a literal "transfer this org to a buyer" commerce flow) | Andrew's language ("ownable asset," "vault") could be read as wanting an actual resale/marketplace mechanism — a real thing in the GHL ecosystem (agencies buy/sell sub-account books of business). | Conflates two different problems: (1) the *technical* primitive of org ownership being transferable/decoupled from creator (needed now, unlocks safe permissioned sharing), and (2) a *commercial* marketplace for buying/selling CallVault orgs (a whole separate product — payments, escrow, dispute handling, KYC). Nothing in this milestone's scope calls for #2. | Build the technical transfer primitive only. If a real "sell your CallVault org" business case emerges later, that's its own milestone with its own research — don't let the metaphor drive scope now. |
| Team-scoped roles / private-teams-as-access-boundary (Linear's "team owner" delegation pattern) | Linear's minimal-global-role + team-scoped-delegation model is held up as a gold standard for avoiding admin bottlenecks. | CallVault's workspace already plays the role Linear's "team" plays — adding a second nested scoping layer (org → team → workspace) on top of what's being built now duplicates the workspace boundary that already exists. | Org → workspace is the right depth for CallVault. Don't add a third tier. |

## Feature Dependencies

```
Org-level roles table (org_owner/org_admin)
    └──requires──> Decoupling org from personal_organization creator-coupling
                       (can't have a real "owner" role if org identity == creator identity)

Ownership transfer flow (promote-then-demote)
    └──requires──> Org-level roles table
    └──requires──> "Exactly one owner always" DB constraint

Billing gated to org_owner
    └──requires──> Org-level roles table
    └──enhances──> Ownership transfer flow (new owner must inherit billing control atomically)

Org invitation flow updated with org_role field
    └──requires──> Org-level roles table
    └──enhances──> existing org invitations (already built) — additive field, not a rebuild

Org-scoped MCP token resolving org role
    └──requires──> Org-level roles table
    └──enhances──> existing OAuth 2.1 MCP org-scoped tokens (already built)

Audit log of role/ownership changes
    └──requires──> Org-level roles table
    └──requires──> Ownership transfer flow
    └──enhances──> future permissioned cross-org sharing (v2.3+) — same event-log primitive reused

Permissioned cross-org sharing (v2.3+, out of scope this milestone)
    └──requires──> Org-as-ownable-entity decoupling
    └──requires──> Generic "grant scoped authority over an entity" primitive (Differentiator)

Per-workspace role override within an org (GHL sub-account pattern)
    └──requires──> Org-level roles table
    └──conflicts with──> "org role = ceiling over all workspaces" default (Table Stakes) unless deliberately layered as an override, not a replacement
```

### Dependency Notes

- **Ownership transfer requires the roles table AND the single-owner constraint first.** Building transfer before the constraint exists means there's a window where a bad transfer leaves an org unowned — exactly the state this milestone exists to prevent.
- **Billing-gating enhances ownership transfer.** If billing access isn't tied to `org_owner`, a transfer can hand over "ownership" in name while the old owner still controls the Polar subscription — a real trust gap in the "ownable asset" framing.
- **The generic grant primitive is the one piece worth over-building slightly now.** It's explicitly named in PROJECT.md as the reason this milestone exists ("org-as-entity and permissioned sharing are the same primitive at two scopes... build the foundation first unlocks sharing later without a second migration"). Everything else in this table should stay minimal; this one dependency chain is where the milestone's strategic bet lives.
- **Per-workspace override conflicts with the simple ceiling model** if implemented carelessly — decide explicitly (recommend: don't build in v2.2, revisit only if a real multi-workspace-per-org customer needs it).

## MVP Definition

### Launch With (v2.2)

- [ ] Org-level roles: `org_owner`, `org_admin` (2 roles, not more) — matches GHL's 2-role agency tier, avoids role explosion
- [ ] Decouple `organization` from `personal_organization` creator-coupling — the actual "ownable entity" unlock
- [ ] "Exactly one `org_owner` at all times" DB-level constraint
- [ ] Promote-then-demote ownership transfer flow (2-step, never instant swap)
- [ ] Billing actions gated to `org_owner` only
- [ ] Org invitation flow updated to capture org role (default: no elevated org role, i.e., workspace-scoped only)
- [ ] `org_owner`/`org_admin` implicitly have access across all workspaces under the org (GHL model — matches Andrew's stated mental model directly)
- [ ] Append-only audit log table for role grants/revokes/transfers (data model only, no UI required yet)
- [ ] Generic entity-scoped grant primitive shaped so v2.3 cross-org sharing is additive, not a second migration

### Add After Validation (v2.2.x / v2.3)

- [ ] Org-scoped MCP tokens resolving org role (not just org_id) — trigger: once org roles exist and an AI-agent-as-agency use case is real, not hypothetical
- [ ] Audit log viewer UI — trigger: a real ownership transfer happens and someone (Andrew or a customer) wants to see the history
- [ ] Permissioned cross-org call/transcript sharing — trigger: this is the explicit v2.3 target, built on the primitive shipped in v2.2

### Future Consideration (v3+)

- [ ] Custom/granular per-feature role permissions — defer until an actual customer's workflow is blocked by the 2-role ceiling, not before
- [ ] Dedicated billing-only role (separate from org_owner) — defer until a customer specifically needs "bookkeeper can see invoices but not manage the org"
- [ ] SSO/IdP group-role mapping — defer until an actual enterprise prospect requires it
- [ ] Per-workspace role override within an org (GHL sub-account admin pattern) — defer until a real multi-workspace customer needs delegated, workspace-scoped-only admins
- [ ] Any org-marketplace/resale commerce layer — a different product; do not let the "ownable asset" metaphor pull this into scope prematurely

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Org-level owner/admin roles | HIGH | LOW-MEDIUM | P1 |
| Decouple org from creator | HIGH | MEDIUM | P1 |
| Single-owner DB constraint | HIGH (prevents catastrophic orphan state) | LOW | P1 |
| Promote-then-demote transfer flow | HIGH | LOW-MEDIUM | P1 |
| Billing gated to owner | HIGH | LOW | P1 |
| Org invitation role field | MEDIUM | LOW | P1 |
| Org role = ceiling over all workspaces | HIGH (matches stated mental model) | MEDIUM | P1 |
| Audit log data model (no UI) | MEDIUM (strategic — makes "asset" framing credible) | LOW-MEDIUM | P1 |
| Generic scoped-grant primitive for future sharing | HIGH (the actual leverage bet of this milestone) | MEDIUM | P1 |
| Org-scoped MCP token role resolution | MEDIUM | MEDIUM | P2 |
| Audit log viewer UI | LOW-MEDIUM | LOW | P2 |
| Custom/granular role builder | LOW (no current demand) | HIGH | P3 |
| SSO/IdP role mapping | LOW (no enterprise customers) | HIGH | P3 |
| Per-workspace override within org | LOW (no known customer need) | MEDIUM | P3 |
| Org marketplace/resale layer | UNKNOWN (unvalidated business idea) | VERY HIGH | P3 |

## Competitor Feature Analysis

| Feature | GoHighLevel | Clerk Organizations | Vercel | Linear/Notion | Our Approach |
|---------|-------------|----------------------|--------|----------------|--------------|
| Top-tier org role | Agency Admin (full platform + all sub-accounts) | `org:admin` (all system permissions) | Owner (billing, member mgmt, role changes) | Notion: Owner (Enterprise-only); Linear: Owner (Enterprise-only) | `org_owner` — always exactly 1+, mirrors Vercel's enforcement |
| Secondary org role | Agency User (restricted dashboard access) | `org:member` (read-only defaults) | Member / Viewer / Billing (3 sub-roles) | Admin (Notion), Member (Linear) | `org_admin` — one secondary tier only, not three |
| Sub-scope role | Sub-Account Admin/User (independent per sub-account) | N/A (single-tier orgs) | N/A (Team = org, no nesting) | Linear: team-scoped Owner delegation | Existing workspace roles (workspace_owner/admin/contributor/member) kept as-is, org role sits above them |
| Custom roles | Granular per-feature permission toggles | Up to 10 custom roles (paid add-on) | Fixed 4 roles only | Fixed roles only (Linear, Notion non-Enterprise) | Fixed roles only — matches Vercel/Linear/Notion's non-enterprise defaults, not GHL's granular toggle system |
| Ownership transfer | Not clearly documented publicly (agency accounts rarely transfer) | Not clearly documented (orgs typically created/owned by API caller) | Promote-then-demote, explicit 2-step, blocks removing last Owner | Not clearly documented publicly | Promote-then-demote (Vercel pattern) — most concretely specified and safest of the sources reviewed |
| Billing scope | Agency-level billing, separate from sub-account | Org-level, admin-only | Owner-only (or dedicated Billing role) | Workspace Owner (Enterprise) | `org_owner`-only for v2.2; dedicated billing role deferred to v3+ |

## Sources

- [Admin vs User Roles & Permission Scopes in HighLevel — HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/48001078296-admin-vs-user-roles-and-permission-scopes) — HIGH confidence, official docs
- [Agency – Managing User Roles & Permissions — HighLevel Support Portal](https://help.gohighlevel.com/support/solutions/articles/155000002543-agency-managing-user-roles-permissions) — HIGH confidence, official docs
- [B2B/B2C Roles and Permissions with Clerk Organizations — Clerk Docs](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — HIGH confidence, official docs
- [Role Sets — Clerk Docs](https://clerk.com/docs/guides/organizations/control-access/role-sets) — HIGH confidence, official docs
- [How do I transfer ownership of a Vercel team? — Vercel Knowledge Base](https://vercel.com/kb/guide/how-do-i-transfer-ownership-of-a-vercel-team) — HIGH confidence, official docs
- [Access Roles — Vercel Docs](https://vercel.com/docs/rbac/access-roles) — HIGH confidence, official docs
- [Members and roles — Linear Docs](https://linear.app/docs/members-roles) — HIGH confidence, official docs
- [Who's who in a Notion workspace — Notion Help Center](https://www.notion.com/help/whos-who-in-a-workspace) — HIGH confidence, official docs
- [Manage members, admins & guests in Notion — Notion Help Center](https://www.notion.com/help/add-members-admins-guests-and-groups) — HIGH confidence, official docs
- [Multi-tenant permissions done right: What Slack, Notion, and Linear can teach us — WorkOS](https://workos.com/blog/multi-tenant-permissions-slack-notion-linear) — MEDIUM confidence, third-party analysis but well-sourced against the same official docs; the "role explosion" anti-pattern framing is the single most load-bearing insight for this milestone's anti-features section
- `/Users/admin/dev/brain/.planning/PROJECT.md` — internal project context (existing workspace roles, org invitations, MCP token scoping, milestone framing)

---
*Feature research for: org-level RBAC + org-as-ownable-entity, CallVault v2.2*
*Researched: 2026-07-30*
