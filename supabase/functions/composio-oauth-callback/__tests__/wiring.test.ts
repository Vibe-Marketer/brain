import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, "../index.ts"), "utf8");

describe("composio-oauth-callback wiring — auth + config (H2, H5)", () => {
  it("returns 503 when COMPOSIO_API_KEY is missing", () => {
    expect(source).toMatch(/COMPOSIO_API_KEY not configured/);
    expect(source).toMatch(/503/);
  });

  it("rejects requests without a Supabase JWT (both actions are frontend-mediated)", () => {
    expect(source).toMatch(/No authorization header/);
    expect(source).toMatch(/401/);
    expect(source).toMatch(/supabase\.auth\.getUser\(/);
  });

  it("surfaces only ComposioApiError.userMessage to clients (H5)", () => {
    expect(source).toMatch(/ComposioApiError/);
    expect(source).toMatch(/error\.userMessage/);
  });
});

describe("composio-oauth-callback wiring — initiate", () => {
  it("requires toolkit for initiate", () => {
    expect(source).toMatch(/toolkit is required for initiate/);
  });

  it("calls composio.initiateOAuth(toolkit, callbackUrl, user.id)", () => {
    expect(source).toMatch(/composio\.initiateOAuth\(/);
  });
});

describe("composio-oauth-callback wiring — complete (C1, C2, C3, M10)", () => {
  it("requires connectedAccountId and toolkit for complete", () => {
    expect(source).toMatch(
      /connectedAccountId and toolkit are required for complete/,
    );
  });

  it("validates source_app slug matches lowercase-kebab-case (M10)", () => {
    expect(source).toMatch(/lowercase-kebab-case required/);
  });

  it("refuses to persist when Composio account status is not ACTIVE", () => {
    expect(source).toMatch(/status is \$\{account\.status\}/);
    expect(source).toMatch(/422/);
  });

  it("writes composio_connected_account_id as a TOP-LEVEL column (NOT a JSONB key)", () => {
    // Regression guard for C2/C3: the dedicated column drives both the
    // upsert conflict target and the webhook lookup.
    expect(source).toMatch(
      /composio_connected_account_id:\s*body\.connectedAccountId/,
    );
  });

  it("upserts onConflict=composio_connected_account_id (NOT user_id,source_app)", () => {
    // The (user_id, source_app) UNIQUE was dropped to enable multi-account.
    expect(source).toMatch(
      /onConflict:\s*["']composio_connected_account_id["']/,
    );
    expect(source).not.toMatch(/onConflict:\s*["']user_id,source_app["']/);
  });

  it("does not blow away connection_metadata sibling fields (C2)", () => {
    // The merge-or-replace concern is resolved by moving the routing field
    // out of JSONB and onto the typed column. Guard: the upsert must NOT
    // include composio_connected_account_id inside connection_metadata.
    const completeBlock = source.split('body.action === "complete"')[1] ?? "";
    expect(completeBlock).not.toMatch(
      /connection_metadata:[^}]*composio_connected_account_id/,
    );
  });
});
