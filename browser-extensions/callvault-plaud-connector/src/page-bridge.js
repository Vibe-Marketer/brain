(function installCallVaultPlaudBridge() {
  "use strict";

  const VERSION = "0.1.2";
  const REQUEST_TYPE = "CALLVAULT_PLAUD_CONNECT_REQUEST";
  const RESPONSE_TYPE = "CALLVAULT_PLAUD_CONNECT_RESPONSE";

  if (window.__callvaultPlaudConnector?.connect) {
    return;
  }

  function randomId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `callvault-plaud-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function connect(options) {
    const requestId = randomId();
    const timeoutMs = Number.isFinite(options?.timeoutMs) ? options.timeoutMs : 120000;

    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        window.removeEventListener("message", onMessage);
        reject(new Error("Timed out waiting for Plaud credentials."));
      }, timeoutMs + 5000);

      function onMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        if (event.data?.type !== RESPONSE_TYPE || event.data.requestId !== requestId) return;

        window.clearTimeout(timeoutId);
        window.removeEventListener("message", onMessage);

        if (event.data.ok) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error?.message || "Plaud connector failed."));
        }
      }

      window.addEventListener("message", onMessage);
      window.postMessage(
        {
          type: REQUEST_TYPE,
          requestId,
          options: {
            timeoutMs,
          },
        },
        window.location.origin,
      );
    });
  }

  Object.defineProperty(window, "__callvaultPlaudConnector", {
    value: Object.freeze({
      version: VERSION,
      connect,
    }),
    configurable: true,
  });

  window.dispatchEvent(
    new CustomEvent("callvault-plaud-connector-ready", {
      detail: { version: VERSION },
    }),
  );
})();
