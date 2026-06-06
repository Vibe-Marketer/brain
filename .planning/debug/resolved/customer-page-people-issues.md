---
status: resolved
trigger: "Customer page has issues with numbers, attendance, time since last call, records are not editable, no ability to add/remove/change first/last name, and no ability to see calls attended."
created: 2026-06-06
updated: 2026-06-06
---

## Symptoms

- Expected behavior: Customer/contact pages should show accurate call counts, attendance, and time since last call; users should be able to add, remove, and edit contact identity details including first and last name; users should be able to see which calls a contact attended.
- Actual behavior: The customer page shows incorrect numbers, attendance, and time-since-last-call values; contact/customer details are effectively read-only; first/last name cannot be changed; attended calls are not visible.
- Error messages: None reported.
- Timeline: Reported during current People/customer page review.
- Reproduction: Open the current customer/contact page for a person and inspect metrics, editable fields, and attended-call history affordances.

## Current Focus

- hypothesis: Contact metrics and customer detail affordances diverged: the list has partial CRUD/stat logic, while the detail/customer page either lacks participant-stat dedupe, lacks call-history wiring, or does not expose existing contact mutations for identity editing.
- test: Trace People/Contacts route, contact table/detail components, `useContacts`, participant stats, and any customer/person detail page to identify wrong metric source and missing UI/mutation wiring.
- expecting: One or more components derive stats from raw rows instead of deduped recording-level attendance, and the customer/detail surface is missing edit/delete/create and attended-call history controls even though hooks exist.
- next_action: resolved

reasoning_checkpoint:
  hypothesis: "The contact detail page diverged from the People list: canonical stats existed in `useContacts`, but the detail surface never wired canonical call history and only exposed a combined full-name edit."
  confirming_evidence:
    - "`ContactsTable` already rendered deduped call, invited, attended, and last-seen metrics from `useContacts`."
    - "`ContactCard` lacked attended-call history and first/last name affordances even though update mutations already existed."
    - "`call_participants` plus `recordings` is the canonical UUID path for participant history, while `contact_call_appearances` is legacy and incomplete for bulk-synced contacts."
  falsification_test: "If the detail panel had already rendered canonical history and split-name editing, the defect would have to be in the underlying stats query rather than the panel wiring."
  fix_rationale: "Wire the detail panel to canonical call history, render attended-call metrics/history, and compose first/last name back into the existing `contacts.name` column."
  blind_spots: "No live browser verification against a real production customer/contact record was run in this session."

## Evidence

- timestamp: 2026-06-06T00:32:39Z
  finding: `ContactsTable` exposed list metrics and opened `contact-detail`, but the detail surface only showed a combined name field plus aggregate call count/last seen. It did not expose first/last editing or attended-call history.
- timestamp: 2026-06-06T00:32:39Z
  finding: `contacts` schema stores a combined `name`, not `first_name` / `last_name`, so first/last editing can be safely implemented as a UI composition over the existing column without a migration.
- timestamp: 2026-06-06T00:32:39Z
  finding: `contact_call_appearances` is a legacy appearance table, while `call_participants` joined to `recordings` is the canonical UUID path for participant metrics and attended-call history.

## Eliminated

- The contact detail panel was not fully missing CRUD. Existing `useContacts` mutations already supported create/update/delete, and `ContactCard` already supported combined-name, type, notes, health, and delete updates.
- A schema migration is not required to make first/last name editable in the current product contract.

## Resolution

- root_cause: The People/customer detail surface had working partial contact mutation wiring, but it collapsed identity editing into one combined name field, omitted attended-call history entirely, and did not show the canonical call-participant breakdown needed to reconcile call count, invited count, attended count, last seen, and last attended.
- fix: Added first/last name controls that save back to `contacts.name`; added canonical `useContactCallHistory` backed by `call_participants` + `recordings`; wired the contact detail panel to show aggregate invited/attended metrics, last attended timing, and attended calls with deep links to the existing call-detail route.
- verification: `npm test -- src/hooks/__tests__/useContacts.test.ts src/hooks/__tests__/people-participant-metrics.test.ts` passed with 10 tests on 2026-06-06. `npm run build` passed on 2026-06-06.
- files_changed: `src/hooks/useContacts.ts`, `src/types/contacts.ts`, `src/components/panels/ContactDetailPanel.tsx`, `src/components/contacts/ContactCard.tsx`, `src/hooks/__tests__/useContacts.test.ts`

## Specialist Review

LOOKS_GOOD (typescript/react): The fix keeps the existing data-access split intact, uses the canonical participant model for history instead of reviving legacy appearance rows, and avoids a schema migration by composing first/last name back into the stored `name` column.
