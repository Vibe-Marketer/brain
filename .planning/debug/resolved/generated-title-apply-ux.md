---
status: resolved
trigger: "Generated/new meeting titles should have a popup or option to replace the original meeting title with one click, or use the generated title as a starting point and edit it before applying."
created: 2026-06-05
updated: 2026-06-05
---

## Symptoms

- Expected behavior: When CallVault generates or detects a better meeting title, the user should be able to apply it to the original meeting title with a simple click, or edit that suggestion before applying.
- Actual behavior: Generated/new title information exists in parts of the app, but there is no obvious apply/edit-from-suggestion path.
- Error messages: None reported.
- Timeline: Reported after title-generation and provider-refresh work.
- Reproduction: Generate or encounter a suggested/new meeting title, then try to replace the current meeting title from that suggestion.

## Current Focus

- hypothesis: The title generation and remote-title flows expose suggested titles as information only, while the existing call title update mutation is not wired into a suggestion-apply dialog/action.
- test: Trace generate-ai-titles, call detail title editing, and remote title change UI for missing mutation wiring.
- expecting: A missing UI affordance and/or missing bridge to `useCallDetailMutations.updateCall`.
- next_action: gather initial evidence

## Evidence

- timestamp: 2026-06-05T00:00:00-04:00
  finding: `src/components/transcript-library/TranscriptTableRow.tsx` surfaced `call.ai_generated_title` only as passive subtitle text, with no action to apply or edit from that suggestion.
- timestamp: 2026-06-05T00:00:00-04:00
  finding: `src/components/CallDetailDialog.tsx` and `src/components/call-detail/CallDetailHeader.tsx` already had a working `useCallDetailMutations().updateCall` path for manual title saves, but no affordance bridging generated/source title suggestions into that mutation.

## Eliminated

- The underlying title update mutation was not missing; only the UI affordance and wiring were missing.

## Resolution

- root_cause: Suggested titles existed in meeting data and list UI, but the call-detail header only exposed manual edit/refresh actions, so users had no one-click apply flow or prefilled edit path into the existing title-save mutation.
- fix: Added a `SUGGESTED TITLE` action in the call detail header that opens a popup showing current vs suggested title, with `APPLY TITLE` for one-click replacement and `EDIT FIRST` to prefill the title editor before saving. The suggestion prefers `Meeting.ai_generated_title`, falls back to raw Fathom `ai_generated_title`, then falls back to `remote_title` when it differs from the current title.
- verification: `npm test -- src/components/call-detail/__tests__/PasteSourceRendering.test.tsx` passed with 12 tests on 2026-06-05. `npm run build` passed on 2026-06-05 after the UI wiring changes.
- files_changed: `src/components/CallDetailDialog.tsx`, `src/components/call-detail/CallDetailHeader.tsx`, `src/components/call-detail/__tests__/PasteSourceRendering.test.tsx`
