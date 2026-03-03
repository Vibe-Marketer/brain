# Home Page Bug Fixes & Pane Architecture Corrections

**Date:** 2026-03-02 (updated 2026-03-03)
**Status:** Ready for implementation
**Scope:** brain repo (v1 frontend + Supabase edge functions)
**Priority:** CRITICAL — data isolation gap + core navigation broken

---

## Context

The home page (`TranscriptsNew.tsx`) has accumulated multiple bugs from features being added at different times. The org/workspace/folder hierarchy exists in the store and UI components, but the actual call filtering is broken — switching orgs, workspaces, or folders doesn't properly filter the displayed calls. The pane architecture also has layout issues.

**ACTIVE DATA BREACH:** Calls ARE bleeding between user accounts in production. Three independent investigations confirmed multiple vectors. The `recordings` table RLS is too broad (any org member sees all org recordings), the personal org query path has zero user filtering, and there are additional unfiltered query paths on `CallDetailPage` and `RecurringTitlesTab`.

**References:**
- `project-decisions/17-unified-home-navigation.md` — target navigation architecture
- `project-decisions/000-workspace-per-import-source-architecture.md` — workspace-per-source rules (NOT yet implemented)

---

## Hard Rules (Read First)

Each element has exactly ONE job:

| Element | Job | What it must NOT do |
|---------|-----|---------------------|
| **TopBar org dropdown** | Switch organizations ("which company am I in?") | Must NOT contain workspace switching, breadcrumbs, or any other UI |
| **Pane 1 (Sidebar)** | Switch between app sections (Home, Import, Settings) | — |
| **Pane 2** | Navigate workspaces and folders ("which project/folder?") | Must NOT have glassmorphism, must NOT contain org switching |
| **Pane 3** | View content (call list, filtered by Pane 2 selections) | Must NOT contain Pane 4 content inline |
| **Pane 4** | Inspect details (call detail, bulk actions, workspace members) | Must be rendered via AppShell's detail pane system, NOT inline in Pane 3 |

**Org switching = TopBar. Workspace/folder switching = Pane 2. Never mix these.**

---

## Bug 0: ACTIVE DATA BREACH — Multiple Call Bleed Vectors (FIX FIRST)

### Summary

Calls are actively bleeding between user accounts. Three independent code audits confirmed FIVE unsafe query paths and one overly-broad RLS policy. This is not theoretical — the user is seeing other users' calls in their account RIGHT NOW.

### Vector 0A: `recordings` RLS Policy Is Too Broad

**File:** `supabase/migrations/20260301000002_recreate_rls_policies.sql`, line 246

The current SELECT policy on `recordings` is:
```sql
CREATE POLICY "Users can view recordings in their organizations"
  ON recordings FOR SELECT
  USING (is_organization_member(organization_id, auth.uid()));
```

This means **ANY member of an organization can see ALL recordings in that organization** — not just their own. If User A and User B are both members of the same org (via workspace invites, team membership, or a migration bug), they see each other's calls. This is the most likely cause of the active bleed.

**Fix — new migration required:**
```sql
-- Drop the overly broad policy
DROP POLICY IF EXISTS "Users can view recordings in their organizations" ON recordings;

-- Users can ALWAYS see their own recordings
CREATE POLICY "Users can view own recordings"
  ON recordings FOR SELECT
  USING (owner_user_id = auth.uid());

-- Users can see recordings shared into workspaces they belong to
CREATE POLICY "Users can view shared recordings in their workspaces"
  ON recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_entries we
      JOIN workspace_memberships wm ON wm.workspace_id = we.workspace_id
      WHERE we.recording_id = recordings.id
        AND wm.user_id = auth.uid()
    )
  );
```

### Vector 0B: Personal Org Query Has No user_id Filter

**File:** `src/components/transcripts/TranscriptsTab.tsx`, lines ~246-278

When `isPersonalOrganization` is `true`, the query executes with ZERO user filtering:
```sql
SELECT * FROM fathom_calls ORDER BY created_at DESC LIMIT 20
-- NO user_id FILTER
```

