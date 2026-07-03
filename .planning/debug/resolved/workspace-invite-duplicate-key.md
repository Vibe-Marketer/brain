---
status: resolved
trigger: "Trying to send a workspace invite produced HTTP 409 duplicate key value violates unique constraint \"workspace_invitations_workspace_id_email_status_key\" instead of sending the invite."
created: "2026-07-03"
updated: "2026-07-03"
---

# Debug Session: workspace-invite-duplicate-key

## Symptoms

- expected_behavior: "Inviting someone to a workspace should send or reuse/resend the workspace invitation without surfacing a raw database constraint error."
- actual_behavior: "The invite POST fails with HTTP 409 and the user cannot send the invite."
- error_messages: "HTTP 409: duplicate key value violates unique constraint \"workspace_invitations_workspace_id_email_status_key\" on POST /rest/v1/workspace_invitations?select=id%2Cworkspace_id%2Cinvited_by%2Cemail%2Crole%2Ctoken%2Cstatus%2Cexpires_at%2Ccreated_at%2Caccepted_at; DB code 23505."
- timeline: "Observed 2026-07-03T16:55:29.629Z."
- reproduction: "Open workspace invite flow and attempt to invite an email address that already has an invitation row for the same workspace/status."

## Current Focus

- hypothesis: "The frontend/service inserts a new pending workspace invitation without first handling an existing pending invitation for the same workspace/email/status, so the database unique constraint leaks as a raw 409."
- test: "Trace the invitation creation code and existing DB constraint; verify whether duplicate pending invites should be idempotently reused, resent, or shown as an actionable already-invited state."
- expecting: "A duplicate invite path either upserts/updates/resends the existing pending invitation or returns a domain-specific error before insert; no raw 23505 reaches the user."
- next_action: "gather initial evidence"
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- timestamp: "2026-07-03T17:03:18-04:00"
  observation: "Focused Vitest coverage added for createInvitation normal insert, existing pending invite refresh, and duplicate insert race recovery."
  result: "`npx vitest run src/services/__tests__/invitations.service.test.ts` passed: 3/3 tests."
- timestamp: "2026-07-03T17:05:40-04:00"
  observation: "Project TypeScript check has many pre-existing failures, so output was filtered to touched files."
  result: "`npx tsc -p tsconfig.app.json --noEmit --pretty false 2>&1 | rg \"src/services/invitations.service|src/services/__tests__/invitations.service.test\" || true` produced no touched-file errors."
- timestamp: "2026-07-03T17:06:05-04:00"
  observation: "Production build after the service fix."
  result: "`npm run build` exited 0."

## Eliminated

## Resolution

- root_cause: "Workspace email invites used insert-only creation against `workspace_invitations`; when a pending invite already existed for the same workspace/email/status, Postgres raised 23505 on `workspace_invitations_workspace_id_email_status_key` and the raw DB error reached the toast."
- fix: "Make `createInvitation` idempotent for pending invites: normalize email, check for an existing pending row, refresh that row's inviter/role/token/expiry, and also recover from a concurrent duplicate insert race by re-reading and refreshing the winning pending row."
- verification: "Focused Vitest 3/3 green; no touched-file TypeScript errors; `npm run build` green."
- files_changed: "src/services/invitations.service.ts; src/services/__tests__/invitations.service.test.ts"
