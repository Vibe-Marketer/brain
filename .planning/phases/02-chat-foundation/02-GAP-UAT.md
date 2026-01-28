---
status: complete
phase: 02-chat-foundation
source: 02-10-SUMMARY.md, 02-11-SUMMARY.md, 02-12-SUMMARY.md
started: 2026-01-28T22:00:00Z
updated: 2026-01-28T23:05:00Z
---

## Current Test

[TESTING COMPLETE]

All 4 tests executed. 1 passed, 3 issues found (2 blockers, 1 major).

## Tests

### 1. Call Detail Panel Opens in Pane 4
expected: In chat, click on a call title/citation link from a previous response. The call details open in the right-side Pane 4 panel (NOT in a popup/modal dialog).
result: issue
reported: "it doesn't open the 4th pane. ALSO clicking on the 'here' link at end of answer opens a new window instead of opening the 4th pane. The original popup dialog was fine - don't know why it was changed."
severity: major

### 2. Model Uses Real Recording IDs
expected: Ask the chat about your calls (e.g., "Tell me about my recent calls"). When the model calls getCallDetails, it uses actual recording_ids from search results (UUIDs like "abc123-def456...") — NOT fabricated IDs like 1, 2, 3. You should NOT see "Call not found" errors in the tool results.
result: pass
note: Model returned real recording_ids (116777566, 116742156) from search results. No "Call not found" errors.

### 3. Error Toast on Network Interruption
expected: Briefly disable network (WiFi off, or airplane mode for 5 seconds) while chat is streaming a response. You see a toast notification like "Connection interrupted" or similar — errors are NOT silent.
result: issue
reported: "FAIL - rapidly flickering, no toast notification. Retry causes infinite error loop, sent multiple retries, duplicate messages in chat, browser froze. 500+ errors: 'Encountered two children with same key'. Same message appears multiple times."
severity: blocker

### 4. No Console Spam on Network Errors
expected: With browser DevTools console open, disconnect network during a chat response. Console errors are throttled (not 500+ errors per second). You may see a few errors, but they should NOT flood rapidly.
result: issue
reported: "Console flooded with reconnect attempts in runaway loop: 'Streaming interrupted, attempting reconnect 1/3 in 1000ms' repeating endlessly. 'Max reconnect attempts reached' fires but immediately retries again. Plus duplicate key React errors. throttledErrorLog not working."
severity: blocker

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Call detail panel opens in Pane 4 when clicking citation links"
  status: failed
  reason: "User reported: doesn't open the 4th pane. 'here' link opens new window. Original popup dialog was fine."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Toast notification appears on network interruption during streaming"
  status: failed
  reason: "User reported: No toast, rapidly flickering UI, retry causes infinite error loop with 500+ 'same key' errors, duplicate messages, browser freeze"
  severity: blocker
  test: 3
  artifacts:
    - path: "src/pages/Chat.tsx"
      issue: "Retry mechanism causes runaway loop and duplicate messages"
    - path: "src/components/chat/chat-container.tsx:81"
      issue: "React key collision - duplicate message IDs"
  missing:
    - "Proper debouncing/circuit breaker on retry"
    - "Toast notification on first interruption"
    - "Prevent duplicate messages on retry"

- truth: "Console errors are throttled during network issues"
  status: failed
  reason: "User reported: Console flooded with reconnect attempts in runaway loop. 'Max reconnect attempts reached' fires but immediately retries again. throttledErrorLog not working."
  severity: blocker
  test: 4
  artifacts:
    - path: "src/pages/Chat.tsx"
      issue: "Reconnect loop doesn't stop after max attempts"
    - path: "logger.ts:27"
      issue: "throttledErrorLog may not be applied to reconnect logs"
  missing:
    - "Circuit breaker to stop reconnect loop after max attempts"
    - "Apply throttling to all reconnect/error logging"
