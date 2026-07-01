---
status: investigating
trigger: "need to completely diagnose and find out why none of the actual searches are really working in app when attempting to locate people that should be able to be found wherever we search for people, so in workspaces and any search anywhere should be able to us the same search tool/workflow or whatever and it should all make it so I can find the people that are in the people database which should be anyone and everyone who alever appeared in or on a call or was invited to one from fathom, zoom, etc. all the different places -- and then the other thing is the actual people themselves - when in the people column or tab or whatever I should be able to somehow have the option to invite them to a workspace, call ault, egc. and right now there's not even an option to afd them to a workspace or anything ribht now."
created: "2026-06-30"
updated: "2026-06-30"
---

# Debug Session: People Search + Workspace Invite

## Symptoms

- expected_behavior: "People search should be shared and reliable across the app, including workspace search and any other people lookup surface. It should find people stored in the people database, including anyone who appeared on a call or was invited to one from Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, and other sources."
- actual_behavior: "Actual in-app searches are not reliably locating people who should exist. People surfaces also lack an obvious action to invite/add a person to a workspace or CallVault context."
- error_messages: "No specific runtime error reported yet."
- timeline: "Unknown; reported 2026-06-30 as a current production/product defect."
- reproduction: "Use app people/workspace/global search surfaces to locate known participants/invitees from provider-imported calls, then inspect a person row/card for workspace invitation/add action."

## Current Focus

- hypothesis: "Confirmed: People surfaces are fragmented. The canonical provider-derived person source is call_participants, but the People page searched only contacts rows, and contact rows were created by a UI-side sync mutation instead of being required for directory visibility. Workspace invite APIs existed but were not wired from contact rows/detail."
- test: "Focused hook tests, Vite build, and Playwright local UI smoke."
- expecting: "People list/search includes participant-derived people from call_participants even when no contacts row exists; contact detail exposes an invite-to-workspace action prefilled with the person's email."
- next_action: "monitor production behavior after deploy; consider a future phase to consolidate global people search, contact suggestions, and People page onto a named people-directory service."
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: 2026-06-30T19:35:00-04:00
  observation: "CodeGraph and source inspection found four separate people lookup paths: useGlobalSearch searches call_participants for call results, ContactsTable filters useContacts contacts locally, WorkspaceInviteDialog suggestions read call_participants, and member/invite surfaces use separate membership/invitation queries."
- timestamp: 2026-06-30T19:36:00-04:00
  observation: "DB migration 20260309120000_call_participants.sql shows call_participants is the canonical participant table populated from source_metadata.calendar_invitees and recorded_by, with transcript participants added by connector-pipeline."
- timestamp: 2026-06-30T19:37:00-04:00
  observation: "useContacts previously queried call_participants only after contactsData had emails. An org with call_participants but no persisted contacts rows could render/search zero people in the People page until a side-effect sync created per-user contact rows."
- timestamp: 2026-06-30T19:38:00-04:00
  observation: "WorkspaceInviteDialog/createInvitation already provided workspace email invitations, but ContactDetailPanel/ContactsTable did not expose that action from a person row."
- timestamp: 2026-06-30T19:40:34-04:00
  observation: "Focused tests passed: npm test -- src/hooks/__tests__/useContacts.test.ts src/hooks/__tests__/people-participant-metrics.test.ts --run. Result: 2 files, 12 tests passed."
- timestamp: 2026-06-30T19:41:10-04:00
  observation: "Repo-wide npx tsc -p tsconfig.app.json --noEmit failed on pre-existing unrelated type errors across AssignFolderDialog, connector tests, services, and panelStore tests; first errors were outside touched files."
- timestamp: 2026-06-30T19:42:00-04:00
  observation: "npm run build passed via Vite. Existing warnings: CJS Vite API deprecation, stale Browserslist data, dynamic/static import chunk warnings, large chunks."
- timestamp: 2026-06-30T19:45:00-04:00
  observation: "Playwright local smoke against http://127.0.0.1:3002/people opened the first person, clicked Invite to workspace, and confirmed the dialog email was prefilled with andrew@aisimple.co. Screenshot: /tmp/callvault-people-invite-dialog-smoke.png."

## Eliminated

- hypothesis: "No workspace invitation backend exists."
  reason: "Eliminated. src/services/invitations.service.ts and WorkspaceInviteDialog already create workspace_invitations and invoke send-org-invite best-effort."
- hypothesis: "Provider ingest never normalizes invitees/hosts into a canonical table."
  reason: "Eliminated for normal recording insert path. call_participants trigger and connector-pipeline transcript participant insert are present. The failing layer was People page dependency on contacts rows."

## Resolution

- root_cause: "The app treated two different concepts as one: contacts is a per-user editable contact overlay, while call_participants is the canonical org-scoped people directory from calls. People page search used only contacts, so canonical participants/invitees could be missing from People search unless a UI-side importAllContacts sync had already materialized them for that user. Separately, the workspace invite workflow existed but was not reachable from contact/person detail."
- fix: "useContacts now always reads call_participants for the active org, computes stats from that canonical table, and appends missing participant-derived read-only people to the People list. ContactCard marks participant-derived rows as From calls and disables edit/delete-only contact controls for those virtual rows. ContactDetailPanel now exposes an Invite to <workspace> action and WorkspaceInviteDialog accepts initialEmail so the invite form is prefilled."
- verification: "Focused hook tests passed (12/12), npm run build passed, local Playwright smoke confirmed People page render and invite dialog prefilled email."
- files_changed: "src/hooks/useContacts.ts; src/types/contacts.ts; src/components/contacts/ContactCard.tsx; src/components/dialogs/WorkspaceInviteDialog.tsx; src/components/panels/ContactDetailPanel.tsx; src/hooks/__tests__/useContacts.test.ts; .planning/debug/people-search-workspace-invite.md"
