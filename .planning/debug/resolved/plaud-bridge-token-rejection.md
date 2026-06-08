---
status: resolved
trigger: "Plaud bridge and Chrome extension are failing for the user and customers. The extension zip is nested inside a second folder, making Chrome load-unpacked selection confusing. Connect Plaud repeatedly fails with: Plaud rejected the captured browser token. In the Plaud tab, refresh the page and open a recording so the bridge can capture a fresh authenticated request, then try Connect Plaud again. Refreshing Plaud, CallVault, and the extension still fails. Connected/minimized connector rows at the top of Import need a settings link or expandable management affordance."
created: 2026-06-02T00:00:00Z
updated: 2026-06-02T15:31:00Z
---

# Debug Session: plaud-bridge-token-rejection

## Symptoms

- Expected behavior: users unzip the Plaud bridge and immediately select the visible bridge folder in Chrome; Connect Plaud should accept a freshly captured authenticated Plaud Web session without repeated refresh cycles; connected connector rows on Import should provide an obvious route to manage or expand settings.
- Actual behavior: the extension folder is nested one level too deep after unzip; the bridge captures session data but CallVault rejects it as invalid; users have to refresh Plaud, CallVault, and the extension without success; connected/minimized connector rows do not expose enough management affordance.
- Error messages: `Plaud connection failed: Plaud rejected the captured browser token. In the Plaud tab, refresh the page and open a recording so the bridge can capture a fresh authenticated request, then try Connect Plaud again.`
- Timeline: observed by the user and at least one customer during Plaud bridge setup after the browser bridge flow was introduced.
- Reproduction: install/load the Plaud bridge extension, sign in to Plaud Web, open or refresh a recording so the bridge captures session data, return to CallVault Import and click Connect Plaud.

## Current Focus

- hypothesis: the bridge captures or submits a token/session artifact that Plaud Web accepts in-browser but the CallVault server cannot replay against Plaud APIs, and the packaged bridge zip includes an extra directory level; Import connected rows are missing the Phase 05 manage affordance in their collapsed state.
- test: inspect Plaud bridge extension capture logic, packaged artifact generation, server validation flow, Plaud connection UI, and Import connected-row rendering/tests.
- expecting: one or more mismatches between token source, required cookies/headers, validation endpoint, or zip root layout; a UI gap where connected rows show status but lack manage/settings expansion.
- next_action: gather initial evidence from Plaud bridge files, Edge Function/service validation, and Import connector components.
- reasoning_checkpoint:
- tdd_checkpoint:

## Evidence

- 2026-06-02T15:26:00Z: `public/downloads/callvault-plaud-connector.zip` contained `browser-extensions/callvault-plaud-connector/manifest.json`, so unzipping exposed a parent folder that was not itself loadable by Chrome.
- 2026-06-02T15:26:00Z: `browser-extensions/callvault-plaud-connector/src/background.js` returned the first stored credential from `handleConnect()`, including local-storage credentials with `source: "local-storage"`, before an authenticated Plaud API request header was captured.
- 2026-06-02T15:26:00Z: Plaud content UI told users local-storage session data was only a possible session and that CallVault was waiting for an authenticated API request, but background flow could still complete from that possible/stale session.
- 2026-06-02T15:26:00Z: `supabase/functions/plaud-connect-token/index.ts` validates immediately with `new PlaudClient(accessToken, { apiBase })` and `await plaudClient.listDevices()`, so stale or wrong browser-storage tokens are rejected before storage.
- 2026-06-02T15:26:00Z: `src/components/connectors/ConnectorImportWizard.tsx` rendered connected connectors as a compact summary only; the existing manage affordance lived in `ConnectionsPanel`, not in the Import-page connected summary.
- 2026-06-02T15:27:00Z: Rebuilt `public/downloads/callvault-plaud-connector.zip` from inside the extension directory; archive now has `manifest.json`, `assets/`, and `src/` at root.
- 2026-06-02T15:27:00Z: Focused verification passed: `npm --prefix browser-extensions/callvault-plaud-connector test`; `npm run test -- src/components/connectors/__tests__/ConnectorImportWizard.test.tsx supabase/functions/plaud-connect-token/__tests__/plaud-connect-token.test.ts`; `npm run build`.

## Eliminated

- Missing server-side Plaud token validation: eliminated because `plaud-connect-token` already validates via `PlaudClient.listDevices()`.
- Nested zip caused by the new rebuild command: eliminated because `unzip -l public/downloads/callvault-plaud-connector.zip` now lists `manifest.json` at archive root.

## Resolution

- root_cause: The bridge could return a local-storage Plaud credential before it observed a real authenticated API request header, making stale browser session artifacts look ready to CallVault; the public extension zip was built with the repo path as its root; the Import connected summary lacked an on-page management affordance.
- fix: Require `source === "authorization-header"` before `handleConnect()` returns a Plaud credential; keep local-storage scans only for enrichment/status; rebuild the zip with loadable extension files at archive root; add an Import summary Manage/Manage bridge toggle that expands the existing connector setup controls inline.
- verification: Extension tests passed; focused ConnectorImportWizard and plaud-connect-token Vitest suites passed; production Vite build passed; zip layout manually verified with `unzip -l`.
- files_changed: browser-extensions/callvault-plaud-connector/src/background.js; browser-extensions/callvault-plaud-connector/package.json; browser-extensions/callvault-plaud-connector/tests/background-behavior.test.cjs; public/downloads/callvault-plaud-connector.zip; src/components/connectors/ConnectorImportWizard.tsx; src/components/connectors/__tests__/ConnectorImportWizard.test.tsx.
