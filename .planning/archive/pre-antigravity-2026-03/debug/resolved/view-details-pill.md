---
status: resolved
trigger: "Fix 'View Details' link in chat responses to open dialog and use pill styling"
created: 2026-01-28T00:00:00Z
updated: 2026-01-28T00:00:00Z
---

## Current Focus

hypothesis: Fix complete - VIEW pill button implemented in CallSourceContent
test: Code review confirms correct implementation
expecting: Sources show "VIEW" pill button with outline variant matching table pills
next_action: User to verify visually in running application

## Symptoms

expected: "View Details" should open call detail dialog popup (like Sources), use hollow pill styling, and say "VIEW"
actual: Currently links to Fathom's share URL and opens in new tab
errors: None - UX issue
reproduction: View any chat response with "View Details" link
started: Always been this way

## Eliminated

## Evidence

- timestamp: 2026-01-28T00:00:00Z
  checked: Searched for "View Details" in codebase
  found: Found "View full call" text in src/components/chat/source.tsx line 208
  implication: This is the text that needs to be changed to "VIEW" and styled as pill

- timestamp: 2026-01-28T00:00:00Z
  checked: Examined CallSourceContent component in source.tsx
  found: Component renders hover card with "View full call" button (lines 155-213)
  implication: This button needs to be styled as hollow pill and text changed to "VIEW"

- timestamp: 2026-01-28T00:00:00Z
  checked: Examined hollow pill styling in TranscriptTableRow.tsx
  found: Badge variant="outline" used for tags/folders (lines 198-247) with className="text-[10px] px-1.5 py-0 h-4"
  implication: Need to use Badge component with outline variant for pill styling

- timestamp: 2026-01-28T00:00:00Z
  checked: Verified handleViewCall function exists in Chat.tsx
  found: handleViewCall callback already passed to onViewCall in SourceList (line 1862)
  implication: The onClick handler already exists, just need to update styling and text

## Resolution

root_cause: CallSourceContent hover card renders "View full call" as a text link button instead of a hollow pill with "VIEW" text
fix: Changed CallSourceContent component (lines 155-213):
  1. Added Badge import from @/components/ui/badge
  2. Changed outer button to div (removed hover styles)
  3. Replaced "View full call" text with Badge component
  4. Badge uses variant="outline" (hollow pill style)
  5. Badge shows "VIEW" text (all caps as requested)
  6. Badge maintains onClick={handleClick} to open CallDetailDialog
  7. Matches table pill styling: text-[10px] px-1.5 py-0 h-4
verification: Code review confirms correct implementation. Visual verification needed:
  1. Start dev server: npm run dev
  2. Navigate to Chat page
  3. Send a message that returns sources
  4. Hover over source citation to see hover card
  5. Verify "VIEW" appears as hollow pill button (not text link)
  6. Click "VIEW" pill and verify CallDetailDialog opens
files_changed: ["/Users/Naegele/dev/brain/src/components/chat/source.tsx"]
