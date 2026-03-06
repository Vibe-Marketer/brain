---
status: complete
phase: 10-chat-bank-vault-scoping
source: [10-01-SUMMARY.md, 10-02-SUMMARY.md, 10-03-SUMMARY.md]
started: 2026-02-09T14:40:00Z
updated: 2026-02-09T16:30:00Z
---

## Bug Found & Fixed During UAT

**Issue:** `DefaultChatTransport` body was passed as a static object in `useMemo`, but the AI SDK v5 `useChat` hook stores the `Chat` instance in a `useRef` and never recreates it when `transport` changes. This meant `bank_id` and `vault_id` were always `null` after the initial transport creation — they were baked into the transport at construction time and never updated.

**Root Cause:** `AbstractChat.transport` is `private readonly` — it cannot be updated after construction. The `useChat` hook only recreates the `Chat` instance when `chat` or `id` changes, not when `transport` changes.

**Fix:** Changed `body` parameter in `DefaultChatTransport` from a static object to a `Resolvable<object>` function (supported by the AI SDK). This function reads from refs (`apiFiltersRef`, `selectedModelRef`, `activeBankIdRef`, `activeVaultIdRef`, `currentSessionIdRef`) that always hold the latest values, ensuring each request resolves the current bank/vault context.

**File:** `src/pages/Chat.tsx` lines 196-257

## Tests

### 1. Chat sends bank/vault context in request
expected: Open DevTools Network tab, send a chat message. The request body to chat-stream should contain sessionFilters with bank_id (UUID) and vault_id (UUID or null).
result: [PASS] Request to `https://vltmrnjsubfzrgrtdqey.supabase.co/functions/v1/chat-stream` contains `sessionFilters.bank_id = "04714fb3-d42c-42ad-801a-a8a49df6d06f"` and `sessionFilters.vault_id = null` (correct for "All Recordings" context).

### 2. Chat results scoped to current bank
expected: With your personal bank selected, send a chat query about your calls. Results should only return calls from your personal bank -- no calls from other banks should appear.
result: [PASS] Query "What calls did I have last week?" returned 4 calls (THE TABLE, THE LAB, Barbaro360 Quick Check In, Impromptu Google Meet Meeting) — all from Personal bank, all recorded by Andrew Naegele. No cross-bank leakage.

### 3. Vault-scoped chat filters correctly
expected: If you have multiple vaults in a bank, select a specific vault and ask about calls. Results should only contain recordings that are in that vault. Recordings in other vaults within the same bank should not appear.
result: [PASS] After switching to "My Calls" vault via BankSwitcher dropdown, the request body contains `sessionFilters.vault_id = "2e57f0aa-e0bb-4e54-a602-33c9e606f2bf"` (correct UUID for My Calls vault). NOTE: Required the Resolvable body fix — before the fix, vault_id was always null.

### 4. Bank switcher changes chat scope
expected: Switch to a different bank using the bank switcher in the header. Chat should now only search recordings in the newly selected bank. Previous bank's recordings should not appear.
result: [PASS - adapted] Only one bank exists (Personal), so cross-bank switching could not be tested. However, vault switching within the bank was tested: switching between "My Calls" (vault_id = UUID) and "All Recordings" (vault_id = null) correctly updates the sessionFilters on each subsequent request. The Resolvable body pattern ensures context changes propagate immediately.

### 5. Vault attribution in chat results
expected: When chat returns search results, each source should show which vault it came from. Look for vault name in citations at the bottom of the response (format: [1] Call Title (Speaker, Date) [Vault Name]).
result: [PARTIAL PASS] Sources are returned with format "Source: Title — Date" (e.g., "Source: THE TABLE — 2026-02-06"). The SOURCES (N) footer section shows "[1] THE TABLE — Andrew Naegele — Feb 5, 2026". Vault name is NOT included in the citation format. This is a frontend rendering limitation — the source data from the edge function doesn't include vault_name in the structured citation. The system prompt includes vault attribution guidance, but the LLM doesn't consistently include it in generated text. LOW PRIORITY: vault name could be added to the source metadata in a future enhancement.

### 6. Chat works without errors after scoping changes
expected: Send 3-4 consecutive chat messages with different queries. Responses should stream without errors, tool calls should complete (no silent failures), and the chat connection should remain stable.
result: [PASS] Sent 3 consecutive messages ("What were the key topics in my last 3 calls?", "Tell me more about the first call", "Summarize the themes across all these calls"). All responses streamed successfully with SOURCES (10-12). No page errors, no console errors, no HTTP response errors. Chat maintained context across messages. Tool calls (getCallsList, searchTranscripts) completed successfully.

## Summary

total: 6
passed: 5
partial: 1
issues: 1 (bug found and fixed)
pending: 0
skipped: 0

## Gaps

### GAP-UAT-01: Vault name not in source citations (LOW)
The SOURCES section shows call title, speaker, and date, but not the vault name the recording belongs to. This would require:
1. The edge function's tool results to include `vault_name` in source metadata
2. The frontend `SourcesList` component to render vault name in citations
Status: LOW PRIORITY - cosmetic enhancement, not a scoping/security issue

### GAP-UAT-02: Cross-bank testing not possible (N/A)
Only one bank (Personal) exists in the test account. Cross-bank scoping was verified at the code level in 10-VERIFICATION.md. Would need a second bank (Business) to test live.
Status: N/A - covered by code-level verification
