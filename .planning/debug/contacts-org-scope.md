---
status: resolved
trigger: "Contact filter/search inside contacts does not appear to show contacts from calls in both Lead Gen Jay and AI Simple orgs; examples include Phill Tomlinson, Brett Bennett, Willie Dochee. Need investigate whether contacts are scoped per org correctly when calls are moved/copied across organizations."
created: "2026-07-04"
updated: "2026-07-04"
---

# Debug Session: contacts-org-scope

## Symptoms

- expected_behavior: "Inside organization Lead Gen Jay, contacts from calls that exist in that organization should appear. If the same person exists in AI Simple too, the product should expose that person in both org contexts without creating user-visible duplicate contacts."
- actual_behavior: "Contact filter/search appears not to move/remove/add contact info consistently when calls move or are visible across organizations."
- error_messages: "No explicit error reported."
- timeline: "Current production/admin-ticket issue; exact start unknown."
- reproduction: "Open organization Lead Gen Jay, use contact filter/search, and look for Phill Tomlinson, Brett Bennett, Willie Dochee. Compare with AI Simple."
- examples_to_probe: "Phill Tomlinson; Brett Bennett; Willie Dochee; Lead Gen Jay; AI Simple"

## Current Focus

- hypothesis: "Malformed Fireflies participant emails created participant-derived contact ghosts, and saved-contact display needed a final same-email collapse guard."
- test: "Resolved code path; queried production contacts, call_participants, recordings, workspace_entries, and tickets; cleaned malformed production participant rows; deployed Edge Function ingestion fixes."
- expecting: "Contacts/filter should not render comma-email ghosts such as `andrew@aisimple.co,naegele412@gmail.com`, and same-email rows should collapse to one displayed contact."
- next_action: "ticket e3a45177-3257-48e6-9338-960de2e61e89 updated/resolved with corrected investigation note"
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- 2026-07-04: Contacts page uses `useContacts(activeOrgId)` and contact filter uses `fetchContactSuggestionsForOrg(activeOrganizationId)`. Both merge saved `contacts` scoped by `contacts.org_id` with `call_participants` scoped by `call_participants.organization_id`.
- 2026-07-04: Production schema has `contacts.org_id NOT NULL`, `contacts_user_id_org_id_email_key UNIQUE (user_id, org_id, email)`, and `call_participants.organization_id NOT NULL`.
- 2026-07-04: Production org ids: AI Simple = `04714fb3-d42c-42ad-801a-a8a49df6d06f`; Lead Gen Jay = `22c98dba-f169-40c8-9e93-547875c203ff`.
- 2026-07-04: For Lead Gen Jay, named examples have 0 saved contact rows, 0 `call_participants` rows, and 0 matching LGJ-visible recordings. For AI Simple, Brett has 4 participant rows, Phill has 69, Willie has 59.
- 2026-07-04: Lead Gen Jay participant data exists generally: 79 visible recordings, 78 with participants, 244 participant rows, 31 distinct participant emails.
- 2026-07-04: Duplicate-looking AI Simple contacts for Phill/Willie/Brett are one row per user, not duplicates for the same `(user_id, org_id, email)`. Current UI filters saved contacts by current `user_id`, so those rows are not user-visible duplicates for Andrew.
- 2026-07-04: Admin ticket found: `e3a45177-3257-48e6-9338-960de2e61e89`, source `in_app_user`, status `new`, submitted from LGJ org/workspace `IMPORT`.
- 2026-07-04: User clarified the expected behavior is that overlapping contacts should appear in both orgs and called out examples of duplicate-looking contacts: `andrew@aisimple.co`, `naegele412@gmail.com`, a no-name row containing both emails, and Phill/others appearing once with name/email and once with email.
- 2026-07-04: Production had 6 `call_participants.email` values containing comma-separated email lists, all from Fireflies transcript-derived rows with `name = null`. Examples included `andrew@aisimple.co,naegele412@gmail.com`, `ptomlinson@cpiaz.com,andrew@aisimple.co,mwicker@kingindustrial.com,trustan@cpiaz.com`, and a long list containing Brett/Willie/Phill/Andrew.
- 2026-07-04: Every split email from those 6 malformed rows already existed as an individual `call_participants` row for the same recording, so the comma rows were redundant artifacts.
- 2026-07-04: Production cleanup deleted exactly 6 malformed comma-email `call_participants` rows; post-cleanup count for `email like '%,%'` is 0.
- 2026-07-04: Post-cleanup production check for `andrew@aisimple.co`, `naegele412@gmail.com`, `ptomlinson@cpiaz.com`, `brett@digitalnextera.com`, and `willieduchee2021@gmail.com` shows 0 comma participant rows; remaining rows are individual emails with names/no-name variants as source data permits.
- 2026-07-04: Added ingestion normalization so Fireflies attendee/invitee email strings are split before they enter canonical participant/contact paths; UI contact stats and suggestions also split comma emails defensively.
- 2026-07-04: Added `dedupeContactsByEmail()` render guard so same-email contacts collapse before the Contacts page returns data.
- 2026-07-04: Deployed production Edge Functions: `fireflies-sync-meetings`, `fireflies-webhook`, `connector-sync-all`, and `fireflies-fetch-meetings`.

## Eliminated

- Same-user duplicate saved contacts: eliminated by production unique constraint and user-id check. Global org-level duplicate-looking saved contacts can exist across different `user_id` owners; the current Contacts hook filters saved contacts by current user and now has a same-email render collapse guard.
- General LGJ contact extraction failure: eliminated by 244 existing LGJ participant rows across 78 recordings.
- Comma-email participant ghosts: confirmed and fixed.

## Resolution

- root_cause: "Fireflies sometimes supplied attendee email fields as comma-separated email lists. The ingestion/contact paths accepted the whole comma string as one participant email, which created no-name participant-derived contact ghosts. Separately, regular contacts needed a final same-email display collapse guard."
- fix: "Split comma-separated emails in canonical recording normalization, Fireflies connector/list mapping, connector pipeline participant collection, Contacts page participant stats/derived contacts, and contact suggestions. Add Contacts page same-email dedupe guard. Cleaned the 6 malformed production participant rows."
- verification: "Production SQL checked contacts, call_participants, workspace_entries, recordings, constraints, indexes, and ticket row. Focused tests passed: 4 files, 46 tests. Deno check passed for shared Fireflies/canonical/pipeline files and deployed sync/webhook/sync-all functions. `npm run build` passed. Deployed relevant production Edge Functions."
- files_changed: ".planning/debug/contacts-org-scope.md; src/hooks/useContacts.ts; src/hooks/useContactSuggestions.ts; src/hooks/__tests__/useContacts.test.ts; supabase/functions/_shared/canonical-recording.ts; supabase/functions/_shared/fireflies-connector.ts; supabase/functions/_shared/connector-pipeline.ts; supabase/functions/_shared/__tests__/canonical-recording.test.ts; supabase/functions/_shared/__tests__/fireflies-connector.test.ts; supabase/functions/_shared/__tests__/connector-pipeline.test.ts; supabase/functions/fireflies-fetch-meetings/index.ts"
