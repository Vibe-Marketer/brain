---
phase: 16-workspace-redesign
verified: 2026-02-28T06:00:00Z
status: gaps_found
score: 4/5 success criteria verified (13/13 requirements at data/service layer; 2 UX gaps remain)
gaps:
  - truth: "Calls list filters by active workspace (shows only that workspace's calls)"
    status: failed
    reason: "useFilteredRecordings() is a passthrough — returns all recordings regardless of active workspace. Code comment explicitly states 'Return all recordings until a workspace filter layer is added (Plan 16-08+)'. No vault_entries join is implemented."
    artifacts:
      - path: "src/routes/_authenticated/index.tsx"
        issue: "useFilteredRecordings() returns all recordings unconditionally (lines 39-43)"
    missing:
      - "Filter recordings by vault_entries.vault_id = activeWorkspaceId when a workspace is selected"
      - "Filter recordings by folder_assignments.folder_id = activeFolderId when a folder is selected"
  - truth: "Folder name appears in breadcrumb trail when a folder is active"
    status: partial
    reason: "useBreadcrumbs() skips the folder level entirely — an activeFolderId produces no breadcrumb label. Code comment: 'Folder name will come from WorkspaceSidebarPane's folder query context / For now we skip the label-less crumb — Plan 16-04 wires this fully'. Plan 16-04 did build useFolders but the breadcrumb was never updated to consume it."
    artifacts:
      - path: "src/components/layout/WorkspaceBreadcrumb.tsx"
        issue: "Lines 166-172: activeFolderId check exists but pushes nothing (empty if block)"
    missing:
      - "Call useFolders(activeWorkspaceId) in useBreadcrumbs and find the folder by activeFolderId to get its name"
      - "Push BreadcrumbItem with folder.name when activeFolderId is set"

human_verification:
  - test: "Navigate to production URL, activate a workspace via sidebar, check that calls list shows ONLY that workspace's calls"
    expected: "Only calls belonging to the selected workspace appear — all other users' calls or other-workspace calls are hidden"
    why_human: "useFilteredRecordings passthrough means this cannot be verified programmatically — the UI appears functional but shows wrong data"
  - test: "Activate a folder in the sidebar, check breadcrumb at top of calls list"
    expected: "Breadcrumb shows: Personal > My Calls > [Folder Name]"
    why_human: "Folder breadcrumb level is silently skipped — no error thrown, just missing from trail"
  - test: "Open Workspace settings page, click Invite Member, verify dialog header shows both org name and workspace name"
    expected: "Dialog shows 'Invite to [Workspace Name]' with 'in [Org Name]' subtitle"
    why_human: "Dialog content depends on runtime props (workspaceName, orgName) passed from WorkspaceDetailPage"
  - test: "Complete onboarding explorer on a fresh account, confirm it does not re-appear on next login"
    expected: "ModelExplorer shown once; after 'Get Started', never shows again on subsequent logins"
    why_human: "user_profiles.auto_processing_preferences persistence can only be verified with a real authenticated session"
  - test: "Verify Supabase Auth email templates contain no Bank/Vault/Hub terminology"
    expected: "All email templates (confirmation, magic link, password reset, invite) use generic text or Organization/Workspace terminology"
    why_human: "Supabase dashboard templates cannot be verified programmatically from source code — noted as manual step in Plan 16-07 Task 3"
---

# Phase 16: Workspace Redesign Verification Report

