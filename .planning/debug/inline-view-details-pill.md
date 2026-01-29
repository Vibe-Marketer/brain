---
status: verifying
trigger: "Fix inline 'View Details' links in chat AI responses to be hollow pill buttons that open the dialog."
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:07:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED - AI generates [View Details](recording_id) links, markdown.tsx renders all links as anchors. Solution: intercept "View Details" links, extract recording_id, render as Badge pill, wire to handleViewCall.
test: Implement onViewCall prop chain and conditional rendering in link component
expecting: "View Details" links become hollow "VIEW" pills that open CallDetailDialog
next_action: Implement fix in markdown.tsx, message.tsx, and Chat.tsx

## Symptoms

expected: "View Details" inline links should be hollow pill buttons labeled "VIEW" that open CallDetailDialog
actual: Currently rendered as underlined text links that navigate away
errors: None
reproduction: AI generates responses with "View Details" links after Key Takeaways
started: Current behavior - needs enhancement

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:01:00Z
  checked: message.tsx and markdown.tsx
  found: Markdown component uses ReactMarkdown with custom link component (a tag) at line 48-58
  implication: Custom link handler already exists - need to intercept "View Details" links specifically

- timestamp: 2026-01-28T00:02:00Z
  checked: markdown.tsx link component
  found: Links rendered with target="_blank", underlined, navigates to href
  implication: Need to check href content and conditionally render as pill button instead of link

- timestamp: 2026-01-28T00:03:00Z
  checked: chat-stream-v2 system prompt (lines 91-166)
  found: System prompt does NOT instruct AI to generate "View Details" links - only citation markers [N] and sources list
  implication: The "View Details" links might be added by a post-processing step OR the AI is generating them without explicit instruction

- timestamp: 2026-01-28T00:04:00Z
  checked: Chat.tsx usage of CallDetailDialog
  found: handleViewCall function (line 1279) accepts recordingId number, fetches call data, opens dialog
  implication: Need to pass this handler to markdown component and call it when "View Details" is clicked

- timestamp: 2026-01-28T00:05:00Z
  checked: AssistantMessage component in message.tsx
  found: Already accepts onCitationClick prop, passes to MarkdownWithCitations
  implication: Need similar pattern - add onViewCall prop that gets passed to Markdown component

## Resolution

root_cause: AI generates markdown links like [View Details](recording_id) or [View Details](fathom-url). The custom link component in markdown.tsx renders these as underlined external links. Need to intercept links with "View Details" text and render as hollow pill buttons that trigger handleViewCall.

fix:
1. ✅ Added onViewCall prop to Markdown component
2. ✅ Created extractRecordingId helper to parse IDs from hrefs (supports numeric IDs and Fathom URLs)
3. ✅ Modified link component to detect "View Details" text (case-insensitive)
4. ✅ Render Badge variant="outline" with "VIEW" text instead of anchor tag
5. ✅ Wire up onClick to call onViewCall(recording_id)
6. ✅ Passed handleViewCall from Chat.tsx → AssistantMessage → Markdown

verification: Testing with dev server
files_changed:
- src/components/chat/markdown.tsx (added onViewCall prop, extractRecordingId helper, conditional link rendering)
- src/components/chat/message.tsx (added onViewCall to MessageContent and AssistantMessage interfaces and implementations)
- src/pages/Chat.tsx (passed handleViewCall as onViewCall prop to AssistantMessage)
