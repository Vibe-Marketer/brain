importScripts("credential-utils.js");

const PLAUD_WEB_URL = "https://web.plaud.ai";
const PLAUD_WEB_MATCH = "https://web.plaud.ai/*";
const DEFAULT_API_BASE = "https://api.plaud.ai";
const DEFAULT_TIMEOUT_MS = 120000;
const STORAGE_KEY = "callvaultPlaudCredential";
const STATUS_TYPE = "CALLVAULT_PLAUD_CAPTURE_STATUS";
const REQUEST_HEADER_URLS = [
  "https://api.plaud.ai/*",
  "https://api-euc1.plaud.ai/*",
  "https://api-apse1.plaud.ai/*",
];

let memoryCredential = null;

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const authorization = details.requestHeaders?.find((header) => header.name.toLowerCase() === "authorization")?.value;
    const accessToken = globalThis.CallVaultPlaudCredentialUtils.extractBearerToken(authorization);
    const apiBase = globalThis.CallVaultPlaudCredentialUtils.normalizeApiBase(details.url);

    if (accessToken && apiBase && isPlaudUserTokenRequest(details.url)) {
      void saveCredential(
        { accessToken, apiBase, source: "authorization-header" },
        details.tabId,
      );
    }
  },
  { urls: REQUEST_HEADER_URLS },
  ["requestHeaders", "extraHeaders"],
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CALLVAULT_PLAUD_CONNECT") {
    handleConnect(message.options || {}, sender.tab?.id)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: { message: error.message } }));
    return true;
  }

  if (message?.type === "CALLVAULT_PLAUD_LOCAL_CREDENTIAL") {
    const credentials = normalizeCredential(message.credentials, "local-storage");
    if (credentials && sender.tab?.url?.startsWith(PLAUD_WEB_URL)) {
      void saveCredential(credentials);
      sendResponse({ ok: true });
      return true;
    }

    sendResponse({ ok: false });
    return false;
  }

  return false;
});

async function handleConnect(options, returnTabId) {
  const timeoutMs = clampTimeout(options.timeoutMs);
  const deadline = Date.now() + timeoutMs;
  await clearStoredCredential();
  const tab = await openOrFocusPlaudTab();

  await injectPlaudCollector(tab.id);
  await postPlaudStatus(
    tab.id,
    "waiting",
    "CallVault bridge connected",
    "Sign in to Plaud if prompted. After login, CallVault will wait for Plaud to load your recordings and then return you automatically.",
  );

  const helperStatusTimer = setTimeout(() => {
    void getStoredCredential().then((credential) => {
      if (credential?.source === "authorization-header") return;
      return postPlaudStatus(
        tab.id,
        "waiting",
        "Waiting for Plaud activity",
        "If you are already signed in, refresh Plaud. If it still waits, click any recording or note so Plaud makes the authenticated request CallVault needs.",
      );
    });
  }, 3000);

  try {
    while (Date.now() < deadline) {
      const storedCredential = await getStoredCredential();
      if (storedCredential) {
        if (!storedCredential.accountEmail) {
          const scannedCredential = await scanPlaudTab(tab.id);
          if (scannedCredential?.accountEmail) {
            await saveCredential({
              ...storedCredential,
              accountEmail: scannedCredential.accountEmail,
            }, tab.id);
          }
        }
        const enrichedCredential = await getStoredCredential();
        await postPlaudStatus(
          tab.id,
          "captured",
          "Plaud token ready",
          "The extension has a Plaud token and is returning you to CallVault. You can close this Plaud tab when finished.",
        );
        await returnToCallVault(returnTabId, tab.id);
        return publicCredential(enrichedCredential ?? storedCredential);
      }

      const scannedCredential = await scanPlaudTab(tab.id);
      if (scannedCredential) {
        await saveCredential(scannedCredential, tab.id);
      }

      await delay(1000);
    }

    throw new Error("Open Plaud Web, sign in, then refresh or click any recording so Plaud loads authenticated account data before trying again.");
  } finally {
    clearTimeout(helperStatusTimer);
  }
}

async function returnToCallVault(returnTabId, plaudTabId) {
  if (!Number.isInteger(returnTabId) || returnTabId < 0) return;

  await postPlaudStatus(
    plaudTabId,
    "captured",
    "Returning to CallVault",
    "The Plaud token was captured. This tab can stay open or be closed after CallVault confirms the connection.",
  );
  await delay(900);

  try {
    const returnTab = await chrome.tabs.get(returnTabId);
    if (returnTab.windowId) {
      await chrome.windows.update(returnTab.windowId, { focused: true }).catch(() => undefined);
    }
    await chrome.tabs.update(returnTabId, { active: true });
  } catch (_error) {
    // If the original CallVault tab was closed, leave the user on Plaud with
    // the visible status panel explaining that the token was captured.
  }
}

