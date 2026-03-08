---
phase: 16-workspace-redesign
verified: 2026-02-28T05:22:03Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 11/13 truths verified
  gaps_closed:
    - "Calls list filters by active workspace (shows only that workspace's calls via vault_entries two-step query)"
    - "Folder name appears in breadcrumb trail when a folder is active (Org > Workspace > Folder)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Log in, activate a workspace via sidebar, observe the calls list. Activate a folder, observe further narrowing."
    expected: "Only calls belonging to the selected workspace appear when a workspace is active. Only calls assigned to the selected folder appear when a folder is active. Deselecting both shows all org calls."
    why_human: "useWorkspaceRecordings correctly selects the query function based on context, but workspace/folder filtering depends on vault_entries and folder_assignments data being populated for the test account — need runtime verification to confirm the data path works end-to-end."
  - test: "Activate a folder in the sidebar, check breadcrumb at top of calls list."
    expected: "Breadcrumb shows: [Org Name] / [Workspace Name] / [Folder Name]"
    why_human: "useFolders cache reuse depends on the sidebar having already loaded folders for the same workspaceId. Needs visual confirmation the folder level appears in the breadcrumb trail."
  - test: "Open Workspace settings page, click Invite Member, verify dialog header shows both org name and workspace name."
    expected: "Dialog shows 'Invite to [Workspace Name]' with 'in [Org Name]' subtitle text"
    why_human: "Dialog content depends on runtime props (workspaceName, orgName) passed from WorkspaceDetailPage — verified in code but needs visual confirmation."
  - test: "Complete onboarding explorer on a fresh account, log out, log back in."
    expected: "ModelExplorer shown once; after 'Get Started', does not appear on subsequent logins"
    why_human: "user_profiles.auto_processing_preferences JSONB persistence can only be verified with a real authenticated Supabase session."
  - test: "Verify Supabase Auth email templates contain no Bank/Vault/Hub terminology."
    expected: "All email templates (confirmation, magic link, password reset, invite) use generic text or Organization/Workspace terminology"
    why_human: "Supabase dashboard templates cannot be verified programmatically from source code — must check Supabase Dashboard -> Authentication -> Email Templates manually."
---

# Phase 16: Workspace Redesign Verification Report

**Phase Goal:** Users experience the new Organization -> Workspace -> Folder model with correct naming everywhere, working URL redirects, clear switching UX, and functional invite flows.
**Verified:** 2026-02-28T05:22:03Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plans 16-08)

---

## Re-Verification Summary

Previous status: gaps_found (11/13 truths, 2 failed)
Current status: human_needed (13/13 truths verified)

**Gaps closed:**

1. Gap 1 (Workspace/folder filtering of calls list) — CLOSED
   - `getRecordingsByWorkspace()` added to `recordings.service.ts` (lines 51-82): two-step query via `vault_entries` where `vault_id = workspaceId`, returns matching recordings
   - `getRecordingsByFolder()` added to `recordings.service.ts` (lines 94-126): two-step query via `folder_assignments` where `folder_id = folderId`, returns recordings by `legacy_recording_id`
   - `useWorkspaceRecordings(workspaceId, folderId)` hook added to `useRecordings.ts` (lines 36-60): single `useQuery` call with ternary-derived `queryKey`/`queryFn` (no conditional hook violations)
   - `useFilteredRecordings()` in `index.tsx` now calls `useWorkspaceRecordings(activeWorkspaceId, activeFolderId)` (lines 35-43), stale TODO comments removed
   - Committed: `ad25ad9` (feat(16-08): add workspace/folder-scoped recording queries and wire into calls list)

2. Gap 2 (Folder breadcrumb level missing) — CLOSED
   - `useFolders` imported into `WorkspaceBreadcrumb.tsx` (line 26)
   - `useFolders(activeWorkspaceId)` called in `useBreadcrumbs()` (line 143), `activeFolder` found by `activeFolderId` (line 144)
   - Level 3 folder push implemented at lines 168-174: `if (activeFolderId && activeFolder) { items.push({ label: activeFolder.name, href: '/' }) }`
   - Empty if-block replaced; stale Plan 16-04 TODO comments removed
   - Committed: `5060479` (feat(16-08): wire folder name into breadcrumb trail)