The code relies entirely on RLS to prevent cross-account reads. But RLS is only one layer — if there is ANY gap (which there IS, see Vector 0A above on the `recordings` table), calls bleed.

**Fix:** ALWAYS add `.eq("user_id", user.id)` to the query, regardless of org type:
```typescript
// ALWAYS filter by user_id — defense in depth
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  query = query.eq("user_id", user.id);
}
// THEN also apply org/workspace filters on top
```

### Vector 0C: CallDetailPage Has No user_id Filter

**File:** `src/pages/CallDetailPage.tsx`, line ~95
```typescript
supabase.from('fathom_calls').select('*').eq('recording_id', recordingId!).single()
```
No `user_id` filter. Anyone who knows a `recording_id` (a sequential integer) can view any call by navigating to `/calls/12345`. Fix: add `.eq("user_id", user.id)`.

### Vector 0D: RecurringTitlesTab Has No Filters At All

**File:** `src/components/transcripts/RecurringTitlesTab.tsx`, line ~79
```typescript
supabase.from("fathom_calls").select("title").not("title", "is", null)
```
Zero user filtering. Returns titles from ALL users' calls. Fix: add `.eq("user_id", user.id)`.

### Vector 0E: `isPersonalOrganization` Race Condition

**File:** `src/hooks/useOrganizationContext.ts`, line ~118

During initialization (before orgs load), `activeOrganization` is `null`, so `isPersonalOrganization` evaluates to `false` — triggering the business org code path even for personal org users. This means during startup, the wrong query path briefly executes.

**Fix:** Add a loading guard — don't query calls until `isInitialized` is `true` and `activeOrganization` is resolved.

### Vector 0F: Dual Org Context Store (Dead Code Risk)

Two separate org context stores exist:
- `src/stores/orgContextStore.ts` — the active v2 store
- `src/stores/organizationContextStore.ts` — a broken legacy store with DUPLICATE property declarations

If ANY component imports the legacy store instead of the v2 store, it would have unsynchronized state. **Fix:** Delete `organizationContextStore.ts` entirely and grep for any imports of it.

### Complete Unsafe Query Audit

| File | Line | Filter | Status |
|------|------|--------|--------|
| `TranscriptsTab.tsx` | ~267 | **NONE** (personal org path) | **UNSAFE** |
| `CallDetailPage.tsx` | ~95 | `.eq('recording_id', id)` only | **UNSAFE** |
| `RecurringTitlesTab.tsx` | ~79 | **NONE** | **UNSAFE** |
| `FilterBar.tsx` | ~73 | `.eq("user_id", user.id)` | Safe |
| `CallDetailPanel.tsx` | ~58 | `.eq("user_id", user.id)` | Safe |
| `SyncTab.tsx` | ~97 | `.eq("user_id", user.id)` | Safe |
| `useCallDetailQueries.ts` | ~73 | `.eq("user_id", userId)` | Safe |
| `useCallAnalytics.ts` | ~46 | `.eq("user_id", user.id)` | Safe |
| `useContacts.ts` | ~318 | `.eq("user_id", user.id)` | Safe |
| All other query paths | — | Have `user_id` filter | Safe |

### Implementation — Do This FIRST Before Anything Else

1. **New Supabase migration** — tighten `recordings` SELECT RLS to `owner_user_id = auth.uid()` plus workspace-based sharing (see SQL above)
2. **Add `.eq("user_id", user.id)` to ALL three unsafe query paths** — TranscriptsTab, CallDetailPage, RecurringTitlesTab
3. **Delete `organizationContextStore.ts`** — grep for imports first, redirect any to `orgContextStore.ts`
4. **Add loading guard** — don't run call queries until org context is fully initialized
5. **Audit edge functions** in `supabase/functions/` — any function using `SUPABASE_SERVICE_ROLE_KEY` that reads `fathom_calls` or `recordings` MUST have `.eq('owner_user_id', userId)`. Service role bypasses ALL RLS.
6. **Verify `fathom_calls` table status** — migration `20260227000002_archive_fathom_calls.sql` renamed it to `fathom_calls_archive`. If this migration has been applied to production, ALL queries to `fathom_calls` are silently failing. If it HASN'T been applied, the old table is live and the bleed is through it. Run: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'fathom%';`

