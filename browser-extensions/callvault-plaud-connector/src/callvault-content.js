(function installCallVaultContentBridge() {
  "use strict";

  const REQUEST_TYPE = "CALLVAULT_PLAUD_CONNECT_REQUEST";
  const RESPONSE_TYPE = "CALLVAULT_PLAUD_CONNECT_RESPONSE";
  const ALLOWED_ORIGIN_PATTERN = /^https:\/\/(?:app|test)\.callvaultai\.com$|^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

  if (!ALLOWED_ORIGIN_PATTERN.test(window.location.origin)) {
    return;
  }

  function injectPageBridge() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/page-bridge.js");
    script.async = false;
    script.onload = () => script.remove();
    (document.documentElement || document.head || document.body).appendChild(script);
  }

  function postResponse(requestId, payload) {
    window.postMessage(
      {
        type: RESPONSE_TYPE,
        requestId,
        ...payload,
      },
      window.location.origin,
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type !== REQUEST_TYPE || typeof event.data.requestId !== "string") return;

    chrome.runtime.sendMessage(
      {
        type: "CALLVAULT_PLAUD_CONNECT",
        requestId: event.data.requestId,
        options: event.data.options || {},
      },
      (response) => {
        if (chrome.runtime.lastError) {
          postResponse(event.data.requestId, {
            ok: false,
            error: { message: chrome.runtime.lastError.message },
          });
          return;
        }

        postResponse(event.data.requestId, response || {
          ok: false,
          error: { message: "No response from CallVault Plaud connector." },
        });
      },
    );
  });

  injectPageBridge();
})();
