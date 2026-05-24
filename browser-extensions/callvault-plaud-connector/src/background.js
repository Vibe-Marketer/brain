importScripts("credential-utils.js");

const PLAUD_WEB_URL = "https://web.plaud.ai";
const PLAUD_WEB_MATCH = "https://web.plaud.ai/*";
const DEFAULT_API_BASE = "https://api.plaud.ai";
const DEFAULT_TIMEOUT_MS = 120000;
const STORAGE_KEY = "callvaultPlaudCredential";
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

    if (accessToken && apiBase) {
      void saveCredential({ accessToken, apiBase, source: "authorization-header" });
    }
  },
  { urls: REQUEST_HEADER_URLS },
  ["requestHeaders", "extraHeaders"],
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CALLVAULT_PLAUD_CONNECT") {
    handleConnect(message.options || {})
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

async function handleConnect(options) {
  const timeoutMs = clampTimeout(options.timeoutMs);
  const deadline = Date.now() + timeoutMs;
  const tab = await openOrFocusPlaudTab();

  await injectPlaudCollector(tab.id);

  while (Date.now() < deadline) {
    const scannedCredential = await scanPlaudTab(tab.id);
    if (scannedCredential) {
      await saveCredential(scannedCredential);
      return publicCredential(scannedCredential);
    }

    const storedCredential = await getStoredCredential();
    if (storedCredential) return publicCredential(storedCredential);

    await delay(1000);
  }

  throw new Error("Open Plaud Web, sign in, and let the page finish loading before trying again.");
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

  if (!accessToken || /\s/.test(accessToken) || accessToken.length < 20) return null;

  return {
    accessToken,
    apiBase,
    source,
    capturedAt: new Date().toISOString(),
  };
}

async function saveCredential(credential) {
  const normalized = normalizeCredential(credential, credential.source || "unknown");
  if (!normalized) return;

  memoryCredential = normalized;

  try {
    if (chrome.storage.session) {
      await chrome.storage.session.set({ [STORAGE_KEY]: normalized });
    }
  } catch (_error) {
    // Session storage can be unavailable in older Chromium variants. The worker
    // memory cache still serves the current connection attempt.
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

function publicCredential(credential) {
  return {
    accessToken: credential.accessToken,
    apiBase: credential.apiBase,
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
