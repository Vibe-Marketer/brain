(function credentialUtilsFactory(root) {
  "use strict";

  const ALLOWED_API_BASES = [
    "https://api.plaud.ai",
    "https://api-euc1.plaud.ai",
    "https://api-apse1.plaud.ai",
  ];

  const API_BASE_PATTERN = /https:\/\/(?:api|api-euc1|api-apse1)\.plaud\.ai(?=\/|["'\s]|$)/i;
  const BEARER_PATTERN = /(?:^|\s)Bearer\s+([A-Za-z0-9._~+/-]{20,}={0,2})(?=$|[\s"',;})\]])/i;
  const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
  const MAX_DEPTH = 6;

  function normalizeApiBase(value) {
    if (typeof value !== "string") return null;
    const match = value.match(API_BASE_PATTERN);
    if (!match) return null;

    try {
      const origin = new URL(match[0]).origin;
      return ALLOWED_API_BASES.includes(origin) ? origin : null;
    } catch (_error) {
      return null;
    }
  }

  function extractBearerToken(value) {
    if (typeof value !== "string") return null;
    const match = value.match(BEARER_PATTERN);
    return match ? cleanToken(match[1]) : null;
  }

  function cleanToken(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
    return looksLikeToken(trimmed) ? trimmed : null;
  }

  function looksLikeToken(value) {
    return (
      typeof value === "string" &&
      value.length >= 20 &&
      value.length <= 8192 &&
      !/\s/.test(value) &&
      !/^https?:\/\//i.test(value) &&
      !/^(null|undefined|false|true)$/i.test(value)
    );
  }

  function isAccessTokenKey(keyPath) {
    const key = String(keyPath || "").toLowerCase();
    if (/(refresh|csrf|xsrf|sessionid|device|email|user|tenant)/.test(key)) return false;
    return /(access[_-]?token|auth[_-]?token|authorization|bearer|token)$/.test(key);
  }

  function tryParseJson(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || !/^[{[]/.test(trimmed)) return null;

    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      return null;
    }
  }

  function inspectValue(value, keyPath, depth) {
    if (depth > MAX_DEPTH || value == null) {
      return { accessToken: null, apiBase: null };
    }

    if (typeof value === "string") {
      const parsed = tryParseJson(value);
      if (parsed) return inspectValue(parsed, keyPath, depth + 1);

      const apiBase = normalizeApiBase(value);
      const bearerToken = extractBearerToken(value);
      const jwtToken = value.match(JWT_PATTERN)?.[0] || null;
      const keyedToken = isAccessTokenKey(keyPath) ? cleanToken(value) : null;

      return {
        accessToken: bearerToken || keyedToken || jwtToken,
        apiBase,
      };
    }

    if (typeof value !== "object") {
      return { accessToken: null, apiBase: null };
    }

    let accessToken = null;
    let apiBase = null;
    const entries = Array.isArray(value)
      ? value.map((item, index) => [String(index), item])
      : Object.entries(value);

    entries.sort(([leftKey], [rightKey]) => tokenKeyScore(rightKey) - tokenKeyScore(leftKey));

    for (const [key, child] of entries) {
      const childResult = inspectValue(child, keyPath ? `${keyPath}.${key}` : key, depth + 1);
      accessToken ||= childResult.accessToken;
      apiBase ||= childResult.apiBase;
      if (accessToken && apiBase) break;
    }

    return { accessToken, apiBase };
  }

  function tokenKeyScore(key) {
    const normalized = String(key || "").toLowerCase();
    if (/access[_-]?token/.test(normalized)) return 3;
    if (/authorization|bearer/.test(normalized)) return 2;
    if (/token/.test(normalized)) return 1;
    return 0;
  }

  function localStorageEntries(storage) {
    if (!storage) return [];

    const entries = [];
    if (typeof storage.length === "number" && typeof storage.key === "function") {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (typeof key === "string") {
          entries.push([key, storage.getItem(key)]);
        }
      }
      return entries;
    }

    return Object.entries(storage);
  }

  function scanLocalStorage(storage) {
    let accessToken = null;
    let apiBase = null;

    for (const [key, value] of localStorageEntries(storage)) {
      const result = inspectValue(value, key, 0);
      accessToken ||= result.accessToken;
      apiBase ||= result.apiBase;
      if (accessToken && apiBase) break;
    }

    return accessToken ? { accessToken, apiBase } : null;
  }

  const api = {
    ALLOWED_API_BASES,
    extractBearerToken,
    normalizeApiBase,
    scanLocalStorage,
  };

  root.CallVaultPlaudCredentialUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