### Also Check: Cross-Org Isolation

When a user has BOTH personal and business orgs, calls must NOT bleed between them:
- **Fathom sync always assigns calls to the personal org** (via `connector-pipeline.ts` line ~130) regardless of which org is active. This is by design but means business org view may appear empty if calls were never explicitly moved/shared.
- **Switching orgs must fully reset** — `setActiveOrg` resets workspace and folder to null. Verify TanStack Query cache is invalidated (it should be — `activeOrganizationId` is in the query key)

---

## Bug 1: Workspace/Folder Filtering Is Broken

### What's wrong

The call list query in `TranscriptsTab` fetches ALL calls for the org. The query key is:
```
["tag-calls", searchQuery, combinedFilters, page, pageSize, activeOrganizationId, isPersonalOrganization]
```

`activeWorkspaceId` is NOT in the query key. Switching workspaces updates the store but does NOT trigger a new query or filter the results.

Folder filtering is client-side via `folderAssignments`, but `useFolderAssignments(activeWorkspaceId)` returns `{}` when `activeWorkspaceId` is null — so folder selection shows empty results unless a workspace is explicitly selected.

### What to fix

1. **Add `activeWorkspaceId` to the query key** in `TranscriptsTab` so workspace switching triggers a re-fetch or re-filter
2. **Filter calls by workspace** — either:
   - Server-side: add workspace scoping to the Supabase query (preferred — fewer calls transferred)
   - Client-side: filter the results by workspace membership after fetch
3. **Fix folder filtering** — `folderAssignments` must load correctly for the active workspace. When no workspace is selected ("All Calls" / Home view), show all calls across all workspaces in the active org
4. **Verify the full chain works:**
   - Switch org in TopBar → call list shows only that org's calls
   - Click workspace in Pane 2 → call list shows only that workspace's calls
   - Click folder in Pane 2 → call list shows only that folder's calls
   - Click "Home" or deselect all → call list shows all calls for the active org

### Files to check
- `src/components/transcripts/TranscriptsTab.tsx` — query key and filtering logic (lines ~241-372)
- `src/pages/TranscriptsNew.tsx` — how `activeFolderId` and `folderAssignments` are passed down
- `src/hooks/useOrganizationContext.ts` — the bridge hook
- `src/hooks/useWorkspaces.ts` — workspace data fetching
- `src/lib/folder-icons.ts` or related — folder assignment lookups

---

## Bug 2: BulkActionToolbarEnhanced Is Not in Pane 4

### What's wrong

`BulkActionToolbarEnhanced` is currently rendered as a flex sibling INSIDE `TranscriptsTab` (Pane 3). It slides in from the right within the main content area, compressing the table. This is wrong — it should be a proper Pane 4 that pushes in from the right as a full-height panel via the AppShell's detail pane system.

Currently, `TranscriptsNew.tsx` does NOT pass `showDetailPane: true` to the AppShell config. The detail pane system (`DetailPaneOutlet`) is not being used for this panel.

### What to fix

1. **Remove** `BulkActionToolbarEnhanced` from inside `TranscriptsTab`
2. **Wire it into the Pane 4 system** — when calls are selected, open the detail pane via the panel store (`usePanelStore` or equivalent):
   - Panel type: `'bulk-actions'` (add this to the panel type union if needed)
   - Panel data: the selected call IDs
3. **Pass `showDetailPane: true`** to the AppShell config in `TranscriptsNew.tsx`
4. **Render `BulkActionToolbarEnhanced`** inside `DetailPaneOutlet` when panel type is `'bulk-actions'`
5. The panel must be **full height**, push in from the right as a Pane 4, and cause Pane 3 to **shrink** to make room (same z-plane, no overlay)
6. When selection is cleared (0 calls selected), close the detail pane

### Files to check
- `src/components/transcript-library/BulkActionToolbarEnhanced.tsx` — the component itself
- `src/components/transcripts/TranscriptsTab.tsx` — where it's currently rendered inline
- `src/pages/TranscriptsNew.tsx` — AppShell config (needs `showDetailPane: true`)
- `src/components/panels/` — where detail panel components live
- AppShell component — detail pane outlet rendering

