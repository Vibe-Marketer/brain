---
status: resolved
trigger: "call-dialog-eliminated"
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:25:00Z
---

## Current Focus

hypothesis: RESOLVED
test: Fix implemented and ready for user testing
expecting: Dialog popup appears when clicking citations
next_action: User testing in browser

## Symptoms

expected: |
  When clicking citation source links in the "Sources" list in chat, OR when clicking "view meeting" inline citations,
  the same call dialog should popup that appears when clicking a call title on the main recordings/calls page.
  NOT a new panel, NOT a navigation to a new page, NOT opening a new browser window.
  JUST THE SAME POPUP DIALOG that exists on the main page.

actual: |
  The dialog was eliminated in Phase 02 gap closure (02-10-PLAN.md).
  Now it either opens a panel (Pane 4), navigates to a new page, or opens a new browser window.
  User says "the original popup dialog was fine" and wants it back.

errors: None - it's a UX behavior change, not an error

reproduction: |
  1. Go to /chat
  2. Ask the AI about your calls
  3. When response includes citation sources or "view meeting" links
  4. Click on any of those links
  5. Expected: Dialog popup
  6. Actual: Panel opens OR new page/window

started: |
  Phase 02 gap closure - specifically 02-10-PLAN.md which implemented CallDetailPanel
  to open in Pane 4 instead of dialog.

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:05:00Z
  checked: .planning/phases/02-chat-foundation/02-10-PLAN.md
  found: |
    Plan explicitly changed Chat.tsx handleViewCall from setShowCallDialog to openPanel('call-detail')
    Line 29: "handleViewCall uses openPanel instead of setShowCallDialog"
    Line 153: Changed from `setSelectedCall(callData); setShowCallDialog(true);` to `openPanel('call-detail', { recordingId });`
  implication: This was intentional change in Phase 02-10 to use panel instead of dialog

- timestamp: 2026-01-28T00:06:00Z
  checked: .planning/phases/02-chat-foundation/02-10-SUMMARY.md
  found: |
    Summary confirms the change was executed exactly as planned.
    Line 54: "Updated Chat.tsx handleViewCall to use openPanel('call-detail', { recordingId })"
    Line 81: "Chat.tsx +2, -23 Use openPanel instead of dialog"
  implication: The dialog was replaced with panel opening, this is what needs to be reverted

- timestamp: 2026-01-28T00:07:00Z
  checked: src/pages/Chat.tsx
  found: |
    Line 20: CallDetailDialog is still imported
    Line 371-372: State still exists (selectedCall, showCallDialog)
    Line 1281-1291: handleViewCall opens panel, not dialog
    Line 1975-1980: CallDetailDialog is still rendered at bottom but never opened
  implication: The dialog component is still there, just not being used. We need to restore the original behavior.

- timestamp: 2026-01-28T00:14:00Z
  checked: src/components/transcripts/TranscriptsTab.tsx
  found: |
    Line 86-87: Uses useState for selectedCall
    Line 624-631: Renders CallDetailDialog with open={!!selectedCall}
    Pattern: Dialog opens when selectedCall is set to a Meeting object, closes when set to null
  implication: This is the correct pattern - set selectedCall to the Meeting object, dialog auto-opens

## Resolution

root_cause: |
  Phase 02-10 (gap closure) changed Chat.tsx handleViewCall from opening a dialog to opening a panel in Pane 4.

  Original behavior (before Phase 02-10):
  1. handleViewCall was async
  2. Fetched call data from fathom_calls table
  3. Set selectedCall state with fetched Meeting object
  4. Set showCallDialog(true)
  5. Dialog auto-opened via open={showCallDialog} prop

  Changed behavior (Phase 02-10):
  1. handleViewCall called openPanel('call-detail', { recordingId })
  2. CallDetailPanel opened in Pane 4 and fetched data internally

  User feedback: "The original popup dialog was fine" - wants dialog back, not panel.

fix: |
  Reverted handleViewCall to original dialog-opening implementation:

  Changes to src/pages/Chat.tsx:
  1. Removed usePanelStore import (line ~71-73)
  2. Removed openPanel destructuring (line ~279-282)
  3. Restored async handleViewCall implementation (lines 1278-1316):
     - Fetch call data from fathom_calls table
     - Set selectedCall state with fetched data
     - Set showCallDialog(true) to open dialog
     - Added error handling with toast notifications

  The CallDetailDialog component was already present and rendered at the bottom of Chat.tsx,
  it just wasn't being opened. Now it opens correctly when clicking citation sources or
  "view meeting" links in chat.

verification: |
  Manual testing required:
  1. Navigate to http://localhost:8080/chat
  2. Ask a question that returns citations (e.g., "What did we discuss in recent calls?")
  3. Click on a citation source in the Sources list OR click a [view meeting] inline link
  4. EXPECTED: Dialog popup appears with call details
  5. EXPECTED: Dialog shows transcript, overview, actions
  6. EXPECTED: Can close dialog with X button
  7. EXPECTED: Dialog overlay dims background

  The dialog should be the SAME popup that appears on the main recordings page,
  NOT a side panel in Pane 4.

files_changed:
  - src/pages/Chat.tsx (removed usePanelStore import, restored async handleViewCall with dialog opening)