**Phase Goal:** Users experience the new Organization -> Workspace -> Folder model with correct naming everywhere, working URL redirects, clear switching UX, and functional invite flows.
**Verified:** 2026-02-28T06:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Old /bank/, /vault/, /hub/ URLs get 301-redirected before any UI rename | VERIFIED | vercel.json has 7 redirect rules with `"permanent": true`; bank, vault, hub route files show 404-style pages |
| 2 | Zero instances of Bank/Vault/Hub in user-facing UI strings | VERIFIED | Grep of all .tsx/.ts files returns zero matches for user-facing strings; bank.tsx, vault.tsx, hub.tsx route files show only "Page Not Found" and "older version of CallVault" |
| 3 | User can see org switcher, switch orgs, create orgs | VERIFIED | OrgSwitcherBar.tsx (218 lines): renders dropdown with all orgs, house icon for personal, checkmark for active, Create Organization option wired to CreateOrganizationDialog |
| 4 | User can see workspaces in sidebar, switch workspaces, see folders nested | VERIFIED | WorkspaceSidebarPane.tsx (347 lines): uses useFolders hook (not inline query — cache coherent per Plan 16-07 fix), FolderDropZone wraps each folder, Collapsible per workspace |
| 5 | Calls list filters by active workspace when one is selected | FAILED | useFilteredRecordings() in index.tsx is a passthrough — all recordings shown regardless of active workspace (comment: "Plan 16-08+" deferred) |
| 6 | User can invite members with Viewer/Member/Admin roles | VERIFIED | WorkspaceInviteDialog.tsx has three-option role picker (guest/member/vault_admin), shows org+workspace context in header (WKSP-10) |
| 7 | Workspace settings shows Members tab and Pending Invites tab | VERIFIED | WorkspaceMemberPanel.tsx uses Radix Tabs with both tabs wired to useWorkspaceMembers + useInvitations hooks |
| 8 | Invite acceptance page shows full context before user accepts | VERIFIED | join/workspace.$token.tsx renders inviter_display_name, organization_name, workspace_name, role with ROLE_DESCRIPTIONS |
| 9 | Onboarding explorer shows Account -> Org -> Workspace -> Folder -> Call | VERIFIED | ModelExplorer.tsx (motion/react, 5 STEPS, RiHome4Line for org, Get Started/Skip) wired into _authenticated.tsx overlay |
| 10 | Folder breadcrumb shows folder name when active | PARTIAL | useBreadcrumbs skips folder level entirely — activeFolderId check exists but pushes nothing (empty if block at lines 166-172 of WorkspaceBreadcrumb.tsx) |
| 11 | New user signup creates Personal org with My Calls workspace (is_default = TRUE) | VERIFIED | Migration 20260228000001: handle_new_user() updated with is_default = TRUE; all 11 existing personal vaults backfilled |
| 12 | Folders can be created, renamed, archived, restored | VERIFIED | folders.service.ts (379 lines): all CRUD + archive/restore; useFolders.ts hooks with optimistic updates and toasts |
| 13 | DnD call-to-folder assignment works on desktop | VERIFIED | DndCallProvider.tsx (201 lines) with DndContext + onDragEnd handler; FolderDropZone.tsx (71 lines) with useDroppable; DraggableCallRow exported |

**Score: 11/13 truths verified, 1 failed, 1 partial**

---

### Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `vercel.json` | VERIFIED | 7 301-redirect rules; `"permanent": true` on all |
| `supabase/migrations/20260228000001_workspace_redesign_schema.sql` | VERIFIED | File exists; contains workspace_invitations, is_default, vault_id, protect_default_workspace |
| `src/types/workspace.ts` | VERIFIED | 107 lines; Organization, Workspace, Folder, WorkspaceInvitation, WorkspaceInviteDetails, ROLE_DISPLAY_NAMES |
| `src/lib/query-config.ts` | VERIFIED | invitations domain (byWorkspace, details) confirmed by SUMMARY |
| `src/stores/orgContextStore.ts` | VERIFIED | 139 lines; setActiveOrg resets workspace+folder to null (locked decision confirmed at line 86) |
| `src/services/organizations.service.ts` | VERIFIED | 116 lines; from('banks') at lines 61, 84 |
| `src/services/workspaces.service.ts` | VERIFIED | 192 lines; from('vaults') at lines 30, 60, 96 |
| `src/hooks/useOrganizations.ts` | VERIFIED | Exists per SUMMARY; session-gated, queryKeys |
| `src/hooks/useWorkspaces.ts` | VERIFIED | Exists per SUMMARY; useWorkspaceMembers, useUpdateMemberRole, useRemoveMember |
| `src/hooks/useOrgContext.ts` | VERIFIED | Exists; used in OrgSwitcherBar, WorkspaceSidebarPane, WorkspaceDetailPage |
| `src/components/layout/OrgSwitcherBar.tsx` | VERIFIED | 218 lines; RiHome4Line, switchOrg, Create Organization option |
| `src/components/layout/WorkspaceSidebarPane.tsx` | VERIFIED | 347 lines; useFolders (not inline query), FolderDropZone, Collapsible |
| `src/components/layout/WorkspaceBreadcrumb.tsx` | PARTIAL | Exists; folder level silently skipped (empty if block) |
| `src/components/layout/AppShell.tsx` | VERIFIED | OrgSwitcherBar rendered above pane container at line 153 |
| `src/components/layout/SidebarNav.tsx` | VERIFIED | Workspaces nav item added, How it works button calls setShowOnboarding(true) |
| `src/services/folders.service.ts` | VERIFIED | 379 lines; getFolders, createFolder (depth limit enforced), archiveFolder, restoreFolder |
| `src/hooks/useFolders.ts` | VERIFIED | 187 lines; useFolders, useArchivedFolders, useCreateFolder, useRenameFolder with optimistic update |
| `src/hooks/useFolderAssignment.ts` | VERIFIED | Exists; useAssignToFolder, useRemoveFromFolder, useMoveToFolder |
| `src/components/dnd/FolderDropZone.tsx` | VERIFIED | 71 lines; useDroppable from @dnd-kit/core |
| `src/components/dnd/DndCallProvider.tsx` | VERIFIED | 201 lines; DndContext, MouseSensor, TouchSensor, DragOverlay |
| `src/services/invitations.service.ts` | VERIFIED | 155 lines; createInvitation, revokeInvitation, getInviteDetails (RPC), acceptInvite (RPC) |
| `src/hooks/useInvitations.ts` | VERIFIED | Exists; useCreateInvitation (auto-clipboard), useInviteDetails, useAcceptInvite |
| `src/components/dialogs/WorkspaceInviteDialog.tsx` | VERIFIED | Tabs (email/link), role picker (Viewer/Member/Admin), WKSP-10 org+workspace in header |
| `src/components/workspace/WorkspaceMemberPanel.tsx` | VERIFIED | Radix Tabs; Members tab + Pending Invites tab; immediate role change |
| `src/routes/_authenticated/join/workspace.$token.tsx` | VERIFIED | inviter_display_name, organization_name, workspace_name all rendered (lines 165, 182, 196) |
| `src/components/onboarding/ModelExplorer.tsx` | VERIFIED | motion/react import, 5 STEPS, RiHome4Line for org, Get Started + Skip |
| `src/hooks/useOnboarding.ts` | VERIFIED | onboarding_seen_v2 key in user_profiles.auto_processing_preferences JSONB |
| `src/routes/_authenticated.tsx` | VERIFIED | ModelExplorer overlay wired with first-login and manual re-trigger conditions |
| `src/routes/_authenticated/index.tsx` | PARTIAL | DndCallProvider, DraggableCallRow, CallActionMenu with Move to Folder — verified. Workspace filtering is NOT implemented. |
| `src/routes/_authenticated/workspaces/$workspaceId.tsx` | VERIFIED | WorkspaceMemberPanel rendered with workspaceId, workspaceName, orgName props |
| `src/routes/_authenticated/settings/$category.tsx` | VERIFIED | Organizations category in SETTINGS_CATEGORIES; OrganizationsSettings component |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| OrgSwitcherBar.tsx | useOrgContext.ts | useOrgContext() called, switchOrg used | WIRED | Lines 36-44 of OrgSwitcherBar |
| WorkspaceSidebarPane.tsx | useFolders.ts | useFolders(workspaceIdForQuery) at line 106 | WIRED | Replaced inline query per Plan 16-07 fix |
| AppShell.tsx | OrgSwitcherBar.tsx | `<OrgSwitcherBar />` at line 153 | WIRED | Desktop+tablet layout only |
| DndCallProvider.tsx | useFolderAssignment.ts | useAssignToFolder() called in onDragEnd | WIRED | DndCallProvider line 95+  |
| WorkspaceInviteDialog.tsx | useInvitations.ts | useCreateInvitation() called on form submit | WIRED | Line 27 import, submit handler |
| WorkspaceMemberPanel.tsx | useWorkspaces.ts | useWorkspaceMembers, useUpdateMemberRole, useRemoveMember | WIRED | Lines 28-29 |
| join/workspace.$token.tsx | get_workspace_invite_details RPC | (supabase as any).rpc('get_workspace_invite_details') | WIRED | invitations.service.ts line 112 |
| _authenticated.tsx | ModelExplorer.tsx | Conditional overlay rendering | WIRED | Lines 30-46 |
| SidebarNav.tsx | useOnboarding.ts | setShowOnboarding(true) onClick | WIRED | Line 143 |
| orgContextStore.setActiveOrg | activeWorkspaceId reset | set({ activeWorkspaceId: null }) | WIRED | Line 86 confirms locked decision |
| index.tsx | workspace filter | vault_entries join | NOT WIRED | useFilteredRecordings passthrough — intentionally deferred |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| WKSP-01: Bank renamed to Organization everywhere | SATISFIED | Zero user-facing "Bank" strings; migration + types + UI all use Organization |
| WKSP-02: Vault renamed to Workspace everywhere | SATISFIED | Zero user-facing "Vault" strings; services use from('vaults') internally only |
| WKSP-03: Hub renamed to Folder everywhere | SATISFIED | Zero user-facing "Hub" strings; Import page renamed to "Import Calls" |
| WKSP-04: 301 redirects for /bank/, /vault/, /hub/ | SATISFIED | vercel.json has 7 redirect rules with permanent:true |
| WKSP-05: Organization creation + Personal auto-created | SATISFIED | CreateOrganizationDialog wired; migration backfills handle_new_user trigger |
| WKSP-06: Org switcher in sidebar | SATISFIED | OrgSwitcherBar rendered in AppShell above all panes |
| WKSP-07: Workspace creation + My Calls auto-created | SATISFIED | createWorkspace service; is_default backfill; protect_default_workspace trigger |
| WKSP-08: Workspace switching within org | SATISFIED | WorkspaceSidebarPane onSelect calls switchWorkspace |
| WKSP-09: Onboarding screen with 4-level model | SATISFIED | ModelExplorer 5-step interactive explorer; first-login overlay + sidebar link |
| WKSP-10: Invite dialog shows Org + Workspace name | SATISFIED | WorkspaceInviteDialog header + join page both render organization_name + workspace_name |
| WKSP-11: Invite with Viewer/Member/Admin roles | SATISFIED | Three-role picker (guest/member/vault_admin) in invite dialog |
| WKSP-12: Create, rename, archive Folders | SATISFIED | folders.service.ts: createFolder, renameFolder, archiveFolder, restoreFolder; depth enforced |
| WKSP-13: Manage Workspace membership from settings | SATISFIED | WorkspaceMemberPanel wired in $workspaceId.tsx with Members + Pending Invites tabs |

