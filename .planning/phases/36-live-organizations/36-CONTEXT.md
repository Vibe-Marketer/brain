# Phase 36: Live Organizations - Context

**Gathered:** 2026-09-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Organizations stop being a tenancy label and become claimable canonical entities — without ever conferring capture access. Delivers: `organization_aliases` + `organization_domains` (multiple names/domains per org), domain-ownership claim/verification, non-destructive reversible duplicate-org merge via `canonical_organization_id`, and RLS-proven isolation so org association with an event never grants capture access (ORG-01..04).

</domain>

<decisions>
## Implementation Decisions

### Domain & Alias Model
- Domain uniqueness is global across ALL orgs — one domain maps to exactly one org, never shared. A shared domain across two orgs would break the canonical-entity premise.
- `organization_aliases` is display/search metadata only this phase — no fuzzy-match or automated duplicate-detection algorithm. Mirrors how the MATCH-* resolution tiers were scoped incrementally rather than all at once.
- Common free-email domains (gmail.com, outlook.com, yahoo.com, etc.) are blocklisted from being claimed as an organization domain — claiming "gmail.com" would let any Gmail user claim the org.
- Aliases are NOT globally unique. Two real-world companies can legitimately share a DBA/alias name; the organization's canonical identity remains its `id`.

### Domain Claim & Verification
- Domain ownership is proven by reusing Phase 34's verified-email mechanism: a user holding an already-verified `@acme.com` email (via `identity_aliases`) can claim `acme.com` for their organization. No new DNS TXT-record flow or fresh verification-email flow this phase.
- Only org admins/owners can initiate a domain claim — mirrors existing org-admin gating used elsewhere (e.g. invitations).
- Conflict rule: first-claim-wins. If a second org later has a member with a verified email on an already-claimed domain, that claim attempt is rejected with a clear conflict message. Allowing multiple orgs to claim the same domain was explicitly rejected as inconsistent with the canonical-entity premise.
- Claims are reversible: a service-role/admin-only unclaim capability exists, mirroring the milestone-wide reversible-operation pattern (kill switch, `reverse_event_match_atomic`). Not necessarily exposed as a self-serve UI action this phase.

### Duplicate Merge Mechanics
- Merges are manual/admin-initiated only. ORG-03 requires that duplicates *can* be merged, not that they're auto-detected — no automated duplicate-org finder this phase.
- Mechanically, `canonical_organization_id` is a redirect/pointer layer: the losing org's row gets `canonical_organization_id` pointing at the winner. Existing FK columns (e.g. `recordings.organization_id`) are NOT bulk-rewritten. This matches the milestone's additive/non-destructive SAFE-* pattern used for `events`/`identities`, and makes reversal trivial (clear the pointer).
- Dual-membership handling (a user who is a member of both the losing and winning org at merge time) is Claude's Discretion at plan time — default to preserving the higher-privilege role if both exist, unless the actual membership-table shape suggests otherwise.
- Merged (non-canonical) orgs remain directly queryable — nothing about them breaks or gets locked. New UI surfaces should follow `canonical_organization_id` when displaying "the" organization, but the old row is never hidden or deleted.

### UI Surface
- Claim/domain/alias management lives in the existing org Settings area, as a new "Organization Identity" (or equivalently named) section — not a new standalone page.
- The merge-duplicates tool is internal/admin-only this phase (mirrors the existing AdminTab precedent for other operator-only tools) — not exposed to end users/org owners.
- Verified-domain status is shown as a small verified badge next to the org name, visually consistent with `IdentityEvidenceBadge` from Phase 34.
- No pending/polling UI state is needed for claims — the recommended verification mechanism (already-verified email) resolves synchronously as an instant confirm/reject. (This would need revisiting only if the verification mechanism ever changes to a DNS-TXT flow.)

### Claude's Discretion
- Exact schema/column naming, constraint syntax, and RLS helper-function structure — follow the established patterns from `events`/`identities` (Phase 30/34): additive only, nullable new columns, SECURITY DEFINER helpers for cross-table RLS checks, non-org-scoped visibility where appropriate.
- Whether the admin/service-role unclaim action gets a UI affordance now or stays DB-only this phase.
- Dual-membership role resolution on merge (see above) — resolve against the actual membership table shape at plan time.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `identity_aliases` + its verified-email OTP flow (Phase 34) — the domain-claim mechanism reuses this rather than building new verification infrastructure.
- `is_organization_member` / `user_can_view_identity`-style SECURITY DEFINER helper pattern, established across Phases 30/31/34, is the precedent for any new RLS predicate this phase needs (e.g. checking domain-claim eligibility without inheriting a target table's own restrictive RLS).
- `IdentityEvidenceBadge` (Phase 34) is the visual precedent for the new verified-org badge.
- AdminTab is the existing precedent for internal/operator-only tooling surfaces (merge-duplicates UI).
- The reversible-operation pattern already shipped twice this milestone (event-merge kill switch/reversal, Phase 31/32) is the precedent for reversible domain-unclaim and reversible org-merge.

### Established Patterns
- Current `organizations` table (`id`, `name`, `slug`, `type`, `logo_url`, `cross_org_default`, `created_at`, `updated_at`) has zero domain/alias/canonical columns today — this phase is purely additive, consistent with every prior v2.2 schema phase.
- All prior v2.2 schema/RLS work follows: additive migration → TEST apply/introspect → prod apply only after explicit Andrew approval, each guarded by the prod-ref check (`vltmrnjsubfzrgrtdqey`).
- `rls-regression.test.ts`'s `CROSS_ORG_TABLES` / `BESPOKE_CLIENT_DENY_TABLES` registries are the required proof mechanism for ORG-04 (no capture-access leakage via org association).

### Integration Points
- Org Settings area (frontend) — where the new Organization Identity section attaches.
- `identity_aliases` verified-email records — read by the new domain-claim check.
- `recordings.organization_id` and any other FK referencing `organizations.id` — read-path callers should be audited (mirroring Phase 34's reader-inventory sweep) to confirm none silently break when a `canonical_organization_id` pointer exists on a queried org.

</code_context>

<specifics>
## Specific Ideas

No specific UI mockups or exact copy were requested — standard approach per the accepted grey-area answers above.

</specifics>

<deferred>
## Deferred Ideas

- Automated duplicate-org detection (fuzzy alias/name matching) — explicitly deferred; this phase only makes merging *possible*, not automatic.
- DNS TXT-record domain verification — deferred in favor of reusing the verified-email mechanism; could be revisited later if a company without any already-verified member email needs to claim its domain.
- Self-serve (non-admin) merge-duplicates UI — deferred; admin-only for now given the stakes of merging real organizations.

</deferred>
