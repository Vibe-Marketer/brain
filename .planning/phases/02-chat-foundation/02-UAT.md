---
status: testing
phase: 02-chat-foundation
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md, 02-08-SUMMARY.md, 02-09-SUMMARY.md
started: 2026-01-28T07:00:00Z
updated: 2026-01-28T16:10:00Z
---

## Current Test

number: 1
name: Send Chat Message and Receive Response
expected: |
  Go to /chat. Type a question about your calls (e.g., "What calls do I have?") and send.
  The message streams in progressively, completing without errors.
  You see a full response from the AI.
awaiting: user response

## Tests

### 1. Send Chat Message and Receive Response
expected: Go to /chat. Type a question about your calls (e.g., "What calls do I have?") and send. The message streams in progressively, completing without errors. You see a full response from the AI.
result: issue
reported: "non-stop failures - Failed to fetch (vltmrnjsubfzrgrtdqey.supabase.co) - POST to /functions/v1/chat-stream-v2 fails after 129ms with 281 repeated errors in 8 seconds"
severity: blocker

### 2. Tool Calls Fire and Show Results
expected: Ask a question that requires searching your calls (e.g., "What did we discuss about pricing in recent calls?"). You see tool call indicators appearing during response. Tools show results count (e.g., "Searched Transcripts (3 results)") — not just a spinner or empty checkmark.
result: [pending]

### 3. Tool Call Three-State Display
expected: Tools that find data show green checkmark with result count. Tools that find nothing show amber indicator with "0 results". If a tool fails, it shows red indicator with "Failed". You can distinguish between success, empty, and error.
result: [pending]

### 4. Inline Citations with Hover Preview
expected: Ask about specific content in your calls. The AI response includes numbered citations like [1], [2] inline in the text. Hover over a citation number — a tooltip shows call title, speaker, date, and snippet from that source.
result: [pending]

### 5. Source List at Bottom of Message
expected: Messages with citations show a "Sources" section at the bottom listing all referenced calls. Clicking a source opens the call detail view.
result: [pending]

### 6. Store Error Toast Notifications
expected: If a store operation fails (e.g., saving content, deleting item), a toast notification appears with an error message like "Couldn't save item. Please try again." — errors are not silent.
result: [pending]

### 7. Chat Connection Stability
expected: Send 5+ consecutive messages in the same session. The chat remains stable without disconnections or requiring page refresh.
result: [pending]

### 8. Streaming Error Recovery
expected: If streaming is interrupted (simulate by briefly losing network), you see: (1) partial response preserved with "Incomplete response" indicator, (2) toast notification with retry action, (3) inline retry button below the incomplete message.
result: [pending]

## Summary

total: 8
passed: 0
issues: 1
pending: 7
skipped: 0

## Gaps

- truth: "Chat sends message and receives streamed response"
  status: failed
  reason: "User reported: non-stop failures - Failed to fetch (vltmrnjsubfzrgrtdqey.supabase.co) - POST to /functions/v1/chat-stream-v2 fails after 129ms with 281 repeated errors in 8 seconds"
  severity: blocker
  test: 1
  root_cause: "chat-stream-v2 Edge Function exists locally but was never deployed to Supabase. Function created 2026-01-28, last deployment 2026-01-14."
  artifacts:
    - path: "supabase/functions/chat-stream-v2/index.ts"
      issue: "Function exists locally (39KB) but not deployed"
  missing:
    - "Deploy chat-stream-v2 to Supabase with: supabase functions deploy chat-stream-v2"
  debug_session: ""
