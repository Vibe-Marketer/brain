---
status: diagnosed
phase: 02-chat-foundation
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md
started: 2026-01-28T07:00:00Z
updated: 2026-01-28T16:15:00Z
---

## Current Test

TESTING COMPLETE

All 8 tests executed. See summary below.

## Tests

### 1. Send Chat Message and Receive Response
expected: Go to /chat. Type a question about your calls (e.g., "What calls do I have?") and send. The message streams in progressively, completing without errors. You see a full response from the AI.
result: pass (with legacy endpoint)
note: |
  PASSED after switching to legacy chat-stream endpoint.
  Data/indexing issues found (separate from chat UI):
  - Date calculation wrong: Model sent 2023-07-28 instead of 2025-07-28 (thinks it's 2024)
  - Intent signal search returns 0 results (intent_signals not indexed)
  - Sentiment search returns 0 results (sentiment not indexed)
  - Speaker search for non-primary speakers returns 0 (Ray Langdon, Caleb not found)
  - Low relevance results (2%) with garbage/transcription errors
  These are DATA ISSUES tracked separately from Phase 2 Chat UI.

### 2. Tool Calls Fire and Show Results
expected: Ask a question that requires searching your calls (e.g., "What did we discuss about pricing in recent calls?"). You see tool call indicators appearing during response. Tools show results count (e.g., "Searched Transcripts (3 results)") — not just a spinner or empty checkmark.
result: pass

### 3. Tool Call Three-State Display
expected: Tools that find data show green checkmark with result count. Tools that find nothing show amber indicator with "0 results". If a tool fails, it shows red indicator with "Failed". You can distinguish between success, empty, and error.
result: pass
note: |
  All three states verified:
  - Green checkmarks: success with result count
  - Amber triangles: 0 results
  - Red circle with "Failed": error state (seen when getCallDetails returns "Call not found")

  BUG FOUND: Model sends wrong recording_ids (1, 2) instead of real IDs from search results.
  This is a model/prompt issue - it should use actual recording_ids from tool results.

### 4. Inline Citations with Hover Preview
expected: Ask about specific content in your calls. The AI response includes numbered citations like [1], [2] inline in the text. Hover over a citation number — a tooltip shows call title, speaker, date, and snippet from that source.
result: FAIL
note: |
  TWO ISSUES FOUND:

  1. MODEL OUTPUT FORMAT CHANGED
     - BEFORE: AI included "Listen Here" links inline after each call reference
     - NOW: Only underlined call titles, no action links
     - Root cause: Model decides response format based on system prompt
     - Fix needed: Update system prompt to instruct model to include inline action links

  2. CALL LINKS OPEN IN POPUP DIALOG INSTEAD OF PANEL
     - Clicking call title opens CallDetailDialog (modal popup)
     - User expects it to open in Pane 4 (detail panel) like other items
     - Root cause: No CallDetailPanel exists - only CallDetailDialog
     - DetailPaneOutlet.tsx doesn't support 'call-detail' panel type
     - Fix needed: Create CallDetailPanel component and wire up panel store

  ARCHITECTURAL GAP:
  - DetailPaneOutlet only supports: folder-detail, tag-detail, setting-help, user-detail
  - 'call-detail' panel type is defined in panelStore but never implemented
  - Need to create src/components/panels/CallDetailPanel.tsx
  - Then add case to DetailPaneOutlet.tsx
  - Then change Chat.tsx to use openPanel('call-detail', { recordingId }) instead of dialog

### 5. Source List at Bottom of Message
expected: Messages with citations show a "Sources" section at the bottom listing all referenced calls. Clicking a source opens the call detail view.
result: pass
note: Sources section appears and lists calls. Clicking opens call details (via popup dialog - panel behavior tracked in Test 4 gap).

### 6. Store Error Toast Notifications
expected: If a store operation fails (e.g., saving content, deleting item), a toast notification appears with an error message like "Couldn't save item. Please try again." — errors are not silent.
result: FAIL
note: |
  Network disconnection test: No toast shown when operations fail.
  - Save operation silently failed with no user feedback
  - Console shows errors but no toast notification appears
  - Errors logged: "Failed to fetch", "Error checking AI jobs TypeError: Failed to fetch"

  Root cause: Error handling logs to console but doesn't trigger toast.
  Fix needed: Add toast.error() calls in catch blocks throughout stores/hooks.

### 7. Chat Connection Stability
expected: Send 5+ consecutive messages in the same session. The chat remains stable without disconnections or requiring page refresh.
result: pass
note: |
  Chat stable across 5+ messages, model switching, and continued sessions.
  No disconnections or crashes observed.

  BUG FOUND DURING TEST: Model hallucinates recording_ids (sends 1, 2 instead of real IDs)
  - getCallDetails called with recording_id: 1, 2 → "Call not found"
  - Model should use actual recording_ids from search results, not made-up numbers

### 8. Streaming Error Recovery
expected: If streaming is interrupted (simulate by briefly losing network), you see: (1) partial response preserved with "Incomplete response" indicator, (2) toast notification with retry action, (3) inline retry button below the incomplete message.
result: partial pass
note: |
  WORKING:
  - "Incomplete response" indicator shown ✓
  - Inline "Retry" button shown ✓
  - Sources section preserved ✓

  ISSUES:
  - Console error spam: 500+ errors in seconds ("network error" runaway loop)
    → Needs debouncing/throttling on error logging
  - Partial response LOST when WiFi restored (not persisted to DB)
    → Should save incomplete response so retry can continue
  - No toast notification (same root cause as Test 6)

## Summary

total: 8
passed: 5
partial: 1
failed: 2
pending: 0
skipped: 0

### Results Overview
| Test | Name | Result |
|------|------|--------|
| 1 | Send Chat Message | ✓ Pass |
| 2 | Tool Calls Fire | ✓ Pass |
| 3 | Three-State Display | ✓ Pass |
| 4 | Inline Citations | ✗ FAIL |
| 5 | Source List | ✓ Pass |
| 6 | Error Toasts | ✗ FAIL |
| 7 | Connection Stability | ✓ Pass |
| 8 | Streaming Recovery | ◐ Partial |

### Issues Requiring Fixes

1. **Test 4 - Call Detail Panel Missing**
   - Links open in popup dialog instead of Pane 4
   - Need to create CallDetailPanel component
   - Inline "Listen Here" links gone from model output

2. **Test 6 - No Error Toast Notifications**
   - Store errors logged to console but no user feedback
   - Need toast.error() calls in catch blocks

3. **Test 8 - Streaming Error Handling**
   - Console error spam (500+ errors, needs debouncing)
   - Partial response lost on reconnect (not persisted)

4. **Bug - Model Hallucinates Recording IDs**
   - getCallDetails called with recording_id: 1, 2 instead of real IDs
   - Model should use actual IDs from search results

## Gaps

- truth: "Chat sends message and receives streamed response"
  status: failed
  reason: "User reported: non-stop failures - chat-stream-v2 not deployed initially, then 'Provider returned error' after deployment"
  severity: blocker
  test: 1
  root_cause: |
    TWO ISSUES FOUND:

    1. DEPLOYMENT GAP (FIXED): chat-stream-v2 was never deployed to Supabase.
       - Function existed locally (39KB) but not in production
       - Fixed by running: supabase functions deploy chat-stream-v2
       - Now deployed as v2

    2. AI SDK/OPENROUTER ERROR (INVESTIGATING): After deployment, "Provider returned error"
       - Error is generic - AI SDK wrapping an OpenRouter API error
       - Legacy chat-stream explicitly bypasses AI SDK due to known zod bundling issues:
         "The AI SDK has zod bundling issues with esm.sh that cause 'safeParseAsync is not a function' errors when tool calls are returned"
       - v2 uses: ai@5.0.102, @openrouter/ai-sdk-provider@1.2.8, zod@3.23.8
       - Working generate-ai-titles uses generateText (no tools), not streamText with tools

    ENHANCED LOGGING DEPLOYED: Added detailed error logging to chat-stream-v2/index.ts
    to capture actual error from OpenRouter/AI SDK. Retest needed.
  artifacts:
    - path: "supabase/functions/chat-stream-v2/index.ts"
      issue: "AI SDK streamText + tool on Deno/esm.sh may have bundling issues"
    - path: "supabase/functions/chat-stream-legacy/index.ts"
      issue: "Legacy function works but bypasses AI SDK entirely - uses direct OpenAI fetch"
    - path: "src/pages/Chat.tsx:270"
      issue: "chatEndpoint hardcoded to 'chat-stream-v2'"
  missing:
    - "Check Supabase dashboard logs for detailed error: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions"
    - "Retest chat after enhanced logging deployment"
    - "If AI SDK bundling is the issue, may need to rewrite v2 to use direct API calls like legacy"
  debug_session: ""

- truth: "Clicking sources opens call details in panel (not popup)"
  status: failed
  reason: "User reported: call links open in popup dialog instead of side panel; 'Listen Here' inline links are gone"
  severity: major
  test: 4
  root_cause: |
    TWO ISSUES:

    1. INLINE ACTION LINKS MISSING
       - BEFORE: Model output included "Listen Here" links inline
       - NOW: Only underlined call titles (model response format changed)
       - May be model variation or system prompt issue

    2. POPUP VS PANEL ARCHITECTURE
       - CallDetailDialog (popup) is the only implementation
       - No CallDetailPanel exists for Pane 4
       - DetailPaneOutlet.tsx only supports: folder-detail, tag-detail, setting-help, user-detail
       - 'call-detail' type is in panelStore but never wired up

  artifacts:
    - path: "src/components/CallDetailDialog.tsx"
      issue: "Only exists as Dialog - needs Panel version for Pane 4"
    - path: "src/components/layout/DetailPaneOutlet.tsx"
      issue: "Missing 'call-detail' case"
    - path: "src/stores/panelStore.ts"
      issue: "Has 'call-detail' type but nothing renders it"
    - path: "src/pages/Chat.tsx"
      issue: "Uses setSelectedCall/setShowCallDialog instead of openPanel"

  fix_required:
    - "Create src/components/panels/CallDetailPanel.tsx (extract from Dialog)"
    - "Add 'call-detail' case to DetailPaneOutlet.tsx"
    - "Change Chat.tsx to use openPanel('call-detail', { recordingId })"
    - "Consider system prompt update for inline action links"

## Investigation Notes

### Timeline
1. Initial test: "Failed to fetch" - function not deployed
2. Deployed chat-stream-v2: `supabase functions deploy chat-stream-v2`
3. Second test: "Provider returned error" - function runs but OpenRouter/AI SDK fails
4. Added enhanced error logging to capture actual error
5. Redeployed with logging - error still generic on client (logs are server-side)
6. **TEMPORARY FIX**: Switched src/pages/Chat.tsx to use 'chat-stream' (legacy) to unblock UAT
   - Edit at line 270: `const chatEndpoint = 'chat-stream';`
   - Legacy endpoint works (bypasses AI SDK, uses direct OpenAI API)

### Key Files
- `supabase/functions/chat-stream-v2/index.ts` - New AI SDK backend (855 lines)
- `supabase/functions/chat-stream-legacy/index.ts` - Working legacy (direct OpenAI API)
- `src/pages/Chat.tsx:270` - Endpoint selection (`const chatEndpoint = 'chat-stream-v2'`)

### Potential Fixes
1. **Quick fix**: Switch chatEndpoint back to 'chat-stream' (legacy works) ✅ APPLIED
2. **Proper fix**: Diagnose AI SDK error via logs, fix the v2 implementation → DEFERRED
3. **Alternative**: Rewrite v2 to use direct OpenRouter API like legacy does with OpenAI

### V2 Fix Deferred
The AI SDK + Deno + esm.sh bundling issue needs investigation via Supabase function logs.
This is tracked as technical debt - legacy endpoint works for UAT.
To fix v2 later:
1. Check logs: https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions
2. Look for the detailed error output from enhanced logging
3. Fix based on actual error (likely zod/bundling or OpenRouter request format)
4. Switch Chat.tsx back to 'chat-stream-v2' when fixed

### Commands to Resume
```bash
# Check function logs in Supabase dashboard
open https://supabase.com/dashboard/project/vltmrnjsubfzrgrtdqey/functions

# If need to switch to legacy temporarily:
# Edit src/pages/Chat.tsx line 270: const chatEndpoint = 'chat-stream';

# Redeploy after fixes:
supabase functions deploy chat-stream-v2
```