---

## Bug 3: Pane 2 Has Wrong Styling (Glassmorphism)

### What's wrong

`WorkspaceSidebarPane` has glassmorphism styling that doesn't match the rest of the app:
- Container: `bg-card/10 border-r border-border/20`
- Org card inside it: `bg-card/60 backdrop-blur-sm`
- AppShell wraps it in: `bg-card/80 backdrop-blur-md rounded-2xl`

There should be no `backdrop-blur`, no transparency (`/10`, `/60`, `/80`), no glass effects.

### What to fix

1. **Remove all glassmorphism** from the Pane 2 container:
   - No `backdrop-blur-sm` or `backdrop-blur-md`
   - No partial opacity backgrounds (`bg-card/10`, `bg-card/60`, `bg-card/80`)
2. **Match sidebar styling** — Pane 2 should use the same visual treatment as Pane 1 (the sidebar nav):
   - Solid `bg-card` background
   - Standard `border-border` borders (not `/20` or `/40` opacity)
3. **Active item styling** should match the sidebar's active state pattern — vibe-orange tint, highlighted text, clear selected state
4. Check both `WorkspaceSidebarPane.tsx` AND the AppShell's wrapper for the secondary pane — glass styling may come from either level

### Files to check
- `src/components/panes/WorkspaceSidebarPane.tsx` — component-level glass styles
- AppShell component — the wrapper div around the secondary pane
- `src/components/ui/sidebar-nav.tsx` — reference for correct active item styling

---

## Bug 4: TopBar Org Dropdown Has Extra UI

### What's wrong

The org dropdown currently contains workspace items (showing "Workspaces in [OrgName]" with individual workspace entries and an "All Recordings" option). It may also contain breadcrumb-like elements. The dropdown should ONLY show organizations.

Additionally, the dropdown visually blends in with the rest of the TopBar — it should stand out as an interactive element.

### What to fix

1. **Remove ALL workspace references** from the org dropdown:
   - No "Workspaces in..." section
   - No individual workspace items
   - No "All Recordings" option
   - ONLY: list of orgs (personal + business), active org checkmark, "Create Organization" at bottom
2. **Visual treatment** — the org dropdown trigger button should:
   - Have a `bg-card` (white) background
   - Have a `border border-border` border
   - Look like a card/pill that stands out from the TopBar background
   - NOT blend in with the headline text color
3. **Remove any breadcrumbs** from the dropdown itself (breadcrumbs in the page header / Pane 3 are fine)

### Files to check
- `src/components/header/OrganizationSwitcher.tsx` — the dropdown component
- TopBar / header component — where the switcher is placed

---

## Bug 5: Sidebar Toggle Label Is Wrong

### What's wrong

The sidebar toggle button in `SidebarNav` says "Library Panel" — this doesn't accurately describe what it toggles (the workspace/folder navigation pane).

### What to fix

Rename "Library Panel" to **"Workspace Panel"** (or "Navigation Panel").

**File:** `src/components/ui/sidebar-nav.tsx`, line ~384:
```tsx
// BEFORE:
{!isCollapsed && <span className="text-sm text-muted-foreground truncate">Library Panel</span>}

// AFTER:
{!isCollapsed && <span className="text-sm text-muted-foreground truncate">Workspace Panel</span>}
```

---

## Bug 6: Visual Overflow Issues in Pane 2 and Main Page

### What's wrong

Multiple elements are overflowing their container bounds on the home page. Content is visually "spilling out" of the panes it should be contained in.

### What to fix

1. **Audit all pane containers** for proper `overflow-hidden` or `overflow-y-auto` on the outer wrapper
2. **Pane 2 (`WorkspaceSidebarPane`):**
   - The outer container must have `overflow-hidden` with an inner scrollable area (`overflow-y-auto`) for the workspace/folder list
   - Header (workspace label + add button) should be sticky/fixed at top, not scroll with content
3. **Pane 3 (main content area):**
   - The table container must clip to its bounds
   - Check that the page header and tab bar don't push content outside the pane