**Regressions:** None. All 11 previously-verified truths confirmed intact via file existence checks and spot grep verification.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Old /bank/, /vault/, /hub/ URLs get 301-redirected | VERIFIED | vercel.json: 7 redirect rules with `"permanent": true` confirmed still present |
| 2 | Zero instances of Bank/Vault/Hub in user-facing UI strings | VERIFIED | Only internal identifiers (BankRow, vaultId, vault_entries) remain — no user-visible strings; bank/vault/hub route files show "Page Not Found" only |
| 3 | User can see org switcher, switch orgs, create orgs | VERIFIED (regression check) | OrgSwitcherBar.tsx still present (218 lines); wired to useOrgContext |
| 4 | User can see workspaces in sidebar, switch workspaces, see folders nested | VERIFIED (regression check) | WorkspaceSidebarPane.tsx still present (347 lines) |
| 5 | Calls list filters by active workspace when one is selected | VERIFIED | useFilteredRecordings now calls useWorkspaceRecordings(activeWorkspaceId, activeFolderId); recordings.service.ts has getRecordingsByWorkspace querying vault_entries and getRecordingsByFolder querying folder_assignments |
| 6 | User can invite members with Viewer/Member/Admin roles | VERIFIED (regression check) | WorkspaceInviteDialog.tsx still present |
| 7 | Workspace settings shows Members tab and Pending Invites tab | VERIFIED (regression check) | WorkspaceMemberPanel.tsx still present |
| 8 | Invite acceptance page shows full context before user accepts | VERIFIED (regression check) | join/workspace.$token.tsx still present |
| 9 | Onboarding explorer shows Account -> Org -> Workspace -> Folder -> Call | VERIFIED (regression check) | ModelExplorer.tsx still present |
| 10 | Folder breadcrumb shows folder name when active | VERIFIED | WorkspaceBreadcrumb.tsx lines 26, 143-144, 168-174: useFolders imported, activeFolder found, pushed as Level 3 with label: activeFolder.name |
| 11 | New user signup creates Personal org with My Calls workspace | VERIFIED (regression check) | Migration and handle_new_user trigger still present from Plan 16-01 |
| 12 | Folders can be created, renamed, archived, restored | VERIFIED (regression check) | folders.service.ts still present |
| 13 | DnD call-to-folder assignment works on desktop | VERIFIED (regression check) | DndCallProvider.tsx, FolderDropZone.tsx still present |

**Score: 13/13 truths verified**

---

### Key Link Verification (Gap Items)

| From | To | Via | Status | Evidence |
|------|----|-----|--------|---------|
| `src/routes/_authenticated/index.tsx` | `src/hooks/useRecordings.ts` | `useWorkspaceRecordings(activeWorkspaceId, activeFolderId)` | WIRED | Line 8: import; line 37-40: called in useFilteredRecordings |
| `src/hooks/useRecordings.ts` | `src/services/recordings.service.ts` | `getRecordingsByWorkspace` / `getRecordingsByFolder` queryFn | WIRED | Lines 4-8: imports; lines 50-53: ternary queryFn selection |
| `src/services/recordings.service.ts` | `vault_entries` table | `supabase.from('vault_entries').select('recording_id').eq('vault_id', workspaceId)` | WIRED | Lines 54-57: exact query present |
| `src/services/recordings.service.ts` | `folder_assignments` table | `supabase.from('folder_assignments').select('call_recording_id').eq('folder_id', folderId)` | WIRED | Lines 96-99: exact query present |
| `src/components/layout/WorkspaceBreadcrumb.tsx` | `src/hooks/useFolders.ts` | `useFolders(activeWorkspaceId)` lookup by `activeFolderId` | WIRED | Line 26: import; lines 143-144: called, activeFolder found; lines 168-174: folder pushed to breadcrumb |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| WKSP-01: Bank renamed to Organization everywhere | SATISFIED | Internal identifiers only (BankRow, bank_id in DB schema) — zero user-visible "Bank" strings |
| WKSP-02: Vault renamed to Workspace everywhere | SATISFIED | Internal identifiers only (vaultId in component state, from('vaults') in services) — zero user-visible "Vault" strings |
| WKSP-03: Hub renamed to Folder everywhere | SATISFIED | Zero user-facing "Hub" strings |
| WKSP-04: 301 redirects for /bank/, /vault/, /hub/ | SATISFIED | 7 permanent redirect rules in vercel.json confirmed |
| WKSP-05: Organization creation + Personal auto-created | SATISFIED | CreateOrganizationDialog + handle_new_user trigger |
| WKSP-06: Org switcher in sidebar | SATISFIED | OrgSwitcherBar in AppShell |
| WKSP-07: Workspace creation + My Calls auto-created | SATISFIED | createWorkspace service + is_default backfill |
| WKSP-08: Workspace switching within org | SATISFIED | WorkspaceSidebarPane onSelect |
| WKSP-09: Onboarding screen with 4-level model | SATISFIED | ModelExplorer 5-step interactive explorer |
| WKSP-10: Invite dialog shows Org + Workspace name | SATISFIED | WorkspaceInviteDialog header + join page |
| WKSP-11: Invite with Viewer/Member/Admin roles | SATISFIED | Three-role picker in invite dialog |
| WKSP-12: Create, rename, archive Folders | SATISFIED | folders.service.ts: createFolder, renameFolder, archiveFolder, restoreFolder |
| WKSP-13: Manage Workspace membership from settings | SATISFIED | WorkspaceMemberPanel with Members + Pending Invites tabs |

