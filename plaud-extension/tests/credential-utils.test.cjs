const assert = require("node:assert/strict");
const {
  extractBearerToken,
  normalizeApiBase,
  scanLocalStorage,
} = require("../src/credential-utils.js");

function makeStorage(entries) {
  const pairs = Object.entries(entries);
  return {
    length: pairs.length,
    key(index) {
      return pairs[index]?.[0] || null;
    },
    getItem(key) {
      return entries[key] ?? null;
    },
  };
}

const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGF1ZC11c2VyIn0.sUQwR2L6d8oOJWeOJQeZcm5f4gGx0eajkq7lWdq2d8Q";
const opaque = "pld_access_token_abcdefghijklmnopqrstuvwxyz1234567890";

assert.equal(extractBearerToken(`Bearer ${opaque}`), opaque);
assert.equal(normalizeApiBase("https://api-euc1.plaud.ai/v1/list"), "https://api-euc1.plaud.ai");
assert.equal(normalizeApiBase("https://example.com"), null);

assert.deepEqual(
  scanLocalStorage(makeStorage({
    "plaud-auth": JSON.stringify({
      auth: {
        accessToken: jwt,
      },
      config: {
        apiBase: "https://api-apse1.plaud.ai/api",
      },
    }),
  })),
  {
    accessToken: jwt,
    apiBase: "https://api-apse1.plaud.ai",
  },
);

assert.deepEqual(
  scanLocalStorage(makeStorage({
    misc: "no token here",
    headers: JSON.stringify({
      Authorization: `Bearer ${opaque}`,
      endpoint: "https://api.plaud.ai/api/user",
    }),
  })),
  {
    accessToken: opaque,
    apiBase: "https://api.plaud.ai",
  },
);

assert.equal(scanLocalStorage(makeStorage({ refreshToken: "short" })), null);

console.log("credential-utils tests passed");