4. **Test at different viewport sizes** to ensure panes don't overflow at narrower widths

---

## Bug 7: Folder Assignments Not Reflecting — Calls Not Showing in Folders (ROOT CAUSE FOUND)

### What's wrong

All folders are visible in Pane 2, but NONE of them show the calls that were previously assigned to them. Every folder appears to have 0 calls despite the user having organized hundreds of calls into folders previously.

### Root cause (confirmed via code trace)

**The folder assignment data is still in the database. The query can't find it because `folders.workspace_id` is NULL.**

The failure chain:

1. Migration `20260210170000_add_bank_id_to_folders_and_tags.sql` added `bank_id` to folders and backfilled it
2. Migration `20260228000001_workspace_redesign_schema.sql` added `vault_id` (later renamed to `workspace_id`) to folders and attempted to backfill from `bank_id → vaults.bank_id`:
   ```sql
   UPDATE folders f SET vault_id = (
     SELECT v.id FROM vaults v WHERE v.bank_id = f.bank_id
     ORDER BY v.created_at ASC LIMIT 1
   ) WHERE f.vault_id IS NULL AND f.bank_id IS NOT NULL;
   ```
   This backfill **silently fails** for any folder where the user's vault wasn't created yet, or where `bank_id` doesn't match any vault. Those folders keep `vault_id = NULL`.
3. Migration `20260301000001` renamed `vault_id → workspace_id`. NULL values stayed NULL.
4. At query time, `getFolderAssignments` in `src/services/folders.service.ts` (lines 119-165) does:
   ```typescript
   let folderQuery = supabase.from('folders').select('id')
   if (workspaceId) {
     folderQuery = folderQuery.eq('workspace_id', workspaceId)  // NULL rows DON'T MATCH
   }
   const folderIds = (folderIdsData ?? []).map(f => f.id)
   if (folderIds.length === 0) return {}  // ← Returns empty HERE
   ```
5. `TranscriptsTab` gets `folderAssignments = {}` → clicking any folder shows 0 calls

### Diagnostic SQL (run in Supabase SQL editor)

```sql
-- 1. Show folders with no workspace_id (the broken ones)
SELECT id, name, user_id, organization_id, workspace_id
FROM folders
WHERE workspace_id IS NULL;

-- 2. Confirm assignments still exist for those folders
SELECT fa.*, f.name as folder_name
FROM folder_assignments fa
JOIN folders f ON f.id = fa.folder_id
WHERE f.workspace_id IS NULL
LIMIT 20;

-- 3. Count total assignments per folder (should be > 0 for folders that had calls)
SELECT f.name, f.workspace_id, count(fa.id) as assignment_count
FROM folders f
LEFT JOIN folder_assignments fa ON fa.folder_id = f.id
WHERE f.user_id = auth.uid()
GROUP BY f.id, f.name, f.workspace_id
ORDER BY assignment_count DESC;
```

### What to fix

**Part 1 — Database patch (new migration):**
```sql
-- Backfill workspace_id on orphaned folders
UPDATE folders f
SET workspace_id = (
  SELECT w.id FROM workspaces w
  WHERE w.organization_id = f.organization_id
  ORDER BY w.created_at ASC
  LIMIT 1
)
WHERE f.workspace_id IS NULL
  AND f.organization_id IS NOT NULL;
```

**Part 2 — Query resilience in `getFolderAssignments`:**
Add a fallback: if no folders are found by `workspace_id`, query by `organization_id` (the RLS `user_id = auth.uid()` policy still allows access). This makes the query resilient to future NULL cases:
```typescript
// Primary: filter by workspace
let folderQuery = supabase.from('folders').select('id')
if (workspaceId) {
  folderQuery = folderQuery.eq('workspace_id', workspaceId)
} else if (organizationId) {
  // Fallback: if no workspace selected, get all folders for the org
  folderQuery = folderQuery.eq('organization_id', organizationId)
}
```

**Part 3 — Fix the type mismatch:**
`TranscriptsTab.tsx` declares `folderAssignments: Record<number, string[]>` but the service returns `Record<string, string[]>` (keys are `String(recording_id)`). JavaScript coerces number keys to strings so this works by accident, but the type declaration should be `Record<string, string[]>`.

