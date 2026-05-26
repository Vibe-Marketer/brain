---
status: awaiting_human_verify
trigger: "Two org-switching bugs: (1) stale calls on login showing wrong org's data, (2) org resets to default on page refresh"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — both bugs share the same root cause: useOrgContext.initialize() always picks personalOrg and overwrites the persisted activeOrgId from localStorage, even when the user had previously selected a different org.
test: code trace complete — initialize() in useOrgContext.ts line 61 always calls initialize(defaultOrg.id) where defaultOrg = personalOrg ?? orgs[0], ignoring what's in localStorage/store
expecting: fix is to check if persisted activeOrgId already exists in the org list — if so, just mark isInitialized=true without overwriting
next_action: apply fix to useOrgContext.ts auto-initialize effect

## Symptoms

expected: On login, personal org shows only personal org calls (empty if none). After switching org and refreshing, stays on AI Simple.
actual: (Bug 1) Personal org initially shows AI Simple's calls until user switches orgs and back. (Bug 2) Page refresh reverts to personal/default org.
errors: No error messages — just wrong data/state
reproduction: Bug 1: Log in as naegele412@gmail.com, observe calls in pane 3. Bug 2: Switch to AI Simple, press Cmd-R, observe org reverts.
started: Current behavior, unclear when started

## Eliminated

- hypothesis: calls query fires before isInitialized=true with stale org from localStorage
  evidence: query has `enabled: isInitialized` — it does not fire until isInitialized=true. The issue is what happens AT the moment isInitialized flips.
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: orgContextStore.ts — store initialization
  found: Store sets activeOrgId from localStorage on module load (line 79), but isInitialized=false always on startup
  implication: persisted org ID is in memory but not "official" — isInitialized guard means calls wait

- timestamp: 2026-04-07
  checked: useOrgContext.ts — auto-initialize effect (lines 51-62)
  found: Effect always calls initialize(defaultOrg.id) where defaultOrg = personalOrg ?? orgs[0], regardless of what activeOrgId already is in the store
  implication: Every app load / page refresh overwrites any previously-persisted non-personal org selection back to personal

- timestamp: 2026-04-07
  checked: orgContextStore.ts — initialize() action (lines 142-148)
  found: initialize(orgId) sets activeOrgId=orgId AND isInitialized=true atomically. persistContext() also writes the new orgId to localStorage, overwriting the previously-saved AI Simple selection.
  implication: The localStorage save done by setActiveOrg when user switched to AI Simple is unconditionally overwritten on next load

- timestamp: 2026-04-07
  checked: AuthContext.tsx — signOut() (line 79)
  found: signOut() does NOT call orgContextStore.reset(). localStorage key callvault-org-context is preserved across logout.
  implication: Bug 1 (stale calls) — on fresh login, localStorage still has AI Simple from previous session. useOrgContext effect overwrites it to personal org, but the brief window where activeOrgId=aiSimpleId exists in the store (before isInitialized=true) may cause a render with stale query key hitting TanStack cache.

- timestamp: 2026-04-07
  checked: TranscriptsTab.tsx line 331 — query key construction
  found: queryKey includes activeOrganizationId. enabled: isInitialized. When initialize(personalOrg.id) fires, both isInitialized=true and activeOrgId=personalOrg.id are set in one atomic set() call — so the first enabled query should use the correct org ID.
  implication: Bug 1 is more subtle — likely TanStack Query stale cache for the personal org's query key serving AI Simple's data. OR the calls query uses activeOrganizationId that briefly resolves to AI Simple via a stale closure.

## Resolution

root_cause: Two related issues: (1) useOrgContext.ts auto-initialize effect unconditionally picked personalOrg on every app load, overwriting any persisted non-personal org from localStorage — causing page refresh to always revert to personal org. (2) TranscriptsTab.tsx placeholderData function only checked workspace/folder IDs when deciding whether to show cached data from a previous query, not org ID — so switching orgs with null workspaceId in both cases would flash the previous org's cached calls.
fix: (1) src/hooks/useOrgContext.ts — auto-initialize now checks if the store's current activeOrgId is valid in the org list; if so, honors it via initialize(activeOrgId) instead of overwriting. (2) src/components/transcripts/TranscriptsTab.tsx — placeholderData now also compares prevOrgId !== currOrgId and returns undefined (no placeholder) when the org has changed.
verification: TypeScript compiles clean (tsc --noEmit, no errors).
files_changed: [src/hooks/useOrgContext.ts, src/components/transcripts/TranscriptsTab.tsx]
