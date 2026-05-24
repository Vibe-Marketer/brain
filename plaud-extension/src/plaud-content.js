(function installPlaudContentCollector() {
  "use strict";

  const SCAN_TYPE = "CALLVAULT_PLAUD_SCAN_LOCAL_STORAGE";
  const REPORT_TYPE = "CALLVAULT_PLAUD_LOCAL_CREDENTIAL";
  const STATUS_TYPE = "CALLVAULT_PLAUD_CAPTURE_STATUS";
  const STATUS_PANEL_ID = "callvault-plaud-connector-status";
  const utils = globalThis.CallVaultPlaudCredentialUtils;

  if (!utils || window.__callvaultPlaudContentCollectorInstalled) {
    return;
  }

  window.__callvaultPlaudContentCollectorInstalled = true;

  function ensureStatusPanel() {
    let panel = document.getElementById(STATUS_PANEL_ID);
    if (panel) return panel;

    const logoUrl = chrome.runtime.getURL("assets/callvault-bridge.png");
    panel = document.createElement("div");
    panel.id = STATUS_PANEL_ID;
    panel.setAttribute("role", "status");
    panel.setAttribute("aria-live", "polite");
    panel.style.cssText = [
      "position:fixed",
      "right:18px",
      "top:18px",
      "z-index:2147483647",
      "width:min(360px,calc(100vw - 36px))",
      "box-sizing:border-box",
      "border:1px solid rgba(249,115,22,0.45)",
      "border-radius:10px",
      "background:#fff7ed",
      "box-shadow:0 18px 45px rgba(15,23,42,0.18)",
      "color:#1f2937",
      "font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      "padding:14px",
    ].join(";");
    panel.innerHTML = [
      '<div style="display:flex;align-items:flex-start;gap:10px">',
      '<div style="position:relative;flex:0 0 auto">',
      `<img alt="" src="${logoUrl}" style="display:block;width:40px;height:40px;border-radius:999px;object-fit:cover;border:1px solid rgba(249,115,22,0.35);background:#111827" />`,
      '<div data-callvault-dot style="position:absolute;right:-1px;bottom:-1px;width:11px;height:11px;border-radius:999px;background:#f97316;border:2px solid #fff7ed;box-shadow:0 0 0 3px rgba(249,115,22,0.15)"></div>',
      "</div>",
      '<div style="min-width:0">',
      '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9a3412">CallVault Bridge</div>',
      '<div data-callvault-title style="margin-top:4px;font-size:14px;font-weight:700;color:#111827">Waiting for Plaud sign-in</div>',
      '<div data-callvault-message style="margin-top:4px;font-size:13px;line-height:1.4;color:#4b5563">Sign in to Plaud if prompted. CallVault is watching this page for a Plaud session token.</div>',
      "</div>",
      "</div>",
    ].join("");

    (document.body || document.documentElement).appendChild(panel);
    return panel;
  }

  function updateStatus(tone, title, message) {
    const panel = ensureStatusPanel();
    const dot = panel.querySelector("[data-callvault-dot]");
    const titleNode = panel.querySelector("[data-callvault-title]");
    const messageNode = panel.querySelector("[data-callvault-message]");
    const colors = {
      waiting: "#f97316",
      captured: "#059669",
      error: "#dc2626",
    };

    if (dot) {
      dot.style.background = colors[tone] || colors.waiting;
      dot.style.boxShadow = `0 0 0 4px ${tone === "captured" ? "rgba(5,150,105,0.15)" : tone === "error" ? "rgba(220,38,38,0.15)" : "rgba(249,115,22,0.15)"}`;
    }
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
  }

  function readCredentials() {
    try {
      return utils.scanLocalStorage(window.localStorage);
    } catch (_error) {
      return null;
    }
  }

  function reportCredentials() {
    const credentials = readCredentials();
    if (!credentials?.accessToken) {
      updateStatus(
        "waiting",
        "Waiting for Plaud session",
        "If you are not signed in, finish signing in here. If you are signed in, open or refresh your recordings list so Plaud makes an API request. CallVault is still waiting.",
      );
      return;
    }

    updateStatus(
      "captured",
      "Plaud token captured",
      "The extension found your Plaud session token and is sending it back to CallVault. You can return to the CallVault tab.",
    );

    chrome.runtime.sendMessage({
      type: REPORT_TYPE,
      credentials,
    }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        updateStatus(
          "error",
          "Could not hand token to CallVault",
          chrome.runtime.lastError?.message || "Reload the CallVault tab and try Continue with Plaud again.",
        );
        return;
      }

      updateStatus(
      "captured",
      "Token sent to CallVault",
        "CallVault has received the Plaud token. Returning you to CallVault; you can close this Plaud tab when finished.",
      );
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === STATUS_TYPE) {
      updateStatus(
        message.tone || "waiting",
        message.title || "CallVault Plaud Connector",
        message.message || "The extension is active on Plaud Web.",
      );
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type !== SCAN_TYPE) return false;

    sendResponse({
      ok: true,
      credentials: readCredentials(),
    });
    return true;
  });

  updateStatus(
    "waiting",
    "CallVault bridge active",
    "Sign in to Plaud if prompted. The extension will capture the Plaud token automatically once Plaud Web loads account data.",
  );
  window.addEventListener("storage", reportCredentials);
  reportCredentials();
  window.setTimeout(reportCredentials, 1500);
  window.setTimeout(reportCredentials, 5000);
})();
