(function installPlaudContentCollector() {
  "use strict";

  const SCAN_TYPE = "CALLVAULT_PLAUD_SCAN_LOCAL_STORAGE";
  const REPORT_TYPE = "CALLVAULT_PLAUD_LOCAL_CREDENTIAL";
  const utils = globalThis.CallVaultPlaudCredentialUtils;

  if (!utils || window.__callvaultPlaudContentCollectorInstalled) {
    return;
  }

  window.__callvaultPlaudContentCollectorInstalled = true;

  function readCredentials() {
    try {
      return utils.scanLocalStorage(window.localStorage);
    } catch (_error) {
      return null;
    }
  }

  function reportCredentials() {
    const credentials = readCredentials();
    if (!credentials?.accessToken) return;

    chrome.runtime.sendMessage({
      type: REPORT_TYPE,
      credentials,
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== SCAN_TYPE) return false;

    sendResponse({
      ok: true,
      credentials: readCredentials(),
    });
    return true;
  });

  window.addEventListener("storage", reportCredentials);
  reportCredentials();
  window.setTimeout(reportCredentials, 1500);
  window.setTimeout(reportCredentials, 5000);
})();
