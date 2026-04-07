---
status: resolved
trigger: "Settings pages throw errors when displayed in the 3rd pane"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:01Z
---

## Current Focus

hypothesis: CONFIRMED — AccountTab uses useBlocker() which requires a data router
test: Playwright browser run confirmed the thrown error and ErrorBoundary catch
expecting: Removing useBlocker will allow AccountTab to render without throwing
next_action: Remove useBlocker from AccountTab, keep useBeforeUnload for browser tab close warning

## Symptoms

expected: Settings pages should render correctly in the appropriate pane
actual: AccountTab throws "useBlocker must be used within a data router" — caught by SettingsDetailPane ErrorBoundary, shows "Failed to load Account settings / An unexpected error occurred"
errors: "useBlocker must be used within a data router. See https://reactrouter.com/v6/routers/picking-a-router."
reproduction: Click on "Settings" in the sidebar — Account tab (default) errors immediately
started: When AccountTab added useBlocker() dirty-state navigation blocking

## Eliminated

- hypothesis: Pane routing mismatch from restructuring
  evidence: Router and AppShell configs are correct; error is from useBlocker inside AccountTab
  timestamp: 2026-04-07

- hypothesis: Missing import or deleted file
  evidence: All imports resolve; build succeeds
  timestamp: 2026-04-07

## Evidence

- timestamp: 2026-04-07
  checked: Playwright browser navigation to /settings
  found: Error thrown: "useBlocker must be used within a data router" at AccountTab line 116
  implication: App uses BrowserRouter, useBlocker requires createBrowserRouter (data router)

- timestamp: 2026-04-07
  checked: AccountTab.tsx line 108
  found: const blocker = useBlocker(isDirty); — this hook is incompatible with BrowserRouter
  implication: The hook throws on mount, ErrorBoundary catches it, shows "Failed to load Account settings"

- timestamp: 2026-04-07
  checked: Screenshot of /settings page
  found: "Failed to load Account settings / An unexpected error occurred. Please try again."
  implication: Confirms the SettingsDetailPane ErrorBoundary is the fallback renderer

## Resolution

root_cause: AccountTab.tsx uses useBlocker(isDirty) from react-router-dom, which requires a data router (createBrowserRouter). The app uses BrowserRouter which does not support useBlocker, causing it to throw on mount. This throws into the SettingsDetailPane ErrorBoundary which shows an error fallback.
fix: Remove useBlocker from AccountTab. Keep useBeforeUnload for browser tab/window close warnings. Remove the AlertDialog that relied on blocker.state.
verification:
files_changed: [src/components/settings/AccountTab.tsx]
