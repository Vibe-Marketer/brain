---
phase: 16-workspace-redesign
plan: "02"
subsystem: data-layer
tags: [zustand, tanstack-query, supabase, organizations, workspaces, context-store]
dependency_graph:
  requires: ["16-01"]
  provides: ["orgContextStore", "organizations.service", "workspaces.service", "useOrganizations", "useWorkspaces", "useOrgContext"]
  affects: ["16-03", "16-04", "16-05", "16-06", "16-07"]
tech_stack:
  added: []
  patterns: ["Zustand v5 double-invocation", "localStorage cross-tab sync", "service+hook separation", "session-gated TanStack Query"]
key_files:
  created:
    - /Users/Naegele/dev/callvault/src/stores/orgContextStore.ts
    - /Users/Naegele/dev/callvault/src/services/organizations.service.ts
    - /Users/Naegele/dev/callvault/src/services/workspaces.service.ts
    - /Users/Naegele/dev/callvault/src/hooks/useOrganizations.ts
    - /Users/Naegele/dev/callvault/src/hooks/useWorkspaces.ts
    - /Users/Naegele/dev/callvault/src/hooks/useOrgContext.ts
  modified: []
decisions:
  - "orgContextStore persists activeOrgId and activeWorkspaceId to localStorage (callvault-org-context key) for cross-tab sync; activeFolderId is session-only"
  - "setActiveOrg resets activeWorkspaceId and activeFolderId to null — locked decision honored"
  - "getWorkspaceMembers returns WorkspaceMember with null displayName/email; profile enrichment deferred to UI layer that has access to auth.users"
metrics:
  duration: "2 minutes"
  completed: "2026-02-28"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 16 Plan 02: Data Layer (Org Context + Services + Hooks) Summary

**One-liner:** Zustand v5 org context store with localStorage cross-tab sync, Supabase service layers for banks/vaults tables, and session-gated TanStack Query hooks for organizations and workspaces.

---

## What Was Built

### Task 1: Org Context Store + Organization Service/Hooks (commit: 52989c3)

**`src/stores/orgContextStore.ts`**

Zustand v5 store tracking `activeOrgId`, `activeWorkspaceId`, `activeFolderId`, and `isInitialized`. Uses the v5 double-invocation pattern: `create<T>()(...)`.

Key behaviors:
- `setActiveOrg(orgId)` — resets `activeWorkspaceId = null` and `activeFolderId = null` (locked decision: clean slate per org)
- `setActiveWorkspace(workspaceId)` — resets `activeFolderId = null` (folder context is workspace-specific)
- Persists `activeOrgId` and `activeWorkspaceId` to localStorage key `callvault-org-context`
- Cross-tab sync via `storage` event listener on `callvault-org-context-updated` key
- `initialize(orgId, workspaceId?)` — called by `useOrgContext` on first data load
- `reset()` — clears all state and removes localStorage entry (for logout)

**`src/services/organizations.service.ts`**

Plain async functions following the `recordings.service.ts` pattern:
- `getOrganizations(userId)` — queries `bank_memberships` joined with `banks`, returns `OrganizationWithRole[]` (includes `membershipRole` and `membershipId`)
- `getOrganizationById(orgId)` — single org fetch from `banks`
- `createOrganization(userId, name)` — inserts into `banks` (type='business'), creates `bank_memberships` as `bank_owner`
- `isPersonalOrg(org)` — helper: `org.type === 'personal'` (never by name)

All queries use `supabase.from('banks')` — never 'organizations'.

**`src/hooks/useOrganizations.ts`**

TanStack Query hooks:
- `useOrganizations()` — `queryKeys.organizations.list()`, enabled when `!!session && !!user`
- `useCreateOrganization()` — mutation, invalidates `organizations.all` on success

**`src/hooks/useOrgContext.ts`**

Convenience hook combining store state with live data:
- Auto-initializes on first load: selects personal org (type='personal'), falls back to first org
- Returns `{ activeOrgId, activeWorkspaceId, activeFolderId, activeOrg, organizations, isLoading, switchOrg, switchWorkspace, switchFolder, reset, isPersonalOrg, activeOrgRole }`
- `switchOrg(orgId)` calls `store.setActiveOrg()` which triggers the locked reset

