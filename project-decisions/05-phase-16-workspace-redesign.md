# Phase 16: Workspace Redesign

**Type:** Full feature build (8 plans)

**Goal:** Rename Bank/Vault/Hub to Organization/Workspace/Folder without breaking the database. Implement the full organizational hierarchy UX: org switching, workspace creation, folder management, invite/membership flows, and onboarding.

**Out of scope:** Import connectors, routing rules, MCP changes, AI features.

---

## Critical Discovery

The `folders` table has `bank_id` but NO `vault_id` column. An additive migration is required before folder-scoped queries can work. URL redirects must ship BEFORE any UI rename touches routes.

---

## Plan 01 — URL Redirects + Schema Foundation

### Vercel Redirects

- [ ] Add 7 server-level 301 redirects in `vercel.json` for all old paths (`/vaults` -> `/workspaces`, `/bank` -> `/workspaces`, etc.)
- [ ] These must ship BEFORE any UI changes to prevent broken links

### Database Migration

- [ ] Create `workspace_invitations` table (id, vault_id, email, role, token, status, invited_by, created_at, expires_at)
- [ ] Add `vault_id` column to `folders` table and backfill from vault_entries relationships
- [ ] Add `is_archived` and `archived_at` columns to `folders` table
- [ ] Add `is_default` column to `vaults` table and backfill for all personal vaults
- [ ] Update `handle_new_user()` trigger to set `is_default = true` on auto-created personal vault
- [ ] Create `get_workspace_invite_details` SECURITY DEFINER RPC (public-facing, no auth required — used by invite acceptance page)
- [ ] Create `accept_workspace_invite` RPC (auth required — creates membership, updates invite status)
- [ ] Create `protect_default_workspace` BEFORE DELETE trigger (prevents deletion of the user's default/personal workspace)

### TypeScript Types

- [ ] Create `src/types/workspace.ts` with type aliases:
  - `Organization` = mapped from BankRow
  - `Workspace` = mapped from VaultRow
  - `Folder` = mapped from FolderRow
  - `WorkspaceInvitation` = mapped from workspace_invitations
  - `WorkspaceRole` = 'viewer' | 'member' | 'admin'
- [ ] Use TypeScript type aliases over DB views — avoids RLS complexity while keeping clean naming
- [ ] Supabase queries still use real table names: `supabase.from('banks')`, `supabase.from('vaults')`

---

## Plan 02 — Data Layer (Services + Hooks + Store)

### Organization Context Store

- [ ] Create `src/stores/orgContextStore.ts` (Zustand v5):
  - `activeOrgId` / `activeWorkspaceId` / `activeFolderId`
  - localStorage persistence
  - **Key decision:** `setActiveOrg` MUST reset workspace + folder to null (switching orgs = clean context)
  - This reset behavior is locked and should not be changed

### Services

- [ ] Create `src/services/organizations.service.ts` — queries `banks` table using TypeScript type aliases
- [ ] Create `src/services/workspaces.service.ts` — queries `vaults` table using TypeScript type aliases
- [ ] Note: `getWorkspaces` needs to sort `is_default` workspaces first — if the column isn't in generated types yet, sort client-side

### Hooks

- [ ] Create `src/hooks/useOrganizations.ts` wrapping organization service with TanStack Query
- [ ] Create `src/hooks/useWorkspaces.ts` wrapping workspace service with TanStack Query
- [ ] Create `src/hooks/useOrgContext.ts` — convenience hook combining store + query data

---

## Plan 03 — Navigation Components

### OrgSwitcherBar

- [ ] Build `OrgSwitcherBar.tsx` — h-10 bar spanning full AppShell width ABOVE all panes (not just sidebar)
- [ ] Brand icons per org type
- [ ] RiCheckLine for active org indicator
- [ ] Dropdown to switch between orgs

### WorkspaceSidebarPane

- [ ] Build `WorkspaceSidebarPane.tsx` — secondary sidebar pane showing workspaces + folders
- [ ] Use Radix Collapsible per workspace (expand/collapse to show folders)
- [ ] For workspace creation: use `window.prompt()` as a deliberate stub (will be replaced with proper dialog in Phase 16.1)

### WorkspaceBreadcrumb

- [ ] Build `WorkspaceBreadcrumb.tsx` with array of BreadcrumbItems
- [ ] Use TanStack Router `Link` for navigation
- [ ] Mobile: show last 2 breadcrumb items only
- [ ] Level 3 folder breadcrumb needs `useFolders` lookup to resolve folder name from ID

---

## Plan 04 — Folder Management

### Folder Service

- [ ] Create `src/services/folders.service.ts` with full CRUD:
  - `getFolders(workspaceId)`, `createFolder(name, workspaceId)`, `renameFolder(id, name)`
  - `archiveFolder(id)`, `unarchiveFolder(id)`
  - `assignCallToFolder(callId, folderId)`, `removeCallFromFolder(callId, folderId)`, `moveCallToFolder(callId, fromFolderId, toFolderId)`
- [ ] Note: DB uses `parent_id` not `parent_folder_id`
- [ ] Note: `folder_assignments` uses `call_recording_id: number` (legacy Fathom numeric ID)
- [ ] Note: `is_archived` may not be in generated types — use `supabase as any` if needed

### Drag-and-Drop

- [ ] Install @dnd-kit/core
- [ ] Build `DndCallProvider.tsx` — MouseSensor with 10px activation distance, TouchSensor with 250ms delay, DragOverlay
- [ ] Build `FolderDropZone.tsx` — useDroppable, orange tint on hover when dragging
- [ ] DnD on desktop only; action menu is the assignment path on mobile

---

## Plan 05 — Invite and Membership

### Services + Hooks

- [ ] Create `src/services/invitations.service.ts` — create invite, accept invite, revoke invite, resend invite
- [ ] Create `src/hooks/useInvitations.ts` wrapping with TanStack Query

### WorkspaceInviteDialog

- [ ] Two tabs: Email invite + Link invite
- [ ] Role picker: Viewer / Member / Admin
- [ ] Org + workspace context shown in dialog header (WKSP-10)
- [ ] **Decision: Email delivery is deferred** — invite creates DB record and auto-copies shareable link to clipboard
- [ ] Show "Email notifications coming soon" disclaimer

### WorkspaceMemberPanel

- [ ] Radix Tabs: Members tab (role change, remove member) + Pending Invites tab (resend, revoke)

### Join Workspace Route

- [ ] Build `/join/workspace/$token` route
- [ ] Show full invite context (who invited, which workspace, what role)
- [ ] Accept / Decline buttons
- [ ] Handle all edge cases: expired invite, revoked invite, invite not found, already a member

---

## Plan 06 — Onboarding Explorer

### Interactive Model Explorer

- [ ] Build `ModelExplorer.tsx` — 5-step walkthrough explaining Organization > Workspace > Folder hierarchy
- [ ] Use motion/react AnimatePresence for step transitions
- [ ] Progress dots at bottom

### Persistence

- [ ] Build `useOnboarding.ts` hook
- [ ] Persist `onboarding_seen_v2` in `user_profiles.auto_processing_preferences` JSONB (server-side persistence)
- [ ] Note: `user_preferences` table does not exist — use the JSONB field on `user_profiles`
- [ ] Share `showOnboarding` state via `preferencesStore` (Zustand) between SidebarNav and `_authenticated.tsx`

---

## Plan 07 — Integration + Terminology Sweep

### Wire Everything Together

- [ ] Wrap calls list with DndCallProvider in index.tsx
- [ ] Add DraggableCallRow to each call in the list
- [ ] Add FolderDropZone on each sidebar folder
- [ ] Build CallActionMenu with "Move to Folder" submenu and folder picker
- [ ] Replace inline folder query in WorkspaceSidebarPane with `useFolders(workspaceId)` hook for cache coherence

### WKSP-01/02/03 Terminology Sweep

- [ ] Search entire v2 codebase for any user-facing "Bank", "Vault", or "Hub" strings
- [ ] Replace all instances with Organization, Workspace, Folder respectively
- [ ] "Import Hub" becomes "Import Calls"
- [ ] Verify zero user-facing legacy naming remains

---

## Plan 08 — Gap Closure (If Needed After Verification)

### Filtered Call Queries

- [ ] Build `getRecordingsByWorkspace(workspaceId)` — two-step query via vault_entries
- [ ] Build `getRecordingsByFolder(folderId)` — two-step query via folder_assignments
- [ ] Build `useWorkspaceRecordings(workspaceId, folderId)` — single unconditional useQuery call using ternary-derived queryKey/queryFn
- [ ] **Important:** Do NOT use conditional hooks (if/else around useQuery) — this violates React Rules of Hooks. Use a single useQuery with ternary-derived parameters instead.

### Breadcrumb Completion

- [ ] Ensure Level 3 folder breadcrumb resolves folder name from ID using `useFolders` lookup
