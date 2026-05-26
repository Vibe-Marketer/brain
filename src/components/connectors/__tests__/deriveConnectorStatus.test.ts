/**
 * Unit tests for deriveConnectorStatus.
 *
 * Pure function — no Supabase, no React. The whole point of factoring out
 * the derive function is so we can exhaustively test the divergence cases
 * that bit us today (issue #283 background).
 */

import { describe, expect, it } from "vitest";
import { deriveConnectorStatus } from "../hooks/useConnector";
import type { ConnectorRow } from "../registry/types";

const NOW = 1_780_000_000_000; // ~2026-05-29 UTC, used as the deterministic clock

function row(overrides: Partial<ConnectorRow> = {}): ConnectorRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    source_app: "fathom",
    is_active: true,
    account_email: "user@example.com",
    last_sync_at: null,
    error_message: null,
    oauth_token_expires: NOW + 60 * 60 * 1000, // 1h from NOW
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-23T00:00:00Z",
    ...overrides,
  };
}

describe("deriveConnectorStatus — Fathom", () => {
  it("active row with future-expiry token → connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [row()],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(true);
    expect(status.tokenExpired).toBe(false);
    expect(status.sourceId).toBe("11111111-1111-1111-1111-111111111111");
    expect(status.accountEmail).toBe("user@example.com");
  });

  it("active row with EXPIRED token but legacy fathom_api_key set → still connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [row({ oauth_token_expires: NOW - 60_000, is_active: true })],
      userSettings: {
        fathom_api_key: "key_abc",
        oauth_token_expires: null,
        zoom_oauth_token_expires: null,
      },
      now: NOW,
    });

    expect(status.connected).toBe(true);
    expect(status.tokenExpired).toBe(true);
  });

  it("no rows + no legacy → not connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [],
      userSettings: {
        fathom_api_key: null,
        oauth_token_expires: null,
        zoom_oauth_token_expires: null,
      },
      now: NOW,
    });

    expect(status.connected).toBe(false);
    expect(status.hasEverConnected).toBe(false);
    expect(status.sourceId).toBeNull();
  });

  it("empty pending row (failed OAuth) + no other rows → not connected", () => {
    // The stuck-row pattern from today's incident: fathom-oauth-url created
    // a row but the callback failed, leaving is_active=false + token nulls.
    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [
        row({
          is_active: false,
          oauth_token_expires: null,
          account_email: null,
        }),
      ],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(false);
    expect(status.hasEverConnected).toBe(true);
  });

  it("error_message on a row surfaces as errorMessage", () => {
    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [row({ error_message: "OAuth refresh failed" })],
      userSettings: null,
      now: NOW,
    });

    expect(status.errorMessage).toBe("OAuth refresh failed");
  });
});

describe("deriveConnectorStatus — Zoom legacy path", () => {
  it("no import_sources row but zoom_oauth_token_expires is future → connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "zoom",
      rows: [],
      userSettings: {
        fathom_api_key: null,
        oauth_token_expires: null,
        zoom_oauth_token_expires: NOW + 60_000,
      },
      now: NOW,
    });

    expect(status.connected).toBe(true);
  });

  it("zoom_oauth_token_expires in the past → not connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "zoom",
      rows: [],
      userSettings: {
        fathom_api_key: null,
        oauth_token_expires: null,
        zoom_oauth_token_expires: NOW - 60_000,
      },
      now: NOW,
    });

    expect(status.connected).toBe(false);
  });
});

describe("deriveConnectorStatus — refreshable OAuth import sources", () => {
  it("keeps Read.ai connected when only the short-lived access token is expired", () => {
    const status = deriveConnectorStatus({
      sourceApp: "read-ai",
      rows: [
        row({
          source_app: "read-ai",
          oauth_token_expires: NOW - 60_000,
          is_active: true,
        }),
      ],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(true);
    expect(status.tokenExpired).toBe(true);
  });

  it("keeps Grain connected when only the short-lived access token is expired", () => {
    const status = deriveConnectorStatus({
      sourceApp: "grain",
      rows: [
        row({
          source_app: "grain",
          oauth_token_expires: NOW - 60_000,
          is_active: true,
        }),
      ],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(true);
    expect(status.tokenExpired).toBe(true);
  });
});

describe("deriveConnectorStatus — always-available sources", () => {
  it("youtube uses public-url auth metadata → always connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "youtube",
      rows: [],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(true);
    expect(status.hasEverConnected).toBe(true);
  });

  it("file-upload uses no-auth metadata → always connected", () => {
    const status = deriveConnectorStatus({
      sourceApp: "file-upload",
      rows: [],
      userSettings: null,
      now: NOW,
    });

    expect(status.connected).toBe(true);
  });
});

describe("deriveConnectorStatus — multi-account Fathom", () => {
  it("first row in array is the 'primary' (caller orders by updated_at DESC)", () => {
    const newer = row({
      id: "33333333-3333-3333-3333-333333333333",
      account_email: "newer@example.com",
      updated_at: "2026-05-22T22:46:50Z",
    });
    const older = row({
      id: "44444444-4444-4444-4444-444444444444",
      account_email: "older@example.com",
      updated_at: "2026-04-17T20:10:52Z",
    });

    const status = deriveConnectorStatus({
      sourceApp: "fathom",
      rows: [newer, older],
      userSettings: null,
      now: NOW,
    });

    expect(status.sourceId).toBe("33333333-3333-3333-3333-333333333333");
    expect(status.accountEmail).toBe("newer@example.com");
    expect(status.allRows).toHaveLength(2);
  });
});
