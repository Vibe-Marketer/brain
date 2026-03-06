---
phase: 02-chat-foundation
plan: 10
subsystem: chat-ui
tags: [panel, call-detail, ux, gap-closure]
dependency_graph:
  requires: [02-09]
  provides: [call-detail-panel, pane-4-call-routing]
  affects: []
tech_stack:
  added: []
  patterns: [detail-panel-outlet-routing, panel-store-integration]
key_files:
  created:
    - src/components/panels/CallDetailPanel.tsx
  modified:
    - src/components/layout/DetailPaneOutlet.tsx
    - src/pages/Chat.tsx
decisions:
  - id: read-only-panel
    choice: "CallDetailPanel is read-only view (no transcript editing)"
    reason: "Panel context is for quick reference, full editing stays in CallDetailDialog"
  - id: internal-data-fetch
    choice: "Panel fetches call data internally via recordingId prop"
    reason: "Matches FolderDetailPanel pattern, avoids prop drilling full Meeting object"
metrics:
  duration: 6m
  completed: 2026-01-28
---

# Phase 02 Plan 10: Call Detail Panel Summary

**One-liner:** Citation clicks now open call details in Pane 4 side panel instead of popup dialog.

## What Changed

### Task 1: Create CallDetailPanel.tsx
Created a new panel component (`578 lines`) that displays call details in the Pane 4 side panel format:

- **Header**: Call title, date, pin/close buttons (matching FolderDetailPanel pattern)
- **Quick Actions**: Chat with AI, View in Fathom, Copy Link buttons
- **Overview Tab**: Quick stats (date, duration, speakers, invitees), folders, auto-tags, summary
- **Transcript Tab**: Chat bubble display with host/participant distinction

Key differences from CallDetailDialog:
- Accepts `recordingId` prop instead of full `Meeting` object
- Fetches data internally using React Query
- No edit functionality (read-only view for quick reference)
- No modal dialogs (ChangeSpeaker, Trim, Resync)

### Task 2: Wire into DetailPaneOutlet and Chat.tsx
- Added `call-detail` case to DetailPaneOutlet switch statement
- Added ARIA label for accessibility
- Updated Chat.tsx `handleViewCall` to use `openPanel('call-detail', { recordingId })`
- Removed async fetch in handleViewCall - panel fetches internally

## Key Links Established

| From | To | Via |
|------|-----|-----|
| Chat.tsx | panelStore.openPanel | handleViewCall uses openPanel instead of setShowCallDialog |
| DetailPaneOutlet.tsx | CallDetailPanel | switch case renders CallDetailPanel with recordingId |

## Verification Results

- [x] `grep -n "case 'call-detail'" DetailPaneOutlet.tsx` shows lines 84, 107
- [x] `grep -n "openPanel.*call-detail" Chat.tsx` shows line 1291
- [x] `npx tsc --noEmit` passes clean
- [x] CallDetailPanel.tsx has 578 lines (> 100 min_lines)

## Deviations from Plan

None - plan executed exactly as written.

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| src/components/panels/CallDetailPanel.tsx | +578 | Created panel component |
| src/components/layout/DetailPaneOutlet.tsx | +8 | Added call-detail case |
| src/pages/Chat.tsx | +2, -23 | Use openPanel instead of dialog |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 5be44a7 | feat | Create CallDetailPanel for Pane 4 call details |
| 78163bf | fix | (bundled) Wire CallDetailPanel into DetailPaneOutlet and Chat.tsx |

Note: Task 2 changes were bundled with an unrelated commit about date picker UX. The changes are correct but commit message doesn't reflect the call detail panel wiring.

## Next Phase Readiness

**Gap 1 CLOSED**: Citation sources now open call details in Pane 4 side panel.

Remaining gaps from UAT:
- Gap 2: Network error toast notifications (addressed in 02-12)
- Gap 3: Recording ID hallucination (addressed in 02-11)
