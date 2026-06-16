---
status: resolved
trigger: "when uploading or \"importing\" a loom or anything like that it keeps taking me to the \"main screen\" instead of actually allowing me the option of uploading another one.. I should be able to upload another right after and have it stay right on the import screen don't you think?"
created: "2026-06-16"
updated: "2026-06-16"
---

# Debug Session: Import redirects main screen

## Symptoms

- expected_behavior: After a Loom/upload/manual import completes, the user should remain on the import screen with the form reset or ready so another item can be imported immediately.
- actual_behavior: Completing upload/import takes the user back to the main screen instead of staying in the import workflow.
- error_messages: None reported.
- timeline: Unknown; reported 2026-06-16.
- reproduction: Complete a Loom/upload/import flow from the import surface.

## Current Focus

- hypothesis: A success handler in the import UI navigates to the recordings/dashboard route or resets the selected import surface after save.
- test: Trace import completion handlers for Loom/manual/upload flows and search for route navigation after successful saves.
- expecting: A `navigate(...)`, location assignment, or parent callback maps import completion to the main screen.
- next_action: fixed; monitor after deploy
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-16
  observation: `PasteTranscriptModal.handleSave()` called `navigate(\`/?callId=${recordingId}\`)` after successful `save-pasted-transcript`.
  interpretation: Loom/manual transcript imports were intentionally leaving `/import` for the main call view after success.
- timestamp: 2026-06-16
  observation: `ConnectorImportWizard` and `YouTubeImportForm` success paths stay in place and only clear selection/invalidate caches.
  interpretation: The redirect behavior was isolated to the pasted/manual transcript surface used by Loom links and transcript uploads.

## Eliminated

- hypothesis: All import sources redirect after completion.
  reason: Connector wizard and YouTube import success handlers do not navigate away.

## Resolution

- root_cause: Manual/Loom transcript import success used the saved recording id to navigate to the root call view.
- fix: Success now invalidates call-list caches and resets the import fields in place while preserving the selected mode and destination for the next import.
- verification: `npm test -- PasteTranscriptModal.test.tsx`; `npm run type-check`; `npm run build`. Playwright local route check reached `/login` because `/import` is auth-gated without a stored session.
- files_changed: `src/components/import/PasteTranscriptModal.tsx`; `src/components/import/__tests__/PasteTranscriptModal.test.tsx`
