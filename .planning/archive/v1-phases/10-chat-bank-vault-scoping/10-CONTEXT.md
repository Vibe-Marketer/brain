# Phase 10: Chat Bank/Vault Scoping - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Chat searches respect active bank/vault context for proper multi-tenant isolation. This closes the integration gap where chat currently searches ALL user recordings instead of respecting the Bank/Vault architecture from Phase 9.

</domain>

<decisions>
## Implementation Decisions

### Vault vs Bank Scoping
- **Vault-selected mode:** Chat only sees VaultEntries in the currently selected vault
- **Bank-level mode (no vault selected):** Chat searches union of VaultEntries in vaults where user has VaultMembership
- **Visibility always governed by VaultMembership:** BankMembership alone does not expose recordings; user must have VaultMembership to see vault content
- **Folder filters scope within current vault:** Folder filter applies to the already-selected vault, not across vaults

### Context Switching Behavior
- **Bank switch:** Ends visible conversation for old Bank, shows chat history for new Bank. Chat sessions are bank-scoped.
- **Vault switch (same bank):** Clears chat. New vault = new conversation context.
- **Session storage:** Chat sessions stored per Bank. Each session has an explicit included vault set.
- **Default scope:** Bank-level chat includes all vaults where user has VaultMembership by default.
- **Scope modification:** Users can add/remove vaults from the included set. System tracks included vaults; exclusion is a UI affordance.

### Cross-Vault Search
- **Vault selection UX:** Same pattern as existing filter options in chat header. Vaults appear as filter chips alongside other filters.
- **Selector visibility:** Always in chat header (persistent vault scope indicator)
- **Quick scope toggle:** Claude's discretion on whether "all vaults" vs "current vault only" toggle adds value
- **Result attribution:** Show vault badge on results (gray subtle badge with vault name)
- **Single-vault badges:** Yes, show vault badge even in single-vault mode for consistency

### Scoping Indicators
- **Header content:** Match existing filter pattern (chip/pill pattern as current filters)
- **No-vaults state:** N/A - bank controls chat, vaults are additive context layers. Chat always works at bank level.

### Architectural Principle
**"All access (UI, search, chat, AI) is governed by VaultMembership; there is no hidden bypass."**

- Bank = outer tenant wall (must have BankMembership to access bank at all)
- Vault = sellable knowledge container (must have VaultMembership to access vault content)
- Chat = searches across vaults user has membership in, within current bank
- This enables vault monetization: sell VaultMembership as access to knowledge products

### Out-of-Scope Query Response
- Treat as "not found" - no hints about scope or suggestions to switch vaults

### Claude's Discretion
- Whether to add a quick "all vaults" vs "current vault only" toggle
- Loading states and skeleton design
- Exact filter chip layout and ordering
- Error state messaging

</decisions>

<specifics>
## Specific Ideas

- "Chat should only see VaultEntries in the currently selected Vault" - tight mental model where vault = AI knowledgebase
- Bank-level chat is "ask anything about this company/account" experience - union of accessible vaults
- Vault scope as filter chips in chat header (same pattern as existing filters)
- Gray subtle badge on results showing source vault
- Include-based filter model: system tracks included vaults, UI may present as "hiding" or "excluding" but underlying model is always include-based
- Monetization path: VaultMembership is the primitive you can sell (Coach Vault, Community Vault, Client Vaults)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 10-chat-bank-vault-scoping*
*Context gathered: 2026-01-31*
