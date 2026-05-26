# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## settings-pane-error — AccountTab crashes on mount due to useBlocker incompatibility with BrowserRouter
- **Date:** 2026-04-07
- **Error patterns:** useBlocker, data router, BrowserRouter, settings pane error, Failed to load Account settings, pane 3, AccountTab
- **Root cause:** AccountTab.tsx used `useBlocker(isDirty)` from react-router-dom, which requires a data router (createBrowserRouter). The app uses BrowserRouter which does not support useBlocker, causing it to throw on mount. This exception was caught by the SettingsDetailPane ErrorBoundary, showing "Failed to load Account settings / An unexpected error occurred." Since Account is auto-selected on /settings load, ALL settings pages appeared broken.
- **Fix:** Removed `useBlocker` and its dependent `AlertDialog` from AccountTab. Kept `useBeforeUnload` for browser tab/window close protection. No other changes needed.
- **Files changed:** src/components/settings/AccountTab.tsx
---