---

### Task 2: Workspace Service + Hooks (commit: 109ee56)

**`src/services/workspaces.service.ts`**

Plain async functions:
- `getWorkspaces(orgId)` — queries `vaults` where `bank_id = orgId`, client-side sorts by `is_default DESC, name ASC`
- `getWorkspaceById(workspaceId)` — single workspace fetch
- `createWorkspace(orgId, userId, name, isDefault?)` — inserts into `vaults`, creates `vault_memberships` as `vault_owner`
- `getWorkspaceMembers(workspaceId)` — queries `vault_memberships`, returns `WorkspaceMember[]`
- `updateMemberRole(workspaceId, userId, newRole)` — updates `vault_memberships.role`
- `removeMember(workspaceId, userId)` — deletes from `vault_memberships`

All queries use `supabase.from('vaults')` — never 'workspaces'.

**`src/hooks/useWorkspaces.ts`**

TanStack Query hooks:
- `useWorkspaces(orgId)` — `queryKeys.workspaces.list()`, enabled when `!!session && !!orgId`
- `useWorkspace(workspaceId)` — `queryKeys.workspaces.detail(id)`, enabled when `!!session && !!workspaceId`
- `useCreateWorkspace()` — mutation, invalidates `workspaces.all`, auto-selects new workspace in store
- `useWorkspaceMembers(workspaceId)` — `queryKeys.workspaces.members(id)`, session-gated
- `useUpdateMemberRole()` — mutation, invalidates workspace members on success
- `useRemoveMember()` — mutation, invalidates workspace members on success

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getWorkspaces sorts is_default client-side instead of SQL ORDER BY**
- **Found during:** Task 2
- **Issue:** The `is_default` column added in Phase 16 migration is not yet in the generated `supabase.ts` types, so `supabase.from('vaults').order('is_default', ...)` would cause a TypeScript error
- **Fix:** Query with `.order('name', { ascending: true })` and sort client-side after casting to `any[]`. Added TODO comment explaining this is a temporary workaround until `supabase gen types` is re-run
- **Files modified:** `src/services/workspaces.service.ts`
- **Commit:** 109ee56

**2. [Rule 3 - Missing feature] WorkspaceMember profile enrichment deferred**
- **Found during:** Task 2
- **Issue:** The plan requested `display_name, email, joined_at` from `auth.users` join, but `auth.users` is not directly accessible from the browser client (requires service role or RPC). Forcing a join would fail at runtime.
- **Fix:** `getWorkspaceMembers` returns `userId` on each member. `displayName` and `email` fields are initialized to `null`. UI layers that need profile data will call a dedicated RPC or fetch from `profiles` table. This is correct for the data layer — profile enrichment is a UI concern.
- **Files modified:** `src/services/workspaces.service.ts`
- **Commit:** 109ee56

---

## Success Criteria Verification

| Criterion | Status |
|-----------|--------|
| orgContextStore tracks activeOrgId/activeWorkspaceId/activeFolderId with localStorage persistence | PASS |
| Org switch resets workspace to null (locked decision honored) | PASS |
| Service functions query banks/vaults tables (not renamed tables) | PASS |
| TanStack Query hooks are session-gated and use queryKeys factory | PASS |
| Build passes with zero TypeScript errors | PASS |

---

## Self-Check: PASSED

Files verified:
- `/Users/Naegele/dev/callvault/src/stores/orgContextStore.ts` — exists
- `/Users/Naegele/dev/callvault/src/services/organizations.service.ts` — exists
- `/Users/Naegele/dev/callvault/src/services/workspaces.service.ts` — exists
- `/Users/Naegele/dev/callvault/src/hooks/useOrganizations.ts` — exists
- `/Users/Naegele/dev/callvault/src/hooks/useWorkspaces.ts` — exists
- `/Users/Naegele/dev/callvault/src/hooks/useOrgContext.ts` — exists

Commits verified:
- `52989c3` — Task 1: org context store, organization service, and hooks
- `109ee56` — Task 2: workspace service and TanStack Query hooks
