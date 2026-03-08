---
status: resolved
trigger: "Source filter toggle state doesn't persist after page refresh on Sync page"
created: 2026-01-29T00:00:00Z
updated: 2026-01-29T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Second useEffect treats initial platform arrival as "newly connected integrations" and auto-enables all of them, ignoring savedFilterRef
test: Confirmed by code reading - lines 259-271 add ALL newlyConnected platforms without checking savedFilterRef
expecting: N/A - root cause confirmed
next_action: Implement fix - when previousConnectedRef was empty and savedFilterRef has a value, apply the saved filter instead of auto-enabling all platforms

## Symptoms

expected: Toggle a source OFF on Sync page, refresh, source stays OFF (filter persists to database)
actual: Source resets to ON after every refresh - filter state doesn't persist
errors: None visible in UI. Console logs were added but behavior still wrong.
reproduction: 1. Go to Sync page 2. Toggle Fathom source OFF 3. Refresh page 4. Fathom is back ON
started: Never worked - this is UAT Test 5 for Phase 3.2 Integration Import Controls

## Prior Attempts (from briefing)

- hypothesis: Array reference changing triggered useEffect re-run
  evidence: Added useMemo with JSON.stringify key - FAILED, still resets
  timestamp: prior

- hypothesis: Race condition between load and state updates
  evidence: Added refs (hasLoadedFromDbRef, isLoadingRef, savedFilterRef) - FAILED, still resets
  timestamp: prior

## Eliminated

- hypothesis: Array reference changing triggered useEffect re-run
  evidence: Memoization was correct approach but doesn't address root timing issue
  timestamp: prior (from briefing)

- hypothesis: Missing refs to prevent re-fetching
  evidence: Refs prevent duplicate DB fetches but don't fix the platform arrival timing
  timestamp: prior (from briefing)

## Evidence

- timestamp: 2026-01-29T00:01:00Z
  checked: useSyncSourceFilter.ts architecture
  found: |
    - loadFilterPreferences uses connectedPlatforms in its closure (line 126, 131, 136)
    - When connectedPlatforms changes, loadFilterPreferences callback RECREATES
    - Initial useEffect (lines 237-241) runs loadFilterPreferences when it changes
    - connectedPlatforms starts as [] and becomes populated async
  implication: |
    RACE CONDITION SUSPECTED: loadFilterPreferences may run twice:
    1. Once with connectedPlatforms=[] -> sets enabledSources to []
    2. Once with connectedPlatforms=['fathom'] -> but hasLoadedFromDbRef is already true!
    
    The second useEffect (lines 244-289) handles "changes AFTER initial load" but may
    not correctly apply savedFilterRef when connectedPlatforms goes from [] to ['fathom']

- timestamp: 2026-01-29T00:02:00Z
  checked: Second useEffect (lines 244-289) logic when connectedPlatforms transitions from [] to ['fathom']
  found: |
    ROOT CAUSE IDENTIFIED!
    
    Sequence on page load:
    1. useSyncSourceFilter called with connectedPlatforms=[] (integrations still loading)
    2. loadFilterPreferences() runs, reads savedFilter=['fathom'] from DB
    3. applyFilterToState([], ['fathom']) called - but platforms.length=0!
       → sets enabledSources=[] because no platforms exist yet
    4. hasLoadedFromDbRef.current=true is set
    5. connectedPlatforms becomes ['fathom'] when useIntegrationSync loads
    6. Second useEffect runs, sees "newly connected" platforms
    7. Lines 263-271: Treats ALL arriving platforms as "newly connected"
       → Adds them ALL to enabledSources (overriding saved filter)
       → SAVES to DB with saveFilterPreferences(updatedEnabled)
    
    The bug: When connectedPlatforms transitions from [] to actual values,
    the second useEffect treats this as "new integrations connected" and
    AUTO-ENABLES them, overwriting the user's saved disabled state!
  implication: |
    FIX NEEDED: When platforms arrive and there's a saved filter in savedFilterRef,
    we should APPLY that filter, not treat arriving platforms as "newly connected"

## Resolution

root_cause: |
  When connectedPlatforms transitions from [] to actual values (async load), the second
  useEffect (lines 244-289) treated this as "new integrations connected" and auto-enabled
  all platforms, overwriting the user's saved filter in savedFilterRef. The fix distinguishes
  between "initial platform arrival" (apply saved filter) vs "truly new integration connected"
  (auto-enable it).
fix: |
  Added check in second useEffect: if previousConnected.length === 0 && connectedPlatforms.length > 0,
  this is initial platform arrival - call applyFilterToState() with savedFilterRef instead of
  auto-enabling all platforms and saving to DB.
verification: |
  1. TypeScript compiles without errors
  2. Code trace verification confirms fix handles:
     - Initial platform arrival: applies savedFilterRef (respects user's disabled sources)
     - New integration connection: auto-enables new platform (correct behavior)
     - Disconnected platforms: removes from enabled (correct behavior)
  3. Removed redundant third useEffect that was setting previousConnectedRef
files_changed:
  - src/hooks/useSyncSourceFilter.ts