function clampTimeout(value) {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.max(10000, Math.min(Number(value), 300000));
}

async function openOrFocusPlaudTab() {
  const [existingTab] = await chrome.tabs.query({ url: PLAUD_WEB_MATCH });

  if (existingTab?.id) {
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => undefined);
    }
    return chrome.tabs.update(existingTab.id, { active: true });
  }

  return chrome.tabs.create({ url: PLAUD_WEB_URL, active: true });
}

async function injectPlaudCollector(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/credential-utils.js", "src/plaud-content.js"],
    });
  } catch (_error) {
    // A just-created tab may still be navigating. Manifest content scripts will
    // run on load, and the polling loop can still observe request headers.
  }
}

async function scanPlaudTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "CALLVAULT_PLAUD_SCAN_LOCAL_STORAGE",
    });
    return normalizeCredential(response?.credentials, "local-storage");
  } catch (_error) {
    await injectPlaudCollector(tabId);
    return null;
  }
}

function normalizeCredential(value, source) {
  if (!value || typeof value !== "object") return null;

  const accessToken = typeof value.accessToken === "string" ? value.accessToken.trim() : null;
  const apiBase = globalThis.CallVaultPlaudCredentialUtils.normalizeApiBase(value.apiBase || "") || DEFAULT_API_BASE;
  const accountEmail = normalizeEmail(value.accountEmail);

  if (!accessToken || /\s/.test(accessToken) || accessToken.length < 20) return null;

  return {
    accessToken,
    apiBase,
    accountEmail,
    source,
    capturedAt: new Date().toISOString(),
  };
}

function isPlaudUserTokenRequest(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return [
      "/user/me",
      "/device/list",
      "/team-app/workspaces/list",
      "/user-app/auth/workspace/token/",
    ].some((path) => url.pathname === path || url.pathname.startsWith(path));
  } catch (_error) {
    return false;
  }
}

async function saveCredential(credential, tabId) {
  const normalized = normalizeCredential(credential, credential.source || "unknown");
  if (!normalized) return;

  if (!normalized.accountEmail && memoryCredential?.accountEmail) {
    normalized.accountEmail = memoryCredential.accountEmail;
  }
  memoryCredential = normalized;

  try {
    if (chrome.storage.session) {
      await chrome.storage.session.set({ [STORAGE_KEY]: normalized });
    }
  } catch (_error) {
    // Session storage can be unavailable in older Chromium variants. The worker
    // memory cache still serves the current connection attempt.
  }

  if (Number.isInteger(tabId) && tabId >= 0) {
    if (normalized.source === "authorization-header") {
      await postPlaudStatus(
        tabId,
        "captured",
        "Plaud API token captured",
        "The extension found Plaud's authenticated API request and is sending the token back to CallVault.",
      );
    } else {
      await postPlaudStatus(
        tabId,
        "waiting",
        "Possible Plaud session found",
        "CallVault found browser session data and is waiting for Plaud Web to make an authenticated API request before saving the connection.",
      );
    }
  }
}

async function getStoredCredential() {
  if (memoryCredential) return memoryCredential;

  try {
    if (chrome.storage.session) {
      const stored = await chrome.storage.session.get(STORAGE_KEY);
      return normalizeCredential(stored[STORAGE_KEY], stored[STORAGE_KEY]?.source || "session-storage");
    }
  } catch (_error) {
    return null;
  }

  return null;
}

async function clearStoredCredential() {
  memoryCredential = null;

  try {
    if (chrome.storage.session) {
      await chrome.storage.session.remove(STORAGE_KEY);
    }
  } catch (_error) {
    // Ignore storage cleanup failures; the in-memory credential was already
    // cleared for the new connection attempt.
  }
}

function publicCredential(credential) {
  return {
    accessToken: credential.accessToken,
    apiBase: credential.apiBase,
    accountEmail: credential.accountEmail || null,
  };
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postPlaudStatus(tabId, tone, title, message) {
  if (!Number.isInteger(tabId) || tabId < 0) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: STATUS_TYPE,
      tone,
      title,
      message,
    });
  } catch (_error) {
    await injectPlaudCollector(tabId);
  }
}