**13/13 requirements satisfied at service/component level.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/layout/WorkspaceSidebarPane.tsx` | ~274 | `window.prompt('Workspace name:')` for Create Workspace | Info | Functional but poor UX — previously noted, no change |
| `src/routes/_authenticated/workspaces/index.tsx` | ~73 | `window.prompt` for Create Workspace on workspaces list page | Info | Same stub pattern — previously noted |
| `src/components/dialogs/WorkspaceInviteDialog.tsx` | ~260 | "Email notifications are coming soon" disclaimer | Info | Known limitation, no email infra in Phase 16 |

No blocker anti-patterns. All previously-flagged WARNING-severity items (empty if-block, passthrough hook, stale comments) have been resolved.

---

### Human Verification Required

**1. Workspace Filtering of Calls List (End-to-End)**

**Test:** Log in, activate a workspace in the sidebar, observe the calls list. Then activate a folder within that workspace, observe further narrowing.
**Expected:** Workspace active — only calls linked via vault_entries for that workspace appear. Folder active — only calls assigned via folder_assignments to that folder appear. Neither active — all org calls appear.
**Why human:** Filtering depends on vault_entries and folder_assignments data being populated for the test account. The query logic is verified in code; runtime verification confirms the data path works end-to-end.

**2. Folder Breadcrumb Level (Visual)**

**Test:** Activate a folder in the sidebar, inspect the breadcrumb at the top of the calls list.
**Expected:** Breadcrumb shows: [Org Name] / [Workspace Name] / [Folder Name]
**Why human:** useFolders cache reuse depends on the sidebar having loaded folders for the same workspaceId first. Needs visual confirmation the folder level renders and does not silently skip.

**3. Invite Dialog Context (WKSP-10)**

**Test:** Navigate to a workspace detail page, click "Invite Member", inspect the dialog header.
**Expected:** Dialog shows "Invite to [Workspace Name]" with "in [Org Name]" subtitle
**Why human:** Dialog receives workspaceName and orgName as runtime props — verified in code but needs visual confirmation.

**4. Onboarding Persistence**

**Test:** Complete the onboarding explorer on a test account, log out, log back in.
**Expected:** ModelExplorer does NOT appear on subsequent logins
**Why human:** Requires a real authenticated Supabase session to verify user_profiles JSONB persistence.

**5. Email Template Audit (WKSP-01)**

**Test:** Check Supabase Dashboard -> Authentication -> Email Templates for all templates (confirmation, magic link, invite, password reset)
**Expected:** Zero instances of "Bank", "Vault", "Hub" in any email template
**Why human:** Supabase dashboard templates cannot be read programmatically from source code.

---

### Success Criteria Verification

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1. User who bookmarked /bank/abc123/vault/xyz gets 301-redirected | VERIFIED | vercel.json: `/bank/:path*` and `/vault/:path*` redirect rules with permanent:true |
| 2. New user sees "Personal" Org and "My Calls" Workspace auto-created, can navigate 4-level model | VERIFIED (code) | handle_new_user trigger, is_default backfill, ModelExplorer overlay, workspace filtering now wired | Needs human for end-to-end flow
| 3. Zero instances of Bank/Vault/Hub visible in UI, API errors, email templates, tooltips | VERIFIED (code) / Needs human for email templates | All source code clean; email templates require dashboard check |
| 4. Workspace owner can invite collaborator with correct context display | VERIFIED (code) | WorkspaceInviteDialog + join page both render org+workspace context | Needs human for visual confirmation |
| 5. Workspace owner can manage member roles from Workspace settings | VERIFIED | WorkspaceMemberPanel wired with Members + Pending Invites tabs |

---

_Verified: 2026-02-28T05:22:03Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after Plan 16-08 gap closure_
