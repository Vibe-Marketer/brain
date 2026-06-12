(function installPlaudContentCollector() {
  "use strict";

  const SCAN_TYPE = "CALLVAULT_PLAUD_SCAN_LOCAL_STORAGE";
  const REPORT_TYPE = "CALLVAULT_PLAUD_LOCAL_CREDENTIAL";
  const STATUS_TYPE = "CALLVAULT_PLAUD_CAPTURE_STATUS";
  const STATUS_PANEL_ID = "callvault-plaud-connector-status";
  const HELPER_DELAY_MS = 2500;
  const utils = globalThis.CallVaultPlaudCredentialUtils;

  if (!utils || window.__callvaultPlaudContentCollectorInstalled) {
    return;
  }

  window.__callvaultPlaudContentCollectorInstalled = true;
  let helperTimer = null;
  let lastPath = window.location.pathname;
  let capturedBearerToken = "";

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
      "user-select:none",
    ].join(";");
    panel.innerHTML = [
      '<div data-callvault-drag-handle style="display:flex;align-items:flex-start;gap:10px;cursor:move;touch-action:none">',
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
      '<details data-callvault-advanced style="margin-top:12px;border-top:1px solid rgba(249,115,22,0.25);padding-top:10px">',
      '<summary style="cursor:pointer;font-size:12px;font-weight:700;color:#7c2d12;outline:none">Advanced</summary>',
      '<button data-callvault-copy-token type="button" disabled style="margin-top:10px;width:100%;border:0;border-radius:8px;background:#9ca3af;color:#fff;font-size:13px;font-weight:800;padding:9px 10px;cursor:not-allowed">Waiting for bearer token</button>',
      '<div data-callvault-token-note style="margin-top:7px;font-size:12px;line-height:1.35;color:#6b7280">Backup only. CallVault normally sends the Plaud token directly after capture.</div>',
      "</details>",
    ].join("");

    (document.body || document.documentElement).appendChild(panel);
    installPanelInteractions(panel);
    updateCopyTokenControl(panel);
    return panel;
  }

  function updateStatus(tone, title, message, accessToken) {
    clearHelperTimer();
    if (typeof accessToken === "string" && accessToken.trim()) {
      capturedBearerToken = accessToken.trim();
    }

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
    updateCopyTokenControl(panel);
  }

  function installPanelInteractions(panel) {
    const handle = panel.querySelector("[data-callvault-drag-handle]");
    const copyButton = panel.querySelector("[data-callvault-copy-token]");
    if (!handle || panel.dataset.callvaultReady === "true") return;

    panel.dataset.callvaultReady = "true";

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button,details,summary,a,input,textarea,select")) return;

      const rect = panel.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      panel.style.right = "auto";
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;

      const movePanel = (moveEvent) => {
        const nextLeft = moveEvent.clientX - offsetX;
        const nextTop = moveEvent.clientY - offsetY;
        placePanel(panel, nextLeft, nextTop);
      };

      const stopMoving = () => {
        handle.removeEventListener("pointermove", movePanel);
        handle.removeEventListener("pointerup", stopMoving);
        handle.removeEventListener("pointercancel", stopMoving);
      };

      handle.addEventListener("pointermove", movePanel);
      handle.addEventListener("pointerup", stopMoving);
      handle.addEventListener("pointercancel", stopMoving);
    });

    window.addEventListener("resize", () => {
      const rect = panel.getBoundingClientRect();
      placePanel(panel, rect.left, rect.top);
    });

    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        if (!capturedBearerToken) return;

        try {
          await navigator.clipboard.writeText(capturedBearerToken);
          copyButton.textContent = "Bearer token copied";
          window.setTimeout(() => updateCopyTokenControl(panel), 1800);
        } catch (_error) {
          copyButton.textContent = "Copy failed";
          window.setTimeout(() => updateCopyTokenControl(panel), 1800);
        }
      });
    }
  }

  function placePanel(panel, left, top) {
    const margin = 8;
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const boundedLeft = Math.min(Math.max(margin, left), maxLeft);
    const boundedTop = Math.min(Math.max(margin, top), maxTop);

    panel.style.left = `${boundedLeft}px`;
    panel.style.top = `${boundedTop}px`;
    panel.style.right = "auto";
  }

  function updateCopyTokenControl(panel) {
    const copyButton = panel.querySelector("[data-callvault-copy-token]");
    if (!copyButton) return;

    if (capturedBearerToken) {
      copyButton.disabled = false;
      copyButton.textContent = "Copy bearer token";
      copyButton.style.background = "#059669";
      copyButton.style.cursor = "pointer";
      return;
    }

    copyButton.disabled = true;
    copyButton.textContent = "Waiting for bearer token";
    copyButton.style.background = "#9ca3af";
    copyButton.style.cursor = "not-allowed";
  }

  function clearHelperTimer() {
    if (!helperTimer) return;
    window.clearTimeout(helperTimer);
    helperTimer = null;
  }

  function scheduleHelperStatus() {
    clearHelperTimer();
    helperTimer = window.setTimeout(() => {
      if (window.location.pathname === "/login") {
        updateStatus(
          "waiting",
          "Finish signing in to Plaud",
          "Choose a sign-in option on this Plaud page. After login, CallVault will keep watching automatically.",
        );
        return;
      }

      updateStatus(
        "waiting",
        "Still waiting for Plaud",
        "If you already signed in, refresh this Plaud tab. If it still waits, click any recording or note so Plaud makes an authenticated request. Keep this tab open until CallVault confirms the connection.",
      );
    }, HELPER_DELAY_MS);
  }

  function readCredentials() {
    if (window.location.pathname === "/login") {
      return null;
    }

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
        window.location.pathname === "/login" ? "Waiting for Plaud sign-in" : "Waiting for Plaud to load",
        window.location.pathname === "/login"
          ? "Sign in on this Plaud page. CallVault will continue automatically after Plaud opens your account."
          : "CallVault is waiting for Plaud to load your recordings or notes. If nothing happens, refresh this Plaud tab.",
      );
      scheduleHelperStatus();
      return;
    }

    updateStatus(
      "waiting",
      "Possible Plaud session found",
      "CallVault found browser session data and is waiting for Plaud Web to make an authenticated API request before it saves the connection.",
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
        "waiting",
        "Session data sent to bridge",
        "Keep this tab open until CallVault confirms the Plaud connection. If you are not signed in, finish signing in first.",
      );
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === STATUS_TYPE) {
      updateStatus(
        message.tone || "waiting",
        message.title || "CallVault Plaud Connector",
        message.message || "The extension is active on Plaud Web.",
        message.accessToken,
      );
      if (message.tone !== "captured" && message.tone !== "error") {
        scheduleHelperStatus();
      }
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
    "Sign in to Plaud if prompted. CallVault will continue automatically after Plaud loads your account.",
  );
  scheduleHelperStatus();
  window.addEventListener("storage", reportCredentials);
  window.setInterval(() => {
    if (window.location.pathname === lastPath) return;
    lastPath = window.location.pathname;
    reportCredentials();
  }, 1000);
  reportCredentials();
  window.setTimeout(reportCredentials, 1500);
  window.setTimeout(reportCredentials, 5000);
})();