**Part 4 — Show folder call counts:**
Each folder in the Pane 2 tree should show a count badge (e.g., "Inbound (12)") so the user can see at a glance which folders have calls.

### Files to fix
- `src/services/folders.service.ts` — `getFolderAssignments` function (lines 119-165)
- `src/hooks/useFolders.ts` — the `enabled` guard at line ~28 (disabled when `workspaceId` is null)
- `src/components/transcripts/TranscriptsTab.tsx` — type declaration for `folderAssignments` prop
- New Supabase migration — backfill `workspace_id` on orphaned folders
- `src/components/panes/WorkspaceSidebarPane.tsx` — add folder call counts

---

## Bug 8: Workspace Switching Does Nothing — YouTube, Zoom, etc. Show No Calls

### What's wrong

Clicking a workspace (e.g., "YouTube") in Pane 2 does not filter the call list. All workspaces show the same calls. The YouTube workspace should show only YouTube imports, the Fathom workspace should show only Fathom calls, etc.

This is a combination of Bug 1 (query doesn't include `activeWorkspaceId`) and the fact that the workspace-per-import-source architecture from `project-decisions/000-workspace-per-import-source-architecture.md` has NOT been implemented yet.

### What's supposed to happen (per 000-workspace-per-import-source-architecture.md)

1. **Every import source gets its own auto-created workspace** — Fathom workspace, YouTube workspace, Zoom workspace, Uploads workspace
2. **Each source workspace has a source-optimized table** — the YouTube workspace shows YouTube-specific columns (channel, views, etc.), the Fathom workspace shows Fathom-specific columns (participants, invitees, etc.)
3. **An "All Calls" view** shows calls from all sources using a universal table with only common fields (title, date, duration, source badge, summary)
4. **User-created workspaces** always use the universal table schema
5. **Data movement is by reference** — calls live in their source workspace, other workspaces reference them

### Current state

- Source workspaces MAY exist in the database but the UI doesn't filter by them
- There is only ONE table component (`TranscriptTable.tsx`) designed for Fathom's schema
- No source-optimized tables exist for YouTube, Zoom, or Uploads
- No universal "All Calls" table exists
- The query in `TranscriptsTab` ignores `activeWorkspaceId` entirely

### What to fix (scope for THIS directive)

This is a large architectural change. For this bug fix round, the minimum viable fix is:

1. **Make workspace switching actually filter calls** — when a workspace is selected, only show calls that belong to that workspace (via `workspace_entries` table)
2. **When no workspace is selected, show all calls** for the active org (the "All Calls" behavior)
3. **Source-optimized tables are a separate phase** — document this as a gap but don't block the current fixes on it

The full workspace-per-source architecture (auto-creation of source workspaces, source-optimized tables, universal table) should be planned as its own GSD phase.

---

## Bug 9: `call_tags` RLS Is Stale

### What's wrong

The `call_tags` table had its `bank_id` column renamed to `organization_id` in the workspace redesign migration, but the RLS policies were never updated. The current RLS is:

```sql
CREATE POLICY "Users can view system and own tags"
  ON call_tags FOR SELECT TO authenticated
  USING (user_id IS NULL OR auth.uid() = user_id);
```

This doesn't use `organization_id` at all. While low severity (tags are user-owned), it means org-scoped tag filtering in `TranscriptsTab` is application-level only, not enforced by RLS.

### What to fix

Create a new migration that updates `call_tags` RLS to include `organization_id` awareness, matching the pattern used in `20260301000002_recreate_rls_policies.sql` for other tables.

### Files to check
- `supabase/migrations/20260301000002_recreate_rls_policies.sql` — the recreate migration (does NOT include `call_tags`)
- `supabase/migrations/20251130000001_rename_categories_to_tags.sql` — original `call_tags` RLS

---

## Implementation Order

### Phase 1: STOP THE BLEED (do immediately, deploy same day)

1. **Bug 0A** — New Supabase migration: tighten `recordings` SELECT RLS to `owner_user_id` + workspace sharing
2. **Bug 0B** — Add `.eq("user_id", user.id)` to `TranscriptsTab.tsx` personal org path
3. **Bug 0C** — Add `.eq("user_id", user.id)` to `CallDetailPage.tsx`
4. **Bug 0D** — Add `.eq("user_id", user.id)` to `RecurringTitlesTab.tsx`
5. **Bug 0F** — Delete `organizationContextStore.ts` (dead code risk)
6. **Bug 0E** — Add loading guard: don't query calls until org context is initialized
7. **Verify** — Check if `fathom_calls` was renamed to `fathom_calls_archive` in production. If yes, ALL call queries are broken and need to target the correct table.

### Phase 2: UI/UX Fixes (after bleed is stopped)

8. **Bug 5** (sidebar label) — trivial rename, 1 line
9. **Bug 4** (TopBar org dropdown) — clean up the dropdown, remove workspace items
10. **Bug 3** (Pane 2 glass styling) — remove glassmorphism, match sidebar styling
11. **Bug 6** (overflow issues) — fix container bounds after styling is corrected

### Phase 3: Data Flow Fixes

12. **Bug 1** (workspace filtering) — add `activeWorkspaceId` to query key, filter by workspace
13. **Bug 7** (folder assignments) — fix `useFolderAssignments` to load correctly, verify data exists
14. **Bug 8** (workspace switching) — minimum viable workspace filtering via `workspace_entries`
15. **Bug 9** (call_tags RLS) — migration, can be done independently

### Phase 4: Architecture

16. **Bug 2** (BulkActionToolbarEnhanced → Pane 4) — move to proper pane system

---

## Verification Checklist

After all fixes, verify these scenarios work:

### Data Isolation (VERIFY BEFORE DEPLOYING ANYTHING ELSE)
- [ ] Run SQL: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'fathom%';` — determine if archive migration was applied
- [ ] Personal org user sees ONLY their own calls (verify `user_id` filter is applied in query AND in RLS)
- [ ] Business org user sees only their OWN calls + calls explicitly shared into their workspaces
- [ ] Business org admin does NOT see all org members' calls by default (only shared workspace content)
- [ ] Switching from personal to business org shows completely different call sets
- [ ] No calls from other accounts/users ever appear
- [ ] `/calls/<random-number>` returns 404 or unauthorized, NOT another user's call
- [ ] `organizationContextStore.ts` is deleted, no imports reference it
- [ ] All edge functions using service role key have explicit `owner_user_id` filters

### Workspace & Folder Navigation
- [ ] Click a workspace in Pane 2 → call list filters to that workspace's calls
- [ ] Click YouTube workspace → only YouTube imports appear
- [ ] Click Fathom workspace → only Fathom calls appear
- [ ] Click a folder in Pane 2 → call list filters to that folder's calls
- [ ] Calls previously assigned to folders APPEAR in those folders
- [ ] Click Home / deselect all → shows all calls for the active org
- [ ] Folder call counts are visible in Pane 2

### Org Switching
- [ ] Switch org in TopBar → call list updates to show only that org's calls
- [ ] Org dropdown shows ONLY orgs, has white card background with border
- [ ] Org dropdown has NO workspace items, NO breadcrumbs

### Pane Architecture
- [ ] Select multiple calls → BulkActionToolbarEnhanced opens as Pane 4 (full height, pushes from right)
- [ ] Deselect all calls → Pane 4 closes
- [ ] Pane 2 has no glass/blur effects, matches sidebar styling
- [ ] No content overflows pane boundaries
- [ ] Sidebar toggle says "Workspace Panel" not "Library Panel"

---

## Out of Scope (Future Phases)

These items from `000-workspace-per-import-source-architecture.md` are NOT part of this fix round but must be tracked:

- [ ] Auto-creation of source workspaces when import sources are connected
- [ ] Source-optimized table components (YouTube table, Zoom table, Uploads table)
- [ ] Universal "All Calls" table with only common fields
- [ ] Source badge column in universal table
- [ ] Call detail modal dynamic tab configuration per source type
- [ ] `display_name` vs original source name on workspace labels
- [ ] Workspace hide/unhide (instead of delete) for source workspaces
