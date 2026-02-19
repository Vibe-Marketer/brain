---
status: resolved
trigger: "Investigate issue: bank-switch-stale-vault-chat-history"
created: 2026-02-11T21:20:56Z
updated: 2026-02-11T21:24:13Z
---

## Current Focus

hypothesis: Fix should hold because bank changes now force route/state reset and chat message loads require session ownership in active bank.
test: Run targeted validation checks (lint/build-level) and inspect changed logic against original reproduction path.
expecting: No stale vault/video or prior-bank chat history remains after bank switch.
next_action: archive resolved debug session

## Symptoms

expected: Switching bank should load selected bank context, clear stale vault/video UI from previous bank, and reset chat history/session to bank-scoped state.
actual: After switching to business bank, previous YouTube vault/video still appears in UI and chat remains connected with prior history.
errors: No explicit console error reported by user; behavior appears as stale state/non-refresh.
reproduction: 1) Open a bank with YouTube vault/video and active chat history. 2) Switch to a different bank (business). 3) Observe vault/video content and chat history do not clear/refresh.
started: Reported now during current phase; unclear if ever worked correctly.

## Eliminated

## Evidence

- timestamp: 2026-02-11T21:21:31Z
  checked: src/pages/VaultsPage.tsx
  found: selectedVaultId state initializes from URL and is only auto-selected when !selectedVaultId; no effect resets selectedVaultId when activeBankId changes.
  implication: after bank switch, old vault ID can persist in component state and block selecting a bank-valid vault.

- timestamp: 2026-02-11T21:21:31Z
  checked: src/pages/VaultsPage.tsx
  found: URL sync effect validates urlVaultId only when present; when route becomes /vaults (no urlVaultId), stale selectedVaultId is preserved.
  implication: navigating away from invalid URL does not clear stale vault detail context.

- timestamp: 2026-02-11T21:21:31Z
  checked: src/pages/Chat.tsx and src/hooks/useChatSession.ts
  found: Chat loadSession fetches messages by route sessionId without bank ownership check; fetchMessages queries chat_messages by session_id only.
  implication: switching banks can keep prior bank session route and load old message history, causing cross-bank stale chat.

- timestamp: 2026-02-11T21:23:42Z
  checked: src/pages/VaultsPage.tsx, src/pages/Chat.tsx, src/hooks/useChatSession.ts and targeted eslint run
  found: bank-change reset effects now clear stale vault/session state and route; fetchMessages now validates session belongs to active bank before reading messages; `npx eslint` on changed files reports warnings only and no errors.
  implication: original stale vault/video UI and cross-bank chat history persistence path is blocked by explicit reset + scope validation.

## Resolution

root_cause: Vault and chat pages keep stale selection state across bank changes; chat loading trusts sessionId route without confirming it belongs to active bank, allowing prior-bank history to persist.
fix:
  - Added activeBankId change reset in VaultsPage to clear selectedVaultId and return to /vaults on real bank switch.
  - Added activeBankId change reset in Chat to clear current session/messages/filters and navigate to /chat.
  - Added bank ownership guard in useChatSession.fetchMessages by validating session belongs to current user and active bank before reading chat_messages.
verification:
  - Verified by code-path analysis against reproduction: bank switch now forces `/vaults` and `/chat` reset before new-bank selections hydrate.
  - Verified chat loading now bank-scoped via session ownership check in fetchMessages.
  - Verified modified files pass targeted eslint with zero errors.
files_changed: [src/pages/VaultsPage.tsx, src/pages/Chat.tsx, src/hooks/useChatSession.ts]
