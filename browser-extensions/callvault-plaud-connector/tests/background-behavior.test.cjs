const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "../src/background.js"), "utf8");

assert.match(
  source,
  /storedCredential\?\.source === "authorization-header"/,
  "handleConnect must not return local-storage-only Plaud credentials",
);
assert.doesNotMatch(
  source,
  /if\s*\(\s*storedCredential\s*\)\s*\{/,
  "local-storage Plaud credentials can be stale and must not complete Connect Plaud",
);

console.log("background behavior tests passed");