**13/13 requirements satisfied at the service/component level. One functional gap: workspace filtering in calls list.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/_authenticated/index.tsx` | 39-43 | `useFilteredRecordings` returns all recordings unconditionally | Warning | Calls list does not filter by active workspace — user sees all calls regardless of workspace context |
| `src/components/layout/WorkspaceBreadcrumb.tsx` | 166-172 | Empty if block for activeFolderId — folder breadcrumb level silently skipped | Warning | Folder name never appears in breadcrumb trail |
| `src/components/layout/WorkspaceSidebarPane.tsx` | 274 | `window.prompt('Workspace name:')` for Create Workspace | Info | Works but poor UX; functional for now, noted as stub |
| `src/routes/_authenticated/workspaces/index.tsx` | 73 | `window.prompt` for Create Workspace on workspaces list page | Info | Same stub pattern |
| `src/components/dialogs/WorkspaceInviteDialog.tsx` | 260 | "Email notifications are coming soon" disclaimer | Info | Known limitation documented in SUMMARY; no email infra in Phase 16 |
| `src/components/layout/WorkspaceBreadcrumb.tsx` | 141, 168 | "will be done by Plan 16-04 / Plan 16-04 wires this fully" — but Plan 16-04 is complete and folder breadcrumb still missing | Warning | Plan 16-04 built useFolders but WorkspaceBreadcrumb was not updated to use it |

---

### Human Verification Required

**1. Workspace Filtering of Calls List**

**Test:** Log in, activate a workspace in the sidebar, observe the calls list
**Expected:** Only calls belonging to that workspace appear — not all calls across all workspaces
**Why human:** useFilteredRecordings() is confirmed passthrough; this needs runtime verification against real vault_entries data to confirm the scope of impact

**2. Folder Breadcrumb Level**

**Test:** Activate a folder in the sidebar, look at the breadcrumb at the top of the calls list
**Expected:** Breadcrumb shows: [Org Name] / [Workspace Name] / [Folder Name]
**Why human:** The folder level is silently skipped — no error, just missing label

**3. Invite Dialog WKSP-10 Context**

**Test:** Navigate to a workspace detail page, click "Invite Member", inspect the dialog header
**Expected:** Dialog shows "Invite to [Workspace Name]" with "in [Org Name]" subtitle text
**Why human:** Dialog receives workspaceName and orgName as runtime props — verified in code but needs visual confirmation

**4. Onboarding Persistence**

**Test:** Complete the onboarding explorer on a test account, log out, log back in
**Expected:** ModelExplorer does NOT appear on subsequent logins
**Why human:** Requires a real authenticated Supabase session to verify user_profiles JSONB persistence

**5. Email Template Audit (WKSP-01)**

**Test:** Check Supabase Dashboard -> Authentication -> Email Templates for all templates (confirmation, magic link, invite, password reset)
**Expected:** Zero instances of "Bank", "Vault", "Hub" in any email template
**Why human:** Supabase dashboard templates cannot be read programmatically; Plan 16-07 Task 3 flagged this as manual step

---

### Gaps Summary

Two gaps prevent full goal achievement:

**Gap 1 (Blocker for Success Criterion 2): Workspace filtering not wired**

Success criterion 2 requires "a new user completes signup, sees Personal Organization and My Calls Workspace auto-created, and can navigate the 4-level model." Implicit in this is that when a user selects a workspace, the calls list scopes to that workspace. The code explicitly defers this to "Plan 16-08+" with a comment. The workspace context store is correctly tracking activeWorkspaceId, and the sidebar correctly highlights the active workspace — but the calls list ignores it entirely (all recordings always shown). This requires a vault_entries join to filter by workspace.

**Gap 2 (Functional gap in navigation): Folder breadcrumb missing**

When a folder is active, the breadcrumb trail shows Org / Workspace but silently drops the Folder level. The useFolders hook exists and is imported into the breadcrumb component, but the folder lookup logic to find a folder by activeFolderId was never added. The fix is small: find the folder from useFolders(activeWorkspaceId) by activeFolderId and push it to the breadcrumb items array.

Both gaps are contained to the calls list page and breadcrumb component. All services, stores, hooks, migration, redirects, invite flows, onboarding, member management, and DnD infrastructure are fully verified and wired.

---

_Verified: 2026-02-28T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
