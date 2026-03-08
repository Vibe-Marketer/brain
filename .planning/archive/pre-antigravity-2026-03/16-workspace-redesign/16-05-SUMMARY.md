---
phase: 16-workspace-redesign
plan: 05
subsystem: ui
tags: [react, tanstack-query, supabase, radix-ui, invitations, workspace-membership]

# Dependency graph
requires:
  - phase: 16-01
    provides: workspace_invitations table with RLS, get_workspace_invite_details RPC, accept_workspace_invite RPC, WorkspaceInvitation/WorkspaceInviteDetails types
  - phase: 16-02
    provides: useWorkspaceMembers, useUpdateMemberRole, useRemoveMember hooks
  - phase: 16-03
    provides: AppShell layout, route structure for _authenticated routes

provides:
  - invitations.service.ts — getInvitations, createInvitation, revokeInvitation, resendInvitation, getInviteDetails (RPC), acceptInvite (RPC), getShareableLink
  - useInvitations.ts — useInvitations, useCreateInvitation, useRevokeInvitation, useResendInvitation, useInviteDetails, useAcceptInvite
  - WorkspaceInviteDialog.tsx — two-tab dialog (email + link), role picker (Viewer/Member/Admin), WKSP-10 org+workspace context
  - WorkspaceMemberPanel.tsx — Members + Pending Invites tabbed panel with role change and remove/revoke/resend actions
  - /join/workspace/:token route — invite acceptance page with full context before accepting

affects: [16-06, 16-07, workspace-settings, phase-17-import-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Invitation service layer following workspaces.service.ts pattern (cast via `as any` for untyped DB tables)
    - useInvitations hooks follow same session-gated enabled pattern as useWorkspaces
    - Two-tab dialog pattern (email + link) with shared role picker
    - Invite acceptance page as standalone _authenticated route
    - Inline confirm state in dropdowns (no separate confirm dialog component needed)

key-files:
  created:
    - /Users/Naegele/dev/callvault/src/services/invitations.service.ts
    - /Users/Naegele/dev/callvault/src/hooks/useInvitations.ts
    - /Users/Naegele/dev/callvault/src/components/dialogs/WorkspaceInviteDialog.tsx
    - /Users/Naegele/dev/callvault/src/components/workspace/WorkspaceMemberPanel.tsx
    - /Users/Naegele/dev/callvault/src/routes/_authenticated/join/workspace.$token.tsx
  modified: []

key-decisions:
  - "Email delivery not implemented in Phase 16 — invite creates DB record and shows shareable link; email re-send deferred to Phase 17+ or Supabase webhooks"
  - "get_workspace_invite_details RPC called with p_token parameter; accept_workspace_invite RPC called with p_token + p_user_id"
  - "workspace_invitations table queries cast via (supabase as any) — not yet in generated supabase.ts types"
  - "Role picker in invite dialog: guest (Viewer), member (Member), vault_admin (Admin) — maps ROLE_DISPLAY_NAMES"
  - "useCreateInvitation auto-copies shareable link to clipboard on success; falls back gracefully if clipboard blocked"
  - "Inline confirm state pattern in MemberRow/InviteRow dropdowns instead of separate confirmation dialog"
  - "WorkspaceMemberPanel Tabs uses Radix UI Tabs from radix-ui package, same as Collapsible in WorkspaceSidebarPane"

patterns-established:
  - "invitations.service.ts: (supabase as any) cast pattern for Phase 16 tables not yet in generated types"
  - "Invite dialog shows Org + Workspace context in header and subtext (WKSP-10 pattern for all invite UX)"
  - "Tab-based management panels: Tabs.Root + Tabs.List + Tabs.Trigger + Tabs.Content from radix-ui"
  - "Join page: standalone page rendering without AppShell (centered card layout for unauthenticated-feel flows)"

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 16 Plan 05: Workspace Invite and Membership Management Summary

**Workspace invitation system with email+link invite dialog (WKSP-10/11), tabbed member management panel (WKSP-13), and invite acceptance page showing inviter/org/workspace/role context before joining**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T04:11:34Z
- **Completed:** 2026-02-28T04:15:52Z
- **Tasks:** 2
- **Files modified:** 5 created, 0 modified

## Accomplishments

- Full invitation service: CRUD on workspace_invitations table, both RPCs wired (get_workspace_invite_details + accept_workspace_invite), shareable link generation
- WorkspaceInviteDialog: Two tabs (email invite / share link), role picker (Viewer/Member/Admin per WKSP-11), WKSP-10 org+workspace name in header
- WorkspaceMemberPanel: Separate Members and Pending Invites tabs (WKSP-13), role changes via inline dropdown (immediate effect, no page refresh), remove member with confirmation, resend/revoke for pending invites
- Join page (/join/workspace/:token): Full WKSP-10 context (inviter name, org name, workspace name, role + description), edge cases for expired/revoked/invalid tokens, Accept/Decline flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Invitation service, hooks, and invite dialog** - `cbf033e` (feat)
2. **Task 2: Workspace member panel and invite acceptance page** - `9a6f073` (feat)

## Files Created/Modified

- `src/services/invitations.service.ts` — getInvitations, createInvitation, revokeInvitation, resendInvitation, getInviteDetails (RPC), acceptInvite (RPC), getShareableLink
- `src/hooks/useInvitations.ts` — useInvitations, useCreateInvitation (auto-clipboard), useRevokeInvitation, useResendInvitation, useInviteDetails, useAcceptInvite
- `src/components/dialogs/WorkspaceInviteDialog.tsx` — Two-tab invite dialog with role picker and WKSP-10 context
- `src/components/workspace/WorkspaceMemberPanel.tsx` — Tabbed member management panel with role change + remove + resend + revoke
- `src/routes/_authenticated/join/workspace.$token.tsx` — Invite acceptance page with full context and edge case handling

## Decisions Made

- Email delivery not implemented in Phase 16. Invite creates DB record and auto-copies shareable link to clipboard. Email delivery deferred to Phase 17+ or Supabase webhooks. Dialog shows amber notice to communicate this.
- get_workspace_invite_details called with `{ p_token: token }` parameter naming — matches Phase 16-01 RPC definition.
- accept_workspace_invite called with `{ p_token: token, p_user_id: userId }`.
- workspace_invitations not in generated types — (supabase as any) cast follows same pattern as Phase 16-04 folders.
- InviteRow and MemberRow use inline confirm state (local useState) instead of a separate confirmation dialog component — keeps the component self-contained.

## Deviations from Plan

None - plan executed exactly as written.

Note: The plan mentioned `createInvitation(supabase, workspaceId, invitedBy, email, role)` as the service signature, but the service layer uses the singleton `supabase` import (not passed as param) — consistent with all other services in the codebase (workspaces.service.ts, folders.service.ts pattern). The hook layer passes auth context correctly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Self-Check: PASSED

All 5 files exist, both task commits found (cbf033e, 9a6f073), SUMMARY.md created.

## Next Phase Readiness

- Invitation system complete: service, hooks, dialog, panel, and join page all built
- WorkspaceMemberPanel is ready to be embedded in workspace settings page (Plan 16-07)
- WorkspaceInviteDialog can be opened from any workspace context that has workspaceId + workspaceName + orgName
- Join route /join/workspace/:token is live and wired into the _authenticated layout
- Plans 16-06 (onboarding) and 16-07 (settings) can consume WorkspaceMemberPanel directly

---
*Phase: 16-workspace-redesign*
*Completed: 2026-02-28*
