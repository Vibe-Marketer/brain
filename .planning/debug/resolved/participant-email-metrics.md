---
status: resolved
trigger: "Speaker and participants tabs now show names, but participant emails are missing; Daniel's eight-person call shows names without email addresses; People tab last-seen dates and calls invited/attended counts appear inaccurate."
created: 2026-06-02
updated: 2026-06-02
---

## Symptoms

- Expected behavior: Speaker, Participants, and People surfaces should show available individual email addresses, and People tab metrics should reflect accurate last-seen dates plus invited and attended call counts.
- Actual behavior: The affected Daniel call now shows participant names for eight people, but does not show their email addresses. The People tab shows inaccurate last-seen dates and calls invited/attended counts.
- Error messages: No explicit runtime error reported.
- Timeline: Started or became visible after the speaker/participants tab name fix.
- Reproduction: Inspect Daniel's call with eight participants, then inspect those individuals in the People tab.

## Current Focus

- hypothesis: Participant identity normalization or aggregation now preserves display names but drops email fields, and People tab metrics are derived from the wrong relationship/date fields.
- test: Trace the recording participants/speakers ingestion path, people aggregation service/hook, and People tab rendering for email, last-seen, invited, and attended fields.
- expecting: A shared identity mapping or query bug explains missing emails and inaccurate People metrics.
- next_action: gather initial evidence

## Evidence

- timestamp: 2026-06-02
  observation: `src/hooks/useCallDetailQueries.ts` merged canonical `call_participants` rows with transcript-derived speakers by `(speaker_email || speaker_name)`, so a participant row keyed by email did not match a transcript row keyed only by the same name. That created transcript-only speaker entries without emails after the recent name fix.
- timestamp: 2026-06-02
  observation: `src/hooks/useContacts.ts` now groups `call_participants` by `(email, recording_id)` and uses `sources` to derive invited vs attended. That fixes People metrics that were previously counted from raw participant rows and final `participant_type`, which dropped invited calls once attendee rows were upgraded to host/speaker.
- timestamp: 2026-06-02
  observation: Local verification passed after the duplicate-name ambiguity guard: `npm test -- src/hooks/__tests__/useCallDetailQueries.test.ts src/hooks/__tests__/useContacts.test.ts src/hooks/__tests__/people-participant-metrics.test.ts` (10 tests), `npm run type-check`, and `npm run build`.

## Eliminated

## Resolution

- root_cause: The speaker-name fix exposed a merge-key bug in call detail: canonical participant rows were indexed by email while transcript rows without emails were indexed by name, so the same person split into duplicate entries and the transcript-only entry lost the email. In parallel, People metrics were being computed from raw `call_participants` rows instead of per-recording identity state, which miscounted invited and attended totals and could stale `last_seen_at`.
- fix: Added name-aware speaker merging in `src/hooks/useCallDetailQueries.ts` so transcript rows enrich existing participant rows instead of creating email-less duplicates, and covered that with hook tests. Kept the `useContacts.ts` per-recording stats aggregation that derives invited and attended counts from participant sources and dedupes by recording.
- verification: `npm test -- src/hooks/__tests__/useCallDetailQueries.test.ts src/hooks/__tests__/useContacts.test.ts src/hooks/__tests__/people-participant-metrics.test.ts` passed with 10 tests; `npm run type-check` passed; `npm run build` passed.
- files_changed: src/hooks/useCallDetailQueries.ts, src/hooks/useContacts.ts, src/hooks/__tests__/useCallDetailQueries.test.ts, src/hooks/__tests__/useContacts.test.ts, src/hooks/__tests__/people-participant-metrics.test.ts
