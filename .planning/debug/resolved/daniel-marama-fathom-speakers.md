---
status: resolved
trigger: "Fathom call from 2026-05-28 recorded by Daniel Marama is not showing invitees/participants; user wants Participants renamed to Speakers and wants speakers, emails, and contact data shown wherever possible."
created: "2026-06-02"
updated: "2026-06-02"
---

# Debug Session: Daniel Marama Fathom Speakers

## Symptoms

- Expected behavior: The May 28, 2026 Fathom call should show invitees and speakers clearly, using "Speakers" instead of "Participants" in the call detail component.
- Actual behavior: The UI could appear to show no invitees/participants for the host-only Daniel Marama call.
- Errors: No runtime error reported.
- Timeline: Reported on 2026-06-02 for a Fathom-connected call dated 2026-05-28.
- Reproduction: Open the Daniel Marama Fathom call from 2026-05-28 and inspect call list invitees plus call detail invitee/speaker tabs.

## Current Focus

- hypothesis: Data exists in canonical tables, but the UI hides or drops host-only invitee/speaker identity.
- test: Read production rows for the matching Fathom recording, inspect UI mapping/rendering code, then run frontend verification.
- expecting: `recordings.source_metadata.calendar_invitees` and `call_participants` contain Daniel; UI should count/show him and label the spoken-person tab "Speakers".
- next_action: Complete.

## Evidence

- timestamp: 2026-06-02
  observation: Production read-only probe found recording `936e8d9f-94b3-4b45-9f8f-f7d0208e265c`, legacy recording `150241213`, title `Impromptu Zoom Meeting`, start `2026-05-28T13:48:38+00:00`.
- timestamp: 2026-06-02
  observation: `source_metadata.calendar_invitees` has one entry for Daniel Marama at `daniel@maramamarketing.com`, and `call_participants` has one host row with sources `recorded_by` and `calendar_invitees`.
- timestamp: 2026-06-02
  observation: No matching `contacts` row exists for Daniel in that organization, so richer contact data cannot be displayed for this specific row until a contact is created or synced.
- timestamp: 2026-06-02
  observation: `InviteesPopover` counted invitees after filtering out `hostEmail`; host-only calls could render the trigger count as zero even when invitee data existed.
- timestamp: 2026-06-02
  observation: The call detail tab still used user-facing "Participants" copy for a list populated from canonical speaker/person data.

## Eliminated

- hypothesis: The Fathom API failed to provide Daniel invitee/speaker data.
  reason: Existing `recordings.source_metadata.calendar_invitees` and `call_participants` rows contain Daniel.
- hypothesis: The canonical participant trigger failed for this recording.
  reason: `call_participants` has the expected host row for the recording.

## Resolution

- root_cause: Host-only invitee rows were visually misleading because the list popover trigger excluded the host from the count; the detail component also used old Participants labeling and did not enrich canonical speaker rows from contacts.
- fix: Count all invitees in the popover trigger, tag host rows in the popover, rename user-facing Participants copy to Speakers in call detail, and enrich canonical speaker rows with matching `contacts` fields when available.
- verification: `npm run type-check` passed; `npm run build` passed; production read-only probe confirmed invitee count 1 and speaker row Daniel Marama / daniel@maramamarketing.com for recording `936e8d9f-94b3-4b45-9f8f-f7d0208e265c`.
- files_changed:
  - `src/hooks/useCallDetailQueries.ts`
  - `src/types/meetings.ts`
  - `src/components/CallDetailDialog.tsx`
  - `src/components/call-detail/CallParticipantsTab.tsx`
  - `src/components/call-detail/CallInviteesTab.tsx`
  - `src/components/call-detail/CallOverviewTab.tsx`
  - `src/components/call-detail/SourceInfoSection.tsx`
  - `src/components/transcript-library/InviteesPopover.tsx`
