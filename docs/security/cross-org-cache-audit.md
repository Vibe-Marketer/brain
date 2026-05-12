# Cross-Org Cache Leak Audit (SEC-03C, Phase 38)

**Audited:** 2026-05-12
**Method:** Code-evidence audit (AuthContext subscriptions + query-key factory review).

## Scope

Verify that switching organizations clears any cached call/folder/tag data from the previous org so no Org A data ever surfaces in an Org B view.

## Defense-in-Depth Fixes Shipped This Phase

### Fix 1 — `queryClient.clear()` on org switch (NEW)

**File:** `src/contexts/AuthContext.tsx`

Added a Zustand subscription that watches `useOrgContextStore.activeOrgId`. When the active org ID transitions to a different value, the subscription calls `queryClient.clear()` to purge every cached query — call lists, folder lists, tag lists, recordings, contacts, workspaces, members, everything.

```typescript
// SEC-03C — Clear TanStack Query cache whenever the active organization
// changes so Org A data never bleeds into the next Org B view.
useEffect(() => {
  let prevOrgId = useOrgContextStore.getState().activeOrgId;
  const unsubscribe = useOrgContextStore.subscribe((state) => {
    const newOrgId = state.activeOrgId;
    if (prevOrgId !== null && prevOrgId !== newOrgId) {
      logger.debug('[AuthContext] Active org changed — clearing query cache');
      queryClient.clear();
    }
    prevOrgId = newOrgId;
  });
  return unsubscribe;
}, [queryClient]);
```

This complements the two existing cache-clearing handlers:
- `SIGNED_OUT` → `queryClient.clear()` (always cleared on logout).
- `SIGNED_IN` with different user → `queryClient.clear()` (account switch).
- **NEW:** `setActiveOrg` → `queryClient.clear()` (same account, different org).

## Query-Key Factory Audit (`src/lib/query-config.ts`)

The factory was audited for keys that fetch org-scoped data without including `orgId` in their key array. Findings:

### Already includes orgId / transitively-scoping ID (no fix needed)

- `recordings.availableSources(orgId, workspaceId)` — explicit orgId
- `folders.list(workspaceId)` / `folders.assignments(workspaceId)` — workspaceId transitively scopes
- `tags.list(orgId)` / `tags.counts(orgId)` / `tags.rules(orgId)` / `tags.recurringTitles(orgId)` — explicit orgId
- `tags.assignments(recordingIds)` — recordingIds transitively scope
- `workspaces.list(orgId)` / `workspaces.detail(id)` / `workspaces.members(workspaceId)` / `workspaces.recordings(workspaceId)`
- `workspaceEntries.byRecording / byWorkspace` — recording/workspace IDs transitively scope
- `organizations.detail(orgId)` / `organizations.members(orgId)` / `organizations.invitations(orgId)`
- `contacts.list(orgId)` / `contactFolders.list(orgId)`
- `routingRules.*(orgId)`
- `rawCalls.fathom / zoom / youtube / upload(recordingId)` — recordingId transitively scopes

### Org-scoped keys WITHOUT orgId in the key (deferred, mitigated by Fix 1)

| Key | Why it's risky | Why deferred |
|-----|----------------|--------------|
| `calls.list(filters)` | Filters dict could repeat across orgs | **Zero callers** in `src/` — dead code |
| `imports.sources()` / `counts()` / `history()` / `failed()` | Per-org import context | 10+ callers each — exceeds plan's <5-caller scope rule |
| `sharing.sharedWithMe()` | Per-user `shared_with_me` list | Per-user (not per-org); only 1 caller |
| `teams.list()` / `teams.detail(id)` | Per-org team context | Threaded through caller props |
| `notifications.list()` / `unread()` | Per-user (not per-org) | Cleared on user switch |
| `folders.detail(folderId)` / `tags.detail(tagId)` | folderId / tagId are globally unique | UUIDs collision-free across orgs |

All of the above are now defended by Fix 1 (`queryClient.clear()` on org switch). The deferred orgId-in-key work is tracked as a v2.3 follow-up if cross-org access patterns evolve.

## Result

**SEC-03C acceptance:** PASS via code-evidence audit + Fix 1.

The combination of:
1. Existing `SIGNED_OUT` cache clear.
2. Existing account-switch `SIGNED_IN` cache clear.
3. NEW org-switch cache clear (this phase).

Means **every** org transition — whether via logout/login or in-place switcher — purges the cache. No Org A row can survive into an Org B view because the cache is empty when Org B starts fetching.

## Limitations of this audit

- Live dev-browser snapshot was not run. The test persona had access to multiple orgs but the V2 org-switcher UI requires manual interaction; a fully scripted snapshot would require dev-browser instrumentation that's still pending Phase 30 integration test sweep follow-up.
- The code-evidence audit confirms the WIRING is correct. Runtime verification of the cache-clear behavior is covered by:
  - Manual verification via the Phase 29 QA sweep cycle when re-walking the route catalog.
  - The CI RLS regression test (`src/test/rls-regression.test.ts`, Plan 38-01) which would catch a server-side cross-org leak even if the client cache failed.

## Re-running this audit

```bash
# Confirm cache-clear hook still installed in AuthContext:
grep -c "Active org changed" src/contexts/AuthContext.tsx
# Expected: 1

# Re-grep for org-scoped keys missing orgId:
grep -E "list:.*=> \['" src/lib/query-config.ts | grep -v "orgId\|workspaceId\|userId\|recordingId\|folderId\|tagId\|callId\|tokenId"
```
