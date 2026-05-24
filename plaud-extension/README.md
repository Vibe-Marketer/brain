# CallVault Plaud Connector

Clean-room Manifest V3 Chromium extension scaffold for connecting CallVault to a user's existing Plaud Web session.

This extension does not copy or derive code from OpenPlaud or any AGPL project. It uses only standard Chromium extension APIs and small local parsing helpers in this directory.

## What It Does

- Injects a page bridge on approved CallVault origins.
- Exposes `window.__callvaultPlaudConnector.connect()`.
- Opens or focuses `https://web.plaud.ai`.
- Reads a Plaud access token from Plaud Web `localStorage` when available.
- Observes outbound `Authorization: Bearer ...` request headers to:
  - `https://api.plaud.ai/*`
  - `https://api-euc1.plaud.ai/*`
  - `https://api-apse1.plaud.ai/*`
- Returns only `{ accessToken, apiBase }` to the CallVault page.

## Manual Sideload

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this directory: `browser-extensions/callvault-plaud-connector`.
5. Open or reload CallVault.
6. Trigger the Plaud import flow in CallVault.
7. When Plaud Web opens, sign in and let the page finish loading.

For local CallVault development, the manifest allows `http://localhost/*` and `http://127.0.0.1/*`.

## CallVault Page API

```js
const credentials = await window.__callvaultPlaudConnector.connect();
// credentials: { accessToken: string, apiBase: string }
```

Optional timeout:

```js
await window.__callvaultPlaudConnector.connect({ timeoutMs: 180000 });
```

The bridge also dispatches `callvault-plaud-connector-ready` when installed on the page.

## Development

No build step is required.

Run the extension-local tests:

```sh
npm test
```

The loaded unpacked extension root is this directory. If you edit files, click **Reload** for the extension in `chrome://extensions`, then reload CallVault and Plaud Web tabs.

## Security Notes

- Token access is scoped to the listed CallVault, Plaud Web, and Plaud API origins in `manifest.json`.
- Tokens are not written to persistent local extension storage. The background worker keeps the latest token in memory and `chrome.storage.session` when available.
- The extension has no remote-code loading and no external dependencies.
- The Plaud token is handed only to approved CallVault pages through the injected bridge after the page calls `connect()`.
- Treat the returned Plaud bearer token as a secret. Send it only to CallVault server endpoints over HTTPS, and avoid logging it in the browser or backend.
- For production publication, reduce development origins if they are not needed and review Chrome Web Store disclosure text for host permissions and request-header access.

## Packaging Follow-Up

For Chrome Web Store publication, add store assets, choose a stable extension ID strategy if CallVault wants one, prepare permission justification copy, and zip this directory without test artifacts or local metadata.
