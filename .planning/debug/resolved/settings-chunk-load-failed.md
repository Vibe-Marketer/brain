---
status: resolved
trigger: "CallVault debug-panel bug report — Settings component crash on /settings/mcp: 'TypeError: Failed to fetch dynamically imported module: https://app.callvaultai.com/assets/AccountTab-CODEdXZV.js'. Resource LINK failed to load for the same chunk. Settings error boundary fired (componentStack rooted at Lazy/Suspense)."
created: 2026-06-17
updated: 2026-06-17
---

# Debug Session: settings-chunk-load-failed

## Symptoms

- **Expected behavior:** Navigating to /settings/* (the user was on /settings/mcp) renders the Settings shell and its lazy-loaded tabs (including AccountTab) without error.
- **Actual behavior:** The Settings error boundary fired. The lazy-loaded AccountTab chunk failed to load, throwing `TypeError: Failed to fetch dynamically imported module`. Settings rendered its error state instead of the page.
- **Error messages:**
  - `[RESOURCE FAILED] LINK failed to load` — Resource: `https://app.callvaultai.com/assets/AccountTab-CODEdXZV.js`, Element: `<link>` (modulepreload)
  - `TypeError: Failed to fetch dynamically imported module: https://app.callvaultai.com/assets/AccountTab-CODEdXZV.js`
  - `[ERROR] Settings component error` — React error boundary, componentStack rooted at `Lazy` → `Suspense` inside `Settings-CWk1_bX5.js`
- **Timeline:** Captured 2026-06-17T02:09:54Z on production (app.callvaultai.com). URL: /settings/mcp. User had just been revoking MCP OAuth client grants (PATCH/GET mcp_oauth_client_grants succeeded — those are unrelated and worked).
- **Reproduction:** Production /settings/mcp, Chrome 149 / macOS. The `<link rel=modulepreload>` for AccountTab-CODEdXZV.js 404s, then the dynamic import of the same chunk fails.

## Current Focus

- hypothesis: CONFIRMED — stale-deploy chunk mismatch + wrong error boundary intercepting the throw.
- test: Completed.
- expecting: N/A — fixed.
- next_action: deploy to prod (auto-deploys on push to main)
- reasoning_checkpoint: Root cause was a two-layer issue. Primary: stale-deploy 404 (AccountTab-CODEdXZV.js replaced by new build hash). Secondary (amplifier): SettingsDetailPane.tsx defined its own local ErrorBoundary class that lacked chunk-load detection, so the ChunkLoadError was caught there before the global ErrorBoundary could trigger the auto-reload. The global ErrorBoundary already had full stale-deploy recovery (isChunkLoadError + window.location.reload + 10s session-storage loop guard + Sentry). Fix: delete local boundary, import global one.

## Evidence

- timestamp: 2026-06-17T02:10:00Z
  finding: SettingsDetailPane.tsx line 44 — `const AccountTab = React.lazy(() => import("@/components/settings/AccountTab"))` — pure React.lazy, no retry wrapper. This is fine; the boundary is what matters.
  source: Read src/components/panes/SettingsDetailPane.tsx

- timestamp: 2026-06-17T02:10:30Z
  finding: SettingsDetailPane.tsx lines 334-361 defined a LOCAL ErrorBoundary class with zero chunk-load awareness — componentDidCatch just called logger.error, no reload logic. This boundary wrapped the Suspense+lazy tabs, so it intercepted the ChunkLoadError before the global boundary could see it.
  source: Read src/components/panes/SettingsDetailPane.tsx

- timestamp: 2026-06-17T02:11:00Z
  finding: src/components/ErrorBoundary.tsx already implements full stale-deploy recovery: isChunkLoadError() matches "Failed to fetch dynamically imported module" (exact prod error message), triggers window.location.reload() with 10s sessionStorage guard, shows "Reloading updated content..." spinner. Already used in App.tsx, main.tsx, TicketsSection.tsx.
  source: Read src/components/ErrorBoundary.tsx

## Eliminated

- MCP OAuth grant API calls as cause — those PATCH/GET calls succeeded per the report
- Missing global preloadError handler as root cause — the global ErrorBoundary already handled this; the missing piece was it never received the error

## Resolution

- root_cause: SettingsDetailPane.tsx had a local `ErrorBoundary` class that wrapped all lazy-loaded settings tabs (AccountTab, BillingTab, MCPTab, etc.) but contained no chunk-load error detection or auto-reload logic. When a stale-deploy caused AccountTab-CODEdXZV.js to 404, the ChunkLoadError was caught by this local boundary which rendered a static fallback — users were left stuck. The global ErrorBoundary with full auto-reload recovery existed but was never reached.
- fix: Deleted the local ErrorBoundary class from SettingsDetailPane.tsx; imported the global ErrorBoundary from @/components/ErrorBoundary instead. Preserved SettingsErrorFallback via the `fallback` prop for non-chunk errors. Commit e54c27d on main.
- verification: tsc -p tsconfig.app.json --noEmit — zero errors in SettingsDetailPane.tsx. Pre-existing errors in unrelated files are unchanged.
- files_changed: src/components/panes/SettingsDetailPane.tsx
