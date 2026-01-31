# Phase 9: Bank/Vault Architecture - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the Bank/Vault architecture from CallVault-Final-Spaces.md:
- Eliminate all "coach" code and references (no production data exists)
- Create Bank, BankMembership, Vault, VaultMembership, Recording, VaultEntry schema
- Migrate existing fathom_calls to new Recording + VaultEntry structure
- Drop and rebuild teams infrastructure using new Bank/Vault model
- Implement personal + team vault types (other types exist in schema only)

**Reference:** `/docs/planning/CallVault-Final-Spaces.md` is the authoritative spec for this architecture.

</domain>

<decisions>
## Implementation Decisions

### Coach Elimination Strategy
- **Approach:** Hard delete all coach-related code — no production data exists
- Claude researches codebase to identify all coach references (Edge Functions, UI, types)
- Build fresh rather than trying to retrofit (square peg/round hole)
- Safe to remove everything without migration concerns

### Bank Creation & Defaults
- **Personal Bank:** Auto-created for every new user at signup
- **Business Banks:** Never auto-created — always explicit user action
- **Business Bank creation paths:**
  1. Settings → "Banks & Billing" → "+ Create Business Bank" button
  2. High-intent actions trigger modal: "Invite teammate", "Create Team Vault", "Set up Company QA"
  3. Signup flow with explicit "I'm setting up for my team" option
- **Business Bank wizard collects:** Bank name, optional company domain, plan selection
- **On Business Bank creation:** User becomes bank_owner, create first Vault using template
- **Cross-bank default:** `copy_only` — keeps original in source Bank, user can override to "move"
- **Monetization tie-in:**
  - Free: Personal Bank only, Business Bank shows upgrade paywall
  - Paid Team: One Business Bank included
  - Agency tier: Multiple Business Banks allowed, count against limit

### Vault Type Behavior
- **Fully implemented in Phase 9:** `personal` + `team`
- **Schema only (no special behavior yet):** `coach`, `community`, `client`
- **Personal Vault:** One default per Bank, can't be deleted, "My Calls" live here
- **Team Vault:** Powers all business use cases (Sales Team, Marketing, VOC, Agency clients)
- `coach`/`community`/`client` types are templates/labels, not different logic — just different default folders and pre-configured AI Agents in future phases
- **Default folder visibility:** `all_members` (least confusing UX, sensitive stuff is explicit)
- **Default folders for new Team Vault:**
  1. `Hall of Fame` (visibility: all_members) — best calls, exemplars
  2. `Manager Reviews` (visibility: managers_only) — QA, coaching notes
- No "All Calls" folder — that's the default unfiltered view of the Vault

### Recording-to-VaultEntry Migration
- **Approach:** Auto-migrate on deploy with offline/background backfill
- **Process:**
  1. Background migration: fathom_calls → recordings + vault_entries
  2. Dual-write during migration window
  3. Cut over UI only after migration is complete
- **Metadata preservation:** All preserved
  - Tags become `global_tags` on Recording
  - Folder assignments become `VaultEntry.folder_id`
- **Teams table:** Drop and rebuild — no production usage, start fresh with Bank/Vault structure
- **Each user's existing calls:** Become VaultEntries in their Personal Vault

### Claude's Discretion
- Exact migration script implementation details
- Technical approach to dual-write pattern
- How to identify and remove all coach-related code
- Database index optimization for new tables
- RLS policy implementation details

</decisions>

<specifics>
## Specific Ideas

- "Never silently auto-create a Business Bank" — users freak out when containers appear they didn't ask for
- "Business Banks are intentional" — only when user explicitly indicates "this is for my company/team/clients"
- High-intent triggers should show modal confirmation, not auto-create
- Personal Bank is "boring and predictable" — everyone has exactly one
- Keep one vault engine, one permission model, one AI flow — avoid "five products in one" syndrome
- Default-open folder visibility, then lock down exceptions — matches the main use cases
- Hall of Fame + Manager Reviews folders demonstrate folder purpose and visibility control

</specifics>

<deferred>
## Deferred Ideas

- **Coach-specific vault behavior:** Special folders, pre-configured AI Agents (future phase when coach type is activated)
- **Community-specific vault behavior:** Broadcast-only invites, member caps (future phase)
- **Client-specific vault behavior:** Agency workflows, per-client isolation (future phase)
- **SSO/auto-invite via company domain:** Captured in wizard but not implemented in Phase 9
- **AI Agent configuration per vault:** Vault types can have different default AI configs in future

</deferred>

---

*Phase: 09-bank-vault-architecture*
*Context gathered: 2026-01-31*
